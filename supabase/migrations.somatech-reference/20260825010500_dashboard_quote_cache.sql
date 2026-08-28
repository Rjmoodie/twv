-- Shared quote cache for the public dashboard. Without this, every browser tab
-- fans out into four Alpha Vantage requests and exhausts provider quotas.

create table if not exists public.dashboard_quote_cache (
  symbol text primary key check (symbol ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.dashboard_quote_cache enable row level security;
revoke all on table public.dashboard_quote_cache from anon, authenticated;

comment on table public.dashboard_quote_cache is
  'Service-role-only cache for dashboard market quotes.';
