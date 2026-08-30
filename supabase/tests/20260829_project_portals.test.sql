begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(26);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', user_id, 'authenticated', 'authenticated', email,
  extensions.crypt('test-password', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}'::jsonb, now(), now(), '', '', '', ''
from (values
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'portfolio-owner@example.com'),
  ('a1000000-0000-4000-8000-000000000002'::uuid, 'portfolio-pm@example.com'),
  ('a1000000-0000-4000-8000-000000000003'::uuid, 'portfolio-investor@example.com'),
  ('a1000000-0000-4000-8000-000000000004'::uuid, 'portfolio-client@example.com'),
  ('a1000000-0000-4000-8000-000000000005'::uuid, 'portfolio-outsider@example.com')
) identity(user_id, email);

-- Signing up no longer conjures a workspace: membership is by invitation, so
-- the fixture creates the organization the trigger used to create implicitly.
with seeded as (
  insert into public.organizations (name, slug, created_by, is_primary)
  values ('Portal Test Org', 'portal-test-org', 'a1000000-0000-4000-8000-000000000001', true)
  returning id
)
insert into public.organization_members (organization_id, user_id, role)
select seeded.id, 'a1000000-0000-4000-8000-000000000001', 'owner' from seeded;

create temporary table portal_ids (label text primary key, id uuid not null);
create temporary table portal_tokens (role text primary key, token text not null);
grant select, insert, update on portal_ids, portal_tokens to authenticated;

insert into portal_ids
select 'organization', organization_id from public.organization_members
where user_id = 'a1000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","email":"portfolio-owner@example.com","role":"authenticated"}';

select lives_ok(
  $$insert into portal_ids values (
    'project', public.create_portfolio_project(
      (select id from portal_ids where label = 'organization'),
      'River House', '400 River Road', 'Austin', 'TX', '78701',
      'River House', 'multifamily', 30.2672, -97.7431,
      'construction', current_date, current_date + 180, 1250000
    )
  )$$,
  'an owner atomically creates a property and project'
);
select is((select count(*) from public.properties where name = 'River House'), 1::bigint, 'atomic creation writes one property');
select is((select count(*) from public.projects where name = 'River House'), 1::bigint, 'atomic creation writes one project');

insert into public.project_milestones (
  organization_id, project_id, title, due_date, visibility, created_by
) values (
  (select id from portal_ids where label = 'organization'),
  (select id from portal_ids where label = 'project'),
  'Framing inspection', current_date + 7, 'all_members', auth.uid()
);

insert into public.crm_contacts (
  id, organization_id, kind, first_name, last_name, email, created_by
) values (
  'a2000000-0000-4000-8000-000000000001',
  (select id from portal_ids where label = 'organization'),
  'client', 'Casey', 'Client', 'portfolio-client@example.com', auth.uid()
);
insert into public.crm_contact_projects (contact_id, project_id, organization_id, relationship)
values (
  'a2000000-0000-4000-8000-000000000001',
  (select id from portal_ids where label = 'project'),
  (select id from portal_ids where label = 'organization'), 'client'
);

insert into public.investor_entities (
  id, organization_id, primary_contact_user_id, name, entity_type, created_by
) values (
  'a3000000-0000-4000-8000-000000000001',
  (select id from portal_ids where label = 'organization'),
  'a1000000-0000-4000-8000-000000000003', 'Investor LLC', 'llc', auth.uid()
);
insert into public.project_investments (
  organization_id, project_id, investor_entity_id, commitment_amount, contributed_amount, status
) values (
  (select id from portal_ids where label = 'organization'),
  (select id from portal_ids where label = 'project'),
  'a3000000-0000-4000-8000-000000000001', 250000, 100000, 'active'
);

