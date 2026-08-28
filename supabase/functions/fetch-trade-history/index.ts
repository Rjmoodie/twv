/**
 * fetch-trade-history
 *
 * Pulls filled orders from Alpaca, upserts them into trade_history,
 * and returns the full history for the requesting user.
 *
 * POST body: { environment?: 'paper' | 'live' }   (defaults to saved connection)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, corsError, CORS_HEADERS } from "../_shared/cors.ts";

const ALPACA_BASE: Record<string, string> = {
  paper: "https://paper-api.alpaca.markets",
  live:  "https://api.alpaca.markets",
};

interface AlpacaOrder {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  filled_qty: string;
  filled_avg_price: string | null;
  notional: string | null;
  filled_at: string | null;
  status: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return corsError("Method not allowed", 405);

  // ── Auth ───────────────────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return corsError("Authentication required", 401);

  // ── Key validation short-circuit ───────────────────────────────────────────
  // Called by the connect dialog BEFORE saving keys to DB.
  // Body: { action: "validate", api_key, api_secret, environment }
  const rawBody = await req.json().catch(() => ({}));
  if (rawBody?.action === "validate") {
    const { api_key, api_secret, environment = "paper" } = rawBody;
    if (!api_key || !api_secret) return corsError("api_key and api_secret are required", 400);
    const base = ALPACA_BASE[environment] ?? ALPACA_BASE.paper;
    try {
      const r = await fetch(`${base}/v2/account`, {
        headers: {
          "APCA-API-KEY-ID": api_key,
          "APCA-API-SECRET-KEY": api_secret,
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (r.status === 401 || r.status === 403) {
        return corsError("Invalid API credentials — check your key and secret", 401);
      }
      if (!r.ok) {
        return corsError(`Alpaca returned ${r.status} — try again`, 502);
      }
      const account = await r.json();
      return corsResponse({ valid: true, account_id: account.id, account_status: account.status });
    } catch (err) {
      return corsError(`Could not reach Alpaca API: ${err instanceof Error ? err.message : err}`, 502);
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    auth.replace("Bearer ", "")
  );
  if (authErr || !user) return corsError("Invalid or expired session", 401);

  // ── Load saved Alpaca credentials ──────────────────────────────────────────
  const { data: keys, error: keysErr } = await supabase
    .from("user_alpaca_keys")
    .select("api_key, api_secret, environment")
    .eq("user_id", user.id)
    .maybeSingle();

  if (keysErr) return corsError("DB error loading credentials", 500);
  if (!keys) return corsError("No Alpaca connection found. Please connect your account first.", 404);

  const base = ALPACA_BASE[keys.environment] ?? ALPACA_BASE.paper;

  try {
    // ── Fetch filled orders (paged, newest-first, up to 500) ──────────────
    // Alpaca pagination in descending order:
    //   First page:  no date filters
    //   Next pages:  until=<filled_at of oldest item on previous page>
    //                This shifts the window back in time to get older orders.
    // NOTE: `after` is a "newer than" filter — using it here would re-fetch
    // the same orders on every page (the classic off-by-one pagination bug).
    const orders: AlpacaOrder[] = [];
    let untilTimestamp: string | null = null;

    do {
      const url = new URL(`${base}/v2/orders`);
      url.searchParams.set("status", "filled");
      url.searchParams.set("limit", "200");
      url.searchParams.set("direction", "desc");
      if (untilTimestamp) url.searchParams.set("until", untilTimestamp);

      const res = await fetch(url.toString(), {
        headers: {
          "APCA-API-KEY-ID": keys.api_key,
          "APCA-API-SECRET-KEY": keys.api_secret,
        },
        signal: AbortSignal.timeout(15_000), // 15 s per Alpaca call
      });

      if (!res.ok) {
        const errText = await res.text();
        // Surface readable Alpaca errors (often JSON like {"message":"..."})
        let msg = errText;
        try { msg = JSON.parse(errText)?.message ?? errText; } catch { /* raw text */ }
        throw new Error(`Alpaca API error: ${msg}`);
      }

      const page: AlpacaOrder[] = await res.json();
      if (!page.length) break;

      orders.push(...page);

      // Advance cursor: oldest item's filled_at shifts the window back in time
      const oldestOnPage = page[page.length - 1].filled_at;
      untilTimestamp = page.length === 200 && orders.length < 500 && oldestOnPage
        ? oldestOnPage
        : null;
    } while (untilTimestamp);

    // ── Upsert into trade_history ──────────────────────────────────────────
    const rows = orders
      .filter((o) => o.filled_at && parseFloat(o.filled_qty) > 0)
      .map((o) => ({
        user_id:          user.id,
        alpaca_order_id:  o.id,
        ticker:           o.symbol,
        side:             o.side,
        qty:              parseFloat(o.filled_qty),
        filled_avg_price: o.filled_avg_price ? parseFloat(o.filled_avg_price) : null,
        notional:         o.notional ? parseFloat(o.notional) : null,
        filled_at:        o.filled_at,
        synced_at:        new Date().toISOString(),
      }));

    if (rows.length > 0) {
      const { error: upsertErr } = await supabase
        .from("trade_history")
        .upsert(rows, { onConflict: "user_id,alpaca_order_id", ignoreDuplicates: false });

      if (upsertErr) throw upsertErr;
    }

    // ── Return full history from DB (includes user strategy tags) ─────────
    const { data: history, error: fetchErr } = await supabase
      .from("trade_history")
      .select("*")
      .eq("user_id", user.id)
      .order("filled_at", { ascending: false });

    if (fetchErr) throw fetchErr;

    return corsResponse({ trades: history ?? [], synced: rows.length });
  } catch (err) {
    console.error("fetch-trade-history error:", err);
    return corsError(err instanceof Error ? err.message : "Internal error", 500);
  }
});
