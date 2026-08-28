-- Patch for migration 20260528000004_personal_finance.sql
-- Fixes: function dependency safety net, first-of-month enforcement,
--        missing service_role policy on scenario_models.

-- M1: Re-create touch_updated_at() here so migration 00004 is self-contained
-- and doesn't hard-depend on 00003 having run first.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- M2: Enforce that snapshot_month is always the first of its month.
-- Prevents duplicate month rows from bypassing the UNIQUE constraint
-- (e.g. 2026-05-15 and 2026-05-01 are different dates so UNIQUE allows both).
alter table public.net_worth_snapshots
  add constraint snapshot_month_is_first_of_month
  check (snapshot_month = date_trunc('month', snapshot_month)::date);

-- Same enforcement for monthly_cash_flow.
alter table public.monthly_cash_flow
  add constraint flow_month_is_first_of_month
  check (flow_month = date_trunc('month', flow_month)::date);

-- M3: Give service_role full access to scenario_models so future edge
-- functions (e.g. Coach-generated scenarios) are not blocked by RLS.
create policy "Service role full access: scenario_models"
  on public.scenario_models for all
  to service_role using (true) with check (true);
