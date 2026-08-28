-- Background alerts when a tracked company's filing changes the story.
--
-- The subscription already existed: watchlist.tracking_mode is the user saying
-- whether they want the narrative at all. What was missing was anything that
-- noticed a new filing without the user going to look, so story_updated_at
-- could only ever advance as a result of the user's own click.

-- ---------------------------------------------------------------------------
-- Routing. Email is deliberately reserved for thesis matches: the claims are
-- model-generated, and a false "your thesis may be broken" costs more trust
-- than a missed alert costs value. Everything else is in-app and push, where
-- the cost of being wrong is a glance.
--
-- It ships as 'none', not 'on_request'. The poller already asks for email on a
-- thesis match, but email-unsubscribe is not deployed yet, and mail whose
-- one-click opt-out 404s must not leave the building. Policy is the switch, so
-- turning it on later is one statement and no deploy:
--
--   update public.notification_channel_policies
--      set email_mode = 'on_request', updated_at = now()
--    where event_type = 'watchlist_story_update';
--
-- on_request is the right mode at that point, because the poller decides per
-- alert which channels a given tier has earned, and that decision is the policy.
-- ---------------------------------------------------------------------------
insert into public.notification_channel_policies
  (event_type, importance, push_mode, email_mode, email_variant, email_preference_key, description)
values
  ('watchlist_story_update', 'time_sensitive', 'required', 'none', 'transactional', 'updates_enabled',
   'A new 10-K/10-Q for a watchlist company reports a high-confidence negative or mixed change. Push and in-app only until email-unsubscribe is live; then on_request, which mails thesis matches alone.')
on conflict (event_type) do update set
  importance = excluded.importance,
  push_mode = excluded.push_mode,
  email_mode = excluded.email_mode,
  email_variant = excluded.email_variant,
  email_preference_key = excluded.email_preference_key,
  description = excluded.description,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Poll state. One row per tracked ticker, so a run can skip a company whose
-- newest filing it has already graded instead of re-reading EDGAR every tick.
-- ---------------------------------------------------------------------------
create table if not exists public.watchlist_story_poll_state (
  ticker text primary key check (ticker = upper(ticker) and ticker ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  last_accession text,
  last_filing_date date,
  last_checked_at timestamptz not null default now(),
  last_error text,
  consecutive_failures integer not null default 0
);
create index if not exists watchlist_story_poll_state_stale_idx
  on public.watchlist_story_poll_state (last_checked_at);
alter table public.watchlist_story_poll_state enable row level security;

-- ---------------------------------------------------------------------------
-- Fan-out.
--
-- This is a SQL function rather than a PostgREST upsert on purpose. The
-- dedupe_key index is partial, and PostgREST emits a bare ON CONFLICT that
-- Postgres will not match to a partial index -- only real SQL can repeat the
-- predicate. Enqueueing from the edge function directly would silently fail.
--
-- Idempotence matters here specifically: the poller re-reads the newest filing
-- on every run, so without the dedupe key one filing would alert on every tick.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_story_alerts(p_alerts jsonb)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  inserted_count integer;
begin
  if p_alerts is null or jsonb_typeof(p_alerts) <> 'array' then return 0; end if;

  with incoming as (
    select
      (item->>'user_id')::uuid as user_id,
      nullif(item->>'dedupe_key', '') as dedupe_key,
      coalesce(item->'payload', '{}'::jsonb) as payload,
      coalesce(
        (select array_agg(channel) from jsonb_array_elements_text(item->'channels') as channel),
        array['in_app']::text[]
      ) as channels
    from jsonb_array_elements(p_alerts) as item
    where item->>'user_id' is not null
  ), inserted as (
    insert into public.notification_outbox (user_id, event_type, payload, channels, dedupe_key)
    select user_id, 'watchlist_story_update', payload, channels, dedupe_key from incoming
    on conflict (dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*) into inserted_count from inserted;
  return coalesce(inserted_count, 0);
end;
$$;
revoke all on function public.enqueue_story_alerts(jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_story_alerts(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- The work list: every distinct ticker somebody is tracking narratively, with
-- the CIK needed to reach EDGAR, oldest-checked first so one slow company
-- cannot starve the rest.
-- ---------------------------------------------------------------------------
create or replace function public.watchlist_story_poll_targets(batch_size integer default 25)
returns table (ticker text, cik text, watcher_count integer, last_accession text)
language sql security definer set search_path = '' as $$
  select w.ticker,
         c.cik,
         count(*)::integer as watcher_count,
         max(s.last_accession) as last_accession
  from public.watchlist w
  join public.stock_analysis_cache c on c.ticker = w.ticker
  left join public.watchlist_story_poll_state s on s.ticker = w.ticker
  where w.tracking_mode <> 'price' and c.cik is not null
  group by w.ticker, c.cik
  order by coalesce(max(s.last_checked_at), 'epoch'::timestamptz) asc
  limit least(greatest(batch_size, 1), 100);
$$;
revoke all on function public.watchlist_story_poll_targets(integer) from public, anon, authenticated;
grant execute on function public.watchlist_story_poll_targets(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Who is watching a ticker, with everything the grader needs to judge per user:
-- their mode, their invalidation note, and their entitlement.
-- ---------------------------------------------------------------------------
create or replace function public.watchlist_story_watchers(p_ticker text)
returns table (
  watchlist_id uuid,
  user_id uuid,
  tracking_mode text,
  thesis_invalidation text,
  subscription_tier text,
  subscription_status text,
  role text
)
language sql security definer set search_path = '' as $$
  select w.id, w.user_id, w.tracking_mode, w.thesis_invalidation,
         p.subscription_tier, p.subscription_status, p.role
  from public.watchlist w
  left join public.user_profiles p on p.id = w.user_id
  where w.ticker = p_ticker and w.tracking_mode <> 'price';
$$;
revoke all on function public.watchlist_story_watchers(text) from public, anon, authenticated;
grant execute on function public.watchlist_story_watchers(text) to service_role;

-- ---------------------------------------------------------------------------
-- The tick. Same shape as dispatch_notifications_tick: secrets from Vault, not
-- from a GUC any app role could read, and a silent no-op until they exist so
-- scheduling ahead of the function deploy cannot spam the cron log.
--
-- Every fifteen minutes reads ten companies, oldest-checked first. The SEC
-- request per company is cheap; the extraction behind it runs only when the
-- accession actually changed, and its result is shared by every watcher of
-- that ticker.
-- ---------------------------------------------------------------------------
create or replace function public.poll_watchlist_stories_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  functions_url text;
  dispatch_secret text;
  api_key text;
begin
  select decrypted_secret into functions_url
    from vault.decrypted_secrets where name = 'supabase_functions_url';
  select decrypted_secret into dispatch_secret
    from vault.decrypted_secrets where name = 'notification_dispatch_secret';
  select decrypted_secret into api_key
    from vault.decrypted_secrets where name = 'supabase_anon_key';

  if functions_url is null or dispatch_secret is null or api_key is null then
    return;
  end if;

  perform net.http_post(
    url     := functions_url || '/poll-watchlist-stories',
    headers := jsonb_build_object(
      'Content-Type',      'application/json',
      'apikey',            api_key,
      'Authorization',     'Bearer ' || api_key,
      'x-dispatch-secret', dispatch_secret
    ),
    body    := jsonb_build_object('batch_size', 10)
  );
end;
$$;

revoke all on function public.poll_watchlist_stories_tick() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('poll-watchlist-stories');
exception when others then
  null;
end $$;

select cron.schedule(
  'poll-watchlist-stories',
  '*/15 * * * *',
  $$select public.poll_watchlist_stories_tick()$$
);
