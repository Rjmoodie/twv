-- Make a person an owner of an EXISTING organization.
--
-- Why this is a script and not a screen
-- ─────────────────────────────────────
-- Invitations cannot grant ownership. `project_invitations.role` is checked
-- against ('project_manager','investor','client','viewer'), and
-- accept_project_invitation maps anything that is not project_manager or
-- investor down to 'viewer'. Nothing in the UI writes organization_members
-- either. So org ownership is deliberately a back-office action.
--
-- Why signing up is not enough
-- ────────────────────────────
-- handle_new_user() gives every new account its own "<Name> Workspace" and
-- makes them owner of THAT. Signing up therefore produces an owner of an empty
-- org, not a member of yours. This script moves them into the real one.
--
-- Order of operations
-- ───────────────────
--   1. The person signs up at the site and confirms their email.
--   2. Run section 1 to find the ids.
--   3. Fill them into section 2 and run it.
--
-- Run in the Supabase SQL editor for the project. Nothing here is destructive
-- except the clearly marked optional cleanup at the end.


-- ── 1. Find the ids ─────────────────────────────────────────────────────────
-- Replace the email, run this alone first, and read the output.

select u.id            as user_id,
       u.email,
       u.confirmed_at,                       -- null means they have not confirmed yet
       om.organization_id,
       o.name          as organization_name,
       om.role
from auth.users u
left join public.organization_members om on om.user_id = u.id
left join public.organizations o          on o.id = om.organization_id
where lower(u.email) = lower('PERSON@EXAMPLE.COM');

-- And find the organization that holds the real work -- the one with projects:
select o.id, o.name, o.slug, count(p.id) as projects
from public.organizations o
left join public.projects p on p.organization_id = o.id
group by o.id, o.name, o.slug
order by projects desc;


-- ── 2. Grant ownership ──────────────────────────────────────────────────────
-- Paste the two ids from section 1. `do update` matters: a plain
-- `do nothing` would silently leave an existing lesser role in place, which is
-- the failure mode that makes someone look signed-up but locked out.

insert into public.organization_members (organization_id, user_id, role)
values ('ORGANIZATION_UUID_HERE', 'USER_UUID_HERE', 'owner')
on conflict (organization_id, user_id) do update set role = 'owner';

-- Verify:
select om.role, o.name, u.email
from public.organization_members om
join public.organizations o on o.id = om.organization_id
join auth.users u           on u.id = om.user_id
where om.organization_id = 'ORGANIZATION_UUID_HERE';


-- ── 3. Optional: name the organization properly ─────────────────────────────
-- The auto-created name is "<Display Name> Workspace", which reads oddly on a
-- company account.

-- update public.organizations
-- set name = 'TW Ventures', slug = 'tw-ventures'
-- where id = 'ORGANIZATION_UUID_HERE';


-- ── 4. Optional cleanup: remove the stray auto-created workspace ────────────
-- DESTRUCTIVE. Only run once you have confirmed the workspace is empty and is
-- not the org you just granted ownership of. Cascades to its members.

-- delete from public.organizations
-- where id = 'STRAY_WORKSPACE_UUID_HERE'
--   and id <> 'ORGANIZATION_UUID_HERE'
--   and not exists (select 1 from public.projects p where p.organization_id = organizations.id);
