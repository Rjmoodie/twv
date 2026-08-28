-- Schwab-first brokerage foundation.
--
-- Broker facts (accounts, balances, positions and executions) are immutable,
-- provider-owned data. Portfolio classification, journal notes and publication
-- are separate SomaTech-owned overlays. Schwab is read-only throughout this
-- migration; existing Alpaca order execution remains isolated and secondary.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Generalise the legacy Alpaca connection without exposing either provider's
-- credentials to the browser.
-- ---------------------------------------------------------------------------
alter table public.brokerage_connections
  drop constraint if exists brokerage_connections_provider_check;
alter table public.brokerage_connections
  add constraint brokerage_connections_provider_check
  check (provider in ('schwab', 'alpaca'));

alter table public.brokerage_connections alter column api_key drop not null;
alter table public.brokerage_connections alter column api_secret drop not null;
alter table public.brokerage_connections
  drop constraint if exists brokerage_connections_portfolio_id_is_active_key;

alter table public.brokerage_connections
  add column if not exists connection_status text not null default 'active',
  add column if not exists is_primary boolean not null default false,
  add column if not exists account_hash text,
  add column if not exists account_number_last_four text,
  add column if not exists display_name text,
  add column if not exists capabilities jsonb not null default '{}'::jsonb,
  add column if not exists execution_enabled boolean not null default false,
  add column if not exists last_sync_attempt_at timestamptz,
  add column if not exists last_positions_synced_at timestamptz,
  add column if not exists last_executions_synced_at timestamptz,
  add column if not exists provider_data_as_of timestamptz,
  add column if not exists last_reconciled_at timestamptz,
  add column if not exists reconciliation_status text not null default 'pending',
  add column if not exists reconciliation_variance numeric,
  add column if not exists sync_cursor timestamptz,
  add column if not exists last_sync_error text;

alter table public.brokerage_connections
  drop constraint if exists brokerage_connections_connection_status_check;
alter table public.brokerage_connections
  add constraint brokerage_connections_connection_status_check
  check (connection_status in ('active','expiring','expired','revoked','error','disconnected'));
alter table public.brokerage_connections
  drop constraint if exists brokerage_connections_reconciliation_status_check;
alter table public.brokerage_connections
  add constraint brokerage_connections_reconciliation_status_check
  check (reconciliation_status in ('pending','reconciled','variance','unsupported'));

create unique index if not exists brokerage_one_primary_per_portfolio
  on public.brokerage_connections(portfolio_id)
  where is_primary and is_active;
create index if not exists brokerage_connections_sync_due_idx
  on public.brokerage_connections(provider, connection_status, last_positions_synced_at)
  where is_active;

-- Existing Alpaca connections stay secondary. A newly linked Schwab account is
-- promoted by the callback transaction and becomes the canonical portfolio feed.
update public.brokerage_connections
set is_primary = false
where provider = 'alpaca';

-- ---------------------------------------------------------------------------
-- One OAuth authorization can expose multiple Schwab accounts. Tokens attach
-- to the authorization, never to a browser-readable account row.
-- ---------------------------------------------------------------------------
create table if not exists public.brokerage_authorizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'schwab'),
  status text not null default 'active'
    check (status in ('active','expiring','expired','revoked','error','disconnected')),
  refresh_expires_at timestamptz not null,
  last_authorized_at timestamptz not null default now(),
  disconnected_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brokerage_authorizations enable row level security;
drop policy if exists "Users read own brokerage authorizations" on public.brokerage_authorizations;
create policy "Users read own brokerage authorizations"
  on public.brokerage_authorizations for select
  using (auth.uid() = user_id);
grant select on public.brokerage_authorizations to authenticated;

alter table public.brokerage_connections
  add column if not exists authorization_id uuid
  references public.brokerage_authorizations(id) on delete set null;
create index if not exists brokerage_connections_authorization_idx
  on public.brokerage_connections(authorization_id);
