-- Shared, service-only cache for Stock Analysis provider responses.
-- The Edge Function owns all reads/writes; browser clients receive only the
-- normalized response and never provider credentials or raw cache access.

create table if not exists public.stock_analysis_cache (
  ticker text primary key check (ticker = upper(ticker) and ticker ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  cik text not null,
  company_name text not null,
  fundamentals jsonb not null,
  fundamentals_as_of date,
  fundamentals_fetched_at timestamptz not null,
  quote jsonb,
  quote_as_of timestamptz,
  quote_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.stock_analysis_cache enable row level security;

-- Intentionally no client policies. The service role used by the Edge
-- Function bypasses RLS; authenticated and anonymous browser clients cannot
-- inspect or mutate the shared provider cache.

create index if not exists stock_analysis_cache_quote_expiry_idx
  on public.stock_analysis_cache (quote_expires_at);

revoke all on table public.stock_analysis_cache from anon, authenticated;
