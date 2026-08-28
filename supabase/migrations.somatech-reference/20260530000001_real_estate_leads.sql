-- Real Estate Leads table
-- Stores normalised property leads sourced from free public APIs:
--   Socrata open city data (Chicago, NYC, LA, SF, Austin, Seattle, ...)
--   Federal REO properties (HUD, Fannie Mae, Freddie Mac)
--   County-level CSV downloads (Florida, Texas, ...)

CREATE TABLE IF NOT EXISTS public.real_estate_leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Source metadata ────────────────────────────────────────────────────────
  data_source      TEXT NOT NULL,          -- e.g. 'chicago_violations', 'nyc_hpd', 'hud_reo'
  source_record_id TEXT,                   -- original ID from the source system
  source_url       TEXT,                   -- canonical URL for this record
  lead_type        TEXT NOT NULL,          -- 'code_violation' | 'tax_delinquent' | 'pre_foreclosure' | 'reo' | 'vacant' | 'probate' | 'eviction'

  -- ── Property ───────────────────────────────────────────────────────────────
  property_address TEXT,
  city             TEXT,
  state            TEXT,
  county           TEXT,
  zip              TEXT,
  latitude         DECIMAL(10, 7),
  longitude        DECIMAL(10, 7),

  -- ── Owner ──────────────────────────────────────────────────────────────────
  owner_name       TEXT,
  mailing_address  TEXT,
  is_absentee      BOOLEAN DEFAULT false,
  is_llc_owned     BOOLEAN DEFAULT false,

  -- ── Financial ──────────────────────────────────────────────────────────────
  property_value   DECIMAL(12, 2),
  equity_estimate  DECIMAL(12, 2),
  last_sale_date   DATE,
  tax_amount       DECIMAL(12, 2),         -- for tax delinquent leads

  -- ── Signal ─────────────────────────────────────────────────────────────────
  violation_description TEXT,
  status           TEXT,                   -- raw status from source
  severity         TEXT,                   -- 'low' | 'medium' | 'high' — normalised signal strength
  tags             TEXT[] DEFAULT '{}',    -- ['distressed', 'absentee', 'tax-delinquent', ...]
  -- COALESCE guards against NULL tags array — ANY(NULL) returns NULL, not false
  is_distressed    BOOLEAN GENERATED ALWAYS AS (
    COALESCE('distressed' = ANY(tags), false) OR lead_type IN ('pre_foreclosure', 'tax_delinquent', 'reo')
  ) STORED,

  -- ── Dates ──────────────────────────────────────────────────────────────────
  incident_date    DATE,
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rel_state          ON public.real_estate_leads (state);
CREATE INDEX IF NOT EXISTS idx_rel_lead_type      ON public.real_estate_leads (lead_type);
CREATE INDEX IF NOT EXISTS idx_rel_data_source    ON public.real_estate_leads (data_source);
CREATE INDEX IF NOT EXISTS idx_rel_fetched_at     ON public.real_estate_leads (fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_rel_severity       ON public.real_estate_leads (severity);
-- Composite for the most common UI query (state + type filter)
CREATE INDEX IF NOT EXISTS idx_rel_state_type     ON public.real_estate_leads (state, lead_type);
-- Dedup: same source + same source record = same lead
-- Full unique index (not partial) so ON CONFLICT (data_source, source_record_id) works
-- with Supabase upsert. PostgreSQL allows multiple NULLs in a unique index, so rows
-- without a source_record_id still insert freely while non-NULL IDs are deduplicated.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rel_source_dedup
  ON public.real_estate_leads (data_source, source_record_id);

-- ── Scraping jobs log ─────────────────────────────────────────────────────────
-- Tracks each fetch attempt so the UI can show status and history
CREATE TABLE IF NOT EXISTS public.real_estate_fetch_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'completed' | 'failed'
  records_fetched  INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated  INTEGER DEFAULT 0,
  error_message TEXT,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfj_source  ON public.real_estate_fetch_jobs (data_source);
CREATE INDEX IF NOT EXISTS idx_rfj_status  ON public.real_estate_fetch_jobs (status);
CREATE INDEX IF NOT EXISTS idx_rfj_created ON public.real_estate_fetch_jobs (created_at DESC);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rel_updated_at ON public.real_estate_leads;
CREATE TRIGGER trg_rel_updated_at
  BEFORE UPDATE ON public.real_estate_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Leads are platform-wide reference data — any authenticated user can read.
-- Only the Edge Function (service_role key) can insert/update.
ALTER TABLE public.real_estate_leads      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_estate_fetch_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read leads"    ON public.real_estate_leads;
DROP POLICY IF EXISTS "Authenticated users can read fetch jobs" ON public.real_estate_fetch_jobs;
DROP POLICY IF EXISTS "Service role full access to leads"       ON public.real_estate_leads;
DROP POLICY IF EXISTS "Service role full access to jobs"        ON public.real_estate_fetch_jobs;

CREATE POLICY "Authenticated users can read leads"
  ON public.real_estate_leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read fetch jobs"
  ON public.real_estate_fetch_jobs FOR SELECT
  TO authenticated
  USING (true);

-- Service role (Edge Function) can do everything
CREATE POLICY "Service role full access to leads"
  ON public.real_estate_leads FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to jobs"
  ON public.real_estate_fetch_jobs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