-- Deliberately non-partial: PostgREST emits a bare conflict target and cannot
-- repeat a partial-index predicate. NULLs remain distinct for legacy Alpaca rows.
create unique index if not exists brokerage_connections_schwab_account_key
  on public.brokerage_connections(authorization_id, account_hash);

create table if not exists public.brokerage_oauth_tokens (
  authorization_id uuid primary key references public.brokerage_authorizations(id) on delete cascade,
  access_token_ciphertext text not null,
  access_token_iv text not null,
  access_expires_at timestamptz not null,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  key_version integer not null default 1,
  refresh_lease_owner uuid,
  refresh_lease_expires_at timestamptz,
  last_refreshed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.brokerage_oauth_tokens enable row level security;
-- Intentionally no client policies. service_role only.
revoke all on public.brokerage_oauth_tokens from public, anon, authenticated;

create table if not exists public.brokerage_oauth_attempts (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  reconnect_authorization_id uuid references public.brokerage_authorizations(id) on delete cascade,
  return_to text not null default '/?module=portfolio',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.brokerage_oauth_attempts enable row level security;
-- Intentionally no client policies. Raw state is never persisted.
revoke all on public.brokerage_oauth_attempts from public, anon, authenticated;

-- The lease is a compare-and-set around the network refresh. A transaction
-- advisory lock cannot protect a fetch that happens after the transaction ends.
create or replace function public.claim_brokerage_token_refresh(
  p_authorization_id uuid,
  p_worker_id uuid,
  p_lease_seconds integer default 60
)
returns setof public.brokerage_oauth_tokens
language sql security definer set search_path = '' as $$
  update public.brokerage_oauth_tokens
  set refresh_lease_owner = p_worker_id,
      refresh_lease_expires_at = now() + make_interval(secs => least(greatest(p_lease_seconds, 15), 180))
  where authorization_id = p_authorization_id
    and (refresh_lease_expires_at is null or refresh_lease_expires_at < now() or refresh_lease_owner = p_worker_id)
  returning *;
$$;
revoke all on function public.claim_brokerage_token_refresh(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_brokerage_token_refresh(uuid, uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Durable broker ledger. No browser role can manufacture or alter broker facts.
-- ---------------------------------------------------------------------------
create table if not exists public.brokerage_account_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.brokerage_connections(id) on delete cascade,
  provider_data_as_of timestamptz not null,
  liquidation_value numeric,
  cash_balance numeric,
  buying_power numeric,
  long_market_value numeric,
  short_market_value numeric,
  currency text not null default 'USD',
  is_complete boolean not null default true,
  created_at timestamptz not null default now(),
  unique(connection_id, provider_data_as_of)
);

create table if not exists public.brokerage_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.brokerage_connections(id) on delete cascade,
  instrument_id text not null,
  symbol text,
  asset_type text not null default 'UNKNOWN',
  description text,
  cusip text,
  quantity numeric not null,
  long_short text not null default 'long' check (long_short in ('long','short')),
  average_price numeric,
  cost_basis numeric,
  market_price numeric,
  market_value numeric,
  currency text not null default 'USD',
  provider_data_as_of timestamptz not null,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(connection_id, instrument_id)
);

create table if not exists public.brokerage_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.brokerage_connections(id) on delete cascade,
  provider text not null check (provider in ('schwab','alpaca')),
  provider_execution_id text not null,
  provider_order_id text,
  provider_leg_id text not null default '',
  instrument_id text,
  symbol text,
  asset_type text not null default 'UNKNOWN',
  side text not null check (side in ('buy','sell')),
  quantity numeric not null check (quantity > 0),
  price numeric,
  gross_amount numeric,
  fees numeric,
  net_amount numeric,
  currency text not null default 'USD',
  executed_at timestamptz not null,
  settled_at timestamptz,
  source_event_hash text not null,
  created_at timestamptz not null default now(),
  unique(connection_id, provider_execution_id, provider_leg_id)
);

create index if not exists brokerage_executions_user_time_idx
  on public.brokerage_executions(user_id, executed_at desc);
create index if not exists brokerage_positions_user_symbol_idx
  on public.brokerage_positions(user_id, symbol);

create table if not exists public.brokerage_raw_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.brokerage_connections(id) on delete cascade,
  event_kind text not null,
  provider_event_id text,
  payload_hash text not null,
  schema_version text not null,
  processing_status text not null default 'received'
    check (processing_status in ('received','processed','quarantined','ignored')),
  quarantine_reason text,
  sanitized_payload jsonb not null,
  provider_occurred_at timestamptz,
  received_at timestamptz not null default now(),
  unique(connection_id, payload_hash)
);
alter table public.brokerage_raw_events enable row level security;
-- Service-only because even sanitized provider envelopes can contain sensitive metadata.
revoke all on public.brokerage_raw_events from public, anon, authenticated;

