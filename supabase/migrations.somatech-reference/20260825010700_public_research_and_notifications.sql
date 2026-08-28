-- Public research publishing, community discovery, and notification delivery.

create table if not exists public.public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  bio text check (bio is null or char_length(bio) <= 500),
  avatar_url text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{4,119}$'),
  ticker text not null check (ticker ~ '^[A-Z0-9.-]{1,12}$'),
  company_name text not null check (char_length(company_name) between 1 and 160),
  title text not null check (char_length(title) between 10 and 180),
  summary text not null check (char_length(summary) between 40 and 600),
  thesis text not null check (char_length(thesis) between 80 and 12000),
  risks text not null check (char_length(risks) between 40 and 8000),
  opportunities text check (opportunities is null or char_length(opportunities) <= 8000),
  disclosure text not null check (char_length(disclosure) between 10 and 1000),
  snapshot jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','published','hidden','archived')),
  author_mode text not null default 'named' check (author_mode in ('named','anonymous')),
  allow_comments boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(ticker, '') || ' ' || coalesce(company_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(thesis, '') || ' ' || coalesce(risks, '')), 'C')
  ) stored
);

create index if not exists research_posts_public_idx on public.research_posts (published_at desc)
  where status = 'published';
create index if not exists research_posts_ticker_idx on public.research_posts (ticker, published_at desc)
  where status = 'published';
create index if not exists research_posts_search_idx on public.research_posts using gin (search_document);

create table if not exists public.research_post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.research_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  revision_number integer not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (post_id, revision_number)
);

create table if not exists public.research_post_reactions (
  post_id uuid not null references public.research_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('useful','insightful')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.research_post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.research_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('misleading','spam','harassment','copyright','financial_advice','other')),
  notes text check (notes is null or char_length(notes) <= 1000),
  status text not null default 'open' check (status in ('open','reviewed','dismissed','actioned')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

create table if not exists public.research_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null check (ticker ~ '^[A-Z0-9.-]{1,12}$'),
  created_at timestamptz not null default now(),
  primary key (follower_id, ticker)
);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  channels text[] not null default array['in_app']::text[],
  status text not null default 'pending' check (status in ('pending','processing','delivered','partial','failed','suppressed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

-- A provider retry must never create a second in-app notification.
alter table public.notifications add column if not exists outbox_id uuid
  references public.notification_outbox(id) on delete set null;
-- Deliberately NOT a partial index. PostgREST's upsert emits a bare
-- `on conflict (outbox_id)`, and Postgres will not infer a partial index as an
-- arbiter unless the predicate is repeated -- which PostgREST cannot do. A
-- plain unique index still allows the many notifications that have no outbox
-- job, because NULLs are distinct in a unique index by default.
create unique index if not exists notifications_outbox_id_key
  on public.notifications(outbox_id);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index if not exists notification_outbox_pending_idx
  on public.notification_outbox (next_attempt_at, created_at) where status in ('pending','failed');

alter table public.public_profiles enable row level security;
alter table public.research_posts enable row level security;
alter table public.research_post_revisions enable row level security;
alter table public.research_post_reactions enable row level security;
alter table public.research_post_reports enable row level security;
alter table public.research_follows enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "Public profiles readable when enabled" on public.public_profiles for select
  using (is_public or auth.uid() = user_id);
create policy "Users manage own public profile" on public.public_profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Authors read own research" on public.research_posts for select
  using (auth.uid() = author_id);
create policy "Users create own research" on public.research_posts for insert
  with check (auth.uid() = author_id);
create policy "Users update own research" on public.research_posts for update
  using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "Users delete own drafts" on public.research_posts for delete
  using (auth.uid() = author_id and status = 'draft');

create policy "Authors read revisions" on public.research_post_revisions for select
  using (auth.uid() = author_id);
create policy "Authors insert revisions" on public.research_post_revisions for insert
  with check (auth.uid() = author_id);
create policy "Users manage own research reactions" on public.research_post_reactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users create research reports" on public.research_post_reports for insert
  with check (auth.uid() = reporter_id);
create policy "Users read own research reports" on public.research_post_reports for select
  using (auth.uid() = reporter_id);
create policy "Users manage own ticker follows" on public.research_follows for all
  using (auth.uid() = follower_id) with check (auth.uid() = follower_id);
create policy "Users manage own push subscriptions" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Outbox is intentionally service-role only. Users receive the resulting
-- notification, never direct access to delivery state or provider errors.

-- Drift repair: journey_posts is created with `create table if not exists`, so
-- environments provisioned before identity_mode shipped never picked the column
-- up -- production is one of them. The public feed view below and the client
-- write path both require it, so add it defensively here. Existing rows default
-- to 'anonymous', the privacy-safe choice: a pre-existing post can never start
-- exposing an author name it was not published under.
alter table public.journey_posts
  add column if not exists identity_mode text not null default 'anonymous';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.journey_posts'::regclass
      and conname = 'journey_posts_identity_mode_check'
  ) then
    alter table public.journey_posts
      add constraint journey_posts_identity_mode_check
      check (identity_mode in ('anonymous', 'display_name'));
  end if;
end $$;

drop policy if exists "Users can read community posts" on public.journey_posts;
drop policy if exists "Public can read shared community posts" on public.journey_posts;
drop policy if exists "Users can read all reactions" on public.post_reactions;
create policy "Users can read own reactions" on public.post_reactions for select
  using (auth.uid() = user_id);

create or replace function public.set_public_content_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger public_profiles_updated_at before update on public.public_profiles
  for each row execute function public.set_public_content_updated_at();
create trigger research_posts_updated_at before update on public.research_posts
  for each row execute function public.set_public_content_updated_at();

create or replace function public.capture_research_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare next_revision integer;
begin
  if old.title is distinct from new.title or old.summary is distinct from new.summary
     or old.thesis is distinct from new.thesis or old.risks is distinct from new.risks
     or old.opportunities is distinct from new.opportunities or old.disclosure is distinct from new.disclosure then
    select coalesce(max(revision_number), 0) + 1 into next_revision
      from public.research_post_revisions where post_id = old.id;
    insert into public.research_post_revisions(post_id, author_id, revision_number, content)
    values (old.id, old.author_id, next_revision, jsonb_build_object(
      'title', old.title, 'summary', old.summary, 'thesis', old.thesis,
      'risks', old.risks, 'opportunities', old.opportunities,
      'disclosure', old.disclosure, 'snapshot', old.snapshot, 'sources', old.sources
    ));
  end if;
  return new;
end;
$$;
create trigger research_posts_capture_revision before update on public.research_posts
  for each row execute function public.capture_research_revision();

create or replace function public.queue_research_publish_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'published' or new.published_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'published' and old.published_at is not null then return new; end if;
  if new.status = 'published' then
    insert into public.notification_outbox(user_id, event_type, payload, channels)
    select f.follower_id, 'research_published', jsonb_build_object(
      'post_id', new.id, 'slug', new.slug, 'ticker', new.ticker,
      'title', new.title, 'author_id', new.author_id
    ), array['in_app','email','push']::text[]
    from public.research_follows f
    where f.ticker = new.ticker and f.follower_id <> new.author_id;
  end if;
  return new;
end;
$$;
create trigger research_posts_queue_notifications after insert or update on public.research_posts
  for each row execute function public.queue_research_publish_notifications();

create or replace function public.validate_research_publish()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recent_count integer;
begin
  if new.status = 'published' then
    if new.published_at is null then new.published_at = now(); end if;
    if new.author_mode = 'named' and not exists (
      select 1 from public.public_profiles profile where profile.user_id = new.author_id and profile.is_public
    ) then raise exception 'Create a public research profile before publishing with attribution'; end if;
    if tg_op = 'INSERT' then
      select count(*) into recent_count from public.research_posts
        where author_id = new.author_id and published_at > now() - interval '24 hours';
      if recent_count >= 5 then raise exception 'Publishing limit reached. Try again tomorrow.'; end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger research_posts_validate_publish before insert or update of status on public.research_posts
  for each row execute function public.validate_research_publish();

create or replace function public.auto_hide_reported_research()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.research_post_reports where post_id = new.post_id and status = 'open') >= 3 then
    update public.research_posts set status = 'hidden' where id = new.post_id and status = 'published';
  end if;
  return new;
