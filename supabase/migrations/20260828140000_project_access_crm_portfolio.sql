-- Project-scoped access, CRM, investor records, invitations, and the portfolio
-- read model. Organization membership establishes the tenant; project
-- membership establishes what an external user or PM may actually see.

create table public.project_members (
  project_id uuid not null,
  organization_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('project_manager', 'investor', 'client', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade,
  foreign key (organization_id, user_id)
    references public.organization_members(organization_id, user_id) on delete cascade
);
create index project_members_user_idx on public.project_members (user_id, role, project_id);
create index project_members_org_idx on public.project_members (organization_id, project_id);

-- Preserve explicit PM assignments that predate the project membership spine.
insert into public.organization_members (organization_id, user_id, role)
select project.organization_id, project.project_manager_id, 'project_manager'
from public.projects project
where project.project_manager_id is not null
on conflict (organization_id, user_id) do nothing;

insert into public.project_members (project_id, organization_id, user_id, role)
select project.id, project.organization_id, project.project_manager_id, 'project_manager'
from public.projects project
where project.project_manager_id is not null
on conflict (project_id, user_id) do update set role = excluded.role;

create or replace function private.is_project_member(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members member
    where member.project_id = target_project
      and member.user_id = auth.uid()
  );
$$;

create or replace function private.has_project_role(target_project uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members member
    where member.project_id = target_project
      and member.user_id = auth.uid()
      and member.role = any(allowed_roles)
  );
$$;

create or replace function private.can_manage_project(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects project
    where project.id = target_project
      and (
        private.is_organization_admin(project.organization_id)
        or private.has_project_role(project.id, array['project_manager']::text[])
      )
  );
$$;

create or replace function private.can_view_project_audience(target_project uuid, audience text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects project
    left join public.project_members member
      on member.project_id = project.id
     and member.user_id = auth.uid()
    where project.id = target_project
      and (
        private.is_organization_admin(project.organization_id)
        or member.role = 'project_manager'
        or audience = 'all_members' and member.user_id is not null
        or audience = member.role
      )
  );
$$;

revoke all on function private.is_project_member(uuid) from public, anon, authenticated;
revoke all on function private.has_project_role(uuid, text[]) from public, anon, authenticated;
revoke all on function private.can_manage_project(uuid) from public, anon, authenticated;
revoke all on function private.can_view_project_audience(uuid, text) from public, anon, authenticated;
grant execute on function private.is_project_member(uuid) to authenticated, service_role;
grant execute on function private.has_project_role(uuid, text[]) to authenticated, service_role;
grant execute on function private.can_manage_project(uuid) to authenticated, service_role;
grant execute on function private.can_view_project_audience(uuid, text) to authenticated, service_role;

alter table public.project_members enable row level security;
create policy project_members_read_team
  on public.project_members for select to authenticated
  using (
    user_id = auth.uid()
    or private.is_organization_admin(organization_id)
    or private.has_project_role(project_id, array['project_manager']::text[])
  );
create policy project_members_admin_insert
  on public.project_members for insert to authenticated
  with check (private.is_organization_admin(organization_id));
create policy project_members_admin_update
  on public.project_members for update to authenticated
  using (private.is_organization_admin(organization_id))
  with check (private.is_organization_admin(organization_id));
create policy project_members_admin_delete
  on public.project_members for delete to authenticated
  using (private.is_organization_admin(organization_id));
revoke all on public.project_members from anon, authenticated;
grant select, insert, update, delete on public.project_members to authenticated;
grant all on public.project_members to service_role;

drop policy if exists organization_members_select_member on public.organization_members;
create policy organization_members_read_scoped
  on public.organization_members for select to authenticated
  using (user_id = auth.uid() or private.is_organization_admin(organization_id));

-- Replace organization-wide lifecycle access with role- and project-scoped
-- policies. Investors and clients consume deliberately narrow read models.
drop policy if exists properties_select_member on public.properties;
drop policy if exists deals_select_member on public.deals;
drop policy if exists underwriting_versions_select_member on public.underwriting_versions;
drop policy if exists projects_select_member on public.projects;
drop policy if exists project_budgets_select_member on public.project_budgets;
drop policy if exists budget_line_items_select_member on public.budget_line_items;
drop policy if exists project_costs_select_member on public.project_costs;
drop policy if exists draw_requests_select_member on public.draw_requests;
drop policy if exists draw_items_select_member on public.draw_items;
drop policy if exists project_milestones_select_member on public.project_milestones;

drop policy if exists properties_insert_manager on public.properties;
drop policy if exists properties_update_manager on public.properties;
drop policy if exists properties_delete_manager on public.properties;
drop policy if exists deals_insert_manager on public.deals;
drop policy if exists deals_update_manager on public.deals;
drop policy if exists deals_delete_manager on public.deals;
drop policy if exists underwriting_versions_insert_manager on public.underwriting_versions;
drop policy if exists underwriting_versions_update_manager on public.underwriting_versions;
drop policy if exists underwriting_versions_delete_manager on public.underwriting_versions;
drop policy if exists projects_insert_manager on public.projects;
drop policy if exists projects_update_manager on public.projects;
drop policy if exists projects_delete_manager on public.projects;
drop policy if exists project_budgets_insert_manager on public.project_budgets;
drop policy if exists project_budgets_update_manager on public.project_budgets;
drop policy if exists project_budgets_delete_manager on public.project_budgets;
drop policy if exists budget_line_items_insert_manager on public.budget_line_items;
drop policy if exists budget_line_items_update_manager on public.budget_line_items;
drop policy if exists budget_line_items_delete_manager on public.budget_line_items;
drop policy if exists project_costs_insert_manager on public.project_costs;
drop policy if exists project_costs_update_manager on public.project_costs;
drop policy if exists project_costs_delete_manager on public.project_costs;
drop policy if exists draw_requests_insert_manager on public.draw_requests;
drop policy if exists draw_requests_update_manager on public.draw_requests;
drop policy if exists draw_requests_delete_manager on public.draw_requests;
drop policy if exists draw_items_insert_manager on public.draw_items;
drop policy if exists draw_items_update_manager on public.draw_items;
drop policy if exists draw_items_delete_manager on public.draw_items;
drop policy if exists project_milestones_insert_manager on public.project_milestones;
drop policy if exists project_milestones_update_manager on public.project_milestones;
drop policy if exists project_milestones_delete_manager on public.project_milestones;

create policy properties_read_authorized_project
  on public.properties for select to authenticated
  using (
    private.is_organization_admin(organization_id)
    or exists (
      select 1
      from public.projects project
      where project.property_id = properties.id
        and private.can_manage_project(project.id)
    )
  );
create policy properties_admin_insert on public.properties for insert to authenticated
  with check (private.is_organization_admin(organization_id));
create policy properties_admin_update on public.properties for update to authenticated
  using (private.is_organization_admin(organization_id))
  with check (private.is_organization_admin(organization_id));
create policy properties_admin_delete on public.properties for delete to authenticated
  using (private.is_organization_admin(organization_id));

create policy deals_admin_read on public.deals for select to authenticated
  using (private.is_organization_admin(organization_id));
create policy deals_admin_insert on public.deals for insert to authenticated
  with check (private.is_organization_admin(organization_id));
create policy deals_admin_update on public.deals for update to authenticated
  using (private.is_organization_admin(organization_id))
  with check (private.is_organization_admin(organization_id));
create policy deals_admin_delete on public.deals for delete to authenticated
  using (private.is_organization_admin(organization_id));

create policy underwriting_admin_read on public.underwriting_versions for select to authenticated
  using (private.is_organization_admin(organization_id));
create policy underwriting_admin_insert on public.underwriting_versions for insert to authenticated
  with check (private.is_organization_admin(organization_id));
create policy underwriting_admin_update on public.underwriting_versions for update to authenticated
  using (private.is_organization_admin(organization_id))
  with check (private.is_organization_admin(organization_id));
create policy underwriting_admin_delete on public.underwriting_versions for delete to authenticated
  using (private.is_organization_admin(organization_id));

create policy projects_internal_read on public.projects for select to authenticated
  using (
    private.is_organization_admin(organization_id)
    or private.has_project_role(id, array['project_manager']::text[])
  );
create policy projects_admin_insert on public.projects for insert to authenticated
  with check (private.is_organization_admin(organization_id));
create policy projects_manager_update on public.projects for update to authenticated
  using (private.can_manage_project(id))
  with check (private.can_manage_project(id));
create policy projects_admin_delete on public.projects for delete to authenticated
  using (private.is_organization_admin(organization_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'project_budgets', 'project_costs', 'draw_requests', 'project_milestones'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.can_manage_project(project_id))',
      table_name || '_project_read', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.can_manage_project(project_id))',
      table_name || '_project_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.can_manage_project(project_id)) with check (private.can_manage_project(project_id))',
      table_name || '_project_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.can_manage_project(project_id))',
      table_name || '_project_delete', table_name
    );
  end loop;
