-- Tighten trade_history UPDATE policy to only allow changes to the strategy
-- column. All Alpaca-sourced columns (ticker, qty, price, etc.) are immutable
-- from the user's perspective — only the service_role (edge function) should
-- ever touch those.

drop policy if exists "Users update own trade strategy tags" on public.trade_history;

-- Recreate with a WITH CHECK that rejects updates to anything except strategy.
-- The check compares every protected column against itself (via the OLD row
-- alias — `trade_history.*` inside the policy refers to the proposed NEW row,
-- while the subquery re-reads the existing row to get OLD values).
create policy "Users update own trade strategy tags"
  on public.trade_history
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    -- Ensure immutable columns are unchanged:
    and ticker           = (select ticker           from public.trade_history where id = trade_history.id)
    and side             = (select side             from public.trade_history where id = trade_history.id)
    and qty              = (select qty              from public.trade_history where id = trade_history.id)
    and coalesce(filled_avg_price::text, '') = coalesce((select filled_avg_price from public.trade_history where id = trade_history.id)::text, '')
    and alpaca_order_id  = (select alpaca_order_id  from public.trade_history where id = trade_history.id)
  );

-- Allow users to delete their own trade history (needed for disconnectBroker cleanup)
drop policy if exists "Users delete own trade history" on public.trade_history;
create policy "Users delete own trade history"
  on public.trade_history
  for delete
  using (auth.uid() = user_id);

-- Add updated_at auto-update trigger for user_alpaca_keys (missing from original migration)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_user_alpaca_keys on public.user_alpaca_keys;
create trigger set_updated_at_user_alpaca_keys
  before update on public.user_alpaca_keys
  for each row execute function public.touch_updated_at();
