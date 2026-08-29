-- Account operations, notification routing, consent, and durable delivery.

create table public.public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  bio text check (bio is null or char_length(bio) <= 500),
  avatar_url text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  theme text,
  dashboard_layout jsonb,
  notification_preferences jsonb not null default jsonb_build_object(
    'email', true,
    'in_app', true,
    'push', true,
    'marketing', false,
    'analysis_complete', true,
    'watchlist_alerts', false,
    'market_updates', false
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.login_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  login_timestamp timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  device_type text,
  location text,
  session_id text,
  success boolean not null default true,
  failure_reason text,
  created_at timestamptz not null default now()
);
create index login_activity_user_idx on public.login_activity (user_id, login_timestamp desc);

create table public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('export', 'deletion')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  download_url text,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  check (completed_at is null or completed_at >= requested_at)
);
create index data_export_requests_user_idx on public.data_export_requests (user_id, requested_at desc);

create table public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('feedback', 'feature_request', 'bug_report', 'testimonial')),
  title text not null check (char_length(title) between 1 and 180),
  description text not null check (char_length(description) between 1 and 5000),
  category text,
  priority integer not null default 0 check (priority between 0 and 5),
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewing', 'planned', 'in_progress', 'completed', 'declined')),
  votes_count integer not null default 0,
  admin_response text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.feature_votes (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.user_feedback(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote_type text not null check (vote_type in ('up', 'down')),
  created_at timestamptz not null default now(),
  unique (feedback_id, user_id)
);

create or replace function private.refresh_feedback_vote_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_feedback uuid := coalesce(new.feedback_id, old.feedback_id);
begin
  update public.user_feedback feedback
  set votes_count = (
    select count(*) filter (where vote.vote_type = 'up')
         - count(*) filter (where vote.vote_type = 'down')
    from public.feature_votes vote
    where vote.feedback_id = target_feedback
  )
  where feedback.id = target_feedback;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function private.refresh_feedback_vote_count() from public, anon, authenticated;

create trigger feature_votes_refresh_count
  after insert or update or delete on public.feature_votes
  for each row execute function private.refresh_feedback_vote_count();

alter table public.public_profiles enable row level security;
alter table public.system_settings enable row level security;
alter table public.login_activity enable row level security;
alter table public.data_export_requests enable row level security;
alter table public.user_feedback enable row level security;
alter table public.feature_votes enable row level security;

create policy public_profiles_select
  on public.public_profiles for select
  using (is_public or user_id = auth.uid());
create policy public_profiles_manage_own
  on public.public_profiles for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy system_settings_manage_own
  on public.system_settings for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy login_activity_select_own
  on public.login_activity for select to authenticated
  using (user_id = auth.uid());
create policy data_export_requests_manage_own
  on public.data_export_requests for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy user_feedback_read_authenticated
  on public.user_feedback for select to authenticated
  using (true);
create policy user_feedback_insert_own
  on public.user_feedback for insert to authenticated
  with check (user_id = auth.uid());
create policy user_feedback_update_own
  on public.user_feedback for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy feature_votes_read_own
  on public.feature_votes for select to authenticated
  using (user_id = auth.uid());
create policy feature_votes_manage_own
  on public.feature_votes for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on
  public.public_profiles,
  public.system_settings,
  public.login_activity,
  public.data_export_requests,
  public.user_feedback,
  public.feature_votes
from anon, authenticated;
grant select on public.public_profiles to anon, authenticated;
grant insert, update, delete on public.public_profiles to authenticated;
grant select, insert, update, delete on public.system_settings to authenticated;
grant select on public.login_activity to authenticated;
grant select, insert, update, delete on public.data_export_requests to authenticated;
grant select, insert, update on public.user_feedback to authenticated;
grant select, insert, update, delete on public.feature_votes to authenticated;
grant all on public.login_activity, public.data_export_requests, public.user_feedback, public.feature_votes to service_role;

create trigger public_profiles_updated_at
  before update on public.public_profiles
  for each row execute function public.set_updated_at();
create trigger system_settings_updated_at
  before update on public.system_settings
  for each row execute function public.set_updated_at();
create trigger user_feedback_updated_at
  before update on public.user_feedback
  for each row execute function public.set_updated_at();

-- Compatibility read model for the existing usage hook. Entitlements remain
-- sourced from user_profiles; this view stores no second subscription truth.
create view public.subscribers
with (security_invoker = true)
as
select
  profile.id,
  profile.id as user_id,
  profile.email,
  profile.stripe_customer_id,
  profile.subscription_tier,
  profile.subscription_ends_at as subscription_end,
  profile.subscription_tier <> 'free'
    and profile.subscription_status in ('active', 'trialing', 'past_due') as subscribed,
  '{}'::jsonb as features_enabled,
  case profile.subscription_tier
    when 'tier1' then '{"monthly_calculations":-1,"saved_projects":-1,"export_reports":50}'::jsonb
    when 'tier2' then '{"monthly_calculations":-1,"saved_projects":-1,"export_reports":100}'::jsonb
    when 'tier3' then '{"monthly_calculations":-1,"saved_projects":-1,"export_reports":-1}'::jsonb
    else '{"monthly_calculations":100,"saved_projects":10,"export_reports":5}'::jsonb
  end as usage_limits,
  profile.created_at,
  profile.updated_at
from public.user_profiles profile;
revoke all on public.subscribers from anon, authenticated;
grant select on public.subscribers to authenticated;

create table public.notification_channel_policies (
  event_type text primary key,
  importance text not null
    check (importance in ('critical', 'transactional', 'time_sensitive', 'activity')),
  push_mode text not null default 'none'
    check (push_mode in ('required', 'preference', 'rate_limited', 'none')),
  email_mode text not null default 'none'
    check (email_mode in ('required', 'on_request', 'fallback', 'digest', 'none')),
  email_variant text not null default 'transactional'
    check (email_variant in ('transactional', 'marketing', 'internal')),
  email_preference_key text not null default 'updates_enabled'
    check (email_preference_key in ('transactional_enabled', 'reminders_enabled', 'updates_enabled', 'marketing_enabled', 'digest_enabled')),
  rate_limit_key text,
  rate_window_minutes integer check (rate_window_minutes is null or rate_window_minutes > 0),
  max_pushes_per_window integer check (max_pushes_per_window is null or max_pushes_per_window > 0),
  description text not null default '',
  updated_at timestamptz not null default now(),
  check (
    push_mode <> 'rate_limited'
    or (rate_limit_key is not null and rate_window_minutes is not null and max_pushes_per_window is not null)
  )
);

insert into public.notification_channel_policies (
  event_type, importance, push_mode, email_mode, email_variant,
  email_preference_key, rate_limit_key, rate_window_minutes,
  max_pushes_per_window, description
)
values
  (
    'calendar_reminder', 'time_sensitive', 'preference', 'on_request',
    'transactional', 'reminders_enabled', null, null, null,
    'A reminder configured by the user; requested channels are honored.'
  ),
  (
    'project_milestone_due', 'time_sensitive', 'rate_limited', 'fallback',
    'transactional', 'updates_enabled', 'project-milestones', 1440, 4,
    'A project milestone assigned to the user is due within seven days.'
  );

create table public.user_email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  transactional_enabled boolean not null default true,
  reminders_enabled boolean not null default true,
  updates_enabled boolean not null default true,
  marketing_enabled boolean not null default false,
  digest_enabled boolean not null default false,
  unsubscribed boolean not null default false,
  unsubscribed_at timestamptz,
  unsubscribe_token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index user_email_preferences_token_key
  on public.user_email_preferences (unsubscribe_token);

create or replace function private.protect_unsubscribe_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
revoke all on function private.protect_unsubscribe_token() from public, anon, authenticated;

create trigger user_email_preferences_protect_token
  before insert or update on public.user_email_preferences
  for each row execute function private.protect_unsubscribe_token();

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null references public.notification_channel_policies(event_type) on update cascade,
  payload jsonb not null default '{}'::jsonb,
  channels text[] not null default array['in_app']::text[]
    check (
      cardinality(channels) > 0
      and channels <@ array['in_app', 'email', 'push']::text[]
      and array_position(channels, null) is null
    ),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'delivered', 'partial', 'failed', 'suppressed', 'dead_letter', 'deferred_digest')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  dedupe_key text,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now()
);
create unique index notification_outbox_dedupe_key
  on public.notification_outbox (dedupe_key) where dedupe_key is not null;
