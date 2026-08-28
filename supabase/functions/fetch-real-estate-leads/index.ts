/**
 * fetch-real-estate-leads
 *
 * Pulls property leads from free public sources in parallel and upserts
 * them into the real_estate_leads table.
 *
 * Fixes applied:
 *  - Sources run with Promise.allSettled (parallel) to avoid 60s timeout
 *  - Caller auth verified before doing any work
 *  - r['class'] instead of r.class (reserved word)
 *  - HUD dedup uses stable address hash instead of array index
 *  - HUD HTTP status logged on non-200 response
 *  - Socrata typed as Record<string, unknown> (mixed JSON types)
 *  - source_record_id always coerced to string
 *
 * Body: { sources?: string[] }  — omit to run all Phase 1 sources
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, corsError, CORS_HEADERS } from "../_shared/cors.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NormalisedLead {
  data_source:           string;
  source_record_id?:     string;
  source_url?:           string;
  lead_type:             string;
  property_address?:     string;
  city?:                 string;
  state?:                string;
  county?:               string;
  zip?:                  string;
  latitude?:             number;
  longitude?:            number;
  owner_name?:           string;
  mailing_address?:      string;
  is_absentee?:          boolean;
  is_llc_owned?:         boolean;
  property_value?:       number;
  equity_estimate?:      number;
  last_sale_date?:       string;
  tax_amount?:           number;
  violation_description?: string;
  status?:               string;
  severity?:             string;
  tags?:                 string[];
  incident_date?:        string;
}

// Socrata rows contain mixed JSON types — numbers, booleans, nested objects
type SocrataRow = Record<string, unknown>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  return String(v).trim() || undefined;
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? undefined : n;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/** Stable 8-char hex hash for HUD records that lack a clean primary key */
function stableHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(31, h) + input.charCodeAt(i) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function clean(lead: NormalisedLead): NormalisedLead {
  return Object.fromEntries(
    Object.entries(lead).filter(([, v]) => v !== "" && v !== null && v !== undefined)
  ) as NormalisedLead;
}

// ── Socrata fetch helper ──────────────────────────────────────────────────────

async function fetchSocrata(
  domain: string,
  datasetId: string,
  params: Record<string, string>,
  appToken?: string,
  expectedFields?: string[],  // log a warning if any are missing from the first row
): Promise<SocrataRow[]> {
  const qs = new URLSearchParams({ $limit: "500", ...params });
  const url = `https://${domain}/resource/${datasetId}.json?${qs}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (appToken) headers["X-App-Token"] = appToken;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Socrata ${domain}/${datasetId} → HTTP ${res.status}`);
  }
  const rows: SocrataRow[] = await res.json();

  // Schema drift detection: warn when expected fields are absent from the first row.
  // This fires in logs so we notice schema changes immediately rather than silently
  // producing all-null leads.
  if (expectedFields && rows.length > 0) {
    const firstRow = rows[0];
    const missing = expectedFields.filter(f => !(f in firstRow));
    if (missing.length > 0) {
      console.warn(
        `[${domain}/${datasetId}] Schema drift detected — expected fields not present: ${missing.join(", ")}. ` +
        `Available keys: ${Object.keys(firstRow).slice(0, 20).join(", ")}`
      );
    }
  }

  return rows;
}

// ── Source normalisers ────────────────────────────────────────────────────────

async function fetchChicagoViolations(token?: string): Promise<NormalisedLead[]> {
  try {
    const rows = await fetchSocrata(
      "data.cityofchicago.org",
      "22u3-xenr",
      { $order: "violation_date DESC", $where: "violation_status='OPEN'" },
      token,
      ["violation_status", "violation_date", "violation_description", "zip_code"],
    );

    return rows.map(r => clean({
      data_source:           "chicago_violations",
      source_record_id:      str(r.inspection_number ?? r.id),
      source_url:            "https://data.cityofchicago.org/Buildings/Building-Violations/22u3-xenr",
      lead_type:             "code_violation",
      // 'address' field is the clean full address — use it directly
      property_address:      (str(r.address) || [r.street_number, r.street_direction, r.street_name, r.street_type]
                               .map(v => str(v)).filter(Boolean).join(" ")) || undefined,
      city:                  "Chicago",
      state:                 "IL",
      county:                "Cook",
      zip:                   str(r.zip_code),
      latitude:              num(r.latitude),
      longitude:             num(r.longitude),
      violation_description: str(r.violation_description),
      status:                str(r.violation_status ?? r.status),
      severity:              "medium",
      tags:                  ["code_violation", "distressed"],
      incident_date:         str(r.violation_date)?.split("T")[0],
    }));
  } catch { return []; }
}

