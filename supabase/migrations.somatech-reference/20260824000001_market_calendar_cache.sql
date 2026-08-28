-- Server-owned cache for live market and regulatory calendar responses.
create table if not exists public.market_calendar_cache (
  cache_key text primary key,
  payload jsonb not null,
  source text not null,
  source_url text,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.market_calendar_cache enable row level security;
create index if not exists market_calendar_cache_expiry_idx
  on public.market_calendar_cache (expires_at);
revoke all on table public.market_calendar_cache from anon, authenticated;
