-- Daily portfolio value history for actual-vs-projection charting.
--
-- brokerage_account_snapshots records one row per sync -- roughly every 20
-- minutes, so ~26k rows per connection per year. A chart wants daily closes, so
-- reading raw snapshots would fetch tens of thousands of rows to draw a few
-- hundred points. This collapses them to the last snapshot per calendar day,
-- summed across a portfolio's connections.
--
-- A view rather than a table: the underlying data is small enough to aggregate
-- on read, and a materialized copy would need its own refresh and could serve
-- a stale balance, which is worse than a slightly slower query.

-- security_invoker: the view must run as the caller so RLS on
-- brokerage_account_snapshots and brokerage_connections still applies. A plain
-- view runs as its owner and would expose every user's balance history.
create or replace view public.portfolio_value_history
with (security_invoker = true, security_barrier = true) as
with ranked as (
  select
    c.portfolio_id,
    s.user_id,
    s.connection_id,
    (s.provider_data_as_of at time zone 'UTC')::date as as_of_date,
    s.liquidation_value,
    s.cash_balance,
    s.provider_data_as_of,
    row_number() over (
      partition by s.connection_id, (s.provider_data_as_of at time zone 'UTC')::date
      order by s.provider_data_as_of desc
    ) as recency
  from public.brokerage_account_snapshots s
  join public.brokerage_connections c on c.id = s.connection_id
  where s.is_complete
)
select
  portfolio_id,
  user_id,
  as_of_date,
  -- A portfolio can hold several connections; the day's value is their sum.
  sum(liquidation_value)          as total_value,
  sum(cash_balance)               as cash_value,
  count(*)                        as connection_count,
  max(provider_data_as_of)        as last_synced_at
from ranked
where recency = 1
group by portfolio_id, user_id, as_of_date;

revoke all on public.portfolio_value_history from public, anon;
grant select on public.portfolio_value_history to authenticated;

comment on view public.portfolio_value_history is
  'One row per portfolio per day: the last complete broker snapshot of that day, summed across connections.';
