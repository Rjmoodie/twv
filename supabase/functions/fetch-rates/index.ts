import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsError, corsResponse, CORS_HEADERS } from "../_shared/cors.ts";
import { FOMC_CALENDAR_URL, nextFomcMeeting } from "../_shared/fomcDates.ts";

/**
 * Interest rates across the board, from FRED.
 *
 * Everything here is a published statistical series — policy rates, the
 * Treasury curve, and what households actually pay to borrow. FRED is free and
 * redistributable, which is why this exists instead of an integration with a
 * licensed vendor feed.
 *
 * What this deliberately does NOT do is imply where rates are going. Deriving
 * market-implied probabilities of a Fed move needs Fed Funds futures prices,
 * which FRED does not carry. Showing observed rates is honest; extrapolating
 * them into a forecast from this data would not be.
 */

const FRED_API_KEY = Deno.env.get("FRED_API_KEY");
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const FRED_SOURCE_URL = "https://fred.stlouisfed.org/";

/** Rates move at most daily; several of these are weekly or quarterly. */
const CACHE_MS = 60 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 8_000;

type Group = "policy" | "treasury" | "lending";

interface SeriesSpec {
  id: string;
  label: string;
  group: Group;
  /** How often the source republishes — shown so a quarterly figure isn't read as today's. */
  cadence: "daily" | "weekly" | "monthly" | "quarterly";
}

const SERIES: SeriesSpec[] = [
  // ── Policy ────────────────────────────────────────────────────────────────
  { id: "DFEDTARU", label: "Fed target (upper)", group: "policy", cadence: "daily" },
  { id: "DFEDTARL", label: "Fed target (lower)", group: "policy", cadence: "daily" },
  { id: "EFFR",     label: "Effective fed funds", group: "policy", cadence: "daily" },
  { id: "SOFR",     label: "SOFR",              group: "policy", cadence: "daily" },

  // ── Treasury curve ────────────────────────────────────────────────────────
  { id: "DGS3MO", label: "3-month", group: "treasury", cadence: "daily" },
  { id: "DGS2",   label: "2-year",  group: "treasury", cadence: "daily" },
  { id: "DGS10",  label: "10-year", group: "treasury", cadence: "daily" },
  { id: "DGS30",  label: "30-year", group: "treasury", cadence: "daily" },
  { id: "T10Y2Y", label: "10Y minus 2Y", group: "treasury", cadence: "daily" },

  // ── What it costs to borrow ───────────────────────────────────────────────
  { id: "MORTGAGE30US",   label: "30-yr mortgage",  group: "lending", cadence: "weekly" },
  { id: "MORTGAGE15US",   label: "15-yr mortgage",  group: "lending", cadence: "weekly" },
  { id: "DPRIME",         label: "Bank prime rate", group: "lending", cadence: "daily" },
  { id: "TERMCBCCALLNS",  label: "Credit cards",    group: "lending", cadence: "quarterly" },
  { id: "TERMCBAUTO48NS", label: "Auto (48-mo)",    group: "lending", cadence: "quarterly" },
  { id: "SNDR",           label: "Savings (national)", group: "lending", cadence: "monthly" },
];

interface RateReading {
  id: string;
  label: string;
  group: Group;
  cadence: SeriesSpec["cadence"];
  /** Percent, e.g. 4.18. Null when the source has no usable recent value. */
  value: number | null;
  /** Change from the previous observation, in basis points. */
  changeBps: number | null;
  /** Observation date of `value` (YYYY-MM-DD). */
  asOf: string | null;
}

/**
 * FRED marks missing observations with ".", and a series can carry a run of
 * them (holidays, or a month that has not been published yet). Pull a short
 * window and take the two most recent real numbers rather than assuming the
 * first two rows are usable.
 */
async function fetchSeries(spec: SeriesSpec): Promise<RateReading> {
  const url =
    `${FRED_BASE}?series_id=${spec.id}&api_key=${FRED_API_KEY}` +
    `&file_type=json&sort_order=desc&limit=12`;

  const base: RateReading = {
    id: spec.id, label: spec.label, group: spec.group,
    cadence: spec.cadence, value: null, changeBps: null, asOf: null,
  };

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`FRED ${spec.id} responded ${res.status}`);
    const json = await res.json();
    const observations: Array<{ date: string; value: string }> = json?.observations ?? [];

    const usable = observations
      .map((o) => ({ date: o.date, value: Number.parseFloat(o.value) }))
      .filter((o) => Number.isFinite(o.value));

    if (usable.length === 0) return base;

    const [latest, previous] = usable;
    return {
      ...base,
      value: latest.value,
      asOf: latest.date,
      // Rates are quoted in percent; the market talks about moves in basis
      // points. Round to whole bps so floating-point noise never renders.
      changeBps: previous ? Math.round((latest.value - previous.value) * 100) : null,
    };
  } catch (error) {
    console.error(`fetch-rates: ${spec.id} failed`, error);
    return base;
  }
}

interface Snapshot {
  rates: RateReading[];
  nextFomc: { date: string; hasProjections: boolean } | null;
  fomcUrl: string;
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  cached: boolean;
  warning?: string;
}

let cache: { snapshot: Snapshot; expiresAt: number } | null = null;
let inFlight: Promise<Snapshot> | null = null;

async function buildSnapshot(): Promise<Snapshot> {
  const rates = await Promise.all(SERIES.map(fetchSeries));
  const missing = rates.filter((r) => r.value === null).length;

  return {
    rates,
    nextFomc: nextFomcMeeting(),
    fomcUrl: FOMC_CALENDAR_URL,
    source: "Federal Reserve Economic Data (FRED), St. Louis Fed",
    sourceUrl: FRED_SOURCE_URL,
    fetchedAt: new Date().toISOString(),
    cached: false,
    // Partial data is normal and useful — say so rather than failing the whole
    // panel because one quarterly series has not been republished yet.
    warning: missing === rates.length
      ? 'FRED returned no usable recent observations for any configured series.'
      : missing > 0
        ? `${missing} of ${rates.length} series had no recent value.`
        : undefined,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    if (!FRED_API_KEY) {
      // A missing key is a deployment gap, not a user-facing fault. Answer 200
      // with an explicit reason so the dashboard renders a "not configured"
      // state instead of a spinner or a scary error.
      return corsResponse({
        rates: [], nextFomc: nextFomcMeeting(), fomcUrl: FOMC_CALENDAR_URL,
        source: "Federal Reserve Economic Data (FRED), St. Louis Fed",
        sourceUrl: FRED_SOURCE_URL, fetchedAt: new Date().toISOString(),
        cached: false,
        warning: "FRED_API_KEY is not configured for this project.",
      });
    }

    if (cache && cache.expiresAt > Date.now()) {
      return corsResponse({ ...cache.snapshot, cached: true });
    }

    // Collapse concurrent cold-start requests into one upstream fan-out;
    // fifteen series times every visitor would burn the FRED rate limit.
    inFlight ??= buildSnapshot().finally(() => { inFlight = null; });
    const snapshot = await inFlight;

    if (snapshot.rates.some((r) => r.value !== null)) {
      cache = { snapshot, expiresAt: Date.now() + CACHE_MS };
    }
    return corsResponse(snapshot);
  } catch (error) {
    console.error("fetch-rates error", error);
    if (cache) {
      return corsResponse({
        ...cache.snapshot, cached: true,
        warning: "Live refresh failed; showing the last successful snapshot.",
      });
    }
    return corsError(
      error instanceof Error ? error.message : "Rate data is unavailable",
      500,
    );
  }
});