end;
$$;

create policy budget_line_items_project_read on public.budget_line_items for select to authenticated
  using (exists (
    select 1 from public.project_budgets budget
    where budget.id = budget_line_items.budget_id and private.can_manage_project(budget.project_id)
  ));
create policy budget_line_items_project_insert on public.budget_line_items for insert to authenticated
  with check (exists (
    select 1 from public.project_budgets budget
    where budget.id = budget_line_items.budget_id and private.can_manage_project(budget.project_id)
  ));
create policy budget_line_items_project_update on public.budget_line_items for update to authenticated
  using (exists (
    select 1 from public.project_budgets budget
    where budget.id = budget_line_items.budget_id and private.can_manage_project(budget.project_id)
  ))
  with check (exists (
    select 1 from public.project_budgets budget
    where budget.id = budget_line_items.budget_id and private.can_manage_project(budget.project_id)
  ));
create policy budget_line_items_project_delete on public.budget_line_items for delete to authenticated
  using (exists (
    select 1 from public.project_budgets budget
    where budget.id = budget_line_items.budget_id and private.can_manage_project(budget.project_id)
  ));

create policy draw_items_project_read on public.draw_items for select to authenticated
  using (exists (
    select 1 from public.draw_requests draw
    where draw.id = draw_items.draw_request_id and private.can_manage_project(draw.project_id)
  ));
