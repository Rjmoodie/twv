-- claim_brokerage_sync_jobs could collide with its own uniqueness guard.
--
-- brokerage_sync_jobs_one_open is unique on (connection_id, sync_kind) while
-- status is 'pending' or 'processing'. The claim promotes both 'pending' and
-- 'failed' rows to 'processing', so whenever a connection had a pending job and
-- a retryable failed job of the same kind -- the normal state after any failure
-- -- promoting both put two rows into that index at once and the whole claim
-- aborted with a unique violation. The worker then reported only
-- "Could not claim Schwab sync work" and no sync could ever run again.
--
-- Claim at most one job per (connection_id, sync_kind). DISTINCT ON cannot be
-- combined with FOR UPDATE, so the candidates are narrowed first and locked
-- second.

create or replace function public.claim_brokerage_sync_jobs(
  p_batch_size integer default 2,
  p_worker_id uuid default gen_random_uuid()
)
returns setof public.brokerage_sync_jobs
language plpgsql security definer set search_path = '' as $$
begin
  update public.brokerage_sync_jobs
  set status = 'failed', claim_owner = null, claimed_at = null,
      not_before = now() + interval '1 minute',
      last_error_code = 'stale_lease', last_error = 'Worker lease expired'
  where status = 'processing' and claimed_at < now() - interval '3 minutes';

  update public.brokerage_sync_jobs
  set status = 'dead_letter'
  where status = 'failed' and attempt_count >= max_attempts;

  return query
  with candidates as (
    select distinct on (connection_id, sync_kind) id, not_before, created_at
    from public.brokerage_sync_jobs
    where status in ('pending','failed')
      and attempt_count < max_attempts
      and not_before <= now()
    -- Prefer the row already inside the partial index. Promoting a 'pending'
    -- job leaves the index holding exactly one row for this (connection, kind);
    -- promoting a 'failed' one while a 'pending' sibling still sits there would
    -- add a second and abort the claim.
    order by connection_id, sync_kind, (status = 'pending') desc, not_before, created_at
  ),
  claimed as (
    select j.id from public.brokerage_sync_jobs j
    where j.id in (select c.id from candidates c)
    order by j.not_before, j.created_at
    for update skip locked
    limit least(greatest(p_batch_size, 1), 5)
  )
  update public.brokerage_sync_jobs j
  set status = 'processing', attempt_count = j.attempt_count + 1,
      claim_owner = p_worker_id, claimed_at = now()
  from claimed where j.id = claimed.id
  returning j.*;
end;
$$;

revoke all on function public.claim_brokerage_sync_jobs(integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_brokerage_sync_jobs(integer, uuid) to service_role;
