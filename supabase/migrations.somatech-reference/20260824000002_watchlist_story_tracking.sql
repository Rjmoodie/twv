-- Versioned, user-owned company story tracking. Shared provider ingestion can
-- populate the same snapshot contract later; this first slice persists the
-- auditable baseline generated from the user's completed Stock Analysis.

alter table public.watchlist
  add column if not exists tracking_mode text not null default 'price'
    check (tracking_mode in ('price', 'story', 'thesis')),
  add column if not exists thesis_summary text,
  add column if not exists thesis_invalidation text,
  add column if not exists story_summary text,
  add column if not exists story_updated_at timestamptz,
  add column if not exists story_last_viewed_at timestamptz;

-- Do not impose a new uniqueness constraint on legacy rows: older deployments
-- may already contain duplicate saved ideas. The client updates the newest
-- matching row and leaves historical duplicates visible for user review.

create table if not exists public.watchlist_story_snapshots (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlist(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null check (ticker = upper(ticker) and ticker ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  reporting_period date,
  source_as_of timestamptz not null,
  analysis_version text not null,
  summary text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint watchlist_story_payload_object check (jsonb_typeof(payload) = 'object'),
  unique (watchlist_id, source_as_of, analysis_version)
);

create index if not exists watchlist_story_snapshots_timeline_idx
  on public.watchlist_story_snapshots (watchlist_id, source_as_of desc);

alter table public.watchlist_story_snapshots enable row level security;

create policy "Users read their own story snapshots"
  on public.watchlist_story_snapshots for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users create their own story snapshots"
  on public.watchlist_story_snapshots for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.watchlist w
      where w.id = watchlist_id and w.user_id = auth.uid() and w.ticker = ticker
    )
  );

create policy "Users delete their own story snapshots"
  on public.watchlist_story_snapshots for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.watchlist_story_snapshots from anon;
grant select, insert, delete on table public.watchlist_story_snapshots to authenticated;

-- Shared service-role cache for the lazily requested price/story overlay.
create table if not exists public.stock_price_history_cache (
  ticker text primary key check (ticker = upper(ticker) and ticker ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  series jsonb not null,
  adjusted boolean not null default false,
  provider text not null,
  as_of date,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  constraint stock_price_history_series_array check (jsonb_typeof(series) = 'array')
);

alter table public.stock_price_history_cache enable row level security;
revoke all on table public.stock_price_history_cache from anon, authenticated;

-- A filing is shared evidence. Cache the citation-validated extraction once so
-- multiple users tracking the same company do not repeat SEC and AI work.
create table if not exists public.company_narrative_cache (
  ticker text not null,
  accession_number text not null,
  analysis_version text not null,
  form text not null,
  filing_date date not null,
  report_date date,
  document_url text not null,
  claims jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (ticker, accession_number, analysis_version),
  constraint company_narrative_claims_array check (jsonb_typeof(claims) = 'array')
);

alter table public.company_narrative_cache enable row level security;
revoke all on table public.company_narrative_cache from anon, authenticated;
