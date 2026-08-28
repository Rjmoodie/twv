// SomaTech Alpha Vantage Proxy Edge Function
// Forwards requests to Alpha Vantage, injecting the secret API key server-side.
// Clients send { function: string, params: Record<string, string> } — they never
// see or need the API key.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AV_BASE = "https://www.alphavantage.co/query";
const QUOTE_CACHE_MS = 5 * 60 * 1000;
const QUOTE_STALE_FALLBACK_MS = 24 * 60 * 60 * 1000;
const SYMBOL_RE = /^[A-Z][A-Z0-9.-]{0,9}$/;
const UPSTREAM_TIMEOUT_MS = 10_000;
const validQuotePayload = (value: unknown): boolean => {
  const quote = (value as { "Global Quote"?: Record<string, unknown> } | null)?.["Global Quote"];
  const price = Number(quote?.["05. price"]);
  return Boolean(quote) && Number.isFinite(price) && price > 0;
};

// Functions that require at least Tier 1 to call
const GATED_FUNCTIONS = new Set([
  "OVERVIEW", "INCOME_STATEMENT", "BALANCE_SHEET", "CASH_FLOW",
  "EARNINGS", "TIME_SERIES_INTRADAY", "SMA", "EMA", "MACD", "RSI",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const apiKey = Deno.env.get("ALPHA_VANTAGE_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Alpha Vantage API key not configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate auth for gated endpoints
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const auth = req.headers.get("Authorization");
  let subscriptionTier = "free";

  if (auth?.startsWith("Bearer ")) {
    const token = auth.replace("Bearer ", "");
    const { data: userInfo } = await supabase.auth.getUser(token);
    if (userInfo?.user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("subscription_tier")
        .eq("id", userInfo.user.id)
        .single();
      subscriptionTier = profile?.subscription_tier ?? "free";
    }
  }

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const avFunction = String(body.function ?? "").toUpperCase();
    const params = body.params && typeof body.params === "object" && !Array.isArray(body.params)
      ? body.params as Record<string, unknown>
      : {};

    if (!avFunction) {
      return new Response(
        JSON.stringify({ error: "Missing required field: function" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gate premium endpoints to authenticated Tier 1+ users
    if (GATED_FUNCTIONS.has(avFunction) && subscriptionTier === "free") {
      return new Response(
        JSON.stringify({ error: "Tier 1 or higher required for this data" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (avFunction === "GLOBAL_QUOTE" && Array.isArray(body.symbols)) {
      const rawSymbols: unknown[] = body.symbols;
      const symbols: string[] = [...new Set(rawSymbols.map((value) => String(value).trim().toUpperCase()))]
        .filter((symbol: string) => SYMBOL_RE.test(symbol))
        .slice(0, 10);
      if (symbols.length === 0) {
        return new Response(JSON.stringify({ error: "At least one valid symbol is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: cachedRows } = await supabase
        .from("dashboard_quote_cache")
        .select("symbol,payload,fetched_at")
        .in("symbol", symbols);
      const cached = new Map((cachedRows ?? []).map((row) => [row.symbol, row]));
      const now = Date.now();
      const quotes: Record<string, unknown> = {};
      const quoteMeta: Record<string, { asOf: string | null; stale: boolean; cacheHit: boolean }> = {};

      await Promise.all(symbols.map(async (symbol) => {
        const row = cached.get(symbol);
        const age = row ? now - new Date(row.fetched_at).getTime() : Number.POSITIVE_INFINITY;
        if (row && age <= QUOTE_CACHE_MS && validQuotePayload(row.payload)) {
          quotes[symbol] = row.payload;
          quoteMeta[symbol] = { asOf: row.fetched_at, stale: false, cacheHit: true };
          return;
        }

        try {
          const url = new URL(AV_BASE);
          url.searchParams.set("function", "GLOBAL_QUOTE");
          url.searchParams.set("symbol", symbol);
          url.searchParams.set("apikey", apiKey);
          const upstream = await fetch(url.toString(), { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
          const payload = await upstream.json();
          const price = Number(payload?.["Global Quote"]?.["05. price"]);
          if (!upstream.ok || payload.Note || payload.Information || !payload["Global Quote"]
            || !Number.isFinite(price) || price <= 0) {
            throw new Error("Quote provider did not return a quote");
          }
          quotes[symbol] = payload;
          quoteMeta[symbol] = { asOf: new Date(now).toISOString(), stale: false, cacheHit: false };
          await supabase.from("dashboard_quote_cache").upsert({
            symbol,
            payload,
            fetched_at: new Date(now).toISOString(),
          });
        } catch (error) {
          console.error(`Quote fetch failed for ${symbol}:`, error);
          const canUseStale = Boolean(row && age <= QUOTE_STALE_FALLBACK_MS && validQuotePayload(row.payload));
          quotes[symbol] = canUseStale ? row!.payload : null;
          quoteMeta[symbol] = {
            asOf: canUseStale ? row!.fetched_at : null,
            stale: canUseStale,
            cacheHit: canUseStale,
          };
        }
      }));

      const available = Object.values(quotes).some(Boolean);
      const staleSymbols = Object.entries(quoteMeta).filter(([, meta]) => meta.stale).map(([symbol]) => symbol);
      return new Response(JSON.stringify({
        quotes,
        quoteMeta,
        staleSymbols,
        warning: staleSymbols.length > 0
          ? `Showing cached quotes for ${staleSymbols.join(', ')} while the market provider refresh is unavailable.`
          : undefined,
      }), {
        status: available ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the Alpha Vantage URL — key is injected here, never returned to client
    const url = new URL(AV_BASE);
    url.searchParams.set("function", avFunction);
    url.searchParams.set("apikey", apiKey);
    for (const [k, v] of Object.entries(params)) {
      // Block attempts to override the apikey param
      if (k.toLowerCase() !== "apikey") {
        url.searchParams.set(k, String(v));
      }
    }

    const upstream = await fetch(url.toString(), { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    const data = await upstream.json();

    if (!upstream.ok) {
      console.error(`Alpha Vantage upstream returned HTTP ${upstream.status}`);
      return new Response(JSON.stringify({ error: "Market data provider request failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Propagate Alpha Vantage rate limit errors as 429
    if (data.Note || data["Information"]) {
      return new Response(JSON.stringify(data), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Alpha Vantage proxy error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
