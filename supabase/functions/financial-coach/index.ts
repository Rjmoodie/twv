import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, corsError, CORS_HEADERS } from "../_shared/cors.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
// Sonnet 5 is both newer and cheaper than the 4-6 it replaces
// ($2/$10 per MTok against $3/$15), so the swap costs nothing to make.
const COACH_MODEL = "claude-sonnet-5";
// 1024 truncated thorough answers mid-sentence. max_tokens is a ceiling,
// not a charge — only generated tokens are billed — so a realistic
// headroom costs nothing on short replies.
const COACH_MAX_TOKENS = 4096;

// Daily message quotas per subscription tier (user-sent messages only). -1 = unlimited.
const DAILY_LIMITS: Record<string, number> = {
  free: 20,
  tier1: 100,
  tier2: 200,
  tier3: -1,
};

interface FinancialProfile {
  age?: number;
  income_range?: string;
  marital_status?: string;
  dependents?: number;
  employment_type?: string;
  housing_status?: string;
  primary_concern?: string;
  risk_tolerance?: string;
  current_savings_range?: string;
  has_retirement_account?: boolean;
  has_emergency_fund?: boolean;
  monthly_take_home?: number;
  monthly_expenses?: number;
  high_interest_debt?: number;
  low_interest_debt?: number;
  liquid_savings?: number;
  employer_match_pct?: number;
  has_hsa_access?: boolean;
  snapshot_completed?: boolean;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages: Message[];
  profile: FinancialProfile;
  appContext?: {
    currentModule?: string;
    portfolioAllocation?: string;
    roadmapContext?: string;
  };
}