alter table public.brokerage_account_snapshots enable row level security;
alter table public.brokerage_positions enable row level security;
alter table public.brokerage_executions enable row level security;
drop policy if exists "Users read own brokerage snapshots" on public.brokerage_account_snapshots;
create policy "Users read own brokerage snapshots" on public.brokerage_account_snapshots for select using (auth.uid() = user_id);
drop policy if exists "Users read own brokerage positions" on public.brokerage_positions;
create policy "Users read own brokerage positions" on public.brokerage_positions for select using (auth.uid() = user_id);
drop policy if exists "Users read own brokerage executions" on public.brokerage_executions;
create policy "Users read own brokerage executions" on public.brokerage_executions for select using (auth.uid() = user_id);
grant select on public.brokerage_account_snapshots, public.brokerage_positions, public.brokerage_executions to authenticated;

-- SomaTech overlays: classification and journaling are editable; provider facts are not.
create table if not exists public.portfolio_position_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  provider text not null check (provider in ('schwab','alpaca')),
  instrument_id text not null,
  symbol text,
  bucket text not null,
  classification_source text not null default 'inferred'
    check (classification_source in ('inferred','user')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, portfolio_id, provider, instrument_id)
);
alter table public.portfolio_position_mappings enable row level security;
drop policy if exists "Users manage own portfolio position mappings" on public.portfolio_position_mappings;
create policy "Users manage own portfolio position mappings"
  on public.portfolio_position_mappings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.trade_annotations (
  execution_id uuid primary key references public.brokerage_executions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  strategy text,
  thesis text,
  lesson text,
  watchlist_id uuid references public.watchlist(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.trade_annotations enable row level security;
drop policy if exists "Users manage own trade annotations" on public.trade_annotations;
create policy "Users manage own trade annotations" on public.trade_annotations for all
  using (auth.uid() = user_id and exists (
    select 1 from public.brokerage_executions e where e.id = execution_id and e.user_id = auth.uid()
  ))
  with check (auth.uid() = user_id and exists (
    select 1 from public.brokerage_executions e where e.id = execution_id and e.user_id = auth.uid()
  ));
grant select, insert, update, delete on public.trade_annotations to authenticated;

create table if not exists public.trade_publications (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.brokerage_executions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','approved','published','rejected')),
  title text,
  commentary text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(execution_id)
);
alter table public.trade_publications enable row level security;
drop policy if exists "Users read own trade publications" on public.trade_publications;
create policy "Users read own trade publications" on public.trade_publications for select using (auth.uid() = user_id);
drop policy if exists "Users create publication drafts" on public.trade_publications;
create policy "Users create publication drafts" on public.trade_publications for insert
  with check (auth.uid() = user_id and status = 'draft' and exists (
    select 1 from public.brokerage_executions e where e.id = execution_id and e.user_id = auth.uid()
  ));
drop policy if exists "Users edit publication drafts" on public.trade_publications;
create policy "Users edit publication drafts" on public.trade_publications for update
  using (auth.uid() = user_id and status = 'draft')
  with check (auth.uid() = user_id and status = 'draft' and exists (
    select 1 from public.brokerage_executions e where e.id = execution_id and e.user_id = auth.uid()
  ));
grant select, insert, update on public.trade_publications to authenticated;

-- Match a Plaid investment account to its direct Schwab source. Plaid may still
-- provide cash-flow data, but the matched investment balance is excluded from
-- net worth so the same account can never be counted twice.
create table if not exists public.financial_account_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brokerage_connection_id uuid not null references public.brokerage_connections(id) on delete cascade,
  plaid_item_id text not null,
  plaid_account_id text not null,
  match_method text not null check (match_method in ('exact_last_four','user_confirmed')),
  include_in_plaid_net_worth boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, plaid_item_id, plaid_account_id)
);
alter table public.financial_account_links enable row level security;
drop policy if exists "Users read own account source links" on public.financial_account_links;
create policy "Users read own account source links" on public.financial_account_links for select using (auth.uid() = user_id);
grant select on public.financial_account_links to authenticated;

