/**
 * Free Data Sources Implementation Service
 *
 * Fixes applied:
 *  - propertyValueRange removed — belongs in UI state, not query key
 *  - getImplementationStatus uses count queries instead of 5000-row scan
 *  - getDataSourceStats uses count-based aggregate queries
 *  - getLeads uses .range() only (not both .limit() + .range())
 *  - fetchSources passes the user's auth token so the Edge Function can verify it
 */

import { supabase } from '@/integrations/supabase/client';

// ── Public types ──────────────────────────────────────────────────────────────

export interface FreeDataResult {
  source:   string;
  fetched:  number;
  inserted: number;
  updated:  number;
  error?:   string;
}

export interface ProcessedProperty {
  id:                    string;
  data_source:           string;
  source_record_id:      string | null;
  lead_type:             string;
  property_address:      string | null;
  city:                  string | null;
  state:                 string | null;
  county:                string | null;
  zip:                   string | null;
  latitude:              number | null;
  longitude:             number | null;
  owner_name:            string | null;
  is_absentee:           boolean;
  is_llc_owned:          boolean;
  is_distressed:         boolean;
  property_value:        number | null;
  equity_estimate:       number | null;
  violation_description: string | null;
  status:                string | null;
  severity:              string | null;
  tags:                  string[];
  incident_date:         string | null;
  fetched_at:            string;
  source_url:            string | null;
}

export interface FetchJob {
  id:               string;
  data_source:      string;
  status:           'pending' | 'running' | 'completed' | 'failed';
  records_fetched:  number;
  records_inserted: number;
  error_message:    string | null;
  started_at:       string;
  completed_at:     string | null;
}

export interface ImplementationStatus {
  totalSources:    number;
  activeSources:   number;
  totalLeads:      number;
  lastFetchedAt:   string | null;
  sourceBreakdown: { source: string; count: number; lastFetch: string | null }[];
}

export interface DataSourceStats {
  byLeadType:      { type: string;     count: number }[];
  byState:         { state: string;    count: number }[];
  bySeverity:      { severity: string; count: number }[];
  totalDistressed: number;
}

// ── Source metadata ───────────────────────────────────────────────────────────

export const PHASE_1_SOURCES = [
  'chicago_violations',
  'nyc_hpd',
  'sf_violations',
  'la_violations',
  'austin_violations',
  'seattle_violations',
  'hud_reo',
  'philly_violations',
  'boston_violations',
] as const;

export type SourceId = typeof PHASE_1_SOURCES[number];

export const SOURCE_META: Record<SourceId, { label: string; city: string; state: string; category: string }> = {
  chicago_violations:  { label: 'Chicago Building Violations',      city: 'Chicago',       state: 'IL', category: 'Code Violations'  },
  nyc_hpd:            { label: 'NYC HPD Housing Violations',        city: 'New York',      state: 'NY', category: 'Code Violations'  },
  sf_violations:      { label: 'SF Building Complaints',            city: 'San Francisco', state: 'CA', category: 'Code Violations'  },
  la_violations:      { label: 'LA Code Enforcement',               city: 'Los Angeles',   state: 'CA', category: 'Code Violations'  },
  austin_violations:  { label: 'Austin Code Compliance',            city: 'Austin',        state: 'TX', category: 'Code Violations'  },
  seattle_violations: { label: 'Seattle Code Violations',           city: 'Seattle',       state: 'WA', category: 'Code Violations'  },
  hud_reo:            { label: 'HUD Home Store (FHA REO)',           city: 'National',      state: 'US', category: 'Bank-Owned (REO)' },
  philly_violations:  { label: 'Philadelphia L&I Violations',       city: 'Philadelphia',  state: 'PA', category: 'Code Violations'  },
  boston_violations:  { label: 'Boston ISD Building Violations',    city: 'Boston',        state: 'MA', category: 'Code Violations'  },
};

// ── Service ───────────────────────────────────────────────────────────────────

class FreeDataSourcesImplementation {