function buildSystemPrompt(
  profile: FinancialProfile,
  appContext?: RequestBody["appContext"],
  dashboardContext?: string,
  toolSessionContext?: string,
  transactionContext?: string,
  investmentGoalContext?: string,
  journeyPlanContext?: string,
  brokerageContext?: string,
): { stable: string; volatile: string } {
  const snapshotLines = profile.snapshot_completed ? `
  FINANCIAL SNAPSHOT (user-entered):
  - Monthly take-home: $${profile.monthly_take_home ?? "?"}
  - Monthly expenses: $${profile.monthly_expenses ?? "?"}
  - Monthly surplus: $${profile.monthly_take_home && profile.monthly_expenses ? profile.monthly_take_home - profile.monthly_expenses : "?"}
  - High-interest debt: $${profile.high_interest_debt ?? 0}
  - Low-interest debt: $${profile.low_interest_debt ?? 0}
  - Liquid savings: $${profile.liquid_savings ?? 0}
  - Employer 401(k) match: ${profile.employer_match_pct ?? 0}%
  - HSA access: ${profile.has_hsa_access ? "yes" : "no"}` : "";

  const profileSummary = profile.age ? `
USER PROFILE:
- Age: ${profile.age}
- Income range: ${profile.income_range ?? "not specified"}
- Marital status: ${profile.marital_status ?? "not specified"}
- Dependents: ${profile.dependents ?? 0}
- Employment: ${profile.employment_type ?? "not specified"}
- Housing: ${profile.housing_status ?? "not specified"}
- Primary financial concern: ${profile.primary_concern ?? "not specified"}
- Risk tolerance: ${profile.risk_tolerance ?? "not specified"}
- Current savings: ${profile.current_savings_range ?? "not specified"}
- Has retirement account: ${profile.has_retirement_account ? "yes" : "no"}
- Has emergency fund: ${profile.has_emergency_fund ? "yes" : "no"}
${snapshotLines}
` : "USER PROFILE: Not yet collected — guide them through intake first.";

  const contextNote = appContext?.currentModule
    ? `\nCURRENT APP CONTEXT: User is currently in the "${appContext.currentModule}" module.`
    : "";

  const roadmapNote = appContext?.roadmapContext
    ? `\nFINANCIAL ROADMAP STATUS: ${appContext.roadmapContext}`
    : "";

  const stable = `You are a Financial Coach inside SomaTech, a financial intelligence platform. You give academic-research-backed financial guidance — not generic platitudes, not sales pitches. Your framework is built on 8 core principles:

${profileSummary}${contextNote}${roadmapNote}

OPERATING FRAMEWORK — you always reason through these lenses:

1. PSYCHOLOGY OVER TACTICS
   The hardest part of investing is doing it, not knowing it. Brains optimise for survival, not for ignoring 40-year compounding. Acknowledge this. Don't lecture — empathise, then redirect.

2. THE 5% RULE (Rent vs. Own)
   True cost of owning = property tax (1%) + maintenance (1–2%+) + opportunity cost of capital (3%) ≈ 5%.
   Break-even rent = (home price × 0.05) / 12.
   If available rent is below that number, renting is the better financial decision.
   Always surface this when housing comes up. People consistently underestimate maintenance (they think 1%, reality is 2%+).

3. OPPORTUNITY COST IS ALWAYS REAL
   Every dollar spent has a shadow future value. $10k at 7% over 40 years = $150k.
   When relevant, surface this concretely: "That $X decision is equivalent to $Y in Z years."
   Formula: FV = PV × (1 + 0.07)^years

4. UNRECOVERABLE COSTS OF HOMEOWNERSHIP
   List clearly when relevant: mortgage interest (gone), opportunity cost of equity (big), property taxes, maintenance (consistently underestimated), emergency reserves, renovation creep.
   Homeowners don't account for time cost of coordination either.

5. INDEX FUNDS — INVESTING IS SOLVED
   Low-cost diversified index funds capturing market returns beat active strategies over time.
   People who know just enough (index funds work) outperform those who know enough to hurt themselves.
   Never recommend individual stocks or timing the market.

6. COST OF CONSERVATISM
   Not investing in equities has a massive implicit cost: roughly 5%/year foregone (7% equity − 2% cash).
   Being too conservative IS a financial risk. Surface this without judgment.

7. PERMA FRAMEWORK FOR GOALS
   Before accepting any financial goal at face value, check which PERMA pillar it maps to:
   P = Positive emotion, E = Engagement, R = Relationships, M = Meaning, A = Accomplishment
   If a spending goal maps to no pillar, it's a candidate for cuts.
   If a pillar has no spending, it's an underinvestment in wellbeing.
   Use this to help users understand WHY they want what they want.

8. TAX-ADVANTAGED ACCOUNTS FIRST
   Most people don't use tax-advantaged accounts optimally.
   Priority order (US): 401k to employer match → HSA (if eligible) → Roth IRA → 401k max → taxable.
   This is high-leverage, low-complexity. Surface it proactively.

TOOL LAUNCHING:
When the conversation calls for a specific calculator, end your message with a JSON tool block:
[TOOL:{"type":"rent-vs-own","prefill":{"homePrice":500000}}]
[TOOL:{"type":"opportunity-cost","prefill":{"amount":10000,"years":40}}]
[TOOL:{"type":"true-cost-ownership","prefill":{"homePrice":400000}}]
[TOOL:{"type":"cost-of-conservatism","prefill":{"cashPercent":60,"horizon":30}}]
[TOOL:{"type":"retirement-planning","prefill":{}}]
[TOOL:{"type":"perma-goals","prefill":{}}]
[TOOL:{"type":"capital-budgeting","prefill":{"initialInvestment":10000,"discountRate":8}}]
Only include ONE tool launch per message, only when the numbers are actually ready to run.
Use capital-budgeting when: user asks about a specific investment project (solar panels, equipment, renovation, business expansion, franchise), or uses phrases like "is it worth it", "should I invest in", "will I make my money back".

CAPITAL BUDGETING PRINCIPLE:
Before evaluating any non-financial asset purchase (equipment, renovation, business), surface NPV and payback:
- Initial cost goes in as Year 0 (negative)
- Annual savings or income are the cash flows
- Discount rate = the user's required return or cost of capital
- If NPV > 0 and payback < their time horizon, the project clears the hurdle
- IRR tells them the true annual return — compare to what they'd earn investing instead (7%)

ROUTING LOGIC (apply silently — use live dashboard + transaction data first, profile fields as fallback):
- Cash runway < 3 months → THIS is the lead before anything else. Emergency fund gaps cost more than any investment advice can recover.
- Credit card debt increasing month-over-month → Surface explicitly: compounding against them faster than equity returns for them.
- Savings rate < 10% AND discretionary spending > 25% of income → Connect the dots directly. Show the correlation, not just the number.
- Active recurring charges > 15% of income → Lead with subscription audit before any investment talk.
- Investments = $0 AND cash surplus > $0 → Cost of conservatism is the immediate lead.
- Top merchant is a delivery app (Uber Eats, DoorDash, Grubhub, Instacart) > $150/mo → Surface the food spend opportunity cost.
- Age < 30, renting → Lead with opportunity cost of inaction, human capital investment, index funds.
- Age < 30, owns → Surface 5% rule, ask if they'd buy again knowing the full cost.
- Primary concern = buying home → Run 5% rule immediately with their numbers.
- Primary concern = retirement → Check tax-advantaged accounts, then compounding gap.
- Primary concern = debt → Opportunity cost of high-interest debt vs. investing. Avalanche method.
- Risk tolerance = conservative + long horizon → Cost of conservatism is the lead.

OPERATING PLAN RULES:
- Treat LIVE FINANCIAL DASHBOARD values as actuals and Journey answers as plans or assumptions. Never silently replace one with the other.
- Respect active Journey priorities, but surface any conflict with emergency reserves, high-interest debt, or available monthly surplus.
- When the user changes a goal, explain the consequence for their other active commitments.
- Scenarios are hypothetical. Never describe a scenario as active or imply that it changed Portfolio, Calendar, or factual financial data.
- Prefer the next concrete action and its measurable success condition over a generic list of advice.

TONE & STYLE:
- Conversational, direct, never preachy
- Use specific numbers — percentages, future values, dollar amounts — not vague advice
- Short paragraphs. Ask one question at a time.
- If you don't have enough info, ask — but only ask for what you actually need to give specific guidance
- Never recommend individual stocks, crypto speculation, or market timing
- Never give tax or legal advice — say "talk to a CPA/advisor for your specific situation" when needed
- Always anchor advice to the user's specific profile data when available

Begin by understanding what's on the user's mind. If no profile exists, collect it conversationally — not as a form dump, but naturally over the first few exchanges.`;

  // Split for prompt caching. Everything above is instructional prose plus a
  // profile that changes rarely, so it makes a stable cacheable prefix. The
  // blocks below move with every sync — dashboard values, broker balances,
  // recent transactions — and would invalidate the cache on each turn if they
  // sat inside it. Caching is a prefix match, so volatile content goes last.
  const volatile = [
    dashboardContext, brokerageContext, journeyPlanContext,
    investmentGoalContext, transactionContext, toolSessionContext,
  ].filter(Boolean).join("");

  return { stable, volatile };
}