end;
$$;
create trigger research_reports_auto_hide after insert on public.research_post_reports
  for each row execute function public.auto_hide_reported_research();

create or replace function public.claim_notification_outbox(batch_size integer default 25)
returns setof public.notification_outbox
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with claimed as (
    select id from public.notification_outbox
    where status in ('pending','failed') and next_attempt_at <= now() and attempt_count < 5
    order by created_at
    for update skip locked
    limit least(greatest(batch_size, 1), 100)
  )
  update public.notification_outbox o
    set status = 'processing', attempt_count = attempt_count + 1
  from claimed where o.id = claimed.id
  returning o.*;
end;
$$;
revoke all on function public.claim_notification_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(integer) to service_role;

-- Public views are deliberately security-definer views with an immutable
-- published-only predicate and no internal user IDs. This prevents anonymous
-- authors from being deanonymized through the REST API.
create or replace view public.public_research_posts
with (security_barrier = true) as
select p.id, p.slug, p.ticker, p.company_name, p.title, p.summary, p.thesis,
       p.risks, p.opportunities, p.disclosure, p.snapshot, p.sources,
       p.author_mode, p.allow_comments, p.published_at, p.updated_at,
       case when p.author_mode = 'named' and profile.is_public then profile.handle end as author_handle,
       case when p.author_mode = 'named' and profile.is_public then profile.display_name end as author_display_name
from public.research_posts p
left join public.public_profiles profile on profile.user_id = p.author_id
where p.status = 'published';

create or replace view public.public_journey_posts
with (security_barrier = true) as
select p.id, p.journey_id, p.post_type, p.visibility, p.identity_mode,
       p.template_key, p.headline, p.subheadline, p.timeline_label,
       p.stage_label, p.show_timeline, p.show_percentages, p.show_exact_amounts,
       p.status, p.reaction_clap, p.reaction_fire, p.reaction_muscle,
       p.reaction_rocket, p.created_at, p.updated_at,
       case when p.identity_mode = 'display_name' and profile.is_public then profile.display_name end as author_display_name
from public.journey_posts p
left join public.public_profiles profile on profile.user_id = p.user_id
where p.status = 'published' and p.visibility in ('community','anonymous');

-- Owner-only views keep private management working without granting clients
-- access to identity-bearing public rows in the base tables.
create or replace view public.my_journey_posts
with (security_barrier = true) as
select p.* from public.journey_posts p where p.user_id = auth.uid();

create or replace view public.my_post_reactions
with (security_barrier = true) as
select r.* from public.post_reactions r where r.user_id = auth.uid();

revoke all on public.public_research_posts from public;
revoke all on public.public_journey_posts from public;
revoke all on public.my_journey_posts from public;
revoke all on public.my_post_reactions from public;
grant select on public.public_research_posts to anon, authenticated;
grant select on public.public_journey_posts to anon, authenticated;
grant select on public.my_journey_posts to authenticated;
grant select on public.my_post_reactions to authenticated;

-- Anonymous callers use the safe views, not identity-bearing base rows.
revoke select on public.research_posts from anon;
revoke select on public.journey_posts from anon;
grant select (id, slug) on public.research_posts to authenticated;