create index notification_outbox_pending_idx
  on public.notification_outbox (next_attempt_at, created_at)
  where status in ('pending', 'failed');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid unique references public.notification_outbox(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text,
  category text,
  action_url text,
  action_label text,
  priority integer not null default 1 check (priority between 0 and 5),
  read boolean not null default false,
  read_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((read and read_at is not null) or (not read and read_at is null))
);
create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where not read;

create table public.push_subscriptions (
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

create table public.email_suppressions (
  email text primary key,
  reason text not null check (reason in ('hard_bounce', 'complaint', 'manual', 'invalid')),
  provider_event text,
  created_at timestamptz not null default now()
);

create table public.email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid references public.notification_outbox(id) on delete set null,
  provider_message_id text,
  email text not null,
  event text not null,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider_message_id, event)
);
create index email_delivery_events_outbox_idx
  on public.email_delivery_events (outbox_id, occurred_at desc);

create table public.email_send_log (
  id bigint generated always as identity primary key,
  recipient text not null,
  sent_at timestamptz not null default now()
);
create index email_send_log_recent_idx on public.email_send_log (sent_at desc);
create index email_send_log_recipient_idx on public.email_send_log (recipient, sent_at desc);

create table public.push_rate_limit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  rate_limit_key text not null,
  consumed_at timestamptz not null default now()
);
create index push_rate_limit_log_lookup_idx
  on public.push_rate_limit_log (user_id, rate_limit_key, consumed_at desc);