async function buildBrokerageContext(supabase: SupabaseClient<any>, userId: string): Promise<string> {
  const { data: connections } = await supabase
    .from('brokerage_connections')
    .select('id,connection_status,provider_data_as_of,reconciliation_status,reconciliation_variance')
    .eq('user_id', userId).eq('provider', 'schwab').eq('is_primary', true).eq('is_active', true);
  if (!connections?.length) return '';
  const connectionIds = connections.map((connection: any) => connection.id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: positions }, { count: fills }] = await Promise.all([
    supabase.from('brokerage_positions').select('market_value,asset_type')
      .eq('user_id', userId).in('connection_id', connectionIds),
    supabase.from('brokerage_executions').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).in('connection_id', connectionIds).gte('executed_at', thirtyDaysAgo),
  ]);
  const supported = (positions ?? []).filter((position: any) => !String(position.asset_type ?? '').toUpperCase().includes('OPTION'));
  const marketValue = supported.reduce((sum: number, position: any) => sum + Number(position.market_value ?? 0), 0);
  const latest = connections.map((connection: any) => connection.provider_data_as_of).filter(Boolean).sort().at(-1) ?? null;
  const health = connections.some((connection: any) => connection.connection_status !== 'active') ? 'needs attention'
    : connections.some((connection: any) => connection.reconciliation_status !== 'reconciled') ? 'reconciliation incomplete'
    : 'reconciled';
  return `\nSCHWAB BROKERAGE SUMMARY (read-only actuals; aggregate context only, with no account identifiers or ticker list):
- Supported position market value: $${Math.round(marketValue).toLocaleString()}
- Supported positions: ${supported.length}; fills in the last 30 days: ${fills ?? 0}
- Data health: ${health}; provider data as of ${latest ?? 'not yet synced'}
Use these actuals to discuss diversification, contribution feasibility and freshness. Do not infer tax lots, realized P&L, options exposure, fees or total performance when they are not explicitly available.`;
}

