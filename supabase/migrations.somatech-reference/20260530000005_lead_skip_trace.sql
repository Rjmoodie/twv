-- Skip trace columns on real_estate_leads
-- Populated by a skip tracing service (e.g. BatchSkipTracing) after export.
-- phone and email are not available from any free public source.

ALTER TABLE public.real_estate_leads
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS email          TEXT,
  ADD COLUMN IF NOT EXISTS skip_traced_at TIMESTAMPTZ;

COMMENT ON COLUMN public.real_estate_leads.phone          IS 'Owner phone — populated via skip tracing service';
COMMENT ON COLUMN public.real_estate_leads.email          IS 'Owner email — populated via skip tracing service';
COMMENT ON COLUMN public.real_estate_leads.skip_traced_at IS 'When skip trace was last run for this lead';

CREATE INDEX IF NOT EXISTS idx_rel_skip_traced ON public.real_estate_leads (skip_traced_at)
  WHERE skip_traced_at IS NOT NULL;
