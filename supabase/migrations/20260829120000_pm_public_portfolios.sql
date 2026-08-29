begin;

create table public.pm_portfolio_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,119}$'),
  title text not null check (char_length(trim(title)) between 3 and 180),
  project_type text not null check (char_length(trim(project_type)) between 2 and 80),
  location_public text check (location_public is null or char_length(location_public) <= 120),
  completed_on date,
  summary text not null check (char_length(trim(summary)) between 20 and 1200),
  challenge text check (challenge is null or char_length(challenge) <= 4000),
  work_completed text not null check (char_length(trim(work_completed)) between 20 and 8000),
  outcomes text check (outcomes is null or char_length(outcomes) <= 4000),
  services text[] not null default '{}'::text[],
  featured_image_url text,
  gallery_urls text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  seo_title text check (seo_title is null or char_length(seo_title) <= 70),
  seo_description text check (seo_description is null or char_length(seo_description) <= 170),
  article_title text check (article_title is null or char_length(article_title) <= 180),
  article_excerpt text check (article_excerpt is null or char_length(article_excerpt) <= 500),
  article_body text check (article_body is null or char_length(article_body) <= 30000),
  ai_generated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete set null,
  check ((status = 'published') = (published_at is not null) or status <> 'published')
);

create index pm_portfolio_entries_author_idx on public.pm_portfolio_entries (user_id, status, published_at desc);
create index pm_portfolio_entries_public_idx on public.pm_portfolio_entries (published_at desc) where status = 'published';

alter table public.pm_portfolio_entries enable row level security;
create policy pm_portfolio_entries_public_read on public.pm_portfolio_entries for select
  using (status = 'published' or user_id = auth.uid());
create policy pm_portfolio_entries_pm_insert on public.pm_portfolio_entries for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members member
      where member.organization_id = pm_portfolio_entries.organization_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin', 'project_manager')
    )
    and (project_id is null or private.can_manage_project(project_id))
  );
create policy pm_portfolio_entries_own_update on public.pm_portfolio_entries for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy pm_portfolio_entries_own_delete on public.pm_portfolio_entries for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.pm_portfolio_entries from anon, authenticated;
grant select on public.pm_portfolio_entries to anon, authenticated;
grant insert, update, delete on public.pm_portfolio_entries to authenticated;
grant all on public.pm_portfolio_entries to service_role;
create trigger pm_portfolio_entries_updated_at before update on public.pm_portfolio_entries
  for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pm-portfolio', 'pm-portfolio', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy pm_portfolio_media_public_read on storage.objects for select
  using (bucket_id = 'pm-portfolio');
create policy pm_portfolio_media_own_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'pm-portfolio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy pm_portfolio_media_own_update on storage.objects for update to authenticated
  using (bucket_id = 'pm-portfolio' and owner_id = auth.uid()::text)
  with check (bucket_id = 'pm-portfolio' and owner_id = auth.uid()::text);
create policy pm_portfolio_media_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'pm-portfolio' and owner_id = auth.uid()::text);

commit;
