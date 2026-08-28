-- Adds a generated normalized_address column for cross-source dedup and
-- county assessor matching (Lane 2). Strips punctuation and lowercases
-- so "123 Main St." and "123 MAIN ST" resolve to the same value.

ALTER TABLE public.real_estate_leads
  ADD COLUMN IF NOT EXISTS normalized_address TEXT
    GENERATED ALWAYS AS (
      regexp_replace(
        regexp_replace(lower(coalesce(property_address, '')), '\s+', ' ', 'g'),
        '[^a-z0-9 ]', '', 'g'
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_rel_norm_addr
  ON public.real_estate_leads (normalized_address)
  WHERE normalized_address IS NOT NULL;