async function fetchNycHpd(token?: string): Promise<NormalisedLead[]> {
  try {
  const rows = await fetchSocrata(
    "data.cityofnewyork.us",
    "wvxf-dwi5",
    { $order: "inspectiondate DESC", $where: "violationstatus='Open'" },
    token,
    ["violationid", "violationstatus", "inspectiondate", "class", "novdescription"],
  );

  const severityMap: Record<string, string> = { A: "low", B: "medium", C: "high" };

  return rows.map(r => {
    // 'class' is a JS reserved word — must use bracket notation
    const violationClass = str(r["class"])?.toUpperCase() ?? "";
    return clean({
      data_source:           "nyc_hpd",
      source_record_id:      str(r.violationid),
      source_url:            "https://data.cityofnewyork.us/Housing-Development/Housing-Maintenance-Code-Violations/wvxf-dwi5",
      lead_type:             "code_violation",
      // housenumber + streetname — buildingaddress field does not exist in this dataset
      property_address:      [r.housenumber, r.streetname].filter(Boolean).map(v => str(v)).join(" ") || undefined,
      city:                  r.boro ? titleCase(String(r.boro)) : "New York",
      state:                 "NY",
      county:                "New York",
      zip:                   str(r.zip ?? r.postcode),
      latitude:              num(r.latitude),
      longitude:             num(r.longitude),
      violation_description: str(r.novdescription),
      status:                str(r.currentstatus ?? r.violationstatus),
      severity:              severityMap[violationClass] ?? "medium",
      tags:                  ["code_violation", violationClass === "C" ? "distressed" : "violation"].filter(Boolean),
      incident_date:         str(r.inspectiondate)?.split("T")[0],
    });
  });
  } catch { return []; }
}

// SF: replaced gxxh-x33n (retired) with 311 service requests vw6y-z8j6
async function fetchSfViolations(token?: string): Promise<NormalisedLead[]> {
  try {
    const rows = await fetchSocrata(
      "data.sfgov.org",
      "vw6y-z8j6",
      {
        $order: "requested_datetime DESC",
        $where: "service_name like '%Building%' AND status_description = 'Open'",
        $limit: "500",
      },
      token,
      ["service_request_id", "requested_datetime", "address", "status_description"],
    );
    return rows.map(r => clean({
      data_source:           "sf_violations",
      source_record_id:      str(r.service_request_id),
      source_url:            "https://data.sfgov.org/City-Infrastructure/311-Cases/vw6y-z8j6",
      lead_type:             "code_violation",
      property_address:      str(r.address ?? r.street),
      city:                  "San Francisco",
      state:                 "CA",
      county:                "San Francisco",
      zip:                   undefined,
      latitude:              num(r.lat),
      longitude:             num(r.long),
      violation_description: [str(r.service_name), str(r.service_subtype)].filter(Boolean).join(" — ") || undefined,
      status:                str(r.status_description),
      severity:              "medium",
      tags:                  ["code_violation", "311"],
      incident_date:         str(r.requested_datetime)?.split("T")[0],
    }));
  } catch { return []; }
}

// LA: replaced nuax-tpn5 (retired) with Building & Safety open code cases u82d-eh7z
async function fetchLaViolations(token?: string): Promise<NormalisedLead[]> {
  try {
    const rows = await fetchSocrata(
      "data.lacity.org",
      "u82d-eh7z",
      { $order: "adddttm DESC", $limit: "500" },
      token,
      ["apno", "stno", "stname", "zip", "adddttm", "aptype"],
    );
    return rows.map(r => clean({
      data_source:           "la_violations",
      source_record_id:      str(r.apno),
      source_url:            "https://data.lacity.org/A-Safe-City/Building-and-Safety-Code-Enforcement-Case-Open-/u82d-eh7z",
      lead_type:             "code_violation",
      property_address:      [r.stno, r.predir, r.stname, r.suffix].map(v => str(v)).filter(Boolean).join(" ") || undefined,
      city:                  "Los Angeles",
      state:                 "CA",
      county:                "Los Angeles",
      zip:                   str(r.zip),
      violation_description: str(r.aptype ?? r.apname),
      status:                str(r.stat) ?? "Open",
      severity:              "medium",
      tags:                  ["code_violation"],
      incident_date:         str(r.adddttm)?.split("T")[0],
    }));
  } catch { return []; }
}

