-- Keep manually recorded positions separate from brokerage-synced positions so
-- an Alpaca reconciliation can never delete a user's planning-only holdings.

alter table public.portfolio_holdings
  add column if not exists source text not null default 'manual'
  check (source in ('manual', 'alpaca'));

create index if not exists portfolio_holdings_source_idx
  on public.portfolio_holdings (portfolio_id, source);
