-- Durable reminders for personal and provider-backed calendar events.
create table if not exists public.calendar_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null check (char_length(event_key) between 1 and 240),
  event_date date not null,
  title text not null check (char_length(title) between 1 and 240),
  event_type text not null,
  days_before smallint not null default 1 check (days_before between 0 and 30),
  delivery_time time not null default '09:00',
  channels text[] not null default array['in_app']::text[]
    check (channels <@ array['in_app','email','push']::text[] and cardinality(channels) > 0 and array_position(channels, null) is null),
  status text not null default 'scheduled' check (status in ('scheduled','queued','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_key)
);

create index if not exists calendar_reminders_due_idx
  on public.calendar_reminders (event_date, status) where status = 'scheduled';
alter table public.calendar_reminders enable row level security;
create policy "Users manage own calendar reminders" on public.calendar_reminders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.calendar_reminders to authenticated;

create or replace function public.queue_due_calendar_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare queued_count integer;
begin
  with due as (
    select r.id, r.user_id, r.event_key, r.event_date, r.title, r.event_type, r.channels
    from public.calendar_reminders r
    where r.status = 'scheduled'
      and r.event_date - r.days_before <= (now() at time zone 'America/New_York')::date
      and (
        r.event_date - r.days_before < (now() at time zone 'America/New_York')::date
        or r.delivery_time <= (now() at time zone 'America/New_York')::time
      )
    for update skip locked
  ), inserted as (
    insert into public.notification_outbox(user_id, event_type, payload, channels)
    select user_id, 'calendar_reminder', jsonb_build_object(
      'reminder_id', id, 'event_key', event_key, 'event_date', event_date,
      'event_type', event_type, 'title', title,
      'message', title || ' is scheduled for ' || to_char(event_date, 'Mon FMDD, YYYY'),
      'action_url', '/?module=financial-calendar'
    ), channels from due
    returning (payload->>'reminder_id')::uuid as reminder_id
  )
  update public.calendar_reminders r set status = 'queued', updated_at = now()
    from inserted i where r.id = i.reminder_id;
  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;
revoke all on function public.queue_due_calendar_reminders() from public, anon, authenticated;
grant execute on function public.queue_due_calendar_reminders() to service_role;

do $$ begin perform cron.unschedule('queue-calendar-reminders'); exception when others then null; end $$;
select cron.schedule('queue-calendar-reminders', '*/5 * * * *', $$select public.queue_due_calendar_reminders()$$);
