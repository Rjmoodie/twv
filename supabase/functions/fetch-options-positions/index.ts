/**
 * fetch-options-positions
 *
 * Loads all positions from the user's Alpaca account and returns only
 * options contracts (symbol format: AAPL240119C00150000).
 * Also returns the top 5 most active tickers from Alpha Vantage as
 * "volume alerts" (a proxy for unusual flow).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, corsError, CORS_HEADERS } from "../_shared/cors.ts";

const ALPACA_BASE: Record<string, string> = {
  paper: "https://paper-api.alpaca.markets",
  live: "https://api.alpaca.markets",
};

// Options contract regex: ticker + 6-digit date + C/P + 8-digit strike
const OPTIONS_SYMBOL_RE = /^[A-Z]{1,5}\d{6}[CP]\d{8}$/;

interface AlpacaPosition {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  change_today: string;
}

function parseOptionsSymbol(symbol: string) {
  // Format: AAPL240119C00150000
  // ticker (1-5 chars), YYMMDD, C/P, 8-digit strike in 1/1000 dollars
  const match = symbol.match(/^([A-Z]{1,5})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  if (!match) return null;
  const [, ticker, yy, mm, dd, type, strikeRaw] = match;
  const strike = parseInt(strikeRaw) / 1000;
  const expiry = `20${yy}-${mm}-${dd}`;
  return { ticker, expiry, type: type === 'C' ? 'Call' : 'Put', strike };
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.max(0, Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
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

  // ── Load Alpaca credentials ────────────────────────────────────────────────
  const { data: keys } = await supabase
    .from("user_alpaca_keys")
    .select("api_key, api_secret, environment")
    .eq("user_id", user.id)
    .maybeSingle();

  // ── Fetch positions (may be null if no connection) ─────────────────────────
  let optionsPositions: object[] = [];
  let positionsError: string | null = null;

  if (keys) {
    const base = ALPACA_BASE[keys.environment] ?? ALPACA_BASE.paper;
    try {
      const res = await fetch(`${base}/v2/positions`, {
        headers: {
          "APCA-API-KEY-ID": keys.api_key,
          "APCA-API-SECRET-KEY": keys.api_secret,
        },
      });

      if (res.ok) {
        const positions: AlpacaPosition[] = await res.json();
        optionsPositions = positions
          .filter((p) => OPTIONS_SYMBOL_RE.test(p.symbol))
          .map((p) => {
            const parsed = parseOptionsSymbol(p.symbol);
            return {
              symbol: p.symbol,
              ticker: parsed?.ticker ?? p.symbol,
              expiry: parsed?.expiry ?? null,
              optionType: parsed?.type ?? null,
              strike: parsed?.strike ?? null,
              daysToExpiry: parsed?.expiry ? daysUntil(parsed.expiry) : null,
              qty: parseFloat(p.qty),
              avgEntryPrice: parseFloat(p.avg_entry_price),
              currentPrice: parseFloat(p.current_price),
              marketValue: parseFloat(p.market_value),
              unrealizedPl: parseFloat(p.unrealized_pl),
              unrealizedPlPct: parseFloat(p.unrealized_plpc) * 100,
            };
          });
      } else {
        console.error("Alpaca positions request failed:", res.status);
        positionsError = "Your brokerage connection could not be refreshed. Check the Alpaca credentials and try again.";
      }
    } catch (err) {
      console.error("Alpaca positions fetch error:", err);
      positionsError = "Your brokerage connection could not be reached. Try again shortly.";
    }
  }

  // ── Volume alerts via Alpha Vantage TOP_GAINERS_LOSERS ────────────────────
  let volumeAlerts: object[] = [];
  const avKey = Deno.env.get("ALPHA_VANTAGE_API_KEY");

  if (avKey) {
    try {
      const res = await fetch(
        `https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${avKey}`
      );
      if (res.ok) {
        const data = await res.json();
        const active: Array<{ ticker: string; volume: string; change_percentage: string }> =
          data.most_actively_traded ?? [];

        volumeAlerts = active.slice(0, 6).flatMap((item) => {
          const changePercent = Number.parseFloat(item.change_percentage.replace("%", ""));
          const volume = Number.parseFloat(item.volume.replaceAll(",", ""));
          if (!item.ticker || !Number.isFinite(changePercent) || !Number.isFinite(volume) || volume < 0) return [];
          return [{
            ticker: item.ticker,
            sentiment: changePercent >= 0 ? "Bullish" : "Bearish",
            changePercent,
            volume,
          }];
        });
      }
    } catch (err) {
      console.error("Alpha Vantage volume alerts error:", err);
    }
  }

  return corsResponse({
    positions: optionsPositions,
    volumeAlerts,
    connected: !!keys,
    error: positionsError,
  });
});