-- ---------------------------------------------------------------------------
-- Queue, durable run ledger and atomic claiming.
-- ---------------------------------------------------------------------------
create table if not exists public.brokerage_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.brokerage_connections(id) on delete cascade,
  sync_kind text not null default 'incremental' check (sync_kind in ('incremental','full','manual')),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','dead_letter')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  not_before timestamptz not null default now(),
  claimed_at timestamptz,
  claim_owner uuid,
  last_error_code text,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index if not exists brokerage_sync_jobs_one_open
  on public.brokerage_sync_jobs(connection_id, sync_kind)
  where status in ('pending','processing');
create index if not exists brokerage_sync_jobs_claim_idx
  on public.brokerage_sync_jobs(not_before, created_at)
  where status in ('pending','failed');
alter table public.brokerage_sync_jobs enable row level security;
revoke all on public.brokerage_sync_jobs from public, anon, authenticated;

create table if not exists public.brokerage_sync_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.brokerage_sync_jobs(id) on delete set null,
  connection_id uuid not null references public.brokerage_connections(id) on delete cascade,
  status text not null default 'running' check (status in ('running','completed','partial','failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  positions_seen integer not null default 0,
  executions_seen integer not null default 0,
  executions_inserted integer not null default 0,
  quarantined_events integer not null default 0,
  provider_data_as_of timestamptz,
  error_code text,
  error_message text,
  diagnostics jsonb not null default '{}'::jsonb
);
alter table public.brokerage_sync_runs enable row level security;
drop policy if exists "Users read own brokerage sync runs" on public.brokerage_sync_runs;
create policy "Users read own brokerage sync runs" on public.brokerage_sync_runs for select
  using (exists (
    select 1 from public.brokerage_connections c
    where c.id = connection_id and c.user_id = auth.uid()
  ));
grant select on public.brokerage_sync_runs to authenticated;

create or replace function public.claim_brokerage_sync_jobs(
  p_batch_size integer default 2,
  p_worker_id uuid default gen_random_uuid()
)
returns setof public.brokerage_sync_jobs
language plpgsql security definer set search_path = '' as $$
begin
  update public.brokerage_sync_jobs
  set status = 'failed', claim_owner = null, claimed_at = null,
      not_before = now() + interval '1 minute',
      last_error_code = 'stale_lease', last_error = 'Worker lease expired'
  where status = 'processing' and claimed_at < now() - interval '3 minutes';

  update public.brokerage_sync_jobs
  set status = 'dead_letter'
  where status = 'failed' and attempt_count >= max_attempts;

  return query
  with claimed as (
    select id from public.brokerage_sync_jobs
    where status in ('pending','failed')
      and attempt_count < max_attempts
      and not_before <= now()
    order by not_before, created_at
    for update skip locked
    limit least(greatest(p_batch_size, 1), 5)
  )
  update public.brokerage_sync_jobs j
  set status = 'processing', attempt_count = j.attempt_count + 1,
      claim_owner = p_worker_id, claimed_at = now()
  from claimed where j.id = claimed.id
  returning j.*;
end;
$$;
revoke all on function public.claim_brokerage_sync_jobs(integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_brokerage_sync_jobs(integer, uuid) to service_role;

-- Manual sync requests are authenticated and scoped through the connection's RLS ownership.
create or replace function public.enqueue_brokerage_sync(p_connection_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
begin
  if not exists (
    select 1 from public.brokerage_connections c
    where c.id = p_connection_id and c.user_id = auth.uid()
      and c.provider = 'schwab' and c.is_active
  ) then
    raise exception 'Schwab connection not found' using errcode = '42501';
  end if;
  insert into public.brokerage_sync_jobs(connection_id, sync_kind, status)
  values (p_connection_id, 'manual', 'pending')
  on conflict do nothing
  returning id into result;
  if result is null then
    select id into result from public.brokerage_sync_jobs
    where connection_id = p_connection_id and sync_kind = 'manual'
      and status in ('pending','processing') limit 1;
  end if;
  return result;
end;
$$;
revoke all on function public.enqueue_brokerage_sync(uuid) from public, anon;
grant execute on function public.enqueue_brokerage_sync(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Compatibility projections for the existing Portfolio and Trades surfaces.
-- ---------------------------------------------------------------------------
alter table public.portfolio_holdings
  drop constraint if exists portfolio_holdings_source_check;
alter table public.portfolio_holdings
  add constraint portfolio_holdings_source_check check (source in ('manual','alpaca','schwab'));
alter table public.portfolio_holdings
  add column if not exists provider_data_as_of timestamptz,
  add column if not exists classification_source text not null default 'user'
    check (classification_source in ('user','inferred')),
  add column if not exists is_stale boolean not null default false;

alter table public.investment_goals
  add column if not exists current_balance_source text not null default 'manual'
    check (current_balance_source in ('manual','schwab')),
  add column if not exists current_balance_as_of timestamptz;

-- Replace the compatibility projection atomically. Canonical account-level
-- positions remain in brokerage_positions; this aggregate exists only so the
-- established Portfolio, Journey and recommendation code reads Schwab facts.
create or replace function public.replace_schwab_portfolio_holdings(
  p_user_id uuid,
  p_portfolio_id uuid,
  p_provider_data_as_of timestamptz,
  p_rows jsonb
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  inserted_count integer;
  portfolio_value numeric;
begin
  if not exists (
    select 1 from public.portfolios p where p.id = p_portfolio_id and p.user_id = p_user_id
  ) then
    raise exception 'Portfolio ownership mismatch' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be an array' using errcode = '22023';
  end if;

  delete from public.portfolio_holdings
  where portfolio_id = p_portfolio_id and source = 'schwab';

  insert into public.portfolio_holdings(
    portfolio_id, ticker, company_name, bucket, shares, cost_basis,
    current_price, market_value, notes, source, provider_data_as_of,
    classification_source, is_stale, updated_at
  )
  select p_portfolio_id,
         upper(left(x.ticker, 32)), left(x.company_name, 255), x.bucket,
         x.shares, x.cost_basis, x.current_price, x.market_value, x.notes,
         'schwab', p_provider_data_as_of, x.classification_source, false, now()
  from jsonb_to_recordset(p_rows) as x(
    ticker text, company_name text, bucket text, shares numeric,
    cost_basis numeric, current_price numeric, market_value numeric,
    notes text, classification_source text
  )
  where x.ticker is not null and x.ticker <> '';

  get diagnostics inserted_count = row_count;
  select coalesce(sum(coalesce(h.market_value, h.shares * h.current_price)), 0)
    into portfolio_value
  from public.portfolio_holdings h
  where h.portfolio_id = p_portfolio_id
    and (h.source = 'schwab' or not exists (
      select 1 from public.portfolio_holdings s
      where s.portfolio_id = p_portfolio_id and s.source = 'schwab'
    ));

  update public.investment_goals g
  set current_balance = portfolio_value,
      current_balance_source = 'schwab',
      current_balance_as_of = p_provider_data_as_of,
      updated_at = now()
  where g.id = (select p.investment_goal_id from public.portfolios p where p.id = p_portfolio_id)
    and g.user_id = p_user_id and g.status = 'active';

  return inserted_count;
end;
$$;
revoke all on function public.replace_schwab_portfolio_holdings(uuid, uuid, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.replace_schwab_portfolio_holdings(uuid, uuid, timestamptz, jsonb) to service_role;

alter table public.trade_history alter column alpaca_order_id drop not null;
alter table public.trade_history
  add column if not exists provider text not null default 'alpaca' check (provider in ('alpaca','schwab')),
  add column if not exists brokerage_execution_id uuid references public.brokerage_executions(id) on delete cascade;
create unique index if not exists trade_history_brokerage_execution_key
  on public.trade_history(brokerage_execution_id) where brokerage_execution_id is not null;

-- The former Trades module read Alpaca secrets directly in the browser. Trades
-- now reads the canonical broker ledger, so retire that credential exposure
-- while retaining service-role access for an intentional legacy migration.
revoke all on public.user_alpaca_keys from authenticated;
drop policy if exists "Users manage own alpaca keys" on public.user_alpaca_keys;

create or replace function public.get_brokerage_trade_feed(p_limit integer default 1000)
returns table (
  id uuid, connection_id uuid, portfolio_id uuid, provider text, provider_execution_id text, ticker text, side text,
  qty numeric, filled_avg_price numeric, notional numeric, filled_at timestamptz,
  strategy text, synced_at timestamptz, source_as_of timestamptz
)
language sql security invoker set search_path = '' stable as $$
  select e.id, e.connection_id, c.portfolio_id, e.provider, e.provider_execution_id, coalesce(e.symbol, 'UNKNOWN'), e.side,
         e.quantity, e.price, coalesce(e.net_amount, e.gross_amount), e.executed_at,
         a.strategy, e.created_at, c.provider_data_as_of
  from public.brokerage_executions e
  join public.brokerage_connections c on c.id = e.connection_id
  left join public.trade_annotations a on a.execution_id = e.id and a.user_id = auth.uid()
  where e.user_id = auth.uid() and c.is_active
    and (c.provider = 'schwab' or not exists (
      select 1 from public.brokerage_connections s
      where s.user_id = auth.uid() and s.provider = 'schwab'
        and s.is_active and s.is_primary
    ))
  order by e.executed_at desc
  limit least(greatest(p_limit, 1), 5000);
$$;
revoke all on function public.get_brokerage_trade_feed(integer) from public, anon;
grant execute on function public.get_brokerage_trade_feed(integer) to authenticated;

-- Safe account metadata columns only. account_hash and all tokens stay server-only.
revoke select on table public.brokerage_connections from authenticated;
revoke insert, update, delete on table public.brokerage_connections from authenticated;
drop policy if exists "brokerage: insert own" on public.brokerage_connections;
drop policy if exists "brokerage: update own" on public.brokerage_connections;
drop policy if exists "brokerage: delete own" on public.brokerage_connections;
grant select (
  id, user_id, portfolio_id, authorization_id, provider, environment, account_id,
  account_type, account_number_last_four, display_name, capabilities, is_active,
  is_primary, connection_status, execution_enabled, autonomous_enabled, approval_required, frequency,
  max_deploy_pct_per_run, max_trades_per_run, max_position_pct, kill_switch,
  drawdown_pause_pct, next_run_at, last_run_at, last_sync_attempt_at,
  last_positions_synced_at, last_executions_synced_at, provider_data_as_of,
  last_reconciled_at, reconciliation_status, reconciliation_variance,
  last_sync_error, created_at, updated_at
) on table public.brokerage_connections to authenticated;

-- ---------------------------------------------------------------------------
-- Queue due work, surface reauthorization before data becomes stale, and wake
-- a bounded worker. The worker claims at most two accounts per request.
-- ---------------------------------------------------------------------------
create or replace function public.queue_due_schwab_syncs()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.brokerage_authorizations
  set status = case
        when refresh_expires_at <= now() then 'expired'
        when refresh_expires_at <= now() + interval '48 hours' then 'expiring'
        else status
      end,
      updated_at = now()
  where status in ('active','expiring') and refresh_expires_at <= now() + interval '48 hours';

  update public.brokerage_connections c
  set connection_status = a.status
  from public.brokerage_authorizations a
  where c.authorization_id = a.id and c.provider = 'schwab'
    and c.connection_status is distinct from a.status;

  insert into public.notification_outbox(user_id, event_type, payload, channels, dedupe_key)
  select a.user_id, 'brokerage_reauthorization',
         jsonb_build_object(
           'provider', 'Schwab', 'authorization_id', a.id,
           'refresh_expires_at', a.refresh_expires_at,
           'expired', a.refresh_expires_at <= now()
         ),
         array['in_app','push','email']::text[],
         'brokerage-reauthorization:' || a.id::text || ':' || a.refresh_expires_at::text
  from public.brokerage_authorizations a
  where a.status in ('expiring','expired')
  on conflict do nothing;

  insert into public.brokerage_sync_jobs(connection_id, sync_kind)
  select c.id, 'incremental'
  from public.brokerage_connections c
  join public.brokerage_authorizations a on a.id = c.authorization_id
  where c.provider = 'schwab' and c.is_active and c.connection_status = 'active'
    and a.status = 'active'
    and (c.last_positions_synced_at is null or c.last_positions_synced_at < now() - interval '15 minutes')
  on conflict do nothing;
end;
$$;
revoke all on function public.queue_due_schwab_syncs() from public, anon, authenticated;

insert into public.notification_channel_policies
  (event_type, importance, push_mode, email_mode, email_variant, email_preference_key, rate_limit_key, rate_window_minutes, max_pushes_per_window, description)
values
  ('brokerage_reauthorization', 'time_sensitive', 'required', 'fallback', 'transactional', 'updates_enabled', 'brokerage-health', 1440, 1,
   'Schwab authorization is within 48 hours of expiry or has expired. No position or trade details are included in notification copy.'),
  ('brokerage_sync_failed', 'activity', 'rate_limited', 'none', 'transactional', 'updates_enabled', 'brokerage-health', 1440, 1,
   'A durable Schwab sync exhausted its automatic retries and needs attention.')
on conflict (event_type) do update set
  importance = excluded.importance, push_mode = excluded.push_mode,
  email_mode = excluded.email_mode, email_variant = excluded.email_variant,
  email_preference_key = excluded.email_preference_key,
  rate_limit_key = excluded.rate_limit_key,
  rate_window_minutes = excluded.rate_window_minutes,
  max_pushes_per_window = excluded.max_pushes_per_window,
  description = excluded.description, updated_at = now();

create or replace function public.dispatch_schwab_sync_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare
  functions_url text;
  dispatch_secret text;
  api_key text;
begin
  perform public.queue_due_schwab_syncs();
  select decrypted_secret into functions_url from vault.decrypted_secrets where name = 'supabase_functions_url';
  select decrypted_secret into dispatch_secret from vault.decrypted_secrets where name = 'schwab_sync_secret';
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'supabase_anon_key';
  if functions_url is null or dispatch_secret is null or api_key is null then return; end if;
  perform net.http_post(
    url := functions_url || '/schwab-sync',
    headers := jsonb_build_object(
      'Content-Type','application/json', 'apikey',api_key,
      'Authorization','Bearer ' || api_key, 'x-dispatch-secret',dispatch_secret
    ),
    body := jsonb_build_object('mode','worker','batch_size',2),
    timeout_milliseconds := 120000
  );
end;
$$;
revoke all on function public.dispatch_schwab_sync_tick() from public, anon, authenticated;

do $$ begin perform cron.unschedule('schwab-sync'); exception when others then null; end $$;
select cron.schedule('schwab-sync', '*/5 * * * *', $$select public.dispatch_schwab_sync_tick()$$);

comment on table public.brokerage_executions is 'Immutable provider executions. User notes and publication live in separate overlay tables.';
comment on table public.brokerage_raw_events is 'Sanitized provider envelopes retained for schema drift diagnosis and quarantine; service-only.';
comment on table public.trade_publications is 'Explicit editorial workflow. Broker fills never auto-publish.';
