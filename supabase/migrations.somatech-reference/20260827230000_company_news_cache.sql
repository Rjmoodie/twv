-- Service-owned cache for the ticker-scoped news surface in Stock Analysis.
-- Browser clients receive normalized articles through the authenticated Edge
-- Function and never read provider payloads or credentials directly.
create table if not exists public.stock_news_cache (
  ticker text primary key check (ticker=upper(ticker) and ticker ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  articles jsonb not null default '[]'::jsonb check (jsonb_typeof(articles)='array'),
  provider text not null,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  last_provider_error text,
  updated_at timestamptz not null default now()
);
create index if not exists stock_news_cache_expiry_idx on public.stock_news_cache(expires_at);
alter table public.stock_news_cache enable row level security;
revoke all on public.stock_news_cache from public,anon,authenticated;
grant select,insert,update on public.stock_news_cache to service_role;