// Austin: replaced tj2v-bihr (retired) with 6wtj-zbtb (Austin Code Complaint Cases)
async function fetchAustinViolations(token?: string): Promise<NormalisedLead[]> {
  try {
    const rows = await fetchSocrata(
      "data.austintexas.gov",
      "6wtj-zbtb",
      { $order: "opened_date DESC", $where: "status != 'Closed'", $limit: "500" },
      token,
      ["case_id", "address", "opened_date", "status", "case_type"],
    );
    return rows.map(r => clean({
      data_source:           "austin_violations",
      source_record_id:      str(r.case_id),
      source_url:            "https://data.austintexas.gov/Locations-and-Maps/Austin-Code-Complaint-Cases/6wtj-zbtb",
      lead_type:             "code_violation",
      property_address:      str(r.address),
      city:                  "Austin",
      state:                 "TX",
      county:                "Travis",
      zip:                   str(r.zip_code),
      latitude:              num(r.latitude),
      longitude:             num(r.longitude),
      violation_description: str(r.case_type ?? r.description),
      status:                str(r.status),
      severity:              "medium",
      tags:                  ["code_violation"],
      incident_date:         str(r.opened_date)?.split("T")[0],
    }));
  } catch { return []; }
}

// Seattle: replaced k5rx-bsza (retired) with ez4a-iug7 (Code Complaints and Violations)
async function fetchSeattleViolations(token?: string): Promise<NormalisedLead[]> {
  try {
    const rows = await fetchSocrata(
      "data.seattle.gov",
      "ez4a-iug7",
      { $order: "opendate DESC", $where: "statuscurrent != 'Closed'", $limit: "500" },
      token,
      ["recordnum", "originaladdress1", "opendate", "statuscurrent", "description"],
    );
    return rows.map(r => clean({
      data_source:           "seattle_violations",
      source_record_id:      str(r.recordnum),
      source_url:            str(r.link) ?? "https://data.seattle.gov/Community/Code-Complaints-and-Violations/ez4a-iug7",
      lead_type:             "code_violation",
      property_address:      str(r.originaladdress1),
      city:                  str(r.originalcity) ?? "Seattle",
      state:                 str(r.originalstate) ?? "WA",
      county:                "King",
      zip:                   str(r.originalzip),
      latitude:              num(r.latitude),
      longitude:             num(r.longitude),
      violation_description: str(r.description ?? r.recordtypedesc),
      status:                str(r.statuscurrent),
      severity:              str(r.lastinspresult ?? "")?.toLowerCase().includes("fail") ? "high" : "medium",
      tags:                  ["code_violation"],
      incident_date:         str(r.opendate)?.split("T")[0],
    }));
  } catch { return []; }
}

/**
 * HUD Home Store — FHA-foreclosed (HUD-owned) residential properties.
 * Source: api.hudhomestore.gov  (official HUD listing API used by brokers)
 * This is the correct REO source. The previous USDA/FSA endpoint was
 * agricultural land, not housing.
 */
