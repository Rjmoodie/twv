import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsError, corsResponse, CORS_HEADERS } from "../_shared/cors.ts";
import { FOMC_CALENDAR_URL, FOMC_DATES, allFomcMeetings } from "../_shared/fomcDates.ts";

const AV_URL = "https://www.alphavantage.co/query";
const EARNINGS_SOURCE_URL = "https://www.alphavantage.co/documentation/#earnings-calendar";
const FDA_SOURCE_URL = "https://open.fda.gov/apis/drug/drugsfda/";
const PDUFA_CALENDAR_URL = "https://www.pdufa.bio";
const PDUFA_API_URL = "https://www.pdufa.bio/api/v1/pdufa";
const BLS_CALENDAR_URL = "https://www.bls.gov/schedule/news_release/bls.ics";
const BEA_SCHEDULE_URL = "https://www.bea.gov/news/schedule/full";
const CACHE_MS = 6 * 60 * 60 * 1000;

function csvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) { row.push(field); field = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function isoDay(date: Date) { return date.toISOString().slice(0, 10); }
function addIsoDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return isoDay(date);
}

async function fetchEarnings(apiKey: string) {
  const url = new URL(AV_URL);
  url.searchParams.set("function", "EARNINGS_CALENDAR");
  // 12month is the widest horizon Alpha Vantage exposes. The UI can only ever
  // look as far ahead as this fetch does, so ask for the maximum and let the
  // client narrow it.
  url.searchParams.set("horizon", "12month");
  url.searchParams.set("apikey", apiKey);
  const response = await fetch(url);
  const body = await response.text();
  if (!response.ok) throw new Error(`Earnings provider returned ${response.status}`);

  // Do NOT content-sniff the whole payload for words like "frequency": the
  // calendar legitimately contains FREQUENCY ELECTRONICS INCORPORATED (FEIM),
  // which made a valid 1,600-row response look rate limited and took the
  // entire earnings feed down. Decide on SHAPE instead — a real response is
  // CSV whose header carries the columns we consume. Anything else is treated
  // as a provider message, and only then do we look at its text.
  const [headers, ...rows] = csvRows(body);
  const looksLikeCalendar = !!headers
    && headers.some((h) => h.trim().toLowerCase() === "symbol")
    && headers.some((h) => h.trim().toLowerCase() === "reportdate");

  if (!looksLikeCalendar) {
    const notice = body.slice(0, 200).replace(/\s+/g, " ").trim();
    if (/rate limit|thank you for using alpha vantage|premium/i.test(body)) {
      throw new Error(`Earnings provider rate limit or plan restriction: ${notice}`);
    }
    throw new Error(`Earnings provider returned an unexpected payload: ${notice}`);
  }
  const at = (row: string[], name: string) => row[headers.indexOf(name)] ?? "";
  const items = rows.map((row) => ({
    symbol: at(row, "symbol").toUpperCase(),
    name: at(row, "name") || at(row, "symbol"),
    reportDate: at(row, "reportDate"),
    fiscalDateEnding: at(row, "fiscalDateEnding"),
    estimate: at(row, "estimate"),
    currency: at(row, "currency") || "USD",
    time: at(row, "time") || "TBD",
    sourceUrl: EARNINGS_SOURCE_URL,
  })).filter((item) => item.symbol && /^\d{4}-\d{2}-\d{2}$/.test(item.reportDate));
  if (!items.length) throw new Error("Earnings provider returned no usable events");
  return { items, source: "Alpha Vantage Earnings Calendar", sourceUrl: EARNINGS_SOURCE_URL, health: { provider: "Alpha Vantage", status: "healthy", itemCount: items.length, horizonEnd: items.map((item) => item.reportDate).sort().at(-1) ?? null } };
}

function first<T>(value: T[] | undefined): T | undefined { return value?.[0]; }

