/**
 * plaid-sync
 *
 * Fetches live balances and transactions from Plaid, then auto-populates:
 *   - net_worth_snapshots  (current month, upserted)
 *   - monthly_cash_flow    (current month, upserted)
 *   - financial_profiles   (Coach snapshot fields)
 *
 * Uses transactions/sync (incremental cursor) so subsequent calls only
 * process new/modified transactions rather than re-fetching everything.
 *
 * POST body: {} (no body needed — user identified via Bearer token)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, corsError, CORS_HEADERS } from "../_shared/cors.ts";

const PLAID_ENV  = Deno.env.get("PLAID_ENV") ?? "production";
const PLAID_BASE = {
  sandbox:    "https://sandbox.plaid.com",
  development:"https://development.plaid.com",
  production: "https://production.plaid.com",
}[PLAID_ENV] ?? "https://production.plaid.com";

class PlaidApiError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly requestId: string | null,
    readonly status: number,
  ) {
    super(message);
    this.name = "PlaidApiError";
  }
}

async function plaidPost(endpoint: string, body: object, accessToken: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${PLAID_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PLAID-CLIENT-ID": Deno.env.get("PLAID_CLIENT_ID")!,
      "PLAID-SECRET":    Deno.env.get("PLAID_SECRET")!,
    },
    body: JSON.stringify({ access_token: accessToken, ...body }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new PlaidApiError(
      typeof err.error_message === "string" ? err.error_message : `Plaid ${endpoint} returned ${res.status}`,
      typeof err.error_code === "string" ? err.error_code : null,
      typeof err.request_id === "string" ? err.request_id : null,
      res.status,
    );
  }
  return res.json();
}

// ── Category mapping ──────────────────────────────────────────────────────────
// Uses Plaid's personal_finance_category.detailed first (most specific),
// then falls back to .primary, then to legacy category[0].
//
// Key corrections vs naive primary-only mapping:
//   GENERAL_SERVICES  → only GENERAL_SERVICES_SUBSCRIPTION maps to 'subscriptions'.
//                        Everything else (insurance, home services, professional) → 'other_expenses'.
//   SHOPPING          → 'other_expenses' not 'clothing' (Amazon/Target aren't clothing stores).
//   ENTERTAINMENT     → covers streaming, concerts, sports, gaming — genuinely entertainment.

type ExpenseKey = 'housing' | 'food' | 'transport' | 'healthcare' | 'entertainment' |
  'subscriptions' | 'clothing' | 'education' | 'travel' | 'other_expenses';

// Detailed subcategory map — checked before primary (more specific)
const PFC_DETAIL_MAP: Record<string, ExpenseKey | 'income' | 'ignore'> = {
  // Only true subscriptions from GENERAL_SERVICES
  GENERAL_SERVICES_SUBSCRIPTION:                    'subscriptions',
  // Streaming lives under ENTERTAINMENT in Plaid's detailed taxonomy
  ENTERTAINMENT_TV_AND_MOVIES:                      'subscriptions',
  ENTERTAINMENT_MUSIC_AND_AUDIO:                    'subscriptions',
  // Clothing-specific shopping subcategories
  SHOPPING_CLOTHING_AND_ACCESSORIES:                'clothing',
  // Transport subcategories — gas stations go to transport not travel
  TRANSPORTATION_GAS_AND_CONVENIENCE_STORES:        'transport',
  TRANSPORTATION_PUBLIC_TRANSIT:                    'transport',
  TRANSPORTATION_TAXIS_AND_RIDE_SHARING:            'transport',
  TRANSPORTATION_PARKING:                           'transport',
  // Rent + utilities clearly housing
  RENT_AND_UTILITIES_RENT:                          'housing',
  RENT_AND_UTILITIES_UTILITIES:                     'housing',
  RENT_AND_UTILITIES_INTERNET_AND_CABLE:            'housing',
  RENT_AND_UTILITIES_TELEPHONE:                     'housing',
  // Income subcategories
  INCOME_WAGES:                                     'income',
  INCOME_OTHER_INCOME:                              'income',
  INCOME_RETIREMENT_PENSION:                        'income',
  INCOME_UNEMPLOYMENT:                              'income',
  // Loan payments — not expenses
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT:                'ignore',
  LOAN_PAYMENTS_OTHER_PAYMENT:                      'ignore',
};

// Primary category map — used when no detailed match
const PFC_PRIMARY_MAP: Record<string, ExpenseKey | 'income' | 'ignore'> = {
  FOOD_AND_DRINK:             'food',
  TRAVEL:                     'travel',
  ENTERTAINMENT:              'entertainment',
  HEALTHCARE:                 'healthcare',
  PERSONAL_CARE:              'other_expenses',
  SHOPPING:                   'other_expenses',  // too broad to call 'clothing'
  TRANSPORTATION:             'transport',
  RENT_AND_UTILITIES:         'housing',
  HOME_IMPROVEMENT:           'housing',
  EDUCATION:                  'education',
  LOAN_PAYMENTS:              'ignore',
  TRANSFER_OUT:               'ignore',
  TRANSFER_IN:                'ignore',
  INCOME:                     'income',
  GENERAL_MERCHANDISE:        'other_expenses',
  GENERAL_SERVICES:           'other_expenses',  // only .SUBSCRIPTION subtype → subscriptions
  GOVERNMENT_AND_NON_PROFIT:  'other_expenses',
  BANK_FEES:                  'other_expenses',
};

const LEGACY_MAP: Record<string, ExpenseKey | 'income' | 'ignore'> = {
  'Food and Drink':   'food',
  'Travel':           'travel',
  'Recreation':       'entertainment',
  'Entertainment':    'entertainment',
  'Healthcare':       'healthcare',
  'Medical':          'healthcare',
  'Shops':            'other_expenses',
  'Service':          'other_expenses',
  'Transportation':   'transport',
  'Community':        'housing',
  'Rent':             'housing',
  'Education':        'education',
  'Transfer':         'ignore',
  'Payment':          'ignore',
  'Payroll':          'income',
  'Deposit':          'income',
  'Interest':         'income',
};

function mapCategory(tx: Record<string, unknown>): ExpenseKey | 'income' | 'ignore' {
  const pfc     = tx.personal_finance_category as any;
  const detailed = pfc?.detailed as string | undefined;
  const primary  = pfc?.primary  as string | undefined;

  if (detailed && PFC_DETAIL_MAP[detailed] !== undefined) return PFC_DETAIL_MAP[detailed];
  if (primary  && PFC_PRIMARY_MAP[primary] !== undefined) return PFC_PRIMARY_MAP[primary];

  const legacy = ((tx.category as string[]) ?? [])[0] ?? '';
  return LEGACY_MAP[legacy] ?? 'other_expenses';
}


// ── Cash flow rebuild ────────────────────────────────────────────────────────

type CashFlowTotals = { primary_income: number; other_income: number } & Record<ExpenseKey, number>;

export function emptyCashFlowTotals(): CashFlowTotals {
  return {
    primary_income: 0, other_income: 0,
    housing: 0, food: 0, transport: 0, healthcare: 0, entertainment: 0,
    subscriptions: 0, clothing: 0, education: 0, travel: 0, other_expenses: 0,
  };
}

/** Above this, an incoming amount is treated as salary rather than incidental. */
const PRIMARY_INCOME_FLOOR = 500;

