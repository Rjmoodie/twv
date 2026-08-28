-- Brokerage credentials must never be readable through the browser-facing API.
-- Edge Functions use the service_role and retain access for Alpaca operations.

revoke select on table public.brokerage_connections from authenticated;

grant select (
  id,
  user_id,
  portfolio_id,
  provider,
  environment,
  account_id,
  account_type,
  is_active,
  autonomous_enabled,
  approval_required,
  frequency,
  max_deploy_pct_per_run,
  max_trades_per_run,
  max_position_pct,
  kill_switch,
  drawdown_pause_pct,
  next_run_at,
  last_run_at,
  created_at,
  updated_at
) on table public.brokerage_connections to authenticated;

comment on column public.brokerage_connections.api_key is
  'Write-only to authenticated clients; readable only by trusted server roles.';
comment on column public.brokerage_connections.api_secret is
  'Write-only to authenticated clients; readable only by trusted server roles.';