async function fetchRegulatoryActions() {
  const end = new Date();
  const start = new Date(end.getTime() - 120 * 86_400_000);
  // openFDA range syntax is `[start TO end]` with real spaces. Writing `+TO+`
  // here and then passing it through searchParams.set() double-encodes the
  // plus signs to %2B, so openFDA received literal '+' instead of a range and
  // answered 500 on every request. Use a space and let the encoder do its job.
  const search = `submissions.submission_status_date:[${isoDay(start).replaceAll("-", "")} TO ${isoDay(end).replaceAll("-", "")}]`;
  const url = new URL("https://api.fda.gov/drug/drugsfda.json");
  url.searchParams.set("search", search);
  // openFDA permits up to 1,000 results. Request the maximum so a busy filing
  // period does not silently truncate the recent-action history at 100.
  url.searchParams.set("limit", "1000");
  const response = await fetch(url, { headers: { "User-Agent": "Somatech research@somatech.pro" } });
  if (!response.ok) throw new Error(`FDA data returned ${response.status}`);
  const json = await response.json();
  const items = (json.results ?? []).flatMap((application: any) => {
    const product: any = first<any>(application.products);
    const submissions = (application.submissions ?? []).filter((submission: any) =>
      /^\d{8}$/.test(submission.submission_status_date ?? "")
    );
    return submissions.map((submission: any) => {
      const raw = submission.submission_status_date;
      const eventDate = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      return {
        id: `${application.application_number}-${submission.submission_number}-${raw}`,
        ticker: null,
        company: application.sponsor_name ?? "Unknown sponsor",
        drug: product?.brand_name ?? product?.active_ingredients?.map((i: any) => i.name).join(", ") ?? application.application_number,
        indication: product?.dosage_form ?? "Drug application",
        eventDate,
        eventType: "FDA action",
        status: submission.submission_status ?? "Regulatory action",
        applicationNumber: application.application_number,
        sourceUrl: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${String(application.application_number).replace(/\D/g, "")}`,
        confidence: 100,
      };
    });
  }).sort((a: any, b: any) => b.eventDate.localeCompare(a.eventDate)).slice(0, 100);
  return { items, source: "FDA Drugs@FDA via openFDA", sourceUrl: FDA_SOURCE_URL };
}

// A PDUFA goal date is a US calendar date. Deriving "today" from UTC discards
// the current US day every evening after 8pm ET — exactly when a decision is
// pending — so anchor the forward window to New York.
function todayInNewYork() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

// pdufa.bio's own vocabulary for where an event stands. Map it explicitly so an
// unrecognised value degrades to a neutral label instead of leaking through.
const PDUFA_STATUS: Record<string, string> = {
  upcoming: "Scheduled target",
  awaiting: "Awaiting FDA decision",
  decided: "Decision announced",
};

async function fetchFuturePdufaDates() {
  const from = todayInNewYork();
  const to = addIsoDays(from, 370);
  const url = new URL(PDUFA_API_URL);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("limit", "1000");
  const response = await fetch(url, { headers: { "User-Agent": "SomaTech research@somatech.pro" } });
  if (!response.ok) throw new Error(`Future PDUFA provider returned ${response.status}`);
  const json = await response.json();
  const records = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
  if (!records.length) throw new Error("Future PDUFA provider returned no records");
  const items = records.flatMap((record: any) => {
    const eventDate = String(record.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || eventDate < from) return [];
    const ticker = typeof record.ticker === "string" ? record.ticker.toUpperCase() : null;
    const company = String(record.company ?? ticker ?? "Sponsor not listed");
    const drug = String(record.name ?? record.drug ?? "FDA application");
    const sourceUrl = typeof record.url === "string" && /^https:\/\//.test(record.url) ? record.url : PDUFA_CALENDAR_URL;
    // The provider states how firm each date is: "day" is a sponsor-stated goal
    // date, while "month"/"quarter" are windows pinned to a nominal day. Carry
    // that through so the UI never renders a window as an exact date.
    const precise = String(record.date_precision ?? "day") === "day";
    const type = String(record.type ?? "PDUFA").toUpperCase();
    return [{
      id: `future-${record.id ?? `${ticker ?? company}-${drug}-${eventDate}`}`,
      ticker,
      company,
      drug,
      indication: String(record.indication ?? record.therapeutic_area ?? "Indication not listed"),
      eventDate,
      eventType: type === "PDUFA" ? "PDUFA target date" : `${type} target date`,
      status: PDUFA_STATUS[String(record.status ?? "").toLowerCase()] ?? "Scheduled target",
      // FDA publishes no application number before it acts, so leave this blank
      // rather than inventing a value the UI would print as fact.
      applicationNumber: "",
      sourceUrl,
      confidence: precise ? 90 : 70,
      sourceType: "issuer_compiled",
      datePrecision: precise ? "day" : "approximate",
    }];
  });
  if (!items.length) throw new Error("Future PDUFA provider returned no usable forward dates");
  return {
    items,
    source: "pdufa.bio issuer-sourced calendar",
    sourceUrl: PDUFA_CALENDAR_URL,
    health: {
      provider: "pdufa.bio",
      status: "healthy",
      itemCount: items.length,
      upcomingCount: items.filter((item: any) => !/decision announced|decided|approved|rejected|withdrawn|complete response/i.test(item.status)).length,
      exactDateCount: items.filter((item: any) => item.datePrecision === "day").length,
      primarySourceCount: items.filter((item: any) => !item.sourceUrl.includes("pdufa.bio")).length,
      horizonEnd: items.map((item: any) => item.eventDate).sort().at(-1) ?? null,
      asOf: json?.meta?.as_of ?? null,
    },
  };
}

async function fetchPdufaCalendar() {
  const [future, actions] = await Promise.allSettled([fetchFuturePdufaDates(), fetchRegulatoryActions()]);
  // Future targets are the primary purpose of this feed. Never replace a good
  // combined snapshot with history-only data just because openFDA happened to
  // remain available while the forward provider failed.
  if (future.status === "rejected") {
    console.error("Future PDUFA calendar unavailable", future.reason);
    throw new Error("Future PDUFA dates are temporarily unavailable");
  }
  const futureItems = future.value.items;
  const actionItems = actions.status === "fulfilled" ? actions.value.items.map((item: any) => ({ ...item, sourceType: "official_action", datePrecision: "day" })) : [];
  if (!futureItems.length && !actionItems.length) throw new Error("Future PDUFA and official FDA sources are unavailable");
  if (actions.status === "rejected") console.error("Official FDA actions unavailable", actions.reason);
  return {
    items: [...futureItems, ...actionItems].sort((a: any, b: any) => a.eventDate.localeCompare(b.eventDate)),
    source: "pdufa.bio future targets + FDA official actions",
    sourceUrl: PDUFA_CALENDAR_URL,
    health: {
      future: future.value.health,
      officialActions: { provider: "FDA Drugs@FDA", status: actions.status === "fulfilled" ? "healthy" : "unavailable", itemCount: actionItems.length },
    },
  };
}

type MacroEvent = {
  id: string; title: string; eventDate: string; time: string;
  timezone: "America/New_York"; agency: "BLS" | "BEA" | "Federal Reserve";
  impact: "high" | "medium"; sourceUrl: string; period?: string;
};

const monthNumber: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

function decodeIcs(value: string) {
  return value.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
}

function macroImpact(title: string): "high" | "medium" {
  return /employment situation|consumer price index|gross domestic product|personal income and outlays|fomc (?:rate decision|statement)/i.test(title) ? "high" : "medium";
}

async function fetchBlsMacro(): Promise<MacroEvent[]> {
  const response = await fetch(BLS_CALENDAR_URL, { headers: { "User-Agent": "SomaTech research@somatech.pro" } });
  if (!response.ok) throw new Error(`BLS calendar returned ${response.status}`);
  const unfolded = (await response.text()).replace(/\r?\n[ \t]/g, "");
  const major = /Employment Situation|Consumer Price Index|Producer Price Index|Job Openings and Labor Turnover|Productivity and Costs|Employment Cost Index|U\.S\. Import and Export Price Indexes/i;
  return [...unfolded.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)].flatMap((match) => {
    const block = match[1];
    const summary = decodeIcs(block.match(/(?:^|\n)SUMMARY:(.*)/)?.[1] ?? "");
    const dateTime = block.match(/(?:^|\n)DTSTART[^:]*:(\d{8})(?:T(\d{4,6}))?/);
    if (!major.test(summary) || !dateTime) return [];
    const [, day, rawTime = "083000"] = dateTime;
    const eventDate = `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;
    const hour = Number(rawTime.slice(0, 2)); const minute = rawTime.slice(2, 4);
    const time = `${hour > 12 ? hour - 12 : hour || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
    const [title, period] = summary.split(/\s+for\s+/i);
    return [{ id: `bls-${day}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, title, eventDate, time, timezone: "America/New_York" as const, agency: "BLS" as const, impact: macroImpact(title), sourceUrl: BLS_CALENDAR_URL, period }];
  });
}

function htmlText(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&#0?39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
}

async function fetchBeaMacro(): Promise<MacroEvent[]> {
  const response = await fetch(BEA_SCHEDULE_URL, { headers: { "User-Agent": "SomaTech research@somatech.pro" } });
  if (!response.ok) throw new Error(`BEA schedule returned ${response.status}`);
  const html = await response.text();
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const major = /GDP \(|Personal Income and Outlays|U\.S\. International Trade in Goods and Services/i;
  const year = new Date().getUTCFullYear();
  return rows.flatMap((row) => {
    const text = htmlText(row[1]);
    const date = text.match(new RegExp(`(${Object.keys(monthNumber).join("|")})\\s+(\\d{1,2})\\s+(\\d{1,2}:\\d{2}\\s+(?:AM|PM))`, "i"));
    const title = text.match(/(?:News|N\s*ews)\s+(.+?)(?:\s+View)?$/i)?.[1]?.trim();
    if (!date || !title || !major.test(title)) return [];
    const eventDate = `${year}-${monthNumber[date[1].toLowerCase()]}-${date[2].padStart(2, "0")}`;
    return [{ id: `bea-${eventDate}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`, title, eventDate, time: date[3].toUpperCase(), timezone: "America/New_York" as const, agency: "BEA" as const, impact: macroImpact(title), sourceUrl: BEA_SCHEDULE_URL }];
  });
}

function fetchFomcMacro(): MacroEvent[] {
  // Publish only dates explicitly present in the verified meeting schedule.
  // Minutes are often released about three weeks later, but "about" is not a
  // calendar date and holidays can move it; never manufacture a precise day.
  return allFomcMeetings().map(([eventDate, projections]) => ({
    id: `fomc-statement-${eventDate}`,
    title: `FOMC rate decision${projections ? " and economic projections" : ""}`,
    eventDate, time: "2:00 PM", timezone: "America/New_York",
    agency: "Federal Reserve", impact: "high", sourceUrl: FOMC_CALENDAR_URL,
  }));
}

async function fetchMacroEvents() {
  const results = await Promise.allSettled([fetchBlsMacro(), fetchBeaMacro()]);
  const fomc = fetchFomcMacro();
  const items = [...fomc, ...results.flatMap((result) => result.status === "fulfilled" ? result.value : [])]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const degraded = results.some((result) => result.status === "rejected");
  if (degraded) console.warn("One or more official macro schedules were unavailable", results);
  return {
    items, source: "BLS, BEA and Federal Reserve official schedules", sourceUrl: FOMC_CALENDAR_URL,
    warning: degraded ? "One or more official macro schedules could not be refreshed." : undefined,
    health: {
      BLS: { status: results[0].status === "fulfilled" ? "healthy" : "unavailable", itemCount: results[0].status === "fulfilled" ? results[0].value.length : 0 },
      BEA: { status: results[1].status === "fulfilled" ? "healthy" : "unavailable", itemCount: results[1].status === "fulfilled" ? results[1].value.length : 0 },
      FederalReserve: { status: "verified_static", itemCount: fomc.length, horizonEnd: FOMC_DATES[2027]?.at(-1)?.[0] ?? null },
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return corsError("Method not allowed", 405);
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return corsError("Authentication required", 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authError } = await supabase.auth.getUser(auth.slice(7));
  if (authError || !user) return corsError("Invalid or expired session", 401);

  try {
    const { kind, force = false } = await req.json().catch(() => ({}));
    if (!['earnings', 'pdufa', 'macro'].includes(kind)) return corsError("kind must be earnings, pdufa or macro", 400);
    const { data: cached } = await supabase.from("market_calendar_cache").select("*").eq("cache_key", kind).maybeSingle();
    const requiredFeedVersion = kind === "pdufa" ? 4 : 1;
    const fresh = cached && cached.payload?.feedVersion === requiredFeedVersion && Date.parse(cached.expires_at) > Date.now();
    if (fresh && !force) return corsResponse({ ...cached.payload, source: cached.source, sourceUrl: cached.source_url, fetchedAt: cached.fetched_at, cached: true, stale: false });

    try {
      const result = kind === 'earnings'
        ? await fetchEarnings(Deno.env.get("ALPHA_VANTAGE_API_KEY") ?? "")
        : kind === 'pdufa' ? await fetchPdufaCalendar() : await fetchMacroEvents();
      const resultWarning = "warning" in result ? result.warning : undefined;
      if (kind === 'pdufa' && cached) {
        const previousCount = (cached.payload.items ?? []).filter((item: any) => item.sourceType === 'issuer_compiled').length;
        const currentCount = result.items.filter((item: any) => item.sourceType === 'issuer_compiled').length;
        if (previousCount >= 10 && currentCount < Math.max(5, Math.floor(previousCount * 0.5))) {
          throw new Error(`Future PDUFA coverage dropped unexpectedly from ${previousCount} to ${currentCount}`);
        }
      }
      if (kind === 'macro' && resultWarning && cached) throw new Error(resultWarning);
      const fetchedAt = new Date().toISOString();
      const { error: cacheError } = await supabase.from("market_calendar_cache").upsert({
        cache_key: kind, payload: { items: result.items, health: result.health ?? null, feedVersion: requiredFeedVersion }, source: result.source,
        source_url: result.sourceUrl, fetched_at: fetchedAt,
        expires_at: new Date(Date.now() + CACHE_MS).toISOString(),
      });
      if (cacheError) console.error("Calendar cache write failed", cacheError);
      return corsResponse({ items: result.items, health: result.health ?? null, source: result.source, sourceUrl: result.sourceUrl, fetchedAt, cached: false, stale: false, warning: resultWarning });
    } catch (providerError) {
      if (cached) return corsResponse({ ...cached.payload, source: cached.source, sourceUrl: cached.source_url, fetchedAt: cached.fetched_at, cached: true, stale: true, warning: "Live refresh failed; showing the last verified snapshot." });

      // Cold start with a failing provider and no snapshot to fall back on.
      // Previously this threw and became a 502, which the client treated as a
      // transport error and retried hard. A missing dataset is not a gateway
      // failure: answer 200 with an empty, explicitly-stale result so the page
      // renders an honest empty state and React Query stops hammering.
      console.error("market-calendar provider failed with no cache", providerError);
      return corsResponse({
        items: [],
        source: kind === "earnings" ? "Alpha Vantage Earnings Calendar" : kind === "pdufa" ? "pdufa.bio future targets + FDA official actions" : "BLS, BEA and Federal Reserve official schedules",
        sourceUrl: kind === "earnings" ? EARNINGS_SOURCE_URL : kind === "pdufa" ? PDUFA_CALENDAR_URL : FOMC_CALENDAR_URL,
        fetchedAt: new Date().toISOString(),
        cached: false,
        stale: true,
        warning: providerError instanceof Error
          ? `Live data is unavailable right now: ${providerError.message}`
          : "Live data is unavailable right now.",
      });
    }
  } catch (error) {
    // Reaching here means a genuine fault in this function, not upstream data.
    console.error("market-calendar error", error);
    return corsError(error instanceof Error ? error.message : "Calendar data is unavailable", 500);
  }
});
