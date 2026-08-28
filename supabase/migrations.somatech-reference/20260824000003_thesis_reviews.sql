-- Thesis reviews: the comparison step between a stated thesis and what happened.
--
-- watchlist.thesis_invalidation records, in advance, what the user said would make
-- them wrong. watchlist_story_snapshots records what the filings later showed. This
-- table joins the two with a verdict, so a saved idea becomes a feedback loop rather
-- than a store.
--
-- One verdict per snapshot: grading the same chapter twice would let a user quietly
-- restate an outcome after the fact, which is the failure this table exists to prevent.

create table if not exists public.thesis_reviews (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlist(id) on delete cascade,
  snapshot_id uuid not null references public.watchlist_story_snapshots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  verdict text not null check (verdict in ('holds', 'invalidated', 'unclear')),
  note text check (note is null or length(note) <= 4000),
  -- The condition as written when the verdict was given. Copied rather than joined:
  -- thesis_invalidation is editable on the watchlist row, and a later edit must not
  -- be able to rewrite what a past verdict was actually judged against.
  thesis_invalidation_at_review text,
  created_at timestamptz not null default now(),
  unique (snapshot_id)
);

create index if not exists thesis_reviews_watchlist_idx
  on public.thesis_reviews (watchlist_id, created_at desc);

alter table public.thesis_reviews enable row level security;

create policy "Users read their own thesis reviews"
  on public.thesis_reviews for select
  to authenticated
  using (auth.uid() = user_id);

-- Insert is gated on the snapshot actually belonging to the caller's watchlist row,
-- mirroring watchlist_story_snapshots: a valid user_id is not on its own proof that
-- this user owns the idea being graded.
create policy "Users create their own thesis reviews"
  on public.thesis_reviews for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.watchlist_story_snapshots s
      join public.watchlist w on w.id = s.watchlist_id
      where s.id = snapshot_id
        and s.watchlist_id = watchlist_id
        and w.user_id = auth.uid()
    )
  );

-- Update is allowed so a user can correct a note or a misclick, but the row stays
-- pinned to its snapshot: the prediction was still made before the outcome was known.
create policy "Users update their own thesis reviews"
  on public.thesis_reviews for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on table public.thesis_reviews from anon;
grant select, insert, update on table public.thesis_reviews to authenticated;
