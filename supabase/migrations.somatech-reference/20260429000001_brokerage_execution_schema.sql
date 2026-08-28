-- Brokerage connections & autonomous execution schema
-- Run this in the Supabase SQL editor

-- ── brokerage_connections ────────────────────────────────────────────────────
create table if not exists public.brokerage_connections (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  portfolio_id            uuid not null references public.portfolios(id) on delete cascade,
  provider                text not null default 'alpaca' check (provider = 'alpaca'),
  environment             text not null default 'paper' check (environment in ('paper', 'live')),
  -- Credentials stored encrypted at rest; only readable by the owning user via RLS
  api_key                 text not null,
  api_secret              text not null,
  account_id              text,
  account_type            text,    -- 'MARGIN' | 'CASH' | 'PORTFOLIO_MARGIN'
  is_active               boolean not null default true,
  -- Autonomous execution settings
  autonomous_enabled      boolean not null default false,
  approval_required       boolean not null default true,
  frequency               text not null default 'weekly' check (frequency in ('daily', 'weekly', 'monthly')),
  max_deploy_pct_per_run  numeric not null default 10  check (max_deploy_pct_per_run between 0.1 and 100),
  max_trades_per_run      integer not null default 5   check (max_trades_per_run between 1 and 50),
  max_position_pct        numeric not null default 10  check (max_position_pct between 0.1 and 100),
  -- Safety rails
  kill_switch             boolean not null default false,
  drawdown_pause_pct      numeric not null default 10  check (drawdown_pause_pct between 1 and 50),
  -- Scheduling
  next_run_at             timestamptz,
  last_run_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- Only one active connection per portfolio
  unique (portfolio_id, is_active) deferrable initially deferred
);

-- ── execution_runs ───────────────────────────────────────────────────────────
-- One row per rebalance attempt; guards idempotency
create table if not exists public.execution_runs (
  id              uuid primary key default gen_random_uuid(),
  connection_id   uuid not null references public.brokerage_connections(id) on delete cascade,
  portfolio_id    uuid not null references public.portfolios(id) on delete cascade,
  run_type        text not null check (run_type in ('manual', 'autonomous', 'sync')),
  status          text not null default 'running' check (status in ('running', 'completed', 'failed', 'killed')),
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  error           text,
  summary         jsonb    -- { positions_synced, orders_generated, orders_submitted, total_notional_usd, drawdown_pct }
);

-- ── execution_log ────────────────────────────────────────────────────────────
-- Every order ever generated or submitted
create table if not exists public.execution_log (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid references public.execution_runs(id) on delete set null,
  connection_id     uuid not null references public.brokerage_connections(id) on delete cascade,
  portfolio_id      uuid not null references public.portfolios(id) on delete cascade,
  ticker            text not null,
  action            text not null check (action in ('BUY', 'SELL')),
  bucket            text not null,
  shares            numeric,
  notional_usd      numeric,
  fill_price        numeric,
  alpaca_order_id   text,
  status            text not null default 'pending'
                    check (status in ('pending', 'submitted', 'filled', 'cancelled', 'rejected', 'error')),
  rationale         text,
  requires_approval boolean not null default true,
  approved_at       timestamptz,
  submitted_at      timestamptz,
  filled_at         timestamptz,
  error             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── updated_at triggers ───────────────────────────────────────────────────────
-- Reuse set_updated_at() if already defined, otherwise create it
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger brokerage_connections_updated_at
  before update on public.brokerage_connections
  for each row execute function public.set_updated_at();

create trigger execution_log_updated_at
  before update on public.execution_log
  for each row execute function public.set_updated_at();

-- ── indexes ───────────────────────────────────────────────────────────────────
create index if not exists brokerage_conn_user_idx       on public.brokerage_connections(user_id);
create index if not exists brokerage_conn_portfolio_idx  on public.brokerage_connections(portfolio_id);
create index if not exists execution_runs_conn_idx       on public.execution_runs(connection_id);
create index if not exists execution_runs_portfolio_idx  on public.execution_runs(portfolio_id);
create index if not exists execution_log_run_idx         on public.execution_log(run_id);
create index if not exists execution_log_conn_idx        on public.execution_log(connection_id);
create index if not exists execution_log_portfolio_idx   on public.execution_log(portfolio_id);
create index if not exists execution_log_status_idx      on public.execution_log(status) where status = 'pending';

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.brokerage_connections enable row level security;
alter table public.execution_runs        enable row level security;
alter table public.execution_log         enable row level security;

-- brokerage_connections: user owns their rows
create policy "brokerage: select own"  on public.brokerage_connections for select  using (auth.uid() = user_id);
create policy "brokerage: insert own"  on public.brokerage_connections for insert  with check (auth.uid() = user_id);
create policy "brokerage: update own"  on public.brokerage_connections for update  using (auth.uid() = user_id);
create policy "brokerage: delete own"  on public.brokerage_connections for delete  using (auth.uid() = user_id);

-- execution_runs: accessible via connection ownership
create policy "runs: select via connection"  on public.execution_runs for select
  using (exists (select 1 from public.brokerage_connections c where c.id = connection_id and c.user_id = auth.uid()));
create policy "runs: insert via connection"  on public.execution_runs for insert
  with check (exists (select 1 from public.brokerage_connections c where c.id = connection_id and c.user_id = auth.uid()));
create policy "runs: update via connection"  on public.execution_runs for update
  using (exists (select 1 from public.brokerage_connections c where c.id = connection_id and c.user_id = auth.uid()));

-- execution_log: accessible via connection ownership
create policy "log: select via connection"  on public.execution_log for select
  using (exists (select 1 from public.brokerage_connections c where c.id = connection_id and c.user_id = auth.uid()));
create policy "log: insert via connection"  on public.execution_log for insert
  with check (exists (select 1 from public.brokerage_connections c where c.id = connection_id and c.user_id = auth.uid()));
create policy "log: update via connection"  on public.execution_log for update
  using (exists (select 1 from public.brokerage_connections c where c.id = connection_id and c.user_id = auth.uid()));