async function buildInvestmentGoalContext(supabase: SupabaseClient<any>, userId: string): Promise<string> {
  const { data } = await supabase
    .from("investment_goals")
    .select("target_amount,target_date,horizon_years,current_balance,monthly_contribution,risk_profile,projection,assumption_version")
    .eq("user_id", userId)
    .eq("goal_type", "investing")
    .eq("status", "active")
    .maybeSingle();
  if (!data) return "";
  const projection = (data.projection ?? {}) as Record<string, unknown>;
  return `\nACTIVE INVESTMENT GOAL (use for quantitative guidance; describe projections as uncertain, never guaranteed):
- Target: $${Number(data.target_amount).toLocaleString()} by ${data.target_date} (${data.horizon_years} years at setup)
- Starting balance: $${Number(data.current_balance).toLocaleString()}
- Planned contribution: $${Number(data.monthly_contribution).toLocaleString()}/month
- Risk profile: ${data.risk_profile}
- Required expected-case contribution: $${Math.ceil(Number(projection.requiredMonthlyContribution ?? 0)).toLocaleString()}/month
- Modeled success likelihood at setup: ${Number(projection.expectedGoalProbabilityPct ?? 0).toFixed(0)}%
- Assumption set: ${data.assumption_version}
Before suggesting securities, assess contribution feasibility, emergency reserves, horizon, diversification, costs, taxes, and allocation. Explain how any selection fits an allocation bucket and the goal; do not imply a stock guarantees goal success.`;
}

