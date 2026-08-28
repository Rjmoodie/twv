/**
 * ai-analysis — Tier3 AI Tools edge function.
 *
 * Handles three tool types:
 *   thesis   — Generate an investment thesis for a ticker
 *   risk     — Portfolio risk scan for a list of tickers
 *   screener — Natural-language stock screener
 *
 * POST body: { tool: 'thesis' | 'risk' | 'screener', payload: object }
 * Auth: Bearer token (Tier3 subscription required)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, corsError, CORS_HEADERS } from "../_shared/cors.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPTS: Record<string, string> = {
  thesis: `You are an expert equity research analyst. When given a stock ticker and company name,
produce a structured investment thesis with these sections:
1. Business overview (2-3 sentences)
2. Economic moat (what makes this company hard to compete with)
3. Key growth drivers (3-5 bullets)
4. Key risks (3-5 bullets)
5. Valuation perspective (qualitative — is it cheap, fair, or expensive vs. peers)
6. Investment verdict: Buy / Hold / Avoid with one-line rationale

Be specific and data-driven. Avoid hedging with "may" and "could" excessively.
Format using clear headers and bullet points. Keep total length under 500 words.`,

  risk: `You are a portfolio risk analyst. When given a list of stock tickers, analyse:
1. Concentration risk (any single position > 20%? any single sector > 40%?)
2. Sector and factor exposures (tech-heavy? rate-sensitive? cyclical?)
3. Correlation risk (positions that would all drop together in a downturn)
4. Macro vulnerability (inflation, rate rises, dollar strength — which holdings are most exposed?)
5. Missing diversification (what asset classes or sectors are absent?)
6. Top 3 specific recommendations to reduce risk

Be direct and specific. No generic advice. Format with clear headers and bullets.`,

  screener: `You are a quantitative stock screening assistant. When given a natural-language description
of investment criteria, respond with:
1. A list of 5-10 specific publicly-traded stock tickers that match the criteria
2. For each ticker: company name, why it matches, one risk to watch
3. A note on the screening methodology you used

Focus on well-known, liquid stocks (US-listed preferred). Be specific — no vague suggestions.
If the criteria are unclear, ask one clarifying question rather than guessing.`,
};

async function callAnthropic(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      // The system prompt is the same for every ticker, so it caches across
      // requests; the per-ticker content travels in the user message, after it.
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Anthropic provider error", res.status, err);
    throw new Error("The AI provider is temporarily unavailable. Please try again shortly.");
  }

  const data = await res.json();
  // Locate the text block rather than assuming position, and refuse to pass off
  // a response that stopped at the ceiling as a finished analysis.
  const text = (data.content ?? []).find((block: { type?: string }) => block?.type === "text")?.text ?? "";
  if (data.stop_reason === "max_tokens") {
    console.warn("ai-analysis: response hit max_tokens and was truncated");
    return `${text}\n\n_(This analysis was cut short at the length limit.)_`;
  }
  return text;
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

  // ── Tier check: Tier3 only ─────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("subscription_tier, subscription_status, role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const tier = profile?.subscription_tier ?? "free";
  const status = profile?.subscription_status ?? "active";
  const isCanceled = status === "canceled" || status === "unpaid";

  if (!isAdmin && (isCanceled || tier !== "tier3")) {
    return corsError("AI Tools require a Tier 3 subscription", 403);
  }

  // ── Parse request ──────────────────────────────────────────────────────────
  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const { tool, payload } = await req.json();

    if (!tool || !SYSTEM_PROMPTS[tool]) {
      return corsError(`Invalid tool. Must be one of: ${Object.keys(SYSTEM_PROMPTS).join(", ")}`, 400);
    }

    let userMessage = "";

    if (tool === "thesis") {
      const { ticker, companyName } = payload ?? {};
      if (!ticker) return corsError("ticker is required for thesis tool", 400);
      const { data: evidence } = await supabase
        .from("stock_analysis_cache")
        .select("company_name, fundamentals, fundamentals_as_of, quote, quote_as_of")
        .eq("ticker", String(ticker).toUpperCase())
        .maybeSingle();
      if (!evidence) return corsError("Run Stock Analysis for this ticker first so the thesis can be grounded in current SEC and quote data.", 409);
      userMessage = `Generate an investment thesis for ${ticker}${companyName ? ` (${companyName})` : ""}.
Use only the supplied evidence for quantitative claims. Clearly label qualitative judgments and do not invent analyst estimates.
Evidence (SEC annual facts and Alpha Vantage quote): ${JSON.stringify(evidence)}`;
    } else if (tool === "risk") {
      const { tickers } = payload ?? {};
      if (!tickers?.length) return corsError("tickers array is required for risk tool", 400);
      const normalized = tickers.slice(0, 20).map((ticker: unknown) => String(ticker).toUpperCase());
      const { data: evidence } = await supabase
        .from("stock_analysis_cache")
        .select("ticker, company_name, fundamentals, fundamentals_as_of, quote, quote_as_of")
        .in("ticker", normalized);
      userMessage = `Analyse the portfolio risk for these holdings: ${normalized.join(", ")}.
Use the supplied SEC/quote evidence where available. State which tickers lack evidence; do not invent weights, sectors, correlations, or live prices.
Evidence: ${JSON.stringify(evidence ?? [])}`;
    } else if (tool === "screener") {
      const { query } = payload ?? {};
      if (!query) return corsError("query is required for screener tool", 400);
      userMessage = `${query}\nThis is an idea-generation request, not a live full-market database screen. Do not claim that a company currently satisfies a numeric criterion unless it is explicitly verified. Give a concise verification checklist for each idea.`;
    }

    const content = await callAnthropic(apiKey, SYSTEM_PROMPTS[tool], userMessage);
    return corsResponse({ content, tool });
  } catch (err) {
    console.error("ai-analysis error:", err);
    return corsError(err instanceof Error ? err.message : "Internal error", 500);
  }
});