alter table public.notification_channel_policies enable row level security;
alter table public.user_email_preferences enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.email_delivery_events enable row level security;
alter table public.email_send_log enable row level security;
alter table public.push_rate_limit_log enable row level security;

create policy notification_channel_policies_read
  on public.notification_channel_policies for select to authenticated
  using (true);
create policy user_email_preferences_manage_own
  on public.user_email_preferences for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy notifications_select_own
  on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update_own
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy notifications_delete_own
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());
create policy push_subscriptions_manage_own
  on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on
  public.notification_channel_policies,
  public.user_email_preferences,
  public.notification_outbox,
  public.notifications,
  public.push_subscriptions,
  public.email_suppressions,
  public.email_delivery_events,
  public.email_send_log,
  public.push_rate_limit_log
from anon, authenticated;
revoke all on sequence public.email_send_log_id_seq from anon, authenticated;
revoke all on sequence public.push_rate_limit_log_id_seq from anon, authenticated;
grant select on public.notification_channel_policies to authenticated;
grant select, insert, update on public.user_email_preferences to authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read, read_at) on public.notifications to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on
  public.notification_channel_policies,
  public.user_email_preferences,
  public.notification_outbox,
  public.notifications,
  public.push_subscriptions,
  public.email_suppressions,
  public.email_delivery_events,
  public.email_send_log,
  public.push_rate_limit_log
to service_role;
grant usage, select on sequence public.email_send_log_id_seq to service_role;
grant usage, select on sequence public.push_rate_limit_log_id_seq to service_role;

create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();
create trigger notifications_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();

create or replace function public.ensure_email_preferences(target_user uuid)
returns public.user_email_preferences
language plpgsql
security definer
set search_path = ''
as $$
declare
  preference_row public.user_email_preferences;
begin
  insert into public.user_email_preferences (user_id)
  values (target_user)
  on conflict (user_id) do nothing;

  select * into preference_row
  from public.user_email_preferences preference
  where preference.user_id = target_user;
  return preference_row;
end;
$$;
revoke all on function public.ensure_email_preferences(uuid) from public, anon, authenticated;
grant execute on function public.ensure_email_preferences(uuid) to service_role;

insert into public.user_email_preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function private.provision_email_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_email_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function private.provision_email_preferences() from public, anon, authenticated;

create trigger auth_users_provision_email_preferences
  after insert on auth.users
  for each row execute function private.provision_email_preferences();

create or replace function public.calculate_notification_retry_time(attempt integer)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now() + case greatest(attempt, 1)
    when 1 then interval '1 second'
    when 2 then interval '5 seconds'
    when 3 then interval '30 seconds'
    when 4 then interval '5 minutes'
    else interval '30 minutes'
  end;
$$;
revoke all on function public.calculate_notification_retry_time(integer) from public, anon, authenticated;
grant execute on function public.calculate_notification_retry_time(integer) to service_role;

create or replace function public.claim_notification_outbox(batch_size integer default 25)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_outbox
  set status = 'pending', claimed_at = null
  where status = 'processing'
    and claimed_at < now() - interval '15 minutes';

  update public.notification_outbox
  set status = 'dead_letter'
  where status in ('pending', 'failed')
    and attempt_count >= max_attempts;

  return query
  with claimed as (
    select outbox.id
    from public.notification_outbox outbox
    where outbox.status in ('pending', 'failed')
      and outbox.next_attempt_at <= now()
      and outbox.attempt_count < outbox.max_attempts
    order by outbox.created_at
    for update skip locked
    limit least(greatest(batch_size, 1), 100)
  )
  update public.notification_outbox outbox
  set status = 'processing',
      attempt_count = outbox.attempt_count + 1,
      claimed_at = now()
  from claimed
  where outbox.id = claimed.id
  returning outbox.*;
end;
$$;
revoke all on function public.claim_notification_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(integer) to service_role;

create or replace function public.consume_email_rate_slot(
  p_recipient text,
  p_global_per_minute integer default 100,
  p_per_recipient_per_minute integer default 10
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_recipient is null or p_global_per_minute < 1 or p_per_recipient_per_minute < 1 then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('tw-email-global', 0));
  perform pg_advisory_xact_lock(hashtextextended(lower(p_recipient), 0));
  if (select count(*) from public.email_send_log where sent_at > now() - interval '1 minute') >= p_global_per_minute then
    return false;
  end if;
  if (
    select count(*) from public.email_send_log
    where recipient = lower(p_recipient) and sent_at > now() - interval '1 minute'
  ) >= p_per_recipient_per_minute then
    return false;
  end if;
  insert into public.email_send_log (recipient) values (lower(p_recipient));
  return true;
