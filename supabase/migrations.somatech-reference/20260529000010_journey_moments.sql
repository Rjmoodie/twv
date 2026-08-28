-- Journey Moments social layer
-- Phase 1+2: shareable cards, anonymous community feed, reactions, reports

-- ── journey_posts ────────────────────────────────────────────────────────────
create table if not exists journey_posts (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  journey_id        text        not null,
  post_type         text        not null check (post_type in (
                                  'journey_started', 'milestone_reached',
                                  'streak', 'projection_improved', 'goal_completed'
                                )),
  visibility        text        not null default 'private' check (visibility in (
                                  'private', 'anonymous', 'community'
                                )),
  identity_mode     text        not null default 'anonymous' check (identity_mode in (
                                  'anonymous', 'display_name'
                                )),
  template_key      text        not null,
  headline          text        not null,
  subheadline       text,
  timeline_label    text,               -- e.g. "18 months to go"
  stage_label       text,               -- e.g. "Build Stage"
  show_timeline     boolean     not null default true,
  show_percentages  boolean     not null default true,
  show_exact_amounts boolean   not null default false,
  status            text        not null default 'published' check (status in (
                                  'published', 'hidden', 'reported', 'removed'
                                )),
  -- denormalised reaction counts for fast feed reads (kept in sync by trigger)
  reaction_clap     int         not null default 0,
  reaction_fire     int         not null default 0,
  reaction_muscle   int         not null default 0,
  reaction_rocket   int         not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index journey_posts_user_id_idx       on journey_posts(user_id);
create index journey_posts_journey_id_idx    on journey_posts(journey_id);
create index journey_posts_visibility_idx    on journey_posts(visibility, status, created_at desc);
create index journey_posts_created_at_idx    on journey_posts(created_at desc);

-- ── post_reactions ────────────────────────────────────────────────────────────
create table if not exists post_reactions (
  id         uuid        primary key default gen_random_uuid(),
  post_id    uuid        not null references journey_posts(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  emoji      text        not null check (emoji in ('👏', '🔥', '💪', '🚀')),
  created_at timestamptz not null default now(),
  unique(post_id, user_id)   -- one reaction per user per post
);

create index post_reactions_post_id_idx on post_reactions(post_id);
create index post_reactions_user_id_idx on post_reactions(user_id);

-- ── post_reports ──────────────────────────────────────────────────────────────
create table if not exists post_reports (
  id                  uuid        primary key default gen_random_uuid(),
  post_id             uuid        not null references journey_posts(id) on delete cascade,
  reporter_user_id    uuid        not null references auth.users(id) on delete cascade,
  reason              text        not null check (reason in (
                                    'privacy', 'misleading', 'spam',
                                    'harassment', 'financial_advice', 'other'
                                  )),
  notes               text,
  status              text        not null default 'open' check (status in (
                                    'open', 'reviewed', 'dismissed', 'actioned'
                                  )),
  created_at          timestamptz not null default now(),
  unique(post_id, reporter_user_id)  -- one report per user per post
);

create index post_reports_post_id_idx on post_reports(post_id);
create index post_reports_status_idx  on post_reports(status);

-- ── Trigger: keep reaction counts in sync ────────────────────────────────────
create or replace function sync_reaction_counts()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    update journey_posts set
      reaction_clap   = reaction_clap   + case when NEW.emoji = '👏' then 1 else 0 end,
      reaction_fire   = reaction_fire   + case when NEW.emoji = '🔥' then 1 else 0 end,
      reaction_muscle = reaction_muscle + case when NEW.emoji = '💪' then 1 else 0 end,
      reaction_rocket = reaction_rocket + case when NEW.emoji = '🚀' then 1 else 0 end,
      updated_at = now()
    where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update journey_posts set
      reaction_clap   = greatest(0, reaction_clap   - case when OLD.emoji = '👏' then 1 else 0 end),
      reaction_fire   = greatest(0, reaction_fire   - case when OLD.emoji = '🔥' then 1 else 0 end),
      reaction_muscle = greatest(0, reaction_muscle - case when OLD.emoji = '💪' then 1 else 0 end),
      reaction_rocket = greatest(0, reaction_rocket - case when OLD.emoji = '🚀' then 1 else 0 end),
      updated_at = now()
    where id = OLD.post_id;
  end if;
  return null;
end;
$$;

create trigger trg_sync_reaction_counts
after insert or delete on post_reactions
for each row execute function sync_reaction_counts();

-- ── Trigger: auto-hide posts with 3+ reports ─────────────────────────────────
create or replace function auto_hide_reported_post()
returns trigger language plpgsql security definer as $$
declare
  report_count int;
begin
  select count(*) into report_count
  from post_reports
  where post_id = NEW.post_id and status = 'open';

  if report_count >= 3 then
    update journey_posts
    set status = 'reported', updated_at = now()
    where id = NEW.post_id and status = 'published';
  end if;
  return null;
end;
$$;

create trigger trg_auto_hide_reported
after insert on post_reports
for each row execute function auto_hide_reported_post();

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table journey_posts   enable row level security;
alter table post_reactions  enable row level security;
alter table post_reports    enable row level security;

-- journey_posts policies
create policy "Users can read own posts"
  on journey_posts for select
  using (auth.uid() = user_id);

create policy "Users can read community posts"
  on journey_posts for select
  using (
    visibility = 'community'
    and status = 'published'
    and auth.uid() is not null
  );

create policy "Users can insert own posts"
  on journey_posts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own posts"
  on journey_posts for update
  using (auth.uid() = user_id);

create policy "Users can delete own posts"
  on journey_posts for delete
  using (auth.uid() = user_id);

-- post_reactions policies
create policy "Users can read all reactions"
  on post_reactions for select
  using (auth.uid() is not null);

create policy "Users can insert own reactions"
  on post_reactions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own reactions"
  on post_reactions for delete
  using (auth.uid() = user_id);

-- post_reports policies
create policy "Users can insert reports"
  on post_reports for insert
  with check (auth.uid() = reporter_user_id);

create policy "Users can read own reports"
  on post_reports for select
  using (auth.uid() = reporter_user_id);

-- ── Rate limiting: max 3 posts per journey per 24h ───────────────────────────
create or replace function check_post_rate_limit()
returns trigger language plpgsql security definer as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from journey_posts
  where user_id    = NEW.user_id
    and journey_id = NEW.journey_id
    and created_at > now() - interval '24 hours';

  if recent_count >= 3 then
    raise exception 'Rate limit: max 3 Journey Moments per journey per 24 hours';
  end if;
  return NEW;
end;
$$;

create trigger trg_post_rate_limit
before insert on journey_posts
for each row execute function check_post_rate_limit();