insert into portal_tokens
select invite_role, invitation_token
from (values
  ('project_manager', 'portfolio-pm@example.com'),
  ('investor', 'portfolio-investor@example.com'),
  ('client', 'portfolio-client@example.com')
) invite(invite_role, email)
cross join lateral public.create_project_invitation(
  (select id from portal_ids where label = 'project'), invite.email, invite.invite_role
);
select is((select count(*) from portal_tokens), 3::bigint, 'owner creates role-bound project invitations');
select is(
  (select count(*) from public.claim_project_invitation_delivery((select token from portal_tokens where role = 'project_manager'))),
  1::bigint,
  'owner can atomically claim an invitation for email delivery'
);
select is(
  (select count(*) from public.claim_project_invitation_delivery((select token from portal_tokens where role = 'project_manager'))),
  0::bigint,
  'a second sender cannot concurrently claim the same invitation'
);
select lives_ok(
  $$select public.create_crm_contact(
    (select id from portal_ids where label = 'organization'),
    'investor', 'Ivy', 'Investor', 'ivy@example.com', null, 'Ivy Capital',
    (select id from portal_ids where label = 'project')
  )$$,
  'owner creates and links a CRM contact transactionally'
);
select is(
  (select count(*) from public.crm_contact_projects link
   join public.crm_contacts contact on contact.id = link.contact_id
   where contact.email = 'ivy@example.com'),
  1::bigint,
  'transactional CRM creation includes the project relationship'
);

set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","email":"portfolio-pm@example.com","role":"authenticated"}';
select is(public.accept_project_invitation((select token from portal_tokens where role = 'project_manager')), 'project_manager', 'PM accepts the PM invitation');
select is((select count(*) from public.projects), 1::bigint, 'PM can read the assigned project record');
select is((select count(*) from public.get_portfolio_projects() where can_manage), 1::bigint, 'PM receives a manageable portfolio project');
select is((select count(*) from public.crm_contacts), 2::bigint, 'PM can read CRM contacts linked to their project');
select is((select count(*) from public.project_investments), 0::bigint, 'PM cannot read investor capital records');

insert into public.project_updates (
  organization_id, project_id, title, body, status, visibility, published_at, created_by
)
select organization_id, id, visibility || ' update', 'Visible progress', 'published', visibility, now(), auth.uid()
from public.projects
cross join (values ('all_members'), ('investor'), ('client'), ('internal')) audience(visibility);
select is((select count(*) from public.project_updates), 4::bigint, 'PM can publish audience-scoped updates');

set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","email":"portfolio-investor@example.com","role":"authenticated"}';
select is(public.accept_project_invitation((select token from portal_tokens where role = 'investor')), 'investor', 'investor accepts the investor invitation');
select is((select count(*) from public.projects), 0::bigint, 'investor cannot read raw project records');
select is((select count(*) from public.get_portfolio_projects()), 1::bigint, 'investor receives the safe portfolio read model');
select is((select commitment_amount from public.get_portfolio_projects()), 250000::numeric, 'investor sees only their own commitment');
select is((select count(*) from public.project_updates), 2::bigint, 'investor sees all-member and investor updates only');
select is((select count(*) from public.crm_contacts), 0::bigint, 'investor cannot read internal CRM contacts');

set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000004","email":"portfolio-client@example.com","role":"authenticated"}';
select is(public.accept_project_invitation((select token from portal_tokens where role = 'client')), 'client', 'client accepts the client invitation');
select is((select count(*) from public.get_portfolio_projects()), 1::bigint, 'client receives the assigned project in the portfolio');
select is((select count(*) from public.project_updates), 2::bigint, 'client sees all-member and client updates only');
select is((select count(*) from public.project_investments), 0::bigint, 'client cannot read investor capital records');

set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000005","email":"portfolio-outsider@example.com","role":"authenticated"}';
select is((select count(*) from public.get_portfolio_projects()), 0::bigint, 'an uninvited user receives no portfolio projects');
select throws_ok(
  $$select public.create_portfolio_project(
    (select id from portal_ids where label = 'organization'),
    'Unauthorized', '1 Other Road', 'Austin', 'TX', '78702'
  )$$,
  'P0001', 'Only organization owners and admins can create projects',
  'an uninvited user cannot create a project in another workspace'
);

select * from finish();
rollback;
