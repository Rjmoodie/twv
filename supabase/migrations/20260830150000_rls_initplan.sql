-- Evaluate auth.uid() once per query instead of once per row.
--
-- Postgres treats a bare `auth.uid()` inside a policy as volatile-per-row and
-- re-runs it for every candidate row. Wrapped as `(select auth.uid())` it
-- becomes an InitPlan: evaluated once and reused. Supabase's performance
-- advisor flags this as auth_rls_initplan; it found 41 policies here.
--
-- The tables are nearly empty today, so nothing is slow yet. That is precisely
-- when this is cheap to fix -- the cost of the current shape grows with row
-- count, and the fix is a textual one with no change in meaning.
--
-- ALTER POLICY rather than drop-and-recreate: the roles, command and name stay
-- untouched, so there is no window in which a table sits unprotected and no
-- chance of reconstructing a policy slightly differently from the original.

begin;

do $$
declare
  policy_row record;
  new_qual text;
  new_check text;
  changed integer := 0;
begin
  for policy_row in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%auth.uid()%'
  loop
    -- Only the bare call is rewritten; one already wrapped is left alone so
    -- re-running this migration is a no-op rather than nesting selects.
    new_qual  := regexp_replace(policy_row.qual,       '(?<!select )auth\.uid\(\)', '(select auth.uid())', 'g');
    new_check := regexp_replace(policy_row.with_check, '(?<!select )auth\.uid\(\)', '(select auth.uid())', 'g');

    if policy_row.qual is not null and policy_row.with_check is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)',
                     policy_row.policyname, policy_row.schemaname, policy_row.tablename, new_qual, new_check);
    elsif policy_row.qual is not null then
      execute format('alter policy %I on %I.%I using (%s)',
                     policy_row.policyname, policy_row.schemaname, policy_row.tablename, new_qual);
    elsif policy_row.with_check is not null then
      execute format('alter policy %I on %I.%I with check (%s)',
                     policy_row.policyname, policy_row.schemaname, policy_row.tablename, new_check);
    end if;
    changed := changed + 1;
  end loop;
  raise notice 'rewrote % policies to use an InitPlan for auth.uid()', changed;
end;
$$;

-- Shipped in 20260830120000 without a pinned search_path, which the security
-- advisor flags: a SECURITY DEFINER caller could otherwise be resolved against
-- a schema the caller controls. This one is immutable and touches no tables,
-- so the risk is theoretical -- but every other function here pins it, and an
-- exception is how the habit erodes.
create or replace function private.organization_role_rank(role_name text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case role_name
    when 'owner' then 5 when 'admin' then 4 when 'project_manager' then 3
    when 'investor' then 2 else 1 end;
$$;

commit;