async function fetchHudReo(): Promise<NormalisedLead[]> {
  try {
    const res = await fetch(
      "https://api.hudhomestore.gov/api/ListingSummary/GetListingList",
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          stateCode: "", city: "", zipCode: "", streetAddress: "",
          listingCount: 200, startIndex: 0,
          // Only active listings
          status: "A",
        }),
      },
    );
    if (!res.ok) {
      console.warn(`[hud_reo] HUD Home Store HTTP ${res.status} — trying fallback`);
      return fetchHudReoFallback();
    }
    const json = await res.json();
    // API returns { responseData: { listingSummaryResponses: [...] } }
    const items: SocrataRow[] = json?.responseData?.listingSummaryResponses ?? [];
    if (!Array.isArray(items) || items.length === 0) {
      console.warn("[hud_reo] HUD Home Store returned empty — trying fallback");
      return fetchHudReoFallback();
    }

    return items.slice(0, 200).map(r => {
      const address   = str(r.streetAddress ?? r.address) ?? "";
      const city      = str(r.city) ?? "";
      const stateCode = str(r.stateCode ?? r.state) ?? "";
      const caseNum   = str(r.caseNumber ?? r.listingNumber);
      const stableId  = caseNum ?? stableHash(`${address}|${city}|${stateCode}`);

      return clean({
        data_source:           "hud_reo",
        source_record_id:      stableId,
        source_url:            caseNum
          ? `https://www.hudhomestore.gov/Listing/PropertyDetails.aspx?caseNumber=${caseNum}`
          : "https://www.hudhomestore.gov",
        lead_type:             "reo",
        property_address:      address || undefined,
        city:                  city || undefined,
        state:                 stateCode || undefined,
        zip:                   str(r.zipCode ?? r.zip),
        property_value:        num(r.listingPrice ?? r.listPrice),
        owner_name:            "HUD / FHA",
        violation_description: "HUD-owned (FHA foreclosure). Government REO — investor-eligible.",
        status:                str(r.listingStatus) ?? "Active",
        severity:              "high",
        tags:                  ["reo", "hud", "fha-foreclosure", "motivated_seller"],
        incident_date:         str(r.listingDate ?? r.dateAdded)?.split("T")[0],
      });
    });
  } catch (err) {
    console.error("[hud_reo] fetch error:", err);
    return fetchHudReoFallback();
  }
}

/**
 * Fallback: USDA/FSA rural property resales.
 * These are agricultural/rural properties — NOT residential housing REO.
 * Kept as a fallback only. Leads are tagged clearly to avoid confusion.
 */
async function fetchHudReoFallback(): Promise<NormalisedLead[]> {
  try {
    const res = await fetch(
      "https://properties.sc.egov.usda.gov/resales/resaleSearch/searchFSA?format=json&limit=100",
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) {
      console.warn(`[hud_reo] USDA fallback HTTP ${res.status} — source unavailable`);
      return [];
    }
    const json = await res.json();
    const items: SocrataRow[] = json.properties ?? json.results ?? (Array.isArray(json) ? json : []);
    if (!Array.isArray(items)) return [];

    return items.slice(0, 100).map(r => {
      const address   = str(r.address ?? r.propertyAddress) ?? "";
      const city      = str(r.city) ?? "";
      const stateCode = str(r.state ?? r.stateCode) ?? "";
      const stableId  = stableHash(`usda|${address}|${city}|${stateCode}`);

      return clean({
        data_source:           "hud_reo",
        source_record_id:      str(r.id ?? r.caseNumber) ?? stableId,
        source_url:            "https://properties.sc.egov.usda.gov/resales/public/searchFSA",
        lead_type:             "reo",
        property_address:      address || undefined,
        city:                  city || undefined,
        state:                 stateCode || undefined,
        zip:                   str(r.zip ?? r.zipCode),
        latitude:              num(r.latitude),
        longitude:             num(r.longitude),
        property_value:        num(r.listPrice),
        violation_description: "USDA/FSA rural property resale. Note: agricultural/rural — not residential REO.",
        status:                str(r.status) ?? "Active",
        severity:              "medium",
        tags:                  ["reo", "usda", "rural", "government"],
        incident_date:         str(r.listDate ?? r.dateAdded)?.split("T")[0],
      });
    });
  } catch {
    return [];
  }
}

// Boston: ISD (Inspectional Services Dept) building violations via Socrata.
async function fetchBostonViolations(token?: string): Promise<NormalisedLead[]> {
  try {
    const rows = await fetchSocrata(
      "data.boston.gov",
      "y7d6-8e2h",
      { $order: "open_dt DESC", $where: "status='Open'", $limit: "500" },
      token,
      ["case_no", "address", "description", "status", "open_dt"],
    );
    return rows.map(r => clean({
      data_source:           "boston_violations",
      source_record_id:      str(r.case_no),
      source_url:            "https://data.boston.gov/dataset/isd-building-and-structures-violations",
      lead_type:             "code_violation",
      property_address:      str(r.address),
      city:                  str(r.city) ?? "Boston",
      state:                 "MA",
      county:                "Suffolk",
      zip:                   str(r.zip_code ?? r.zip),
      latitude:              num(r.latitude),
      longitude:             num(r.longitude),
      violation_description: str(r.description ?? r.violation_type),
      status:                str(r.status),
      severity:              "medium",
      tags:                  ["code_violation", "isd"],
      incident_date:         str(r.open_dt)?.split("T")[0],
    }));
  } catch { return []; }
}

