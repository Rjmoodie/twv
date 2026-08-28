-- A manual planning position and a brokerage-synced position may share a ticker.
-- Source must therefore participate in identity; otherwise an Alpaca upsert
-- overwrites the manual row before the source-scoped cleanup can protect it.

alter table public.portfolio_holdings
  drop constraint if exists portfolio_holdings_portfolio_id_ticker_key;

create unique index if not exists portfolio_holdings_portfolio_ticker_source_key
  on public.portfolio_holdings (portfolio_id, ticker, source);
