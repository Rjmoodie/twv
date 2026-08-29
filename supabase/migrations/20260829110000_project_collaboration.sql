begin;

-- Private project files. Object paths are organization/project/random-name;
-- metadata remains the audience-aware source of truth.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents', 'project-documents', false, 26214400,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy project_documents_storage_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-documents'
    and exists (
      select 1 from public.project_documents document
      where document.storage_path = name
        and (
          private.can_manage_project(document.project_id)
          or private.can_view_project_audience(document.project_id, document.visibility)
        )
    )
  );

create policy project_documents_storage_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-documents'
    and exists (
      select 1 from public.projects project
      where project.organization_id::text = (storage.foldername(name))[1]
        and project.id::text = (storage.foldername(name))[2]
        and private.can_manage_project(project.id)
    )
  );

create policy project_documents_storage_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-documents'
    and exists (
      select 1 from public.project_documents document
      where document.storage_path = name
        and private.can_manage_project(document.project_id)
    )
  );

create table public.project_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  organization_id uuid not null,
  request_type text not null
    check (request_type in ('question', 'change_request', 'approval', 'document_request')),
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text not null check (char_length(trim(description)) between 1 and 5000),
  status text not null default 'open'
    check (status in ('open', 'in_review', 'approved', 'declined', 'resolved')),
  priority text not null default 'normal'
    check (priority in ('normal', 'high', 'urgent')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  assigned_to uuid references auth.users(id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 5000),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade,
  check ((status in ('approved', 'declined', 'resolved')) = (resolved_at is not null))
);

create index project_requests_project_status_idx
  on public.project_requests (project_id, status, priority, created_at desc);

alter table public.project_requests enable row level security;

create policy project_requests_read_member
  on public.project_requests for select to authenticated
  using (
    private.can_manage_project(project_id)
    or requested_by = auth.uid()
    or private.has_project_role(project_id, array['client', 'investor', 'viewer']::text[])
  );

create policy project_requests_create_member
  on public.project_requests for insert to authenticated
  with check (
    requested_by = auth.uid()
    and (
      private.can_manage_project(project_id)
      or private.is_project_member(project_id)
    )
  );

create policy project_requests_manage_internal
  on public.project_requests for update to authenticated
  using (private.can_manage_project(project_id))
  with check (private.can_manage_project(project_id));

revoke all on public.project_requests from anon, authenticated;
grant select, insert, update on public.project_requests to authenticated;
grant all on public.project_requests to service_role;

create trigger project_requests_updated_at
  before update on public.project_requests
  for each row execute function public.set_updated_at();

commit;
