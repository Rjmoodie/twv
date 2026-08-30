-- The leak this migration closed, asserted so it cannot come back.
--
-- Before: the inquiry policies asked "is the caller an owner or admin of
-- ANYTHING", never correlating to the row's organization. Combined with a
-- workspace auto-created per signup, that made every registered account able to
-- read every investor lead. These tests fail loudly if either half returns.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(5);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', identity.user_id, 'authenticated',
       'authenticated', identity.email, crypt('password', gen_salt('bf')),
       now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb
from (values
  ('c1000000-0000-4000-8000-000000000001'::uuid, 'tenant-insider@example.com'),
  ('c1000000-0000-4000-8000-000000000002'::uuid, 'tenant-outsider@example.com')
) identity(user_id, email);

select is(
  (select count(*) from public.organization_members
   where user_id = 'c1000000-0000-4000-8000-000000000002'),
  0::bigint,
  'a fresh signup owns nothing'
);

-- The company, and an unrelated org the outsider owns -- the shape that used to
-- grant them sight of everything.
with company as (
  insert into public.organizations (name, slug, created_by, is_primary)
  values ('Tenant Co', 'tenant-co', 'c1000000-0000-4000-8000-000000000001', true)
  returning id
)
insert into public.organization_members (organization_id, user_id, role)
select company.id, 'c1000000-0000-4000-8000-000000000001', 'owner' from company;

with other as (
  insert into public.organizations (name, slug, created_by)
  values ('Outsider Co', 'outsider-co', 'c1000000-0000-4000-8000-000000000002')
  returning id
)
insert into public.organization_members (organization_id, user_id, role)
select other.id, 'c1000000-0000-4000-8000-000000000002', 'owner' from other;

select is(
  (select count(*) from public.organizations where is_primary),
  1::bigint,
  'exactly one organization is primary'
);

select lives_ok(
  $$select public.submit_investor_inquiry('Lead Person', 'lead@example.com')$$,
  'an anonymous visitor can submit an enquiry'
);

-- The outsider owns an organization, so the old predicate was true for them.
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}';

select is(
  (select count(*) from public.investor_inquiries),
  0::bigint,
  'an owner of another organization reads no investor leads'
);

set local role postgres;
set local request.jwt.claims = '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

select is(
  (select count(*) from public.investor_inquiries),
  1::bigint,
  'the company owner reads their own lead'
);

select * from finish();
rollback;
