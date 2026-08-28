-- Notification dispatch moves from a Vercel cron to pg_cron.
--
-- Vercel Hobby caps crons at one run per day, which blocked deploys outright
-- with the */5 schedule this feature needs. pg_cron + pg_net keeps the
-- five-minute cadence inside Postgres and mirrors the pattern already used for
-- the real estate lead fetch. /api/dispatch-notifications stays available as a
-- manual trigger.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Secrets live in Vault rather than a database setting. A custom GUC set with
-- ALTER DATABASE is readable by anything that can call current_setting(),
-- whereas vault.decrypted_secrets is restricted -- and the service role key and
-- dispatch secret are exactly the values that must not leak to app roles.
create or replace function public.dispatch_notifications_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  functions_url text;
  dispatch_secret text;
  api_key text;
begin
  select decrypted_secret into functions_url
    from vault.decrypted_secrets where name = 'supabase_functions_url';
  select decrypted_secret into dispatch_secret
    from vault.decrypted_secrets where name = 'notification_dispatch_secret';
  select decrypted_secret into api_key
    from vault.decrypted_secrets where name = 'supabase_anon_key';

  -- No-op until the secrets are provisioned, so scheduling this ahead of the
  -- edge function deploy cannot spam the cron log with failures.
  if functions_url is null or dispatch_secret is null or api_key is null then
    return;
  end if;

  perform net.http_post(
    url     := functions_url || '/dispatch-notifications',
    headers := jsonb_build_object(
      'Content-Type',      'application/json',
      'apikey',            api_key,
      'Authorization',     'Bearer ' || api_key,
      'x-dispatch-secret', dispatch_secret
    ),
    body    := '{}'::jsonb
  );
end;
$$;

revoke all on function public.dispatch_notifications_tick() from public, anon, authenticated;

-- Idempotent: unschedule any prior job of this name before rescheduling.
do $$
begin
  perform cron.unschedule('dispatch-notifications');
exception when others then
  null;
end $$;

select cron.schedule(
  'dispatch-notifications',
  '*/5 * * * *',
  $$select public.dispatch_notifications_tick()$$
);
