-- Communications: routing, consent, suppression and a real dead letter.
--
-- notification_outbox already gave us a durable spool with atomic claiming.
-- What it lacked was everything above the spool: a decision about which
-- channels an event should use, a record of what the provider did with the
-- message afterwards, and a terminal state for mail that can never be
-- delivered. Those are added here as data rather than as worker branches.

-- ---------------------------------------------------------------------------
-- Routing. One row per event type. Adding a notification means inserting a
-- row; the dispatcher never learns a new `if`.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_channel_policies (
  event_type text primary key,
  importance text not null check (importance in ('critical','transactional','time_sensitive','activity')),
  push_mode text not null default 'none' check (push_mode in ('required','preference','rate_limited','none')),
  email_mode text not null default 'none' check (email_mode in ('required','on_request','fallback','digest','none')),
  -- The class decides the footer, so it is stored with the route rather than
  -- decided by whichever sender happens to render the message.
  email_variant text not null default 'transactional' check (email_variant in ('transactional','marketing','internal')),
  email_preference_key text not null default 'updates_enabled'
    check (email_preference_key in ('transactional_enabled','reminders_enabled','updates_enabled','marketing_enabled','digest_enabled')),
  -- Grouping is a shared string, not N coordinated constants: every event
  -- naming the same key spends from the same window.
  rate_limit_key text,
  rate_window_minutes integer check (rate_window_minutes is null or rate_window_minutes > 0),
  max_pushes_per_window integer check (max_pushes_per_window is null or max_pushes_per_window > 0),
  description text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.notification_channel_policies enable row level security;
-- Config, not user data: a signed-in client may read it to explain each
-- notification in settings, but only the service role may change a route.
create policy "Channel policies are readable" on public.notification_channel_policies
  for select using (auth.role() in ('authenticated','service_role'));
grant select on public.notification_channel_policies to authenticated;

insert into public.notification_channel_policies
  (event_type, importance, push_mode, email_mode, email_variant, email_preference_key, description)
values
  ('research_published', 'time_sensitive', 'required', 'fallback', 'transactional', 'updates_enabled',
   'A followed ticker gained a published analysis. Email only when push did not land, so an active app user is not told twice.'),
  ('calendar_reminder', 'time_sensitive', 'required', 'on_request', 'transactional', 'reminders_enabled',
   'A reminder the user configured themselves. The channels on the reminder row are the user''s own choice, so they are honoured as written.')
on conflict (event_type) do update set
  importance = excluded.importance,
  push_mode = excluded.push_mode,
  email_mode = excluded.email_mode,
  email_variant = excluded.email_variant,
  email_preference_key = excluded.email_preference_key,
  description = excluded.description,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Consent. One row per user, per category, with a token that makes one-click
-- unsubscribe (RFC 8058) resolvable without exposing a user id in a URL.
-- ---------------------------------------------------------------------------
create table if not exists public.user_email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  transactional_enabled boolean not null default true,
  reminders_enabled boolean not null default true,
  updates_enabled boolean not null default true,
  -- Marketing and digest are opt-in. Everything else is opt-out.
  marketing_enabled boolean not null default false,
  digest_enabled boolean not null default false,
  unsubscribed boolean not null default false,
  unsubscribed_at timestamptz,
  -- 64 hex chars from two v4 UUIDs: ~244 bits of entropy with no extension
  -- dependency, so it resolves under `search_path = ''` in any environment.
  unsubscribe_token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists user_email_preferences_token_key
  on public.user_email_preferences (unsubscribe_token);

alter table public.user_email_preferences enable row level security;
create policy "Users manage own email preferences" on public.user_email_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on public.user_email_preferences to authenticated;

-- The token is a bearer credential for an unauthenticated endpoint. A user may
-- read and flip their own flags, but must never be able to choose the token --
-- or to overwrite someone else's row by guessing one.
create or replace function public.protect_unsubscribe_token()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.unsubscribe_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  else
    new.unsubscribe_token := old.unsubscribe_token;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists user_email_preferences_protect_token on public.user_email_preferences;
create trigger user_email_preferences_protect_token
  before insert or update on public.user_email_preferences
  for each row execute function public.protect_unsubscribe_token();

-- ---------------------------------------------------------------------------
-- Suppression. Without this a dead address is retried forever, and every retry
-- costs sender reputation that the deliverable mail then pays for.
-- ---------------------------------------------------------------------------
create table if not exists public.email_suppressions (
  email text primary key,
  reason text not null check (reason in ('hard_bounce','complaint','manual','invalid')),
  provider_event text,
  created_at timestamptz not null default now()
);
alter table public.email_suppressions enable row level security;
grant select on public.email_suppressions to service_role;

-- ---------------------------------------------------------------------------
-- Delivery ledger. "The provider accepted it" was previously the only signal
-- the system ever recorded, which is not the same as "it arrived".
-- ---------------------------------------------------------------------------
create table if not exists public.email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid references public.notification_outbox(id) on delete set null,
  provider_message_id text,
  email text not null,
  event text not null,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists email_delivery_events_outbox_idx
  on public.email_delivery_events (outbox_id, occurred_at desc);
create index if not exists email_delivery_events_message_idx
  on public.email_delivery_events (provider_message_id);
-- A provider redelivering a webhook must not create a second row.
create unique index if not exists email_delivery_events_dedupe_key
  on public.email_delivery_events (provider_message_id, event)
  where provider_message_id is not null;
alter table public.email_delivery_events enable row level security;

-- ---------------------------------------------------------------------------
-- Outbox hardening: idempotency, bounded attempts, a claim timestamp.
-- ---------------------------------------------------------------------------
alter table public.notification_outbox add column if not exists dedupe_key text;
alter table public.notification_outbox add column if not exists max_attempts integer not null default 5;
alter table public.notification_outbox add column if not exists claimed_at timestamptz;
alter table public.notification_outbox add column if not exists provider_message_id text;

-- Idempotency is opt-in: a caller that can name the message uniquely gets
-- exactly-once for free, and a caller that cannot passes NULL and is
-- unaffected, because NULLs are distinct in a unique index.
create unique index if not exists notification_outbox_dedupe_key
  on public.notification_outbox (dedupe_key) where dedupe_key is not null;

alter table public.notification_outbox drop constraint if exists notification_outbox_status_check;
alter table public.notification_outbox add constraint notification_outbox_status_check
  check (status in ('pending','processing','delivered','partial','failed','suppressed','dead_letter'));

-- ---------------------------------------------------------------------------
-- The retry ladder is data, not a constant in the worker. A worker that
-- computes its own next-attempt time is the worker that drifts from what the
-- queue table actually contains.
-- ---------------------------------------------------------------------------
create or replace function public.calculate_notification_retry_time(attempt integer)
returns timestamptz language sql immutable set search_path = '' as $$
  select now() + case greatest(attempt, 1)
    when 1 then interval '1 second'
    when 2 then interval '5 seconds'
    when 3 then interval '30 seconds'
    when 4 then interval '5 minutes'
    else interval '30 minutes'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Claiming, now with a reaper and a terminal state.
-- ---------------------------------------------------------------------------
create or replace function public.claim_notification_outbox(batch_size integer default 25)
returns setof public.notification_outbox
language plpgsql security definer set search_path = '' as $$
begin
  -- A worker that died mid-batch left its rows in `processing` with nothing to
  -- sweep them back. Returning them to the pool is the whole fix.
  update public.notification_outbox
    set status = 'pending'
    where status = 'processing'
      and claimed_at is not null
      and claimed_at < now() - interval '15 minutes';

  -- Bounded attempts, then a terminal state that keeps last_error and the full
  -- payload so an operator can read what happened and replay it.
  update public.notification_outbox
    set status = 'dead_letter'
    where status in ('pending','failed')
      and attempt_count >= max_attempts;

  return query
  with claimed as (
    select id from public.notification_outbox
    where status in ('pending','failed')
      and next_attempt_at <= now()
      and attempt_count < max_attempts
    order by created_at
    for update skip locked
    limit least(greatest(batch_size, 1), 100)
  )
  update public.notification_outbox o
    set status = 'processing',
        attempt_count = o.attempt_count + 1,
        claimed_at = now()
  from claimed where o.id = claimed.id
  returning o.*;
end;
$$;
revoke all on function public.claim_notification_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Rate limiting. A throttled message goes back to pending with a future retry
-- time -- "rate limited" must never be a synonym for "lost".
-- ---------------------------------------------------------------------------
create table if not exists public.email_send_log (
  id bigserial primary key,
  recipient text not null,
  sent_at timestamptz not null default now()
);
create index if not exists email_send_log_sent_idx on public.email_send_log (sent_at desc);
create index if not exists email_send_log_recipient_idx on public.email_send_log (recipient, sent_at desc);
alter table public.email_send_log enable row level security;

-- Parameters are prefixed because `recipient` is also a column on
-- email_send_log, and an unprefixed parameter of the same name is ambiguous
-- inside the function body -- which Postgres reports at call time, not at
-- definition time.
drop function if exists public.consume_email_rate_slot(text, integer, integer);
create or replace function public.consume_email_rate_slot(
  p_recipient text,
  p_global_per_minute integer default 100,
  p_per_recipient_per_minute integer default 10
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  global_count integer;
  recipient_count integer;
begin
  select count(*) into global_count
    from public.email_send_log where sent_at > now() - interval '1 minute';
  if global_count >= p_global_per_minute then return false; end if;

  select count(*) into recipient_count
    from public.email_send_log
    where email_send_log.recipient = p_recipient
      and sent_at > now() - interval '1 minute';
  if recipient_count >= p_per_recipient_per_minute then return false; end if;

  insert into public.email_send_log(recipient) values (p_recipient);
  return true;
end;
$$;
revoke all on function public.consume_email_rate_slot(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_email_rate_slot(text, integer, integer) to service_role;

create or replace function public.prune_email_send_log()
returns void language sql security definer set search_path = '' as $$
  delete from public.email_send_log where sent_at < now() - interval '1 hour';
$$;
revoke all on function public.prune_email_send_log() from public, anon, authenticated;

do $$ begin perform cron.unschedule('prune-email-send-log'); exception when others then null; end $$;
select cron.schedule('prune-email-send-log', '17 * * * *', $$select public.prune_email_send_log()$$);

-- ---------------------------------------------------------------------------
-- Provisioning consent rows.
--
-- The unsubscribe token only exists once a row does, so every user needs one.
-- Existing users are backfilled here; new users are covered by a trigger on
-- auth.users where the migration role is permitted to create one. Ownership of
-- auth.users varies between projects, so a refusal degrades to the on-demand
-- path in the dispatch worker rather than failing the whole migration.
-- ---------------------------------------------------------------------------
insert into public.user_email_preferences (user_id)
  select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.ensure_email_preferences(target_user uuid)
returns public.user_email_preferences
language plpgsql security definer set search_path = '' as $$
declare
  row public.user_email_preferences;
begin
  insert into public.user_email_preferences(user_id) values (target_user)
    on conflict (user_id) do nothing;
  select * into row from public.user_email_preferences where user_id = target_user;
  return row;
end;
$$;
revoke all on function public.ensure_email_preferences(uuid) from public, anon;
grant execute on function public.ensure_email_preferences(uuid) to service_role;

create or replace function public.provision_email_preferences()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_email_preferences(user_id) values (new.id)
    on conflict (user_id) do nothing;
  return new;
end;
$$;

do $$
begin
  drop trigger if exists auth_users_provision_email_preferences on auth.users;
  create trigger auth_users_provision_email_preferences
    after insert on auth.users
    for each row execute function public.provision_email_preferences();
exception when insufficient_privilege or undefined_table then
  raise notice 'Skipped auth.users trigger; preferences will be provisioned on demand.';
end $$;
