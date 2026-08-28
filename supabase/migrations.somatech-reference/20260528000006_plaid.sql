-- Plaid bank connection tables.
-- Split into two: user-readable metadata and service-only secrets.
-- Access tokens NEVER leave the server — only service_role can read plaid_secrets.

-- ── plaid_connections — user-visible metadata ─────────────────────────────────

create table if not exists public.plaid_connections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  item_id          text not null unique,              -- Plaid item identifier
  institution_id   text,
  institution_name text,
  -- Snapshot of linked accounts (id, name, type, subtype, mask) — no balances
  accounts         jsonb not null default '[]',
  -- Incremental sync cursor from transactions/sync API
  sync_cursor      text,
  last_synced_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id)   -- one active Plaid item per user for now
);

alter table public.plaid_connections enable row level security;

create policy "Users read/delete own connection"
  on public.plaid_connections for select
  using (auth.uid() = user_id);

create policy "Users delete own connection"
  on public.plaid_connections for delete
  using (auth.uid() = user_id);

create policy "Service role full access: plaid_connections"
  on public.plaid_connections for all
  to service_role using (true) with check (true);

-- ── plaid_secrets — server-only access tokens ─────────────────────────────────
-- No user-readable policy. Only service_role edge functions touch this table.

create table if not exists public.plaid_secrets (
  item_id      text primary key,     -- matches plaid_connections.item_id
  access_token text not null,        -- Plaid permanent access token
  created_at   timestamptz not null default now()
);

alter table public.plaid_secrets enable row level security;

-- Intentionally no user policy — only service_role can access.
create policy "Service role full access: plaid_secrets"
  on public.plaid_secrets for all
  to service_role using (true) with check (true);

-- ── Triggers ──────────────────────────────────────────────────────────────────

create trigger set_updated_at_plaid_connections
  before update on public.plaid_connections
  for each row execute function public.touch_updated_at();
