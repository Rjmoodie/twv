-- Journey operating plans
-- Separates editable planning documents from factual financial data and makes
-- activation, scenarios, generated actions, and revision conflicts explicit.

create table if not exists public.journey_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  journey_id text not null check (journey_id in (
    'debt-freedom', 'budget-clarity', 'investor-starter', 'home-buying', 'business-owner'
  )),
  name text not null default 'Baseline' check (char_length(btrim(name)) between 1 and 80),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  input_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(input_metadata) = 'object'),
  assumptions jsonb not null default '[]'::jsonb check (jsonb_typeof(assumptions) = 'array'),
  activated_analysis jsonb,
  activated_revision bigint check (activated_revision is null or activated_revision > 0),
  schema_version smallint not null default 1 check (schema_version > 0),
  revision bigint not null default 1 check (revision > 0),
  parent_plan_id uuid references public.journey_plans(id) on delete set null,
  is_baseline boolean not null default false,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  currency_code text not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
  locale text not null default 'en-US' check (char_length(locale) between 2 and 20),
  monthly_commitment numeric not null default 0 check (monthly_commitment >= 0),
  target_date date,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists journey_plans_one_baseline_idx
  on public.journey_plans(user_id, journey_id) where is_baseline;
create unique index if not exists journey_plans_one_active_idx
  on public.journey_plans(user_id, journey_id) where status = 'active';
create index if not exists journey_plans_user_updated_idx
  on public.journey_plans(user_id, updated_at desc);
create index if not exists journey_plans_parent_idx
  on public.journey_plans(parent_plan_id) where parent_plan_id is not null;

create table if not exists public.journey_plan_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.journey_plans(id) on delete cascade,
  action_key text not null check (char_length(action_key) between 1 and 180),
  title text not null check (char_length(title) between 1 and 240),
  description text,
  category text not null default 'general',
  action_type text not null check (action_type in ('commitment','check_in','milestone','review')),
  amount numeric check (amount is null or amount >= 0),
  due_date date,
  cadence text,
  status text not null default 'pending' check (status in ('pending','completed','skipped','cancelled')),
  completed_at timestamptz,
  source_revision bigint not null check (source_revision > 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, action_key),
  unique(id, user_id)
);

create index if not exists journey_plan_actions_user_due_idx
  on public.journey_plan_actions(user_id, due_date) where status = 'pending';

alter table public.financial_events
  add column if not exists journey_plan_id uuid references public.journey_plans(id) on delete cascade,
  add column if not exists source_key text,
  add column if not exists source_revision bigint;

alter table public.journey_posts
  add column if not exists journey_plan_id uuid references public.journey_plans(id) on delete set null,
  add column if not exists source_revision bigint,
  add column if not exists verification_mode text not null default 'user_reported'
    check (verification_mode in ('plan_activation','user_reported'));

create index if not exists journey_posts_plan_idx
  on public.journey_posts(journey_plan_id) where journey_plan_id is not null;

create unique index if not exists financial_events_plan_source_idx
  on public.financial_events(user_id, journey_plan_id, source_key);

alter table public.journey_plans enable row level security;
alter table public.journey_plan_actions enable row level security;

create policy "Users manage own journey plans"
  on public.journey_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own journey plan actions"
  on public.journey_plan_actions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.journey_plans to authenticated;
grant select, insert, update, delete on public.journey_plan_actions to authenticated;

create or replace function public.validate_journey_plan_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_plan_id is not null and not exists (
    select 1 from public.journey_plans parent
    where parent.id = new.parent_plan_id
      and parent.user_id = new.user_id
      and parent.journey_id = new.journey_id
      and parent.parent_plan_id is null
  ) then
    raise exception 'Scenario parent must be an owned root plan for the same journey'
      using errcode = '23503';
  end if;
  if new.parent_plan_id = new.id then
    raise exception 'A plan cannot be its own parent' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.touch_journey_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.revision = old.revision + 1;
  return new;
end;
$$;

create or replace function public.touch_journey_plan_action()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at = now();
  elsif new.status <> 'completed' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists journey_plans_validate_parent on public.journey_plans;
create trigger journey_plans_validate_parent
  before insert or update of parent_plan_id, user_id, journey_id on public.journey_plans
  for each row execute function public.validate_journey_plan_parent();

drop trigger if exists journey_plans_touch on public.journey_plans;
create trigger journey_plans_touch
  before update on public.journey_plans
  for each row execute function public.touch_journey_plan();

drop trigger if exists journey_plan_actions_touch on public.journey_plan_actions;
create trigger journey_plan_actions_touch
  before update on public.journey_plan_actions
  for each row execute function public.touch_journey_plan_action();

create or replace function public.sync_journey_action_from_financial_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_event public.financial_events;
  event_completed boolean := false;
