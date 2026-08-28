-- Lead review workflow
-- Persists per-user review status for each lead so it survives page reload.
-- Currently the component tracks this in local React state only.
--
-- Keyed by (user_id, data_source, source_record_id) so it works even without
-- a direct FK to real_estate_leads (which has no stable PK in the upsert flow).

CREATE TABLE IF NOT EXISTS public.lead_reviews (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_source      TEXT        NOT NULL,
  source_record_id TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'new'
                               CHECK (status IN ('new','reviewed','analyzing','exported','dismissed')),
  notes            TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, data_source, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_lr_user      ON public.lead_reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_lr_source    ON public.lead_reviews (data_source);
CREATE INDEX IF NOT EXISTS idx_lr_status    ON public.lead_reviews (user_id, status);

CREATE OR REPLACE FUNCTION public.set_lead_review_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_lr_updated_at ON public.lead_reviews;
CREATE TRIGGER trg_lr_updated_at
  BEFORE UPDATE ON public.lead_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_lead_review_updated_at();

ALTER TABLE public.lead_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reviews"
  ON public.lead_reviews FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
