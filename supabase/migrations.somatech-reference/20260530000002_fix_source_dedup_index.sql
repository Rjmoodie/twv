-- Fix: replace partial unique index with a full unique index so that
-- ON CONFLICT (data_source, source_record_id) works with Supabase upsert.
-- PostgreSQL allows multiple NULLs in a unique index, so rows without a
-- source_record_id still insert freely while non-NULL IDs are deduplicated.

DROP INDEX IF EXISTS public.idx_rel_source_dedup;

CREATE UNIQUE INDEX idx_rel_source_dedup
  ON public.real_estate_leads (data_source, source_record_id);
