-- Individual Plaid transactions, persisted before aggregation.
-- Enables subscription detection, merchant ranking, and Coach context
-- that category-level totals alone cannot provide.

create table if not exists public.plaid_transactions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  item_id        text        not null,   -- which Plaid connection
  account_id     text        not null,
  transaction_id text        not null,   -- Plaid's stable ID — upsert key
  merchant_name  text,                   -- Plaid's cleaned merchant name (e.g. "Netflix")
  name           text        not null,   -- raw description from bank
  amount         numeric     not null,   -- positive = money out (Plaid convention)
  date           date        not null,
  category_key   text,                   -- our mapped key: food, subscriptions, etc.
  plaid_category text,                   -- Plaid personal_finance_category.primary
  pending        boolean     not null default false,
  created_at     timestamptz not null default now(),

  unique (transaction_id)
);

alter table public.plaid_transactions enable row level security;

create policy "Users read own transactions"
  on public.plaid_transactions for select
  using (auth.uid() = user_id);

create policy "Service role full access: plaid_transactions"
  on public.plaid_transactions for all
  to service_role using (true) with check (true);

-- Fast lookups used by every query in the app
create index if not exists idx_plaid_tx_user_date
  on public.plaid_transactions (user_id, date desc);

create index if not exists idx_plaid_tx_user_merchant
  on public.plaid_transactions (user_id, merchant_name, date desc);
