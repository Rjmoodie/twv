-- Personal Finance FP&A tables
-- Powers the Net Worth Tracker, Cash Flow module, and Scenario Modeler.
-- All tables are user-isolated via RLS.

-- ── Net Worth Snapshots ──────────────────────────────────────────────────────
-- One row per user per month. Manual entry; user updates balances monthly.

create table if not exists public.net_worth_snapshots (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  snapshot_month   date not null,          -- stored as first-of-month (YYYY-MM-01)

  -- Assets
  checking         numeric not null default 0,
  savings          numeric not null default 0,
  investments      numeric not null default 0,
  real_estate      numeric not null default 0,
  other_assets     numeric not null default 0,

  -- Liabilities
  credit_cards     numeric not null default 0,
  student_loans    numeric not null default 0,
  mortgage         numeric not null default 0,
  car_loans        numeric not null default 0,
  other_liabilities numeric not null default 0,

  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (user_id, snapshot_month)
);

alter table public.net_worth_snapshots enable row level security;

create policy "Users manage own net worth snapshots"
  on public.net_worth_snapshots for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role full access: net_worth_snapshots"
  on public.net_worth_snapshots for all
  to service_role using (true) with check (true);

create index if not exists nw_snapshots_user_month
  on public.net_worth_snapshots(user_id, snapshot_month desc);

-- ── Monthly Cash Flow ────────────────────────────────────────────────────────
-- One row per user per month. Income + categorised expenses.
-- On save, the app syncs monthly_take_home / monthly_expenses into
-- financial_profiles so the Financial Coach always has fresh numbers.

create table if not exists public.monthly_cash_flow (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  flow_month       date not null,           -- first-of-month

  -- Income streams
  primary_income   numeric not null default 0,
  side_income      numeric not null default 0,
  investment_income numeric not null default 0,
  other_income     numeric not null default 0,

  -- Expense categories
  housing          numeric not null default 0,
  food             numeric not null default 0,
  transport        numeric not null default 0,
  healthcare       numeric not null default 0,
  entertainment    numeric not null default 0,
  subscriptions    numeric not null default 0,
  clothing         numeric not null default 0,
  education        numeric not null default 0,
  travel           numeric not null default 0,
  other_expenses   numeric not null default 0,

  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (user_id, flow_month)
);

alter table public.monthly_cash_flow enable row level security;

create policy "Users manage own cash flow"
  on public.monthly_cash_flow for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role full access: monthly_cash_flow"
  on public.monthly_cash_flow for all
  to service_role using (true) with check (true);

create index if not exists cash_flow_user_month
  on public.monthly_cash_flow(user_id, flow_month desc);

-- ── Scenario Models ──────────────────────────────────────────────────────────
-- Named what-if scenarios with assumption overrides.
-- Projections are computed client-side from baseline cash flow data.

create table if not exists public.scenario_models (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  name                     text not null,
  income_change_pct        numeric not null default 0,   -- % delta vs baseline
  expense_change_pct       numeric not null default 0,
  one_time_cost            numeric not null default 0,   -- hits month 1
  extra_monthly_savings    numeric not null default 0,   -- additional savings/mo
  color                    text not null default '#6366f1',
  is_preset                boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.scenario_models enable row level security;

create policy "Users manage own scenarios"
  on public.scenario_models for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Shared updated_at trigger ────────────────────────────────────────────────
-- Reuse touch_updated_at() created in migration 20260528000003.

create trigger set_updated_at_net_worth_snapshots
  before update on public.net_worth_snapshots
  for each row execute function public.touch_updated_at();

create trigger set_updated_at_monthly_cash_flow
  before update on public.monthly_cash_flow
  for each row execute function public.touch_updated_at();

create trigger set_updated_at_scenario_models
  before update on public.scenario_models
  for each row execute function public.touch_updated_at();
