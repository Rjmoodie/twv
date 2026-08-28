-- Lightweight Alpaca connection for the Trades module.
-- Separate from brokerage_connections (which ties to portfolios for execution).
-- Stores API credentials encrypted at rest; RLS ensures user isolation.

create table if not exists public.user_alpaca_keys (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  api_key     text not null,
  api_secret  text not null,
  environment text not null default 'paper' check (environment in ('paper', 'live')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id)
);

alter table public.user_alpaca_keys enable row level security;

create policy "Users manage own alpaca keys"
  on public.user_alpaca_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role full access: user_alpaca_keys"
  on public.user_alpaca_keys for all
  to service_role using (true) with check (true);

-- Trade history: one row per filled Alpaca order.
-- Side-note: this stores individual fills, not paired round-trips.
-- The Trades Dashboard reads from this and computes analytics client-side.
create table if not exists public.trade_history (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  alpaca_order_id  text not null,
  ticker           text not null,
  side             text not null check (side in ('buy', 'sell')),
  qty              numeric not null,
  filled_avg_price numeric,
  notional         numeric,
  filled_at        timestamptz,
  strategy         text,    -- user-assigned label (editable in UI)
  synced_at        timestamptz not null default now(),
  unique (user_id, alpaca_order_id)
);

alter table public.trade_history enable row level security;

create policy "Users read own trade history"
  on public.trade_history for select
  using (auth.uid() = user_id);

create policy "Users update own trade strategy tags"
  on public.trade_history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role full access: trade_history"
  on public.trade_history for all
  to service_role using (true) with check (true);

create index if not exists trade_history_user_filled
  on public.trade_history(user_id, filled_at desc);
