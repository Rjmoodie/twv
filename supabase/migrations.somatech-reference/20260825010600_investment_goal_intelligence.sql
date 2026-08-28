create table if not exists public.investment_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_type text not null default 'investing' check (goal_type in ('investing')),
  target_amount numeric not null check (target_amount > 0),
  target_date date not null,
  horizon_years integer not null check (horizon_years between 1 and 50),
  current_balance numeric not null default 0 check (current_balance >= 0),
  monthly_contribution numeric not null default 0 check (monthly_contribution >= 0),
  risk_profile text not null check (risk_profile in ('conservative', 'moderate', 'growth')),
  annual_contribution_growth_pct numeric not null default 0,
  inflation_pct numeric not null default 2.5,
  projection jsonb not null default '{}'::jsonb,
  assumption_version text not null,
  status text not null default 'active' check (status in ('active', 'reached', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, goal_type)
);

alter table public.investment_goals enable row level security;

create policy "Users can read their investment goals"
  on public.investment_goals for select
  using (auth.uid() = user_id);

create policy "Users can create their investment goals"
  on public.investment_goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update their investment goals"
  on public.investment_goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their investment goals"
  on public.investment_goals for delete
  using (auth.uid() = user_id);

alter table public.portfolios
  add column if not exists investment_goal_id uuid references public.investment_goals(id) on delete set null,
  add column if not exists target_amount numeric check (target_amount is null or target_amount > 0),
  add column if not exists monthly_contribution numeric check (monthly_contribution is null or monthly_contribution >= 0);

create index if not exists investment_goals_user_status_idx
  on public.investment_goals (user_id, status);

create index if not exists portfolios_investment_goal_idx
  on public.portfolios (investment_goal_id)
  where investment_goal_id is not null;

create or replace function public.set_investment_goal_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists investment_goals_updated_at on public.investment_goals;
create trigger investment_goals_updated_at
  before update on public.investment_goals
  for each row execute function public.set_investment_goal_updated_at();

-- A portfolio and its linked goal must belong to the same user. The foreign key
-- alone only proves that the goal exists and would otherwise permit a guessed
-- goal UUID from a different account to be attached.
create or replace function public.validate_portfolio_investment_goal_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.investment_goal_id is not null and not exists (
    select 1
    from public.investment_goals goal
    where goal.id = new.investment_goal_id
      and goal.user_id = new.user_id
  ) then
    raise exception 'Investment goal does not belong to portfolio owner'
      using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists portfolios_validate_investment_goal_owner on public.portfolios;
create trigger portfolios_validate_investment_goal_owner
  before insert or update of investment_goal_id, user_id on public.portfolios
  for each row execute function public.validate_portfolio_investment_goal_owner();
