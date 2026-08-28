/**
 * enrich-real-estate-leads
 *
 * Lane 2: Cross-references existing real_estate_leads with free county
 * assessor datasets to fill in owner_name and property_value.
 *
 * Sources:
 *  - NYC PLUTO (data.cityofnewyork.us/64uk-42ks) → nyc_hpd leads
 *  - Cook County Assessor (data.cookcountyil.gov/uzyt-m557) → chicago_violations leads
 *  - SF Assessor-Recorder (data.sfgov.org/wv5m-vpq2) → sf_violations leads
 *  - Boston Property Assessment (data.boston.gov/fd3b-xuhz) → boston_violations leads
 *  - Philadelphia OPA (phl.carto.com/opa_properties_public) → philly_violations leads
 *
 * Matching strategy: normalized_address (lowercase, alphanumeric + spaces)
 *
 * Auth: service trigger secret or valid user JWT (same as fetch function)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, corsError, CORS_HEADERS } from "../_shared/cors.ts";

// The generated database type is not bundled with Edge Functions. Keep the
// admin client structurally open here; individual payloads are typed below.
type AdminClient = ReturnType<typeof createClient<any>>;

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

function normalizeAddress(addr: string): string {
  return addr.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();
}

type AssessorRecord = {
  normalizedAddress: string;
  ownerName:         string | undefined;
  propertyValue:     number | undefined;
  mailingAddress:    string | undefined;
};

// ── NYC PLUTO ─────────────────────────────────────────────────────────────────
// PLUTO is the NYC tax lot dataset — has ownername + assesstot + address for
// every building in NYC. ~860K rows; we query by address to stay efficient.

async function fetchPlutoForAddresses(
  addresses: string[],
): Promise<Map<string, AssessorRecord>> {
  const result = new Map<string, AssessorRecord>();
  if (!addresses.length) return result;

  // Batch into groups of 50 to avoid query-string length limits
  const BATCH = 50;
  for (let i = 0; i < addresses.length; i += BATCH) {
    const batch = addresses.slice(i, i + BATCH);
    // Build an IN-style SoQL query: address in('ADDR1','ADDR2',...)
    const inList = batch.map(a => `'${a.toUpperCase().replace(/'/g, "''")}'`).join(",");
    const qs = new URLSearchParams({
      $select: "address,ownername,assesstot,zipcode,latitude,longitude",
      $where:  `upper(address) in(${inList})`,
      $limit:  String(BATCH),
    });
    const url = `https://data.cityofnewyork.us/resource/64uk-42ks.json?${qs}`;

    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        console.warn(`[pluto] HTTP ${res.status} for batch ${i}–${i + BATCH}`);
        continue;
      }
      const rows: Record<string, unknown>[] = await res.json();

      for (const r of rows) {
        const rawAddr = str(r.address);
        if (!rawAddr) continue;
        const key = normalizeAddress(rawAddr);
        const ownerName = str(r.ownername);
        const propertyValue = num(r.assesstot);
        if (ownerName || propertyValue != null) {
          result.set(key, { normalizedAddress: key, ownerName, propertyValue, mailingAddress: undefined });
        }
      }
    } catch (err) {
      console.error(`[pluto] fetch error batch ${i}:`, err);
    }
  }

  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return corsError("Unauthorized", 401);
  const token = authHeader.replace("Bearer ", "");
  const triggerSecret = Deno.env.get("FETCH_TRIGGER_SECRET");
  const isServerTrigger = triggerSecret && token === triggerSecret;

  if (!isServerTrigger) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return corsError("Unauthorized", 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    // Which sources to enrich — default all supported
    const sources: string[] = body.sources ?? ["nyc_hpd", "philly_violations", "chicago_violations", "sf_violations", "boston_violations"];

    const ENRICH_HANDLERS: Record<string, () => Promise<{ checked: number; enriched: number }>> = {
      nyc_hpd:            () => enrichNyc(supabase),
      philly_violations:  () => enrichPhilly(supabase),
      chicago_violations: () => enrichChicago(supabase),
      sf_violations:      () => enrichSf(supabase),
      boston_violations:  () => enrichBoston(supabase),
    };

    const summary: Record<string, { checked: number; enriched: number; error?: string }> = {};

    // Run all sources in parallel — they hit different external APIs and different rows
    const settled = await Promise.allSettled(
      sources.map(source =>
        (ENRICH_HANDLERS[source]?.() ?? Promise.resolve({ checked: 0, enriched: 0, error: "not supported" }))
          .then(r => ({ source, ...r }))
          .catch(err => ({ source, checked: 0, enriched: 0, error: (err as Error).message }))
      )
    );

    for (const r of settled) {
      if (r.status === "fulfilled") {
        const { source, ...rest } = r.value;
        summary[source] = rest;
      }
    }

    const totalEnriched = Object.values(summary).reduce((a, s) => a + s.enriched, 0);
    return corsResponse({ success: true, summary, totalEnriched });

  } catch (err) {
    console.error("enrich-real-estate-leads fatal:", err);
    return corsError((err as Error).message, 500);
  }
});

// ── NYC enrichment ────────────────────────────────────────────────────────────

async function enrichNyc(
  supabase: AdminClient,
): Promise<{ checked: number; enriched: number }> {

  // Load all NYC leads that need enrichment (missing owner or value)
  const { data: leads, error } = await supabase
    .from("real_estate_leads")
    .select("id, property_address, normalized_address, zip")
    .eq("data_source", "nyc_hpd")
    .or("owner_name.is.null,property_value.is.null")
    .not("normalized_address", "is", null)
    .neq("normalized_address", "")
    .limit(1000);

  if (error) throw error;
  if (!leads?.length) return { checked: 0, enriched: 0 };

  // Build list of uppercase addresses for PLUTO query
  const addresses = [...new Set(
    leads.map(l => l.property_address?.toUpperCase()).filter(Boolean) as string[]
  )];

  console.log(`[nyc_hpd] enriching ${leads.length} leads against PLUTO (${addresses.length} unique addresses)`);

  const plutoMap = await fetchPlutoForAddresses(addresses);

  if (!plutoMap.size) {
    console.warn("[nyc_hpd] PLUTO returned no matches");
    return { checked: leads.length, enriched: 0 };
  }

  // Match and build updates
  const updates: { id: string; owner_name?: string; property_value?: number }[] = [];

  for (const lead of leads) {
    const key = lead.normalized_address;
    const record = plutoMap.get(key);
    if (!record) continue;

    const update: { id: string; owner_name?: string; property_value?: number } = { id: lead.id };
    if (record.ownerName) update.owner_name = record.ownerName;
    if (record.propertyValue != null) update.property_value = record.propertyValue;

    if (update.owner_name || update.property_value != null) {
      updates.push(update);
    }
  }

  if (!updates.length) {
    console.log("[nyc_hpd] No PLUTO matches for current leads");
    return { checked: leads.length, enriched: 0 };
  }

  let enriched = 0;
  const BATCH = 100;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(({ id, owner_name, property_value }) =>
      supabase.from("real_estate_leads").update({ owner_name, property_value }).eq("id", id)
    ));
    const failed = results.filter(r => r.error);
    if (failed.length) console.warn(`[nyc_hpd] ${failed.length} update(s) failed in batch ${i}`);
    enriched += batch.length - failed.length;
  }

  console.log(`[nyc_hpd] enriched ${enriched}/${leads.length} leads with PLUTO data`);
  return { checked: leads.length, enriched };
}

// ── Philadelphia OPA enrichment ───────────────────────────────────────────────
// Philadelphia Office of Property Assessment — owner name + market value.
// Dataset: opa_properties_public via CARTO SQL API.
// Matched by normalized address against property_address in our leads.

async function fetchOpaForAddresses(
  addresses: string[],
): Promise<Map<string, AssessorRecord>> {
  const result = new Map<string, AssessorRecord>();
  if (!addresses.length) return result;

  const BATCH = 50;
  for (let i = 0; i < addresses.length; i += BATCH) {
    const batch = addresses.slice(i, i + BATCH);
    const inList = batch.map(a => `'${a.toUpperCase().replace(/'/g, "''")}'`).join(",");
    const sql = encodeURIComponent(
      `SELECT location, owner_1, owner_2, market_value, zip_code FROM opa_properties_public ` +
      `WHERE upper(location) IN (${inList}) LIMIT ${BATCH}`
    );
    const url = `https://phl.carto.com/api/v2/sql?q=${sql}&format=json`;

    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        console.warn(`[opa] HTTP ${res.status} for batch ${i}–${i + BATCH}`);
        continue;
      }
      const json: { rows?: Record<string, unknown>[]; error?: unknown } = await res.json();
      // CARTO returns HTTP 200 with { error: [...] } on SQL/table errors
      if (json.error) {
        console.warn(`[opa] CARTO error batch ${i}: ${JSON.stringify(json.error)}`);
        continue;
      }
      for (const r of json.rows ?? []) {
        const rawAddr = str(r.location);
        if (!rawAddr) continue;
        const key = normalizeAddress(rawAddr);
        const ownerParts = [str(r.owner_1), str(r.owner_2)].filter(Boolean);
        const ownerName = ownerParts.length ? ownerParts.join(" / ") : undefined;
        const propertyValue = num(r.market_value);
        if (ownerName || propertyValue != null) {
          result.set(key, { normalizedAddress: key, ownerName, propertyValue, mailingAddress: undefined });
        }
      }
    } catch (err) {
      console.error(`[opa] fetch error batch ${i}:`, err);
    }
  }

  return result;
}

async function enrichPhilly(
  supabase: AdminClient,
): Promise<{ checked: number; enriched: number }> {

  const { data: leads, error } = await supabase
    .from("real_estate_leads")
    .select("id, property_address, normalized_address")
    .eq("data_source", "philly_violations")
    .or("owner_name.is.null,property_value.is.null")
    .not("normalized_address", "is", null)
    .neq("normalized_address", "")
    .limit(1000);

  if (error) throw error;
  if (!leads?.length) return { checked: 0, enriched: 0 };

  const addresses = [...new Set(
    leads.map(l => l.property_address?.toUpperCase()).filter(Boolean) as string[]
  )];

  console.log(`[philly_violations] enriching ${leads.length} leads against OPA (${addresses.length} unique addresses)`);

  const opaMap = await fetchOpaForAddresses(addresses);

  if (!opaMap.size) {
    console.warn("[philly_violations] OPA returned no matches");
    return { checked: leads.length, enriched: 0 };
  }

  const updates: { id: string; owner_name?: string; property_value?: number }[] = [];
  for (const lead of leads) {
    const record = opaMap.get(lead.normalized_address);
    if (!record) continue;
    const update: { id: string; owner_name?: string; property_value?: number } = { id: lead.id };
    if (record.ownerName) update.owner_name = record.ownerName;
    if (record.propertyValue) update.property_value = record.propertyValue;
    if (update.owner_name || update.property_value) updates.push(update);
  }

  if (!updates.length) {
    console.log("[philly_violations] No OPA matches for current leads");
    return { checked: leads.length, enriched: 0 };
  }

  let enriched = 0;
  const BATCH = 100;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(({ id, owner_name, property_value }) =>
      supabase.from("real_estate_leads").update({ owner_name, property_value }).eq("id", id)
    ));
    const failed = results.filter(r => r.error);
    if (failed.length) console.warn(`[philly_violations] ${failed.length} update(s) failed in batch ${i}`);
    enriched += batch.length - failed.length;
  }

  console.log(`[philly_violations] enriched ${enriched}/${leads.length} leads with OPA data`);
  return { checked: leads.length, enriched };
}

// ── Shared Socrata assessor helper ────────────────────────────────────────────
// Used by Cook County, SF, and Boston enrichment — all three are Socrata.

async function fetchSocrataAssessor(
  domain: string,
  datasetId: string,
  addressField: string,
  ownerField: string,
  valueField: string,
  addresses: string[],
  expectedFields: string[],
  mailingField?: string,
): Promise<Map<string, AssessorRecord>> {
  const result = new Map<string, AssessorRecord>();
  if (!addresses.length) return result;

  const BATCH = 50;
  for (let i = 0; i < addresses.length; i += BATCH) {
    const batch = addresses.slice(i, i + BATCH);
    const inList = batch.map(a => `'${a.toUpperCase().replace(/'/g, "''")}'`).join(",");
    const selectFields = [addressField, ownerField, valueField, mailingField].filter(Boolean).join(",");
    const qs = new URLSearchParams({
      $select: selectFields,
      $where:  `upper(${addressField}) in(${inList})`,
      $limit:  String(BATCH),
    });
    const url = `https://${domain}/resource/${datasetId}.json?${qs}`;

    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        console.warn(`[${domain}/${datasetId}] HTTP ${res.status} for batch ${i}–${i + BATCH}`);
        continue;
      }
      const rows: Record<string, unknown>[] = await res.json();

      if (rows.length > 0 && !result.size) {
        const missing = expectedFields.filter(f => !(f in rows[0]));
        if (missing.length) {
          console.warn(`[${domain}/${datasetId}] Schema drift: missing ${missing.join(", ")}`);
        }
      }

      for (const r of rows) {
        const rawAddr = str(r[addressField]);
        if (!rawAddr) continue;
        const key           = normalizeAddress(rawAddr);
        const ownerName     = str(r[ownerField]);
        const propertyValue = num(r[valueField]);
        const mailingAddress = mailingField ? str(r[mailingField]) : undefined;
        if (ownerName || propertyValue != null) {
          result.set(key, { normalizedAddress: key, ownerName, propertyValue, mailingAddress });
        }
      }
    } catch (err) {
      console.error(`[${domain}/${datasetId}] fetch error batch ${i}:`, err);
    }
  }

  return result;
}

// Shared pattern for all three Socrata-based enrichment sources.
async function enrichFromSocrata(
  supabase: AdminClient,
  dataSource: string,
  domain: string,
  datasetId: string,
  addressField: string,
  ownerField: string,
  valueField: string,
  expectedFields: string[],
  logLabel: string,
  mailingField?: string,
): Promise<{ checked: number; enriched: number }> {
  const { data: leads, error } = await supabase
    .from("real_estate_leads")
    .select("id, property_address, normalized_address")
    .eq("data_source", dataSource)
    .or("owner_name.is.null,property_value.is.null")
    .not("normalized_address", "is", null)
    .neq("normalized_address", "")
    .limit(1000);

  if (error) throw error;
  if (!leads?.length) return { checked: 0, enriched: 0 };

  const addresses = [...new Set(
    leads.map(l => l.property_address?.toUpperCase()).filter(Boolean) as string[]
  )];

  console.log(`[${logLabel}] enriching ${leads.length} leads (${addresses.length} unique addresses)`);

  const assessorMap = await fetchSocrataAssessor(
    domain, datasetId, addressField, ownerField, valueField, addresses, expectedFields, mailingField
  );

  if (!assessorMap.size) {
    console.warn(`[${logLabel}] assessor returned no matches`);
    return { checked: leads.length, enriched: 0 };
  }

  const updates: { id: string; owner_name?: string; property_value?: number; mailing_address?: string }[] = [];
  for (const lead of leads) {
    const record = assessorMap.get(lead.normalized_address);
    if (!record) continue;
    const update: { id: string; owner_name?: string; property_value?: number; mailing_address?: string } = { id: lead.id };
    if (record.ownerName)        update.owner_name      = record.ownerName;
    if (record.propertyValue != null) update.property_value = record.propertyValue;
    if (record.mailingAddress)   update.mailing_address = record.mailingAddress;
    if (update.owner_name || update.property_value != null || update.mailing_address) updates.push(update);
  }

  if (!updates.length) {
    console.log(`[${logLabel}] no assessor matches for current leads`);
    return { checked: leads.length, enriched: 0 };
  }

  let enriched = 0;
  const BATCH = 100;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(({ id, owner_name, property_value, mailing_address }) =>
      supabase.from("real_estate_leads").update({ owner_name, property_value, mailing_address }).eq("id", id)
    ));
    const failed = results.filter(r => r.error);
    if (failed.length) console.warn(`[${logLabel}] ${failed.length} update(s) failed in batch ${i}`);
    enriched += batch.length - failed.length;
  }

  console.log(`[${logLabel}] enriched ${enriched}/${leads.length} leads`);
  return { checked: leads.length, enriched };
}

// ── Chicago — Cook County Assessor ───────────────────────────────────────────
// Dataset uzyt-m557: Assessor Parcel Universe — taxpayer_name + assessed_value
// Matched by property_address field (full street address, uppercase).

async function enrichChicago(
  supabase: AdminClient,
): Promise<{ checked: number; enriched: number }> {
  return enrichFromSocrata(
    supabase,
    "chicago_violations",
    "data.cookcountyil.gov",
    "uzyt-m557",
    "property_address",
    "taxpayer_name",
    "assessed_value",
    ["property_address", "taxpayer_name", "assessed_value"],
    "chicago/cook-county",
    "mail_address",  // taxpayer mailing address — key for absentee owner detection
  );
}

// ── San Francisco — Assessor-Recorder ────────────────────────────────────────
// Dataset wv5m-vpq2: Assessor Historical Secured Property Tax Rolls.
// property_location is the full address; owner_name + assessed_value present.

async function enrichSf(
  supabase: AdminClient,
): Promise<{ checked: number; enriched: number }> {
  return enrichFromSocrata(
    supabase,
    "sf_violations",
    "data.sfgov.org",
    "wv5m-vpq2",
    "property_location",
    "owner_name",
    "assessed_value",
    ["property_location", "owner_name", "assessed_value"],
    "sf/assessor-recorder",
  );
}

// ── Boston — Property Assessment ─────────────────────────────────────────────
// Dataset fd3b-xuhz: Boston Property Assessment (Analyze Boston / Socrata).
// full_address combines st_num + st_name; owner + av_total are the key fields.

async function enrichBoston(
  supabase: AdminClient,
): Promise<{ checked: number; enriched: number }> {
  return enrichFromSocrata(
    supabase,
    "boston_violations",
    "data.boston.gov",
    "fd3b-xuhz",
    "full_address",
    "owner",
    "av_total",
    ["full_address", "owner", "av_total"],
    "boston/property-assessment",
  );
}