/**
 * Totals per 'YYYY-MM', rebuilt from every stored transaction.
 *
 * A null category_key is a transfer or a loan payment — mapCategory calls those
 * 'ignore'. They are skipped entirely rather than counted by sign, because
 * TRANSFER_IN carries a negative amount and the previous sign-based rule read
 * every incoming transfer as income, inflating both income and savings rate.
 *
 * Rows written before category_key stored 'income' have null there too and are
 * therefore skipped, which under-reports income until the repair migration or
 * the next full re-sync rewrites them. Under-reporting is the safer direction:
 * it will not tell someone they are doing better than they are.
 */
export async function rebuildCashFlows(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<Map<string, CashFlowTotals>> {
  const byMonth = new Map<string, CashFlowTotals>();
  const PAGE = 1000;

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("plaid_transactions")
      .select("date, amount, category_key")
      .eq("user_id", userId)
      .eq("pending", false)
      .order("date", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error("Cash flow rebuild failed");

    const rows = (data ?? []) as { date: string; amount: number; category_key: string | null }[];
    if (rows.length === 0) break;

    for (const tx of rows) {
      const month = (tx.date ?? "").slice(0, 7);
      if (month.length !== 7) continue;
      if (!byMonth.has(month)) byMonth.set(month, emptyCashFlowTotals());
      const row = byMonth.get(month)!;

      if (tx.category_key === "income") {
        const incoming = Math.abs(tx.amount);
        if (incoming > PRIMARY_INCOME_FLOOR) row.primary_income += incoming;
        else                                 row.other_income   += incoming;
      } else if (tx.category_key && tx.amount > 0) {
        if (tx.category_key in row) (row as Record<string, number>)[tx.category_key] += tx.amount;
        else row.other_expenses += tx.amount;
      }
    }

    if (rows.length < PAGE) break;
  }

  return byMonth;
}

// ── Account → balance sheet mapping ──────────────────────────────────────────

type AssetKey      = 'checking' | 'savings' | 'investments' | 'real_estate' | 'other_assets';
type LiabilityKey  = 'credit_cards' | 'student_loans' | 'mortgage' | 'car_loans' | 'other_liabilities';

function mapAccountToAsset(type: string, subtype: string): AssetKey | null {
  if (type === 'depository') {
    return (subtype === 'savings' || subtype === 'money market' || subtype === 'cd') ? 'savings' : 'checking';
  }
  if (type === 'investment') return 'investments';
  return null;
}

function mapAccountToLiability(type: string, subtype: string): LiabilityKey | null {
  if (type === 'credit') return 'credit_cards';
  if (type === 'loan') {
    if (subtype === 'student')   return 'student_loans';
    if (subtype === 'mortgage')  return 'mortgage';
    if (subtype === 'auto')      return 'car_loans';
    return 'other_liabilities';
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return corsError("Method not allowed", 405);

  // ── Auth ───────────────────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return corsError("Authentication required", 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    auth.replace("Bearer ", "")
  );
  if (authErr || !user) return corsError("Invalid or expired session", 401);

  // ── Load ALL connections for this user ────────────────────────────────────
  const { data: conns, error: connectionsError } = await supabase
    .from("plaid_connections")
    .select("item_id, sync_cursor")
    .eq("user_id", user.id)
    .order("last_synced_at", { ascending: true, nullsFirst: true }); // oldest first

  if (connectionsError) {
    console.error("plaid-sync: connection lookup failed", connectionsError);
    return corsError("We couldn't load your bank connections. Please try again.", 503);
  }

  if (!conns || conns.length === 0) {
    return corsError("No Plaid connection found. Connect a bank first.", 404);
  }

  // Fetch access tokens for all connections in parallel
  const secretResults = await Promise.all(
    conns.map(c =>
      supabase.from("plaid_secrets").select("item_id, access_token").eq("item_id", c.item_id).maybeSingle()
    )
  );

  if (secretResults.some(({ error }) => error)) {
    console.error("plaid-sync: one or more token lookups failed");
    return corsError("We couldn't access your bank connection securely. Please reconnect your bank.", 503);
  }

  // Pair connections with their access tokens, skip any with missing tokens
  const connWithTokens = conns
    .map((c, i) => ({ ...c, accessToken: (secretResults[i].data as any)?.access_token as string | undefined }))
    .filter(c => !!c.accessToken) as Array<{ item_id: string; sync_cursor: string | null; accessToken: string }>;

  if (connWithTokens.length === 0) {
    return corsError("No valid access tokens found — please reconnect your bank.", 500);
  }

  const now          = new Date();
  const snapshotMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthStr      = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Aggregate across all connections
  const assets:      Record<AssetKey,     number> = { checking: 0, savings: 0, investments: 0, real_estate: 0, other_assets: 0 };
  const liabilities: Record<LiabilityKey, number> = { credit_cards: 0, student_loans: 0, mortgage: 0, car_loans: 0, other_liabilities: 0 };
  const expenses:    Record<ExpenseKey,   number> = {
    housing: 0, food: 0, transport: 0, healthcare: 0, entertainment: 0,
    subscriptions: 0, clothing: 0, education: 0, travel: 0, other_expenses: 0,
  };
  let primaryIncome = 0;
  let otherIncome   = 0;
  let totalTxs      = 0;
  // Which liability kinds the user actually has linked. Without this a 0 is
  // ambiguous: it means both "paid off" and "no such account connected", and
  // writing the latter as 0 asserts a debt-free state nobody stated.
  const observedLiabilities = new Set<LiabilityKey>();

  // A directly linked Schwab account is the canonical investment source. Plaid
  // can continue providing bank transactions, but its balance for the same
  // account must be excluded or net worth counts the money twice.
  const { data: accountLinks, error: accountLinksError } = await supabase
    .from('financial_account_links')
    .select('plaid_item_id,plaid_account_id')
    .eq('user_id', user.id)
    .eq('include_in_plaid_net_worth', false);
  if (accountLinksError && accountLinksError.code !== '42P01') {
    throw new Error('Could not resolve financial account source precedence');
  }
  const schwabPrimaryPlaidAccounts = new Set(
    (accountLinks ?? []).map((link: any) => `${link.plaid_item_id}:${link.plaid_account_id}`),
  );

  try {
    // ── Process each connection ───────────────────────────────────────────────
    for (const conn of connWithTokens) {
      const { accessToken } = conn;

      // ── 1. Fetch live balances for this institution ───────────────────────
      const balancesData = await plaidPost("/accounts/balance/get", {}, accessToken);
      for (const acct of (balancesData.accounts as any[]) ?? []) {
        if (acct.type === 'investment' && schwabPrimaryPlaidAccounts.has(`${conn.item_id}:${acct.account_id}`)) {
          continue;
        }
        const balance      = Math.abs(acct.balances?.current ?? 0);
        const assetKey     = mapAccountToAsset(acct.type, acct.subtype);
        const liabilityKey = mapAccountToLiability(acct.type, acct.subtype);
        if (assetKey)     assets[assetKey]           += balance;
        else if (liabilityKey) {
          liabilities[liabilityKey] += balance;
          observedLiabilities.add(liabilityKey);
        }
      }

      // ── 2. Incremental transaction sync for this institution ──────────────
      const startingCursor = conn.sync_cursor ?? "";
      let cursor  = startingCursor;
      let hasMore = true;
      const addedTxs:    Record<string, unknown>[] = [];
      const modifiedTxs: Record<string, unknown>[] = [];
      const removedIds:  string[]                  = [];
      let mutationRestarts = 0;

      while (hasMore) {
        let syncData: Record<string, unknown>;
        try {
          syncData = await plaidPost("/transactions/sync", { cursor }, accessToken);
        } catch (error) {
          // Plaid requires the entire pagination sequence to restart when the
          // underlying transaction set mutates between pages.
          if (error instanceof PlaidApiError
              && error.code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"
              && mutationRestarts < 2) {
            mutationRestarts += 1;
            cursor = startingCursor;
            hasMore = true;
            addedTxs.length = 0;
            modifiedTxs.length = 0;
            removedIds.length = 0;
            continue;
          }
          throw error;
        }
        addedTxs.push(   ...((syncData.added    as any[]) ?? []));
        modifiedTxs.push(...((syncData.modified as any[]) ?? []));
        // Plaid sends removed as objects with transaction_id
        for (const r of (syncData.removed as any[]) ?? []) {
          if (r.transaction_id) removedIds.push(r.transaction_id);
        }
        cursor  = syncData.next_cursor as string;
        hasMore = syncData.has_more    as boolean;
      }

      // ── 3. Persist individual transactions before aggregation ─────────────
      // Upsert added + modified; delete removed.
      // We persist ALL dates (not just current month) so the insight engine
      // can detect recurring charges across multiple months.
      const allTxs = [...addedTxs, ...modifiedTxs];
      totalTxs    += allTxs.length;

      if (allTxs.length > 0) {
        const rows = allTxs.map((tx) => {
          const category = mapCategory(tx);
          const pfc      = tx.personal_finance_category as any;
          return {
            user_id:        user.id,
            item_id:        conn.item_id,
            account_id:     (tx.account_id as string) ?? "",
            transaction_id: tx.transaction_id as string,
            merchant_name:  (tx.merchant_name as string | null) ?? null,
            name:           (tx.name as string) ?? "",
            amount:         tx.amount as number,
            date:           tx.date as string,
            // 'income' is stored, not nulled. Nulling both income and 'ignore'
            // made them indistinguishable later, so every incoming transfer
            // read back as income when months were rebuilt from this table.
            category_key:   category === "ignore" ? null : category,
            // Store detailed subcategory for richer client-side analysis
            plaid_category: pfc?.detailed ?? pfc?.primary ?? null,
            pending:        (tx.pending as boolean) ?? false,
          };
        });

        // Batch in chunks of 200 to avoid request size limits
        for (let i = 0; i < rows.length; i += 200) {
          const { error: transactionWriteError } = await supabase.from("plaid_transactions").upsert(
            rows.slice(i, i + 200),
            { onConflict: "transaction_id" }
          );
          if (transactionWriteError) throw new Error("Transaction storage failed");
        }
      }

      // Delete transactions Plaid has removed (e.g. pending → posted deduplication)
      if (removedIds.length > 0) {
        const { error: transactionDeleteError } = await supabase.from("plaid_transactions")
          .delete()
          .in("transaction_id", removedIds);
        if (transactionDeleteError) throw new Error("Transaction reconciliation failed");
      }

      // Cash flow is no longer aggregated from this call's results. See step 7:
      // transactions/sync is incremental, so these are only what changed.

      // ── 5. Save updated cursor + last_synced_at for this item ────────────
      const { error: cursorWriteError } = await supabase.from("plaid_connections")
        .update({ sync_cursor: cursor, last_synced_at: now.toISOString() })
        .eq("item_id", conn.item_id)
        .eq("user_id", user.id);
      if (cursorWriteError) throw new Error("Connection checkpoint failed");
    }

    // ── 6. Write aggregated net worth snapshot (all banks combined) ───────────
    const { error: snapshotWriteError } = await supabase.from("net_worth_snapshots").upsert({
      user_id: user.id,
      snapshot_month: snapshotMonth,
      ...assets,
      ...liabilities,
    }, { onConflict: "user_id,snapshot_month" });
    if (snapshotWriteError) throw new Error("Net worth snapshot storage failed");

    // ── 7. Rebuild every month's cash flow from the durable transaction store ─
    //
    // transactions/sync is incremental: a repeat call returns only what changed.
    // This step used to aggregate that delta and upsert it as the month's total,
    // so the second sync of any month overwrote real figures with near-zero.
    // That is why the health score reported "no data" for cash runway, savings
    // rate, and expense control while the balance-derived components — which are
    // re-fetched in full every sync — kept working.
    //
    // plaid_transactions is the durable record, so recomputing from it is
    // idempotent and covers the current month and history by the same rule.
    const monthlyTotals = await rebuildCashFlows(supabase, user.id);

    const cashFlowRows = [...monthlyTotals.entries()].map(([month, totals]) => ({
      user_id:           user.id,
      flow_month:        `${month}-01`,
      side_income:       0,
      investment_income: 0,
      ...totals,
    }));
    for (let i = 0; i < cashFlowRows.length; i += 10) {
      const { error: cashFlowWriteError } = await supabase.from("monthly_cash_flow").upsert(
        cashFlowRows.slice(i, i + 10),
        { onConflict: "user_id,flow_month" }
      );
      if (cashFlowWriteError) throw new Error("Cash flow storage failed");
    }

    // The current month feeds the coach profile below.
    const current = monthlyTotals.get(monthStr) ?? emptyCashFlowTotals();
    primaryIncome = current.primary_income;
    otherIncome   = current.other_income;
    for (const key of Object.keys(expenses) as ExpenseKey[]) expenses[key] = current[key];

    // ── 9. Sync aggregated totals to financial_profiles for the Coach ─────────
    const totalIncome   = primaryIncome + otherIncome;
    const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);
    const liquidAssets  = assets.checking + assets.savings;

    // Only write what this sync actually established. Writing a zero for a month
    // with no transactions yet, or for an account type the user has not linked,
    // states a fact we do not have — and these columns drive roadmap milestone
    // completion, where a wrong zero reads as "this debt is paid off".
    const hasMonthData = totalIncome > 0 || totalExpenses > 0;
    const profileUpdate: Record<string, unknown> = {
      user_id:        user.id,
      liquid_savings: liquidAssets,
    };
    if (hasMonthData) {
      profileUpdate.monthly_take_home = totalIncome;
      profileUpdate.monthly_expenses  = totalExpenses;
      profileUpdate.snapshot_completed = true;
    }
    if (observedLiabilities.has('credit_cards'))  profileUpdate.high_interest_debt = liabilities.credit_cards;
    if (observedLiabilities.has('student_loans')) profileUpdate.low_interest_debt  = liabilities.student_loans;

    const { error: profileWriteError } = await supabase
      .from("financial_profiles")
      .upsert(profileUpdate, { onConflict: "user_id" });
    if (profileWriteError) throw new Error("Financial profile storage failed");

    return corsResponse({
      synced:                  true,
      institutions_synced:     connWithTokens.length,
      last_synced_at:          now.toISOString(),
      snapshot_month:          snapshotMonth,
      transactions_processed:  totalTxs,
      totals: {
        totalIncome,
        totalExpenses,
        netWorth: Object.values(assets).reduce((a, b) => a + b, 0) - Object.values(liabilities).reduce((a, b) => a + b, 0),
      },
    });

  } catch (err) {
    console.error("plaid-sync error:", err);
    if (err instanceof PlaidApiError) {
      if (err.code === "ITEM_LOGIN_REQUIRED" || err.code === "INVALID_ACCESS_TOKEN") {
        return corsError("Your bank connection needs attention. Reconnect the institution, then sync again.", 409);
      }
      if (err.code === "RATE_LIMIT_EXCEEDED") {
        return corsError("Your bank is receiving too many requests. Wait a moment and try syncing again.", 429);
      }
      if (err.status >= 500) {
        return corsError("Your bank or Plaid is temporarily unavailable. Please try again shortly.", 503);
      }
      return corsError("We couldn't sync this bank connection. Reconnect it and try again.", 422);
    }
    return corsError("We couldn't finish syncing your financial data. Your existing data is safe; please try again.", 500);
  }
});
