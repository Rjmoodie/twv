-- Grant a person access to the TW Ventures workspace.
--
-- Replaces the previous one-off, which set `user_profiles.subscription_tier =
-- 'tier3'` on the premise that "tier3 is the value that actually unlocks every
-- module". That stopped being true when module access moved to personas
-- (see config/moduleAccess.ts): tier now decides billing and nothing else, so
-- granting a tier no longer opens a single screen. That script also hardcoded
-- one person's email and user id, which is not something to keep in a repo.
--
-- Access is derived in AuthProvider from real membership rows:
--
--   admin           <- organization_members.role in ('owner', 'admin')
--   project_manager <- organization_members.role = 'project_manager'
--                      OR project_members.role  = 'project_manager'
--   investor        <- organization_members.role = 'investor'
--                      OR project_members.role  = 'investor'
--   client          <- project_members.role = 'client'
--
-- `user_profiles.role in ('admin','super_admin')` is a separate platform-owner
-- bypass -- it is not a persona, and it ignores membership entirely.
--
-- Fill in the variables, then run the block you need. Every statement is
-- idempotent, so re-running is safe.

\set target_email  'person@example.com'
\set org_id        '00000000-0000-0000-0000-000000000000'
\set project_id    '00000000-0000-0000-0000-000000000000'

-- == 1. Organization membership =============================================
-- roles: owner | admin | project_manager | investor | viewer
-- Required before any project membership: project_members carries a composite
-- FK back to organization_members (organization_id, user_id).

insert into public.organization_members (organization_id, user_id, role)
select :'org_id'::uuid, u.id, 'project_manager'
from public.user_profiles u
where u.email = :'target_email'
on conflict (organization_id, user_id) do update set role = excluded.role;

-- == 2. Project membership ==================================================
-- roles: project_manager | investor | client | viewer
-- Only needed for per-project access such as the investor and client portals.

-- insert into public.project_members (project_id, organization_id, user_id, role)
-- select :'project_id'::uuid, :'org_id'::uuid, u.id, 'client'
-- from public.user_profiles u
-- where u.email = :'target_email'
-- on conflict (project_id, user_id) do update set role = excluded.role;

-- == 3. Platform-owner bypass ===============================================
-- Grants every module regardless of membership. Use sparingly.

-- update public.user_profiles set role = 'admin', updated_at = now()
-- where email = :'target_email';

-- == Verify =================================================================
-- Shows the rows the app actually reads to build the persona set.

select u.email,
       u.role              as platform_role,
       u.subscription_tier as billing_tier,
       om.role             as org_role,
       pm.role             as project_role,
       pm.project_id
from public.user_profiles u
left join public.organization_members om
  on om.user_id = u.id and om.organization_id = :'org_id'::uuid
left join public.project_members pm
  on pm.user_id = u.id
where u.email = :'target_email';
