import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsError, corsResponse, CORS_HEADERS } from "../_shared/cors.ts";
import { extractMdaSection, htmlToText, recentFilingCandidates } from "../_shared/secNarrative.ts";
import {
  analyzeSection,
  filingDocumentUrl,
  NARRATIVE_ANALYSIS_VERSION,
  SEC_HEADERS,
} from "../_shared/narrativeExtraction.ts";
import { isStoredClaim } from "../_shared/narrativeClaim.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return corsError("Method not allowed", 405);
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return corsError("Authentication required", 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authError } = await supabase.auth.getUser(auth.slice(7));
  if (authError || !user) return corsError("Invalid or expired session", 401);
  try {
    const { ticker: rawTicker, watchlistId } = await req.json().catch(() => ({}));
    const ticker = String(rawTicker ?? "").trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker) || !watchlistId) return corsError("A valid ticker and watchlistId are required", 400);
    const { data: profile } = await supabase.from("user_profiles").select("subscription_tier,subscription_status,role").eq("id", user.id).maybeSingle();
    const allowed = profile?.role === "admin" || profile?.role === "super_admin" || (["tier2", "tier3"].includes(profile?.subscription_tier ?? "") && !["canceled", "unpaid"].includes(profile?.subscription_status ?? ""));
    if (!allowed) return corsError("Company Story requires an Investor or Complete subscription", 403);
    const { data: tracked } = await supabase.from("watchlist").select("id,ticker,tracking_mode").eq("id", watchlistId).eq("user_id", user.id).eq("ticker", ticker).maybeSingle();
    if (!tracked || tracked.tracking_mode === "price") return corsError("Enable Story or Thesis tracking first", 409);
    const [{ data: company }, { data: latest }] = await Promise.all([
      supabase.from("stock_analysis_cache").select("cik,company_name").eq("ticker", ticker).maybeSingle(),
      supabase.from("watchlist_story_snapshots").select("payload").eq("watchlist_id", watchlistId).eq("user_id", user.id).order("source_as_of", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!company?.cik || !latest?.payload) return corsError("Run Stock Analysis and save a baseline before enriching the story", 409);
    const submissionsResponse = await fetch(`https://data.sec.gov/submissions/CIK${company.cik}.json`, { headers: SEC_HEADERS });
    if (submissionsResponse.status === 429) return corsError("SEC filing service is temporarily rate limited", 429);
    if (!submissionsResponse.ok) throw new Error(`SEC submissions request failed (${submissionsResponse.status})`);
    const filing = recentFilingCandidates(await submissionsResponse.json())[0];
    if (!filing) return corsError("No recent 10-K or 10-Q filing document was found", 404);
    const { data: existingEnrichment } = await supabase.from("watchlist_story_snapshots").select("id,payload").eq("watchlist_id", watchlistId).eq("user_id", user.id).eq("source_as_of", filing.filingDate).eq("analysis_version", "story-v2").maybeSingle();
    if (existingEnrichment) {
      const priorClaims = Array.isArray((existingEnrichment.payload as { narrativeClaims?: unknown[] })?.narrativeClaims) ? (existingEnrichment.payload as { narrativeClaims: unknown[] }).narrativeClaims.length : 0;
      return corsResponse({ snapshotId: existingEnrichment.id, ticker, claims: priorClaims, filing, cacheHit: true });
    }
    const documentUrl = filingDocumentUrl(company.cik, filing.accessionNumber, filing.primaryDocument);
    const { data: sharedNarrative } = await supabase.from("company_narrative_cache").select("claims").eq("ticker", ticker).eq("accession_number", filing.accessionNumber).eq("analysis_version", NARRATIVE_ANALYSIS_VERSION).maybeSingle();
    let claims = Array.isArray(sharedNarrative?.claims) ? sharedNarrative.claims.filter(isStoredClaim).slice(0, 8) : [];
    let sharedCacheHit = claims.length > 0;
    if (!claims.length) {
      const documentResponse = await fetch(documentUrl, { headers: SEC_HEADERS });
      if (documentResponse.status === 429) return corsError("SEC filing service is temporarily rate limited", 429);
      if (!documentResponse.ok) throw new Error(`SEC filing document request failed (${documentResponse.status})`);
      const fullText = htmlToText(await documentResponse.text());
      const section = extractMdaSection(fullText, filing.form);
      if (!section) return corsError("The filing was retrieved, but a complete MD&A section could not be isolated safely", 422);
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) throw new Error("Qualitative-analysis provider is not configured");
      claims = await analyzeSection(apiKey, ticker, filing.form, section);
      if (!claims.length) return corsError("No citation-verifiable material narrative claims were extracted", 422);
      const { error: narrativeCacheError } = await supabase.from("company_narrative_cache").upsert({ ticker, accession_number: filing.accessionNumber, analysis_version: NARRATIVE_ANALYSIS_VERSION, form: filing.form, filing_date: filing.filingDate, report_date: filing.reportDate, document_url: documentUrl, claims }, { onConflict: "ticker,accession_number,analysis_version", ignoreDuplicates: true });
      if (narrativeCacheError) console.error("company narrative cache write failed:", narrativeCacheError);
      sharedCacheHit = false;
    }
    const baseline = latest.payload as Record<string, unknown>;
    const generatedAt = new Date().toISOString();
    const enriched = { ...baseline, schemaVersion: "story-v2", generatedAt, sourceAsOf: filing.filingDate, reportingPeriod: filing.reportDate, narrativeClaims: claims.map((claim) => ({ ...claim, source: { form: filing.form, accession: filing.accessionNumber, filedAt: filing.filingDate, reportDate: filing.reportDate, section: "MD&A", documentUrl } })) };
    const { data: saved, error: saveError } = await supabase.from("watchlist_story_snapshots").insert({ watchlist_id: watchlistId, user_id: user.id, ticker, reporting_period: filing.reportDate, source_as_of: filing.filingDate, analysis_version: "story-v2", summary: String(baseline.summary ?? `${claims.length} filing-backed narrative claims`), payload: enriched }).select("id").single();
    if (saveError) {
      if (saveError.code === "23505") {
        const { data: raced } = await supabase.from("watchlist_story_snapshots").select("id").eq("watchlist_id", watchlistId).eq("source_as_of", filing.filingDate).eq("analysis_version", "story-v2").maybeSingle();
        if (raced) return corsResponse({ snapshotId: raced.id, ticker, claims: claims.length, filing: { ...filing, documentUrl }, cacheHit: true });
      }
      throw new Error("The enriched story could not be saved");
    }
    await supabase.from("watchlist").update({ story_updated_at: generatedAt, story_summary: String(baseline.summary ?? claims[0].headline) }).eq("id", watchlistId).eq("user_id", user.id);
    return corsResponse({ snapshotId: saved.id, ticker, claims: claims.length, filing: { ...filing, documentUrl }, generatedAt, sharedCacheHit });
  } catch (error) {
    console.error("company-story error:", error);
    const message = error instanceof Error ? error.message : "Company Story failed";
    return corsError(message, /rate limit|429/i.test(message) ? 429 : /JSON|provider/i.test(message) ? 502 : 500);
  }
});