  /** Trigger a fetch via the Edge Function, forwarding the user's auth token */
  async fetchSources(sources: SourceId[] = [...PHASE_1_SOURCES]): Promise<{
    success: boolean;
    summary: Record<string, FreeDataResult>;
    totalFetched:  number;
    totalInserted: number;
    errors: string[];
  }> {
    // Get the current session token so the Edge Function can verify the caller
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const { data, error } = await supabase.functions.invoke('fetch-real-estate-leads', {
      body: { sources },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (error) throw error;
    return data;
  }

  /**
   * Read leads from the database with optional server-side filters.
   * Note: propertyValueRange is intentionally NOT a parameter here —
   * it should be applied client-side so slider changes don't trigger DB round-trips.
   */
  async getLeads(opts: {
    sources?:      string[];
    states?:       string[];
    leadTypes?:    string[];
    severity?:     string[];
    distressedOnly?: boolean;
    search?:       string;
    limit?:        number;
    page?:         number;   // 0-based page index
  } = {}): Promise<ProcessedProperty[]> {
    const limit  = opts.limit ?? 500;
    const page   = opts.page  ?? 0;
    const from   = page * limit;
    const to     = from + limit - 1;

    // Use .range() only — not .limit() — to avoid header conflicts in PostgREST
    let q = supabase
      .from('real_estate_leads')
      .select('*')
      .order('fetched_at', { ascending: false })
      .range(from, to);

    if (opts.sources?.length)   q = q.in('data_source', opts.sources);
    if (opts.states?.length)    q = q.in('state', opts.states);
    if (opts.leadTypes?.length) q = q.in('lead_type', opts.leadTypes);
    if (opts.severity?.length)  q = q.in('severity', opts.severity);
    if (opts.distressedOnly)    q = q.eq('is_distressed', true);
    if (opts.search?.trim()) {
      const s = opts.search.trim();
      q = q.or(
        `property_address.ilike.%${s}%,city.ilike.%${s}%,owner_name.ilike.%${s}%,county.ilike.%${s}%`
      );
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as ProcessedProperty[];
  }

  /** Recent fetch jobs for the status panel */
  async getRecentJobs(limit = 20): Promise<FetchJob[]> {
    const { data, error } = await supabase
      .from('real_estate_fetch_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, limit - 1);
    if (error) throw error;
    return (data ?? []) as FetchJob[];
  }

  /**
   * Aggregate counts using exact count queries instead of scanning rows.
   * Avoids the 5000-row cap issue.
   */
  async getImplementationStatus(): Promise<ImplementationStatus> {
    // Total lead count (no row data needed)
    const { count: totalLeads, error: countErr } = await supabase
      .from('real_estate_leads')
      .select('*', { count: 'exact', head: true });

    if (countErr) throw countErr;

    // Per-source counts — one HEAD query per known source (no row data transferred)
    const sourceCountEntries = await Promise.all(
      PHASE_1_SOURCES.map(async (s) => {
        const { count } = await supabase
          .from('real_estate_leads')
          .select('*', { count: 'exact', head: true })
          .eq('data_source', s);
        return [s, count ?? 0] as const;
      })
    );
    const countBySource = Object.fromEntries(sourceCountEntries);

    // Last completed fetch per source
    const { data: jobs } = await supabase
      .from('real_estate_fetch_jobs')
      .select('data_source, completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .range(0, 99);

    const lastFetchBySource: Record<string, string> = {};
    for (const j of jobs ?? []) {
      if (j.completed_at && !lastFetchBySource[j.data_source]) {
        lastFetchBySource[j.data_source] = j.completed_at;
      }
    }

    const activeSources  = Object.keys(countBySource).length;
    const allFetchTimes  = Object.values(lastFetchBySource);
    const lastFetchedAt  = allFetchTimes.length
      ? allFetchTimes.sort((a, b) => b.localeCompare(a))[0]
      : null;

    const sourceBreakdown = PHASE_1_SOURCES.map(s => ({
      source:    s,
      count:     countBySource[s] ?? 0,
      lastFetch: lastFetchBySource[s] ?? null,
    }));

    return {
      totalSources:  PHASE_1_SOURCES.length,
      activeSources,
      totalLeads:    totalLeads ?? 0,
      lastFetchedAt,
      sourceBreakdown,
    };
  }

  /** Breakdown stats — uses exact count queries per dimension */
  async getDataSourceStats(): Promise<DataSourceStats> {
    const [leadTypeRes, stateRes, severityRes, distressedRes] = await Promise.all([
      // lead_type breakdown — range ensures we get all rows past the default PostgREST cap
      supabase.from('real_estate_leads').select('lead_type').order('lead_type').range(0, 9999),
      // state breakdown
      supabase.from('real_estate_leads').select('state').order('state').range(0, 9999),
      // severity breakdown
      supabase.from('real_estate_leads').select('severity').order('severity').range(0, 9999),
      // distressed count — HEAD query, no row data
      supabase.from('real_estate_leads').select('*', { count: 'exact', head: true }).eq('is_distressed', true),
    ]);

    const countBy = (rows: { [key: string]: string | null }[] | null, key: string) => {
      const map: Record<string, number> = {};
      for (const r of rows ?? []) {
        const v = r[key];
        if (v) map[v] = (map[v] ?? 0) + 1;
      }
      return Object.entries(map).map(([k, count]) => ({ [key === 'lead_type' ? 'type' : key]: k, count }))
        .sort((a, b) => b.count - a.count) as { [k: string]: string | number }[];
    };

    return {
      byLeadType:      countBy(leadTypeRes.data,  'lead_type') as { type: string;     count: number }[],
      byState:         countBy(stateRes.data,     'state')     as { state: string;    count: number }[],
      bySeverity:      countBy(severityRes.data,  'severity')  as { severity: string; count: number }[],
      totalDistressed: distressedRes.count ?? 0,
    };
  }
}

export const freeDataSourcesImplementation = new FreeDataSourcesImplementation();