async function buildJourneyPlanContext(supabase: SupabaseClient<any>, userId: string): Promise<string> {
  const [{ data: plans }, { data: actions }] = await Promise.all([
    supabase
      .from("journey_plans")
      .select("id,journey_id,name,answers,activated_analysis,monthly_commitment,target_date,updated_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("updated_at", { ascending: false }),
    supabase
      .from("journey_plan_actions")
      .select("plan_id,title,due_date,amount,status")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(10),
  ]);
  if (!plans?.length) return "";

  const actionRows = (actions ?? []) as Array<Record<string, unknown>>;
  const lines = ["\nACTIVE JOURNEY OPERATING PLANS (user intent and planning assumptions; compare with actuals before advising):"];
  let totalCommitment = 0;
  for (const plan of plans as Array<Record<string, any>>) {
    const analysis = (plan.activated_analysis ?? {}) as Record<string, any>;
    const metrics = Array.isArray(analysis.metrics) ? analysis.metrics.slice(0, 4) : [];
    const commitment = Number(plan.monthly_commitment ?? 0);
    totalCommitment += commitment;
    lines.push(`- ${plan.journey_id} / ${plan.name}: ${commitment > 0 ? `$${commitment.toLocaleString()}/month committed` : "no recurring personal commitment"}${plan.target_date ? `; target ${plan.target_date}` : ""}`);
    for (const metric of metrics) {
      lines.push(`  • ${String(metric.label ?? metric.id)}: ${String(metric.value ?? "N/A")}`);
    }
    const next = actionRows.find(action => action.plan_id === plan.id);
    if (next) lines.push(`  • Next action: ${String(next.title)}${next.due_date ? ` due ${String(next.due_date)}` : ""}`);
  }
  lines.push(`- Total recurring commitment across active Journeys: $${totalCommitment.toLocaleString()}/month.`);
  return lines.join("\n");
}

// ── Tool session context ───────────────────────────────────────────────────────
// Fetches recent planning tool sessions and injects them into the Coach system
// prompt so advice is grounded in what the user has actually been modelling.

async function buildToolSessionContext(
  supabase: SupabaseClient<any>,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("tool_sessions")
    .select("tool, summary, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  const sessions = (data ?? []) as { tool: string; summary: string; created_at: string }[];
  if (sessions.length === 0) return "";

  const lines = ["\nRECENT PLANNING TOOL SESSIONS (what the user has been actively modelling — reference these when giving specific advice):"];
  for (const s of sessions) {
    const date = new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    lines.push(`- [${s.tool} · ${date}] ${s.summary}`);
  }
  return lines.join("\n");
}

// ── Live dashboard context ─────────────────────────────────────────────────────
// Queries the user's personal finance tables and returns a formatted string
// injected into the Coach system prompt. This gives the Coach real numbers
// rather than relying solely on the 6-field financial_profiles snapshot.

// ── Transaction context ────────────────────────────────────────────────────────
// Queries persisted Plaid transactions to identify recurring charges and top
// merchants — giving the Coach named, specific data rather than category buckets.

async function buildTransactionContext(
  supabase: SupabaseClient<any>,
  userId: string
): Promise<string> {
  const now          = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(now.getDate() - 90);
  const cutoff = ninetyDaysAgo.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("plaid_transactions")
    .select("merchant_name,name,amount,date,category_key,pending")
    .eq("user_id", userId)
    .gte("date", cutoff)
    .eq("pending", false)
    .order("date", { ascending: false });

  const txs = (data ?? []) as {
    merchant_name: string | null; name: string; amount: number;
    date: string; category_key: string | null; pending: boolean;
  }[];

  if (txs.length === 0) return "";

  const $n = (n: number) => `$${Math.round(n).toLocaleString()}`;

  // ── Recurring charge detection (same logic as client-side) ──────────────────
  const months = [0, 1, 2].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [thisMonth] = months;

  const debits = txs.filter(tx => tx.amount > 0 && tx.category_key !== null);

  const byMerchant = new Map<string, typeof debits>();
  for (const tx of debits) {
    const key = (tx.merchant_name ?? tx.name).replace(/\s*\*\s*\w+$/, "").trim().toLowerCase();
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push(tx);
  }

  const recurring: { name: string; amount: number; possiblyCancelled: boolean }[] = [];
  for (const [, group] of byMerchant) {
    const appearsInMonth = new Map<string, number[]>();
    for (const tx of group) {
      const m = tx.date.slice(0, 7);
      if (!months.includes(m)) continue;
      if (!appearsInMonth.has(m)) appearsInMonth.set(m, []);
      appearsInMonth.get(m)!.push(tx.amount);
    }
    if (appearsInMonth.size < 2) continue;
    const medians = [...appearsInMonth.values()].map(arr => arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)]);
    const med = medians.sort((a, b) => a - b)[Math.floor(medians.length / 2)];
    const maxDev = Math.max(...medians.map(m => Math.abs(m - med) / med));
    if (maxDev > 0.20) continue;
    const rep = group.sort((a, b) => b.date.localeCompare(a.date))[0];
    recurring.push({
      name: (rep.merchant_name ?? rep.name).replace(/\s*\*\s*\w+$/, "").trim(),
      amount: med,
      possiblyCancelled: !appearsInMonth.has(thisMonth),
    });
  }
  recurring.sort((a, b) => b.amount - a.amount);

  // ── Top merchants this month ─────────────────────────────────────────────────
  const thisMonthDebits = debits.filter(tx => tx.date.startsWith(currentMonth));
  const merchantTotals = new Map<string, number>();
  for (const tx of thisMonthDebits) {
    const key = tx.merchant_name ?? tx.name;
    merchantTotals.set(key, (merchantTotals.get(key) ?? 0) + tx.amount);
  }
  const top8 = [...merchantTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const lines: string[] = ["\nTRANSACTION-LEVEL DETAIL (from connected bank accounts — use these for specific, named advice):"];

  if (recurring.length > 0) {
    const active   = recurring.filter(r => !r.possiblyCancelled);
    const inactive = recurring.filter(r =>  r.possiblyCancelled);
    const total    = active.reduce((s, r) => s + r.amount, 0);
    lines.push(`Active recurring charges (${active.length}, ${$n(total)}/mo): ${active.map(r => `${r.name} ${$n(r.amount)}`).join(", ")}`);
    if (inactive.length > 0) {
      lines.push(`Not seen this month (possibly cancelled): ${inactive.map(r => r.name).join(", ")}`);
    }
  }

  if (top8.length > 0) {
    lines.push(`Top merchants this month: ${top8.map(([m, v]) => `${m} ${$n(v)}`).join(", ")}`);
  }

  return lines.join("\n");
}

async function buildDashboardContext(
  supabase: SupabaseClient<any>,
  userId: string
): Promise<string> {
  const [snapsRes, flowRes] = await Promise.all([
    supabase
      .from("net_worth_snapshots")
      .select("snapshot_month,checking,savings,investments,real_estate,other_assets,credit_cards,student_loans,mortgage,car_loans,other_liabilities")
      .eq("user_id", userId)
      .order("snapshot_month", { ascending: false })
      .limit(3),
    supabase
      .from("monthly_cash_flow")
      .select("flow_month,primary_income,side_income,investment_income,other_income,housing,food,transport,healthcare,entertainment,subscriptions,clothing,education,travel,other_expenses")
      .eq("user_id", userId)
      .order("flow_month", { ascending: false })
      .limit(3),
  ]);

  const snaps = (snapsRes.data ?? []) as Record<string, number>[];
  const flows = (flowRes.data ?? []) as Record<string, number>[];
  if (snaps.length === 0 && flows.length === 0) return "";

  const lines: string[] = ["\nLIVE FINANCIAL DASHBOARD (from Personal Finance module — use these numbers, not general estimates):"];

  const nw = (s: Record<string, number>) =>
    (s.checking + s.savings + s.investments + s.real_estate + s.other_assets) -
    (s.credit_cards + s.student_loans + s.mortgage + s.car_loans + s.other_liabilities);

  const cf = (f: Record<string, number>) => {
    const income = f.primary_income + f.side_income + f.investment_income + f.other_income;
    const expenses = f.housing + f.food + f.transport + f.healthcare + f.entertainment +
      f.subscriptions + f.clothing + f.education + f.travel + f.other_expenses;
    return { income, expenses, surplus: income - expenses };
  };

  const $n = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString()}`;

  // ── Net worth ────────────────────────────────────────────────────────────────
  if (snaps.length > 0) {
    const cur = snaps[0];
    const curNw = nw(cur);
    let nwTrend = "";
    if (snaps.length >= 2) {
      const change = curNw - nw(snaps[1]);
      nwTrend = ` (${change >= 0 ? "↑+" : "↓"}${$n(change)} vs last month)`;
    }
    lines.push(`- Net worth: ${$n(curNw)}${nwTrend}`);
    lines.push(`- Liquid assets (checking + savings): ${$n(cur.checking + cur.savings)}`);
    if (cur.investments > 0)    lines.push(`- Investments: ${$n(cur.investments)}`);
    if (cur.real_estate > 0)    lines.push(`- Real estate equity: ${$n(cur.real_estate)}`);
    if (cur.credit_cards > 0)   lines.push(`- Credit card debt: ${$n(cur.credit_cards)}${snaps.length >= 2 && snaps[1].credit_cards < cur.credit_cards ? " ↑ increasing" : snaps.length >= 2 && snaps[1].credit_cards > cur.credit_cards ? " ↓ declining ✓" : ""}`);
    if (cur.student_loans > 0)  lines.push(`- Student loans: ${$n(cur.student_loans)}`);
    if (cur.mortgage > 0)       lines.push(`- Mortgage: ${$n(cur.mortgage)}`);
  }

  // ── Cash flow ────────────────────────────────────────────────────────────────
  if (flows.length > 0) {
    const cur = flows[0];
    const { income, expenses, surplus } = cf(cur);
    const savingsRate = income > 0 ? (surplus / income) * 100 : 0;

    lines.push(`- Monthly income: ${$n(income)}`);
    lines.push(`- Monthly expenses: ${$n(expenses)}`);
    lines.push(`- Monthly surplus: ${surplus >= 0 ? "+" : "-"}${$n(surplus)}`);
    lines.push(`- Savings rate: ${savingsRate.toFixed(1)}%${savingsRate < 10 ? " ⚠ critically low" : savingsRate < 20 ? " (below 20% target)" : " ✓"}`);

    // Cash runway
    if (snaps.length > 0 && expenses > 0) {
      const liquid = snaps[0].checking + snaps[0].savings;
      const runway = liquid / expenses;
      lines.push(`- Emergency fund / cash runway: ${runway.toFixed(1)} months${runway < 3 ? " ⚠ dangerously low" : runway < 6 ? " (target: 6 months)" : " ✓"}`);
    }

    // Savings rate trend
    if (flows.length >= 2) {
      const prev = flows[1];
      const { income: pInc, expenses: pExp } = cf(prev);
      const prevRate = pInc > 0 ? ((pInc - pExp) / pInc) * 100 : 0;
      const delta = savingsRate - prevRate;
      if (Math.abs(delta) > 2) {
        lines.push(`- Savings rate trend: ${delta > 0 ? "↑ improving" : "↓ declining"} (${delta > 0 ? "+" : ""}${delta.toFixed(1)}pp vs last month)`);
      }
    }

    // Top expense categories + housing % check
    const cats = [
      ["housing", "Housing", cur.housing], ["food", "Food", cur.food],
      ["transport", "Transport", cur.transport], ["entertainment", "Entertainment", cur.entertainment],
      ["subscriptions", "Subscriptions", cur.subscriptions], ["travel", "Travel", cur.travel],
      ["healthcare", "Healthcare", cur.healthcare], ["education", "Education", cur.education],
    ].filter(([, , v]) => (v as number) > 0)
      .sort((a, b) => (b[2] as number) - (a[2] as number))
      .slice(0, 4);

    if (cats.length > 0) {
      lines.push(`- Expense breakdown: ${cats.map(([, label, val]) => `${label} ${$n(val as number)} (${income > 0 ? Math.round((val as number) / income * 100) : 0}% of income)`).join(", ")}`);
    }

    if (income > 0 && cur.housing / income > 0.30) {
      lines.push(`- ⚠ Housing is ${Math.round(cur.housing / income * 100)}% of income — above the 30% healthy threshold`);
    }

    // Month-over-month expense spikes (>25% increase in a category with >$50 base)
    if (flows.length >= 2) {
      const prev = flows[1];
      const spikes = (["food", "entertainment", "travel", "subscriptions", "transport", "clothing"] as const)
        .map((k) => ({ k, cur: cur[k] as number, prev: prev[k] as number }))
        .filter(({ cur, prev }) => prev > 50 && cur > prev * 1.25)
        .map(({ k, cur, prev }) => `${k.charAt(0).toUpperCase() + k.slice(1)} ↑${Math.round((cur - prev) / prev * 100)}% (+${$n(cur - prev)})`);
      if (spikes.length > 0) lines.push(`- Notable MoM increases: ${spikes.join(", ")}`);
    }
  }

  return lines.join("\n");
}

async function callAnthropic(
  apiKey: string,
  systemPrompt: { stable: string; volatile: string },
  messages: Message[]
): Promise<{ content: string; toolLaunch: { type: string; prefill: Record<string, unknown> } | null; truncated: boolean }> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: COACH_MODEL,
      max_tokens: COACH_MAX_TOKENS,
      // Two blocks so the stable half can be cached. Cached reads bill at ~10%
      // of input, and this prefix is resent on every turn of a conversation.
      // The volatile block is omitted entirely when empty: an empty text block
      // is rejected by the API.
      system: [
        { type: "text", text: systemPrompt.stable, cache_control: { type: "ephemeral" } },
        ...(systemPrompt.volatile ? [{ type: "text", text: systemPrompt.volatile }] : []),
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${err}`);
  }

  const data = await response.json();
  // Find the text block rather than assuming it is first: a non-text block
  // leading would otherwise yield an empty reply with no error.
  const raw = (data.content ?? []).find((block: { type?: string }) => block?.type === "text")?.text ?? "";
  // A response cut off at the ceiling is indistinguishable from a complete one
  // unless stop_reason is checked, so the caller is told.
  const truncated = data.stop_reason === "max_tokens";
  const toolMatch = raw.match(/\[TOOL:(\{.*?\})\]/s);
  // A truncated reply can end mid-marker, so a malformed payload must not throw
  // and lose an otherwise usable answer.
  let toolLaunch: { type: string; prefill: Record<string, unknown> } | null = null;
  if (toolMatch) {
    try {
      toolLaunch = JSON.parse(toolMatch[1]);
    } catch {
      console.error("financial-coach: unparseable tool marker, ignoring");
    }
  }
  const content = raw.replace(/\[TOOL:\{.*?\}\]/s, "").trim();

  return { content, toolLaunch, truncated };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return corsError("Method not allowed", 405);
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return corsError("Authentication required", 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return corsError("Invalid or expired session", 401);
  }

  // ── Subscription tier ──────────────────────────────────────────────────────
  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("subscription_tier, subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  const rawTier = userProfile?.subscription_tier ?? "free";
  const subStatus = userProfile?.subscription_status ?? "active";
  const effectiveTier =
    subStatus === "canceled" || subStatus === "unpaid" ? "free" : rawTier;

  const dailyLimit = DAILY_LIMITS[effectiveTier] ?? DAILY_LIMITS.free;

  // ── Rate limiting (skipped for unlimited tiers) ────────────────────────────
  let quotaUsed = 0;
  if (dailyLimit !== -1) {
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
      .from("coach_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "user")
      .gte("created_at", todayUtc.toISOString());

    if (!countError) {
      quotaUsed = count ?? 0;
      if (quotaUsed >= dailyLimit) {
        const resetAt = new Date(todayUtc);
        resetAt.setUTCDate(resetAt.getUTCDate() + 1);
        return new Response(
          JSON.stringify({
            error: "Daily message limit reached",
            limit: dailyLimit,
            used: quotaUsed,
            remaining: 0,
            resetAt: resetAt.toISOString(),
            upgradeRequired: effectiveTier === "free",
          }),
          { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
    }
    // On DB error we fail open — don't block the user over a count query failure.
  }

  // ── Parse body & call Anthropic ────────────────────────────────────────────
  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const body: RequestBody = await req.json();
    const { messages, profile, appContext } = body;

    if (!messages || messages.length === 0) {
      return corsError("messages array is required", 400);
    }

    // Fetch all context in parallel — net cost is the slowest single query
    const [dashboardContext, toolSessionContext, transactionContext, investmentGoalContext, journeyPlanContext, brokerageContext] = await Promise.all([
      buildDashboardContext(supabase, user.id).catch(() => ""),
      buildToolSessionContext(supabase, user.id).catch(() => ""),
      buildTransactionContext(supabase, user.id).catch(() => ""),
      buildInvestmentGoalContext(supabase, user.id).catch(() => ""),
      buildJourneyPlanContext(supabase, user.id).catch(() => ""),
      buildBrokerageContext(supabase, user.id).catch(() => ""),
    ]);

    const systemPrompt = buildSystemPrompt(profile ?? {}, appContext, dashboardContext, toolSessionContext, transactionContext, investmentGoalContext, journeyPlanContext, brokerageContext);
    const { content, toolLaunch, truncated } = await callAnthropic(apiKey, systemPrompt, messages);

    const quota =
      dailyLimit === -1
        ? null
        : { limit: dailyLimit, used: quotaUsed + 1, remaining: dailyLimit - quotaUsed - 1 };

    return corsResponse({ content, toolLaunch, quota, truncated });
  } catch (err) {
    console.error("financial-coach error:", err);
    return corsError(err instanceof Error ? err.message : "Internal error", 500);
  }
});