end;
$$;
revoke all on function public.consume_email_rate_slot(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_email_rate_slot(text, integer, integer) to service_role;

create or replace function public.consume_push_rate_slot(
  p_user_id uuid,
  p_key text,
  p_window_minutes integer,
  p_max integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_key is null or p_window_minutes < 1 or p_max < 1 then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_key, 0));
  if (
    select count(*) from public.push_rate_limit_log
    where user_id = p_user_id
      and rate_limit_key = p_key
      and consumed_at >= now() - make_interval(mins => p_window_minutes)
  ) >= p_max then
    return false;
  end if;
  insert into public.push_rate_limit_log (user_id, rate_limit_key)
  values (p_user_id, p_key);
  return true;
end;
$$;
revoke all on function public.consume_push_rate_slot(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_push_rate_slot(uuid, text, integer, integer) to service_role;

create table public.calendar_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null check (char_length(event_key) between 1 and 240),
  event_date date not null,
  title text not null check (char_length(title) between 1 and 240),
  event_type text not null,
  days_before smallint not null default 1 check (days_before between 0 and 30),
  delivery_time time not null default '09:00',
  channels text[] not null default array['in_app']::text[]
    check (channels <@ array['in_app', 'email', 'push']::text[] and cardinality(channels) > 0),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'queued', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_key)
);
create index calendar_reminders_due_idx
  on public.calendar_reminders (event_date, status) where status = 'scheduled';
alter table public.calendar_reminders enable row level security;
create policy calendar_reminders_manage_own
  on public.calendar_reminders for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
revoke all on public.calendar_reminders from anon, authenticated;
grant select, insert, update, delete on public.calendar_reminders to authenticated;
grant all on public.calendar_reminders to service_role;
create trigger calendar_reminders_updated_at
  before update on public.calendar_reminders
  for each row execute function public.set_updated_at();

create or replace function public.queue_due_calendar_reminders(as_of timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued_count integer;
begin
  with due as (
    select reminder.*
    from public.calendar_reminders reminder
    where reminder.status = 'scheduled'
      and reminder.event_date - reminder.days_before <= (as_of at time zone 'America/New_York')::date
      and (
        reminder.event_date - reminder.days_before < (as_of at time zone 'America/New_York')::date
        or reminder.delivery_time <= (as_of at time zone 'America/New_York')::time
      )
    for update skip locked
  ), inserted as (
    insert into public.notification_outbox (
      user_id, event_type, payload, channels, dedupe_key
    )
    select
      due.user_id,
      'calendar_reminder',
      jsonb_build_object(
        'reminder_id', due.id,
        'event_key', due.event_key,
        'event_date', due.event_date,
        'event_type', due.event_type,
        'title', due.title,
        'message', due.title || ' is scheduled for ' || to_char(due.event_date, 'Mon FMDD, YYYY'),
        'action_url', '/?module=dashboard'
      ),
      due.channels,
      'calendar:' || due.id::text || ':' || due.event_date::text
    from due
    on conflict (dedupe_key) where dedupe_key is not null do nothing
    returning (payload ->> 'reminder_id')::uuid as reminder_id
  )
  update public.calendar_reminders reminder
  set status = 'queued', updated_at = now()
  from inserted
  where reminder.id = inserted.reminder_id;
  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;
revoke all on function public.queue_due_calendar_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.queue_due_calendar_reminders(timestamptz) to service_role;

create or replace function public.queue_due_project_milestones(as_of date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued_count integer;
begin
  insert into public.notification_outbox (
    user_id, event_type, payload, channels, dedupe_key
  )
  select
    coalesce(milestone.assigned_to, project.project_manager_id),
    'project_milestone_due',
    jsonb_build_object(
      'milestone_id', milestone.id,
      'project_id', project.id,
      'project_name', project.name,
      'title', milestone.title,
      'due_date', milestone.due_date,
      'action_url', '/?module=dashboard'
    ),
    array['in_app', 'email', 'push']::text[],
    'project-milestone:' || milestone.id::text || ':' || milestone.due_date::text
  from public.project_milestones milestone
  join public.projects project
    on project.id = milestone.project_id
   and project.organization_id = milestone.organization_id
  where milestone.status in ('planned', 'in_progress', 'blocked')
    and milestone.due_date between as_of and as_of + 7
    and coalesce(milestone.assigned_to, project.project_manager_id) is not null
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;
revoke all on function public.queue_due_project_milestones(date) from public, anon, authenticated;
grant execute on function public.queue_due_project_milestones(date) to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