begin
  if tg_op = 'DELETE' then
    source_event := old;
  else
    source_event := new;
    event_completed := new.is_completed;
  end if;
  if source_event.journey_plan_id is null or source_event.source_key is null then
    return source_event;
  end if;

  update public.journey_plan_actions
  set status = case
    when tg_op = 'DELETE' then 'cancelled'
    when event_completed then 'completed'
    else 'pending'
  end
  where user_id = source_event.user_id
    and plan_id = source_event.journey_plan_id
    and action_key = source_event.source_key;

  if tg_op = 'DELETE' or event_completed then
    update public.calendar_reminders
    set status = 'cancelled', updated_at = now()
    where user_id = source_event.user_id
      and event_key = 'personal:' || source_event.id::text;
  end if;
  return source_event;
end;
$$;

drop trigger if exists financial_events_sync_journey_action_update on public.financial_events;
create trigger financial_events_sync_journey_action_update
  after update of is_completed on public.financial_events
  for each row when (old.is_completed is distinct from new.is_completed)
  execute function public.sync_journey_action_from_financial_event();

drop trigger if exists financial_events_sync_journey_action_delete on public.financial_events;
create trigger financial_events_sync_journey_action_delete
  after delete on public.financial_events
  for each row execute function public.sync_journey_action_from_financial_event();

-- Atomically promotes and activates a plan. The expected revision prevents a
-- stale browser tab from replacing a newer edit without the user seeing it.
create or replace function public.activate_journey_plan(
  p_plan_id uuid,
  p_expected_revision bigint,
  p_analysis jsonb,
  p_monthly_commitment numeric,
  p_target_date date
)
returns public.journey_plans
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected public.journey_plans;
begin
  select * into selected
  from public.journey_plans
  where id = p_plan_id and user_id = auth.uid()
  for update;

  if selected.id is null then
    raise exception 'Journey plan not found' using errcode = 'P0002';
  end if;
  if selected.revision <> p_expected_revision then
    raise exception 'Journey plan changed in another session' using errcode = '40001';
  end if;
  if p_monthly_commitment < 0 then
    raise exception 'Monthly commitment cannot be negative' using errcode = '23514';
  end if;

  update public.journey_plans
  set is_baseline = false
  where user_id = auth.uid()
    and journey_id = selected.journey_id
    and is_baseline
    and id <> selected.id;

  update public.journey_plans
  set status = 'paused'
  where user_id = auth.uid()
    and journey_id = selected.journey_id
    and status = 'active'
    and id <> selected.id;

  update public.journey_plans
  set parent_plan_id = null,
      is_baseline = true,
      status = 'active',
      activated_analysis = p_analysis,
      activated_revision = selected.revision + 1,
      monthly_commitment = p_monthly_commitment,
      target_date = p_target_date,
      activated_at = now()
  where id = selected.id
  returning * into selected;

  return selected;
end;
$$;

revoke all on function public.activate_journey_plan(uuid,bigint,jsonb,numeric,date) from public, anon;
grant execute on function public.activate_journey_plan(uuid,bigint,jsonb,numeric,date) to authenticated;

-- Completes an executable plan action and its calendar representation together,
-- so Dashboard and Calendar cannot tell conflicting stories.
create or replace function public.set_journey_plan_action_status(
  p_action_id uuid,
  p_status text
)
returns public.journey_plan_actions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected public.journey_plan_actions;
  linked_event_ids uuid[];
begin
  if p_status not in ('pending','completed') then
    raise exception 'Unsupported action status' using errcode = '22023';
  end if;

  select * into selected
  from public.journey_plan_actions
  where id = p_action_id and user_id = auth.uid()
  for update;

  if selected.id is null then
    raise exception 'Journey plan action not found' using errcode = 'P0002';
  end if;

  update public.journey_plan_actions
  set status = p_status
  where id = selected.id
  returning * into selected;

  select coalesce(array_agg(id), '{}'::uuid[]) into linked_event_ids
  from public.financial_events
  where user_id = auth.uid()
    and journey_plan_id = selected.plan_id
    and source_key = selected.action_key;

  update public.financial_events
  set is_completed = (p_status = 'completed'),
      completed_at = case when p_status = 'completed' then now() else null end,
      updated_at = now()
  where user_id = auth.uid()
    and journey_plan_id = selected.plan_id
    and source_key = selected.action_key;

  if p_status in ('completed','skipped') and cardinality(linked_event_ids) > 0 then
    update public.calendar_reminders
    set status = 'cancelled', updated_at = now()
    where user_id = auth.uid()
      and event_key = any (
        select 'personal:' || event_id::text from unnest(linked_event_ids) as ids(event_id)
      );
  end if;

  return selected;
end;
$$;

revoke all on function public.set_journey_plan_action_status(uuid,text) from public, anon;
grant execute on function public.set_journey_plan_action_status(uuid,text) to authenticated;
