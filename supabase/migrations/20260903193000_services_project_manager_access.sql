-- Give the established Services account the organization-level Project Manager
-- persona used by /pm. Project-specific assignments remain explicit in
-- project_members so this does not expose unrelated projects.

begin;

insert into public.organization_members (organization_id, user_id, role)
select private.primary_organization(), account.id, 'project_manager'
from auth.users account
where account.id = '80dc787c-3788-440b-bb59-0964ad30e2e3'::uuid
  and lower(account.email) = 'services@twv-llc.com'
  and private.primary_organization() is not null
on conflict (organization_id, user_id) do update
set role = excluded.role
where private.organization_role_rank(excluded.role)
    > private.organization_role_rank(public.organization_members.role);

commit;