create policy draw_items_project_insert on public.draw_items for insert to authenticated
  with check (exists (
    select 1 from public.draw_requests draw
    where draw.id = draw_items.draw_request_id and private.can_manage_project(draw.project_id)
  ));
create policy draw_items_project_update on public.draw_items for update to authenticated
  using (exists (
    select 1 from public.draw_requests draw
    where draw.id = draw_items.draw_request_id and private.can_manage_project(draw.project_id)
  ))
  with check (exists (
    select 1 from public.draw_requests draw
    where draw.id = draw_items.draw_request_id and private.can_manage_project(draw.project_id)
  ));
create policy draw_items_project_delete on public.draw_items for delete to authenticated
  using (exists (
    select 1 from public.draw_requests draw
    where draw.id = draw_items.draw_request_id and private.can_manage_project(draw.project_id)
  ));

alter table public.project_milestones
  add column visibility text not null default 'internal'
    check (visibility in ('internal', 'investor', 'client', 'all_members'));
drop policy if exists project_milestones_project_read on public.project_milestones;
create policy project_milestones_audience_read
  on public.project_milestones for select to authenticated
  using (
    private.can_manage_project(project_id)
    or private.can_view_project_audience(project_id, visibility)
  );

create or replace function private.protect_project_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not private.is_organization_admin(new.organization_id)
     and (
       new.organization_id is distinct from old.organization_id
       or new.property_id is distinct from old.property_id
       or new.deal_id is distinct from old.deal_id
       or new.project_manager_id is distinct from old.project_manager_id
       or new.approved_budget is distinct from old.approved_budget
     ) then
    raise exception 'Only organization owners and admins may change project ownership, assignment, or approved budget';
  end if;
  if new.project_manager_id is not null and not exists (
    select 1 from public.project_members member
    where member.project_id = new.id
      and member.user_id = new.project_manager_id
      and member.role = 'project_manager'
  ) then
    raise exception 'The assigned project manager must be a project member with the project_manager role';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_project_admin_fields() from public, anon, authenticated;
create trigger projects_protect_admin_fields
  before update on public.projects
  for each row execute function private.protect_project_admin_fields();

create or replace function private.protect_project_approval_transitions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization uuid := coalesce(new.organization_id, old.organization_id);
begin
  if auth.uid() is null or private.is_organization_admin(target_organization) then return new; end if;
  if tg_table_name = 'project_budgets' and new.status in ('approved', 'superseded', 'closed') and new.status is distinct from old.status then
    raise exception 'Only organization owners and admins may approve or close budgets';
  end if;
  if tg_table_name = 'draw_requests' and new.status in ('approved', 'funded', 'rejected', 'void') and new.status is distinct from old.status then
    raise exception 'Only organization owners and admins may approve, fund, reject, or void draws';
  end if;
  if tg_table_name = 'project_costs' and new.status in ('approved', 'paid', 'void') and new.status is distinct from old.status then
    raise exception 'Only organization owners and admins may approve, pay, or void costs';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_project_approval_transitions() from public, anon, authenticated;
create trigger project_budgets_protect_approval before update on public.project_budgets
  for each row execute function private.protect_project_approval_transitions();
create trigger draw_requests_protect_approval before update on public.draw_requests
  for each row execute function private.protect_project_approval_transitions();
create trigger project_costs_protect_approval before update on public.project_costs
  for each row execute function private.protect_project_approval_transitions();

create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  organization_id uuid not null,
  title text not null check (char_length(title) between 1 and 180),
  body text not null check (char_length(body) between 1 and 10000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  visibility text not null default 'all_members'
    check (visibility in ('internal', 'investor', 'client', 'all_members')),
  published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade,
  check ((status = 'published') = (published_at is not null) or status = 'draft')
);
create index project_updates_project_idx on public.project_updates (project_id, published_at desc, created_at desc);

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  organization_id uuid not null,
  name text not null check (char_length(name) between 1 and 240),
  document_type text not null,
  storage_path text not null,
  visibility text not null default 'internal'
    check (visibility in ('internal', 'investor', 'client', 'all_members')),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (project_id, storage_path),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);
create index project_documents_project_idx on public.project_documents (project_id, created_at desc);

alter table public.project_updates enable row level security;
alter table public.project_documents enable row level security;
create policy project_updates_read_audience on public.project_updates for select to authenticated
  using (
    private.can_manage_project(project_id)
    or (status = 'published' and private.can_view_project_audience(project_id, visibility))
  );
create policy project_updates_manage on public.project_updates for all to authenticated
  using (private.can_manage_project(project_id))
  with check (private.can_manage_project(project_id));