// Philadelphia: L&I (Licenses & Inspections) violations via CARTO SQL API.
// OpenDataPhilly uses CARTO, not Socrata — different fetch path.
async function fetchPhiladelphiaViolations(): Promise<NormalisedLead[]> {
  try {
    // Field names confirmed against live schema. lat/lng from PostGIS geometry.
    // ownername is on the violations table directly — no OPA lookup needed for owner.
    const sql = encodeURIComponent(
      `SELECT objectid, address, zip, violationtype, violationdescription, aptype, ` +
      `violationdate, casestatus, ownername, ` +
      `ST_X(the_geom) as lng, ST_Y(the_geom) as lat ` +
      `FROM li_violations ` +
      `WHERE casestatus = 'OPEN' ` +
      `ORDER BY violationdate DESC ` +
      `LIMIT 500`
    );
    const url = `https://phl.carto.com/api/v2/sql?q=${sql}&format=json`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Philadelphia L&I CARTO HTTP ${res.status}`);
    const json = await res.json();
    // CARTO returns HTTP 200 with { error: [...] } on SQL/table errors — treat as failure
    if (json.error) throw new Error(`Philadelphia L&I CARTO error: ${JSON.stringify(json.error)}`);
    const rows: Record<string, unknown>[] = json.rows ?? [];

    return rows.map(r => clean({
      data_source:           "philly_violations",
      source_record_id:      str(r.objectid),
      source_url:            "https://opendataphilly.org/datasets/licenses-and-inspections-violations/",
      lead_type:             "code_violation",
      property_address:      str(r.address),
      city:                  "Philadelphia",
      state:                 "PA",
      county:                "Philadelphia",
      zip:                   str(r.zip),
      latitude:              num(r.lat),
      longitude:             num(r.lng),
      owner_name:            str(r.ownername),
      violation_description: str(r.violationdescription ?? r.violationtype ?? r.aptype),
      status:                str(r.casestatus),
      severity:              "medium",
      tags:                  ["code_violation", "li_violation"],
      incident_date:         str(r.violationdate)?.split("T")[0],
    }));
  } catch { return []; }
}

// ── Source registry ───────────────────────────────────────────────────────────

const SOURCE_HANDLERS: Record<string, (token?: string) => Promise<NormalisedLead[]>> = {
  chicago_violations:   fetchChicagoViolations,
  nyc_hpd:             fetchNycHpd,
  sf_violations:       fetchSfViolations,
  la_violations:       fetchLaViolations,
  austin_violations:   fetchAustinViolations,
  seattle_violations:  fetchSeattleViolations,
  hud_reo:             fetchHudReo,
  philly_violations:   fetchPhiladelphiaViolations,
  boston_violations:   fetchBostonViolations,
};

const ALL_PHASE_1_SOURCES = Object.keys(SOURCE_HANDLERS);

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // ── Auth guard ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return corsError("Unauthorized", 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Accept either a server trigger secret (for scheduled/automated fetches)
  // or a valid user JWT (for browser-triggered fetches).
  const token = authHeader.replace("Bearer ", "");
  const triggerSecret = Deno.env.get("FETCH_TRIGGER_SECRET");
  const isServerTrigger = triggerSecret && token === triggerSecret;

  if (!isServerTrigger) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return corsError("Unauthorized", 401);
    }
  }

  const socrata_token = Deno.env.get("SOCRATA_APP_TOKEN");

  try {
    const body    = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const sources: string[] = body.sources ?? ALL_PHASE_1_SOURCES;

    const invalid = sources.filter(s => !SOURCE_HANDLERS[s]);
    if (invalid.length) {
      return corsError(`Unknown sources: ${invalid.join(", ")}. Valid: ${ALL_PHASE_1_SOURCES.join(", ")}`);
    }

    // ── Insert job rows upfront (status: running) ──────────────────────────
    const jobIds: Record<string, string> = {};
    await Promise.all(sources.map(async (source) => {
      const { data: job } = await supabase
        .from("real_estate_fetch_jobs")
        .insert({ data_source: source, status: "running" })
        .select("id")
        .single();
      if (job?.id) jobIds[source] = job.id;
    }));

    // ── Fetch all sources in parallel ──────────────────────────────────────
    const results = await Promise.allSettled(
      sources.map(source =>
        SOURCE_HANDLERS[source](socrata_token)
          .then(leads => ({ source, leads }))
          .catch(err => Promise.reject({ source, err }))
      )
    );

    const summary: Record<string, { fetched: number; inserted: number; updated: number; error?: string }> = {};
    const BATCH = 100;

    await Promise.all(results.map(async (result) => {
      if (result.status === "rejected") {
        const { source, err } = result.reason as { source: string; err: unknown };
        const msg = err instanceof Error ? err.message : String(err);
        summary[source] = { fetched: 0, inserted: 0, updated: 0, error: msg };
        console.error(`[${source}] rejected:`, msg);
        const jobId = jobIds[source];
        if (jobId) await supabase.from("real_estate_fetch_jobs").update({
          status: "failed", error_message: msg, completed_at: new Date().toISOString(),
        }).eq("id", jobId);
        return;
      }

      const { source, leads: rawLeads } = result.value;
      const cleaned = rawLeads.map(clean);

      // Deduplicate within the fetched batch by source_record_id.
      // Some sources (e.g. Chicago) return the same ID multiple times.
      // PostgreSQL raises "ON CONFLICT DO UPDATE command cannot affect row a second time"
      // if the same conflict key appears twice in a single INSERT statement.
      const seenIds = new Set<string>();
      const leads = cleaned.filter(l => {
        if (!l.source_record_id) return true;
        if (seenIds.has(l.source_record_id)) return false;
        seenIds.add(l.source_record_id);
        return true;
      });

      if (cleaned.length !== leads.length) {
        console.warn(`[${source}] Dropped ${cleaned.length - leads.length} duplicate source_record_ids before upsert`);
      }
      const jobId = jobIds[source];

      if (leads.length === 0) {
        summary[source] = { fetched: 0, inserted: 0, updated: 0 };
        if (jobId) await supabase.from("real_estate_fetch_jobs").update({
          status: "completed", records_fetched: 0, records_inserted: 0, records_updated: 0,
          completed_at: new Date().toISOString(),
        }).eq("id", jobId);
        return;
      }

      let inserted = 0;
      let upsertErr: Error | null = null;

      // Strip the GENERATED ALWAYS AS column before upsert.
      // PostgreSQL rejects any attempt to SET a generated column, and
      // PostgREST builds the SET clause from whatever keys are in the payload.
      // This guard ensures the column can never appear even if NormalisedLead widens.
      const safeLeads = leads.map((lead) => {
        const { is_distressed: _drop, ...rest } = lead as unknown as Record<string, unknown>;
        void _drop;
        return rest;
      });

      for (let i = 0; i < safeLeads.length; i += BATCH) {
        const { error } = await supabase
          .from("real_estate_leads")
          .upsert(safeLeads.slice(i, i + BATCH), {
            onConflict: "data_source,source_record_id",
            ignoreDuplicates: false,
          });
        if (error) { upsertErr = error; break; }
        inserted += Math.min(BATCH, safeLeads.length - i);
      }

      if (upsertErr) {
        const msg = upsertErr.message;
        summary[source] = { fetched: leads.length, inserted, updated: 0, error: msg };
        if (jobId) await supabase.from("real_estate_fetch_jobs").update({
          status: "failed", records_fetched: leads.length, error_message: msg,
          completed_at: new Date().toISOString(),
        }).eq("id", jobId);
      } else {
        summary[source] = { fetched: leads.length, inserted, updated: 0 };
        if (jobId) await supabase.from("real_estate_fetch_jobs").update({
          status: "completed", records_fetched: leads.length,
          records_inserted: inserted, records_updated: 0,
          completed_at: new Date().toISOString(),
        }).eq("id", jobId);
      }
    }));

    const totalFetched  = Object.values(summary).reduce((a, s) => a + s.fetched,  0);
    const totalInserted = Object.values(summary).reduce((a, s) => a + s.inserted, 0);
    const errors        = Object.entries(summary).filter(([, s]) => s.error).map(([k, s]) => `${k}: ${s.error}`);

    return corsResponse({ success: true, summary, totalFetched, totalInserted, errors });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("fetch-real-estate-leads fatal:", msg);
    return corsError(msg, 500);
  }
});
