-- Schedule the notification dispatcher from inside the database.
--
-- The schedule lived in vercel.json as `*/5 * * * *` until Vercel refused it:
-- Hobby accounts allow only daily cron jobs. Worse than not running, that
-- failed at deploy time, so every push was rejected while the site kept serving
-- the previous build -- nothing appeared broken for two hours.
--
-- pg_cron has no such limit and no dependency on the hosting plan, and it sits
-- beside the outbox it drains. The secret is held in Vault rather than inlined,
-- because cron.job is readable by anyone who can read the cron schema.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Vault holds the shared secret the edge function checks against its own
-- NOTIFICATION_DISPATCH_SECRET. Seeded out of band (see the note below), never
-- committed.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'notification_dispatch_secret') then
    raise notice 'vault secret notification_dispatch_secret is absent; the schedule will be created but will 401 until it is set';
  end if;
end;
$$;

create or replace function private.dispatch_notifications_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  dispatch_secret text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'project_url';

  select decrypted_secret into dispatch_secret
  from vault.decrypted_secrets where name = 'notification_dispatch_secret';

  if project_url is null or dispatch_secret is null then
    raise notice 'dispatch tick skipped: vault secrets not configured';
    return;
  end if;

  perform net.http_post(
    url     := project_url || '/functions/v1/dispatch-notifications',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-dispatch-secret', dispatch_secret
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;
revoke all on function private.dispatch_notifications_tick() from public, anon, authenticated;

-- Replace rather than duplicate if this migration is ever re-run.
select cron.unschedule(jobid)
from cron.job where jobname = 'dispatch-notifications';

select cron.schedule(
  'dispatch-notifications',
  '*/5 * * * *',
  $$select private.dispatch_notifications_tick()$$
);

commit;
