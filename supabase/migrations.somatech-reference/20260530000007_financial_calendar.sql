-- Financial Calendar — unified event store
-- Events span journey milestones, check-ins, coach reminders, and market dates

create table if not exists financial_events (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  title         text        not null,
  description   text,
  event_date    date        not null,
  event_type    text        not null check (event_type in (
                              'journey_milestone', 'check_in', 'coach_reminder',
                              'savings_target', 'earnings', 'pdufa', 'bill', 'custom'
                            )),
  journey_id    text,       -- null for non-journey events
  category      text        not null default 'general' check (category in (
                              'savings', 'debt', 'investment', 'home', 'business',
                              'market', 'bill', 'general'
                            )),
  is_completed  boolean     not null default false,
  completed_at  timestamptz,
  color         text,       -- optional hex/tailwind color override
  metadata      jsonb       not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index financial_events_user_date_idx   on financial_events(user_id, event_date);
create index financial_events_user_type_idx   on financial_events(user_id, event_type);
create index financial_events_journey_idx     on financial_events(user_id, journey_id) where journey_id is not null;

-- RLS
alter table financial_events enable row level security;

create policy "Users manage own events"
  on financial_events for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function update_financial_events_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_financial_events_updated_at
  before update on financial_events
  for each row execute function update_financial_events_updated_at();