create policy project_documents_read_audience on public.project_documents for select to authenticated
  using (private.can_manage_project(project_id) or private.can_view_project_audience(project_id, visibility));
create policy project_documents_manage on public.project_documents for all to authenticated
  using (private.can_manage_project(project_id))
  with check (private.can_manage_project(project_id));
revoke all on public.project_updates, public.project_documents from anon, authenticated;
grant select, insert, update, delete on public.project_updates, public.project_documents to authenticated;
grant all on public.project_updates, public.project_documents to service_role;
create trigger project_updates_updated_at before update on public.project_updates
  for each row execute function public.set_updated_at();

-- CRM is internal operational data. PMs may see contacts attached to one of
-- their projects; investors and clients never receive raw CRM access.
create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('investor', 'client', 'vendor', 'lender', 'broker', 'owner', 'other')),
  first_name text not null,
  last_name text not null,
  company_name text,
  email text,
  phone text,
  status text not null default 'active' check (status in ('lead', 'active', 'inactive', 'do_not_contact')),
  source text,
  tags text[] not null default '{}'::text[],
  relationship_owner_id uuid references auth.users(id) on delete set null,
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index crm_contacts_org_followup_idx on public.crm_contacts (organization_id, next_follow_up_at, status);
create unique index crm_contacts_org_email_key on public.crm_contacts (organization_id, lower(email)) where email is not null;

create table public.crm_contact_projects (
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  project_id uuid not null,
  organization_id uuid not null,
  relationship text not null check (relationship in ('investor', 'client', 'vendor', 'lender', 'broker', 'other')),
  created_at timestamptz not null default now(),
  primary key (contact_id, project_id, relationship),
  foreign key (contact_id, organization_id)
    references public.crm_contacts(id, organization_id) on delete cascade,
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);
create index crm_contact_projects_project_idx on public.crm_contact_projects (project_id, relationship);

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null,
  project_id uuid,
  activity_type text not null check (activity_type in ('note', 'call', 'email', 'meeting', 'task')),
  subject text not null,
  body text,
  due_at timestamptz,
  completed_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (contact_id, organization_id)
    references public.crm_contacts(id, organization_id) on delete cascade,
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade,
  check (completed_at is null or activity_type = 'task')
);
create index crm_activities_due_idx on public.crm_activities (organization_id, due_at) where completed_at is null;

alter table public.crm_contacts enable row level security;
alter table public.crm_contact_projects enable row level security;
alter table public.crm_activities enable row level security;
create policy crm_contacts_internal_read on public.crm_contacts for select to authenticated
  using (
    private.is_organization_admin(organization_id)
    or exists (
      select 1 from public.crm_contact_projects link
      where link.contact_id = crm_contacts.id
        and private.has_project_role(link.project_id, array['project_manager']::text[])
    )
  );
create policy crm_contacts_admin_manage on public.crm_contacts for all to authenticated
  using (private.is_organization_admin(organization_id))
  with check (private.is_organization_admin(organization_id));
create policy crm_links_internal_read on public.crm_contact_projects for select to authenticated
  using (private.is_organization_admin(organization_id) or private.has_project_role(project_id, array['project_manager']::text[]));
create policy crm_links_admin_manage on public.crm_contact_projects for all to authenticated
  using (private.is_organization_admin(organization_id))
  with check (private.is_organization_admin(organization_id));
create policy crm_activities_internal_read on public.crm_activities for select to authenticated
  using (private.is_organization_admin(organization_id) or (project_id is not null and private.has_project_role(project_id, array['project_manager']::text[])));
create policy crm_activities_internal_insert on public.crm_activities for insert to authenticated
  with check (private.is_organization_admin(organization_id) or (project_id is not null and private.has_project_role(project_id, array['project_manager']::text[])));
create policy crm_activities_internal_update on public.crm_activities for update to authenticated
  using (private.is_organization_admin(organization_id) or (project_id is not null and private.has_project_role(project_id, array['project_manager']::text[])))
  with check (private.is_organization_admin(organization_id) or (project_id is not null and private.has_project_role(project_id, array['project_manager']::text[])));
revoke all on public.crm_contacts, public.crm_contact_projects, public.crm_activities from anon, authenticated;
grant select, insert, update, delete on public.crm_contacts, public.crm_contact_projects to authenticated;
grant select, insert, update on public.crm_activities to authenticated;
grant all on public.crm_contacts, public.crm_contact_projects, public.crm_activities to service_role;
create trigger crm_contacts_updated_at before update on public.crm_contacts
  for each row execute function public.set_updated_at();
create trigger crm_activities_updated_at before update on public.crm_activities
  for each row execute function public.set_updated_at();

