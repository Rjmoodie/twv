begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

select has_table('public', 'project_requests', 'project collaboration requests exist');
select has_column('public', 'project_requests', 'request_type', 'requests are typed');
select has_column('public', 'project_requests', 'resolution_note', 'requests preserve resolution context');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.project_requests'::regclass),
  'project requests enforce RLS'
);
select is(
  (select public from storage.buckets where id = 'project-documents'),
  false,
  'project document storage is private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'project-documents'),
  26214400::bigint,
  'project documents are limited to 25 MB'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'project_documents_storage_read'
  ),
  'project document reads have an audience policy'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'project_requests'
      and policyname = 'project_requests_manage_internal'
  ),
  'project request updates are restricted to internal managers'
);

select * from finish();
rollback;
