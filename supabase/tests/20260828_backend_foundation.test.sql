begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(26);

select has_table('public', 'user_profiles', 'account profile table exists');
select has_table('public', 'organization_members', 'organization membership table exists');
select has_table('public', 'projects', 'project lifecycle table exists');
select has_table('public', 'brrrr_deals', 'saved underwriting table exists');
select has_table('public', 'notification_outbox', 'durable notification outbox exists');

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'authenticated',
    'authenticated',
    'owner@example.com',
    extensions.crypt('test-password', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Owner User"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'authenticated',
    'authenticated',
    'viewer@example.com',
    extensions.crypt('test-password', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Viewer User"}',
    now(), now(), '', '', '', ''
  );

select is(
  (select count(*) from public.user_profiles where id in (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  )),
  2::bigint,
  'signup trigger provisions user profiles'
);
select is(
  (select count(*) from public.organization_members where user_id in (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ) and role = 'owner'),
  2::bigint,
  'signup trigger provisions one owned workspace per user'
);

create temporary table smoke_ids (
  label text primary key,
  id uuid not null
);
insert into smoke_ids (label, id)
select 'owner_org', organization_id
from public.organization_members
where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
grant select on smoke_ids to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local request.jwt.claim.role = 'authenticated';

select is(
  (select count(*) from public.organizations),
  1::bigint,
  'a user sees only their own organizations'
);

select lives_ok(
  $$
    insert into public.properties (
      id, organization_id, address_line1, city, state, postal_code, created_by
    )
    values (
      '11111111-1111-4111-8111-111111111111',
      (select id from smoke_ids where label = 'owner_org'),
      '101 Main Street', 'Springfield', 'MA', '01103', auth.uid()
    )
  $$,
  'an organization owner can create a property'
);

select lives_ok(
  $$
    insert into public.deals (
      id, organization_id, property_id, name, stage, strategy, created_by
    )
    values (
      '22222222-2222-4222-8222-222222222222',
      (select id from smoke_ids where label = 'owner_org'),
      '11111111-1111-4111-8111-111111111111',
      'Main Street Acquisition', 'underwriting', 'brrrr', auth.uid()
    )
  $$,
  'an organization owner can create a deal'
);

select lives_ok(
  $$
    insert into public.underwriting_versions (
      id, organization_id, deal_id, version, model_type, inputs, results, created_by
    )
    values (
      '33333333-3333-4333-8333-333333333333',
      (select id from smoke_ids where label = 'owner_org'),
      '22222222-2222-4222-8222-222222222222',
      1, 'brrrr', '{"purchasePrice":250000}', '{"capRate":7.1}', auth.uid()
    )
  $$,
  'underwriting history can be attached to a deal'
);

select lives_ok(
  $$
    insert into public.brrrr_deals (
      id, user_id, deal_name, inputs, results
    )
    values (
      '44444444-4444-4444-8444-444444444444',
      auth.uid(), 'Saved BRRRR', '{}', '{}'
    )
  $$,
  'the shipped calculator can save without supplying organization_id'
);
select is(
  (select organization_id from public.brrrr_deals where id = '44444444-4444-4444-8444-444444444444'),
  (select id from smoke_ids where label = 'owner_org'),
  'saved calculator rows inherit the user workspace'
);

select lives_ok(
  $$
    insert into public.projects (
      id, organization_id, deal_id, property_id, name, project_manager_id, created_by
    )
    values (
      '55555555-5555-4555-8555-555555555555',
      (select id from smoke_ids where label = 'owner_org'),
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      'Main Street Redevelopment', auth.uid(), auth.uid()
    )
  $$,
  'an approved deal can become a project'
);

select lives_ok(
  $$
    insert into public.project_milestones (
      id, organization_id, project_id, title, due_date, assigned_to, created_by
    )
    values (
      '66666666-6666-4666-8666-666666666666',
      (select id from smoke_ids where label = 'owner_org'),
      '55555555-5555-4555-8555-555555555555',
      'Rough inspection', current_date, auth.uid(), auth.uid()
    )
  $$,
  'project milestones preserve the organization boundary'
);

reset role;
select is(
  public.queue_due_project_milestones(current_date),
  1,
  'due milestones enqueue once'
);
select is(
  public.queue_due_project_milestones(current_date),
  0,
  'milestone enqueueing is idempotent'
);
select is(
  (select count(*) from public.notification_outbox where event_type = 'project_milestone_due'),
  1::bigint,
  'the milestone outbox row is durable'
);

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local request.jwt.claim.role = 'authenticated';

select is(
  (select count(*) from public.properties),
  0::bigint,
  'a non-member cannot read another workspace property'
);
select is(
  (select count(*) from public.brrrr_deals),
  0::bigint,
  'saved underwriting remains private to its author'
);
select throws_ok(
  $$
    insert into public.properties (
      organization_id, address_line1, city, state, postal_code, created_by
    )
    values (
      (select id from smoke_ids where label = 'owner_org'),
      '102 Main Street', 'Springfield', 'MA', '01103', auth.uid()
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "properties"',
  'a non-member cannot write into another workspace'
);
select throws_ok(
  $$update public.user_profiles set role = 'super_admin' where id = auth.uid()$$,
  '42501',
  'permission denied for table user_profiles',
  'clients cannot elevate their platform role'
);

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $$update public.user_email_preferences set unsubscribe_token = 'attacker-chosen' where user_id = auth.uid()$$,
  'a normal preference update succeeds'
);
select isnt(
  (select unsubscribe_token from public.user_email_preferences where user_id = auth.uid()),
  'attacker-chosen',
  'the unsubscribe bearer token cannot be overwritten by its user'
);
select throws_ok(
  $$select count(*) from public.notification_outbox$$,
  '42501',
  'permission denied for table notification_outbox',
  'delivery internals are not readable by clients'
);
select is(
  (select count(*) from public.subscribers),
  1::bigint,
  'the subscription compatibility view respects profile RLS'
);

select * from finish();
rollback;