-- Admin-facing CRM writes are transactional: a newly created contact and its
-- initial project relationship either both exist or neither does.
create or replace function public.create_crm_contact(
  target_organization uuid,
  contact_kind text,
  first_name text,
  last_name text,
  email text default null,
  phone text default null,
  company_name text default null,
  target_project uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_contact_id uuid;
  project_organization uuid;
  project_relationship text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.is_organization_admin(target_organization) then
    raise exception 'Only organization owners and admins can create CRM contacts';
  end if;
  if contact_kind not in ('investor', 'client', 'vendor', 'lender', 'broker', 'owner', 'other') then
    raise exception 'Invalid contact kind';
  end if;
  if nullif(trim(first_name), '') is null or nullif(trim(last_name), '') is null then
    raise exception 'First and last name are required';
  end if;
  if email is not null and (position('@' in trim(email)) <= 1 or position(E'\n' in email) > 0 or position(E'\r' in email) > 0) then
    raise exception 'Invalid email address';
  end if;
  if target_project is not null then
    select project.organization_id into project_organization
    from public.projects project where project.id = target_project;
    if project_organization is distinct from target_organization then
      raise exception 'Project does not belong to the target organization';
    end if;
  end if;

  insert into public.crm_contacts (
    organization_id, kind, first_name, last_name, email, phone,
    company_name, relationship_owner_id, created_by
  ) values (
    target_organization, contact_kind, trim(first_name), trim(last_name),
    nullif(lower(trim(email)), ''), nullif(trim(phone), ''),
    nullif(trim(company_name), ''), auth.uid(), auth.uid()
  ) returning id into new_contact_id;

  if target_project is not null then
    project_relationship := case
      when contact_kind in ('investor', 'client', 'vendor', 'lender', 'broker') then contact_kind
      else 'other'
    end;
    insert into public.crm_contact_projects (contact_id, project_id, organization_id, relationship)
    values (new_contact_id, target_project, target_organization, project_relationship);
  end if;
  return new_contact_id;
end;
$$;
revoke all on function public.create_crm_contact(uuid, text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_crm_contact(uuid, text, text, text, text, text, text, uuid) to authenticated;

create table public.investor_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  primary_contact_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  entity_type text not null check (entity_type in ('individual', 'joint', 'llc', 'trust', 'partnership', 'corporation', 'other')),
  status text not null default 'active' check (status in ('prospect', 'active', 'inactive')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.project_investments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  investor_entity_id uuid not null,
  commitment_amount numeric(16,2) not null default 0 check (commitment_amount >= 0),
  contributed_amount numeric(16,2) not null default 0 check (contributed_amount >= 0),
  distributed_amount numeric(16,2) not null default 0 check (distributed_amount >= 0),
  ownership_percent numeric(7,4) check (ownership_percent is null or ownership_percent between 0 and 100),
  status text not null default 'active' check (status in ('prospect', 'committed', 'active', 'exited', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, investor_entity_id),
  unique (id, organization_id),
  foreign key (investor_entity_id, organization_id)
    references public.investor_entities(id, organization_id) on delete restrict,
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);
create index project_investments_entity_idx on public.project_investments (investor_entity_id, status);

create table public.investment_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_investment_id uuid not null,
  transaction_type text not null check (transaction_type in ('capital_call', 'contribution', 'distribution', 'fee', 'adjustment')),
  amount numeric(16,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  due_date date,
  paid_at timestamptz,
  reference text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (project_investment_id, organization_id)
    references public.project_investments(id, organization_id) on delete cascade,
  check ((status = 'paid' and paid_at is not null) or (status <> 'paid' and paid_at is null))
);
create index investment_transactions_investment_idx on public.investment_transactions (project_investment_id, created_at desc);

alter table public.investor_entities enable row level security;
alter table public.project_investments enable row level security;
alter table public.investment_transactions enable row level security;
create policy investor_entities_read on public.investor_entities for select to authenticated
  using (private.is_organization_admin(organization_id) or primary_contact_user_id = auth.uid());
create policy investor_entities_admin_manage on public.investor_entities for all to authenticated
  using (private.is_organization_admin(organization_id))
  with check (private.is_organization_admin(organization_id));
create policy project_investments_read on public.project_investments for select to authenticated
  using (
    private.is_organization_admin(organization_id)
    or exists (
      select 1 from public.investor_entities entity
      where entity.id = project_investments.investor_entity_id
        and entity.primary_contact_user_id = auth.uid()
    )
  );
create policy project_investments_admin_manage on public.project_investments for all to authenticated
  using (private.is_organization_admin(organization_id))
  with check (private.is_organization_admin(organization_id));
create policy investment_transactions_read on public.investment_transactions for select to authenticated
  using (
    private.is_organization_admin(organization_id)
    or exists (
      select 1
      from public.project_investments investment
      join public.investor_entities entity on entity.id = investment.investor_entity_id
      where investment.id = investment_transactions.project_investment_id
        and entity.primary_contact_user_id = auth.uid()
    )
  );
create policy investment_transactions_admin_manage on public.investment_transactions for all to authenticated
  using (private.is_organization_admin(organization_id))
  with check (private.is_organization_admin(organization_id));
revoke all on public.investor_entities, public.project_investments, public.investment_transactions from anon, authenticated;
grant select, insert, update, delete on public.investor_entities, public.project_investments, public.investment_transactions to authenticated;
grant all on public.investor_entities, public.project_investments, public.investment_transactions to service_role;
create trigger investor_entities_updated_at before update on public.investor_entities
  for each row execute function public.set_updated_at();
create trigger project_investments_updated_at before update on public.project_investments
  for each row execute function public.set_updated_at();

create table public.project_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  role text not null check (role in ('project_manager', 'investor', 'client', 'viewer')),
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  email_sent_at timestamptz,
  email_provider_message_id text,
  created_at timestamptz not null default now(),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade,
  check (expires_at > created_at),
  check ((accepted_at is null) = (accepted_by is null))
);
create unique index project_invitations_pending_key
  on public.project_invitations (project_id, email, role) where accepted_at is null;
alter table public.project_invitations enable row level security;
create policy project_invitations_admin_read on public.project_invitations for select to authenticated
  using (private.is_organization_admin(organization_id));
create policy project_invitations_admin_delete on public.project_invitations for delete to authenticated
  using (private.is_organization_admin(organization_id));
revoke all on public.project_invitations from anon, authenticated;
grant select, delete on public.project_invitations to authenticated;
grant all on public.project_invitations to service_role;

insert into public.notification_channel_policies (
  event_type, importance, push_mode, email_mode, email_variant,
  email_preference_key, description
) values (
  'project_invitation', 'transactional', 'none', 'required', 'transactional',
  'transactional_enabled', 'A project-scoped access invitation requested by a workspace administrator.'
) on conflict (event_type) do update set
  importance = excluded.importance,
  push_mode = excluded.push_mode,
  email_mode = excluded.email_mode,
  email_variant = excluded.email_variant,
  email_preference_key = excluded.email_preference_key,
  description = excluded.description,
  updated_at = now();

-- Keep project creation atomic. The portfolio UI should never leave an orphan
-- property behind when the project insert or tenant checks fail.
create or replace function public.create_portfolio_project(
  target_organization uuid,
  project_name text,
  address_line1 text,
  city text,
  state text,
  postal_code text,
  property_name text default null,
  property_type text default null,
  latitude numeric default null,
  longitude numeric default null,
  project_stage text default 'acquisition',
  start_date date default null,
  target_completion_date date default null,
  approved_budget numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_property_id uuid;
  new_project_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.is_organization_admin(target_organization) then
    raise exception 'Only organization owners and admins can create projects';
  end if;
  if nullif(trim(project_name), '') is null then raise exception 'Project name is required'; end if;
  if nullif(trim(address_line1), '') is null
    or nullif(trim(city), '') is null
    or nullif(trim(state), '') is null
    or nullif(trim(postal_code), '') is null then
    raise exception 'A complete property address is required';
  end if;
  if project_stage not in ('acquisition', 'development', 'construction', 'stabilization', 'management', 'disposed') then
    raise exception 'Invalid project stage';
  end if;
  if coalesce(approved_budget, 0) < 0 then raise exception 'Approved budget cannot be negative'; end if;
  if latitude is not null and (latitude < -90 or latitude > 90) then raise exception 'Invalid latitude'; end if;
  if longitude is not null and (longitude < -180 or longitude > 180) then raise exception 'Invalid longitude'; end if;
  if start_date is not null and target_completion_date is not null and target_completion_date < start_date then
    raise exception 'Target completion date cannot precede the start date';
  end if;

  insert into public.properties (
    organization_id, name, address_line1, city, state, postal_code,
    property_type, latitude, longitude, created_by
  ) values (
    target_organization, nullif(trim(property_name), ''), trim(address_line1),
    trim(city), upper(trim(state)), trim(postal_code), nullif(trim(property_type), ''),
    latitude, longitude, auth.uid()
  ) returning id into new_property_id;

  insert into public.projects (
    organization_id, property_id, name, stage, status, start_date,
    target_completion_date, approved_budget, created_by
  ) values (
    target_organization, new_property_id, trim(project_name), project_stage,
    case when start_date is null then 'planned' else 'active' end,
    start_date, target_completion_date, coalesce(approved_budget, 0), auth.uid()
  ) returning id into new_project_id;

  return new_project_id;
end;
$$;
revoke all on function public.create_portfolio_project(uuid, text, text, text, text, text, text, text, numeric, numeric, text, date, date, numeric) from public, anon, authenticated;
grant execute on function public.create_portfolio_project(uuid, text, text, text, text, text, text, text, numeric, numeric, text, date, date, numeric) to authenticated;

create or replace function public.create_project_invitation(
  target_project uuid,
  invite_email text,
  invite_role text,
  valid_for interval default interval '7 days'
)
returns table (invitation_id uuid, invitation_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization uuid;
  raw_token text;
begin
  select project.organization_id into target_organization
  from public.projects project where project.id = target_project;
  if target_organization is null or not private.is_organization_admin(target_organization) then
    raise exception 'Only organization owners and admins can invite project members';
  end if;
  if invite_role not in ('project_manager', 'investor', 'client', 'viewer') then
    raise exception 'Invalid project role';
  end if;
  if valid_for <= interval '0 seconds' or valid_for > interval '30 days' then
    raise exception 'Invitation lifetime must be between one second and 30 days';
  end if;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  return query
  insert into public.project_invitations (
    organization_id, project_id, email, role, token_hash, invited_by, expires_at
  ) values (
    target_organization,
    target_project,
    lower(trim(invite_email)),
    invite_role,
    encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    auth.uid(),
    now() + valid_for
  )
  on conflict (project_id, email, role) where accepted_at is null
  do update set
    token_hash = excluded.token_hash,
    invited_by = excluded.invited_by,
    expires_at = excluded.expires_at
  returning id, raw_token, project_invitations.expires_at;
end;
$$;

create or replace function public.accept_project_invitation(invitation_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.project_invitations;
  signed_in_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  organization_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into invitation
  from public.project_invitations candidate
  where candidate.token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex')
    and candidate.accepted_at is null
    and candidate.expires_at > now()
  for update;
  if invitation.id is null then raise exception 'Invitation is invalid or expired'; end if;
  if signed_in_email = '' or signed_in_email <> invitation.email then
    raise exception 'Sign in with the email address that received this invitation';
  end if;

  organization_role := case invitation.role
    when 'project_manager' then 'project_manager'
    when 'investor' then 'investor'
    else 'viewer'
  end;
  insert into public.organization_members (organization_id, user_id, role, invited_by)
  values (invitation.organization_id, auth.uid(), organization_role, invitation.invited_by)
  on conflict (organization_id, user_id) do nothing;

  insert into public.project_members (project_id, organization_id, user_id, role, invited_by)
  values (invitation.project_id, invitation.organization_id, auth.uid(), invitation.role, invitation.invited_by)
  on conflict (project_id, user_id) do update set role = excluded.role;

  update public.project_invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = invitation.id;
  return invitation.role;
end;
$$;
revoke all on function public.create_project_invitation(uuid, text, text, interval) from public, anon, authenticated;
revoke all on function public.accept_project_invitation(text) from public, anon, authenticated;
grant execute on function public.create_project_invitation(uuid, text, text, interval) to authenticated;
grant execute on function public.accept_project_invitation(text) to authenticated;

-- The dedicated invitation mailer uses the caller's JWT for this lookup. It
-- receives only the fields needed to render delivery and never bypasses the
-- organization-admin check.
create or replace function public.get_project_invitation_delivery(invitation_token text)
returns table (
  invitation_id uuid,
  invite_email text,
  invite_role text,
  project_name text,
  expires_at timestamptz,
  email_sent_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select invitation.id, invitation.email, invitation.role, project.name,
    invitation.expires_at, invitation.email_sent_at
  from public.project_invitations invitation
  join public.projects project on project.id = invitation.project_id
  where invitation.token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex')
    and invitation.accepted_at is null
    and invitation.expires_at > now()
    and private.is_organization_admin(invitation.organization_id);
$$;

create or replace function public.mark_project_invitation_emailed(
  invitation_token text,
  provider_message_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.project_invitations invitation
  set email_sent_at = coalesce(invitation.email_sent_at, now()),
      email_provider_message_id = coalesce(invitation.email_provider_message_id, provider_message_id)
  where invitation.token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex')
    and invitation.accepted_at is null
    and invitation.expires_at > now()
    and private.is_organization_admin(invitation.organization_id);
  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;
revoke all on function public.get_project_invitation_delivery(text) from public, anon, authenticated;
revoke all on function public.mark_project_invitation_emailed(text, text) from public, anon, authenticated;
grant execute on function public.get_project_invitation_delivery(text) to authenticated;
grant execute on function public.mark_project_invitation_emailed(text, text) to authenticated;

-- One role-aware, bounded read model prevents list/map clients from joining the
-- entire project graph or leaking internal fields to investors and clients.
create or replace function public.get_portfolio_projects()
returns table (
  project_id uuid,
  organization_id uuid,
  access_role text,
  can_manage boolean,
  project_name text,
  stage text,
  status text,
  property_name text,
  address text,
  city text,
  state text,
  postal_code text,
  latitude numeric,
  longitude numeric,
  project_manager_id uuid,
  start_date date,
  target_completion_date date,
  approved_budget numeric,
  committed_amount numeric,
  paid_amount numeric,
  budget_variance numeric,
  next_milestone_id uuid,
  next_milestone_title text,
  next_milestone_due date,
  overdue_milestones bigint,
  latest_update_id uuid,
  latest_update_title text,
  latest_update_at timestamptz,
  commitment_amount numeric,
  contributed_amount numeric,
  distributed_amount numeric,
  health text,
  next_action text,
  next_action_label text
)
language sql
stable
security definer
set search_path = ''
as $$
  with accessible as (
    select
      project.*,
      property.name as property_name,
      property.address_line1 || coalesce(' ' || property.address_line2, '') as address,
      property.city,
      property.state,
      property.postal_code,
      property.latitude,
      property.longitude,
      case
        when organization_member.role in ('owner', 'admin') then organization_member.role
        else project_member.role
      end as access_role
    from public.projects project
    join public.properties property on property.id = project.property_id
    join public.organization_members organization_member
      on organization_member.organization_id = project.organization_id
     and organization_member.user_id = auth.uid()
    left join public.project_members project_member
      on project_member.project_id = project.id
     and project_member.user_id = auth.uid()
    where organization_member.role in ('owner', 'admin') or project_member.user_id is not null
  )
  select
    accessible.id,
    accessible.organization_id,
    accessible.access_role,
    accessible.access_role in ('owner', 'admin', 'project_manager'),
    accessible.name,
    accessible.stage,
    accessible.status,
    accessible.property_name,
    accessible.address,
    accessible.city,
    accessible.state,
    accessible.postal_code,
    accessible.latitude,
    accessible.longitude,
    accessible.project_manager_id,
    accessible.start_date,
    accessible.target_completion_date,
    accessible.approved_budget,
    coalesce(budget.committed_amount, 0),
    coalesce(budget.paid_amount, 0),
    accessible.approved_budget - coalesce(budget.committed_amount, 0),
    milestone.id,
    milestone.title,
    milestone.due_date,
    coalesce(overdue.count, 0),
    latest_update.id,
    latest_update.title,
    latest_update.published_at,
    case when accessible.access_role = 'project_manager' then null else investment.commitment_amount end,
    case when accessible.access_role = 'project_manager' then null else investment.contributed_amount end,
    case when accessible.access_role = 'project_manager' then null else investment.distributed_amount end,
    case
      when accessible.status = 'on_hold' or coalesce(overdue.count, 0) > 0 then 'at_risk'
      when accessible.target_completion_date is not null and accessible.target_completion_date < current_date and accessible.status = 'active' then 'attention'
      when milestone.id is null and accessible.status = 'active' then 'needs_plan'
      else 'on_track'
    end,
    case
      when accessible.access_role in ('investor', 'client', 'viewer') then 'view_update'
      when coalesce(overdue.count, 0) > 0 then 'resolve_overdue'
      when not exists (
        select 1 from public.project_members manager
        where manager.project_id = accessible.id and manager.role = 'project_manager'
      ) and accessible.access_role in ('owner', 'admin') then 'invite_project_manager'
      when milestone.id is not null then 'update_milestone'
      else 'publish_update'
    end,
    case
      when accessible.access_role in ('investor', 'client', 'viewer') then 'View latest update'
      when coalesce(overdue.count, 0) > 0 then 'Resolve overdue milestones'
      when not exists (
        select 1 from public.project_members manager
        where manager.project_id = accessible.id and manager.role = 'project_manager'
      ) and accessible.access_role in ('owner', 'admin') then 'Invite project manager'
      when milestone.id is not null then 'Update next milestone'
      else 'Publish project update'
    end
  from accessible
  left join lateral (
    select
      sum(item.committed_amount) as committed_amount,
      sum(item.paid_amount) as paid_amount
    from public.project_budgets project_budget
    join public.budget_line_items item on item.budget_id = project_budget.id
    where project_budget.project_id = accessible.id
      and project_budget.status = 'approved'
  ) budget on true
  left join lateral (
    select item.id, item.title, item.due_date
    from public.project_milestones item
    where item.project_id = accessible.id
      and item.status not in ('completed', 'cancelled')
      and (
        accessible.access_role in ('owner', 'admin', 'project_manager')
        or item.visibility in ('all_members', accessible.access_role)
      )
    order by item.due_date nulls last, item.created_at
    limit 1
  ) milestone on true
  left join lateral (
    select count(*)::bigint as count
    from public.project_milestones item
    where item.project_id = accessible.id
      and item.status not in ('completed', 'cancelled')
      and item.due_date < current_date
      and (
        accessible.access_role in ('owner', 'admin', 'project_manager')
        or item.visibility in ('all_members', accessible.access_role)
      )
  ) overdue on true
  left join lateral (
    select item.id, item.title, item.published_at
    from public.project_updates item
    where item.project_id = accessible.id
      and item.status = 'published'
      and (
        accessible.access_role in ('owner', 'admin', 'project_manager')
        or item.visibility in ('all_members', accessible.access_role)
      )
    order by item.published_at desc
    limit 1
  ) latest_update on true
  left join lateral (
    select
      sum(item.commitment_amount) as commitment_amount,
      sum(item.contributed_amount) as contributed_amount,
      sum(item.distributed_amount) as distributed_amount
    from public.project_investments item
    join public.investor_entities entity on entity.id = item.investor_entity_id
    where item.project_id = accessible.id
      and (
        accessible.access_role in ('owner', 'admin')
        or entity.primary_contact_user_id = auth.uid()
      )
  ) investment on true
  order by
    case when accessible.status = 'active' then 0 else 1 end,
    accessible.target_completion_date nulls last,
    accessible.name;
$$;
revoke all on function public.get_portfolio_projects() from public, anon, authenticated;
grant execute on function public.get_portfolio_projects() to authenticated;
