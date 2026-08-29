-- TW Ventures real-estate lifecycle.
--
-- A sourced opportunity becomes a deal, underwriting versions remain
-- immutable history, and an approved deal becomes a project whose budget,
-- costs, draws, and milestones remain in the same organization boundary.

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null check (char_length(state) between 2 and 3),
  postal_code text not null,
  county text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  property_type text,
  units integer check (units is null or units > 0),
  square_feet integer check (square_feet is null or square_feet > 0),
  year_built integer check (year_built is null or year_built between 1600 and 2200),
  parcel_number text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index properties_org_idx on public.properties (organization_id, city, state);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid,
  name text not null check (char_length(name) between 1 and 160),
  stage text not null default 'lead'
    check (stage in ('lead', 'screening', 'underwriting', 'loi', 'contract', 'due_diligence', 'closed', 'dead')),
  status text not null default 'active'
    check (status in ('active', 'on_hold', 'won', 'lost', 'archived')),
  strategy text check (strategy is null or strategy in ('brrrr', 'rental', 'development', 'flip', 'land', 'other')),
  source text,
  source_lead_id uuid,
  asking_price numeric(16, 2) check (asking_price is null or asking_price >= 0),
  target_close_date date,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete restrict
);
create index deals_pipeline_idx on public.deals (organization_id, stage, updated_at desc);
create index deals_assigned_idx on public.deals (assigned_to, status) where assigned_to is not null;

create table public.underwriting_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid not null,
  version integer not null check (version > 0),
  model_type text not null check (model_type in ('brrrr', 'traditional_rental', 'development', 'other')),
  inputs jsonb not null,
  results jsonb not null,
  assumptions jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (deal_id, version),
  unique (id, organization_id),
  foreign key (deal_id, organization_id)
    references public.deals(id, organization_id) on delete cascade
);
create index underwriting_versions_deal_idx
  on public.underwriting_versions (deal_id, version desc);

-- Compatibility surface for the shipped BRRRR calculator. New saves are
-- attached to the user's first workspace automatically, while optional links
-- let the lifecycle UI promote them into a deal later without copying JSON.
create table public.brrrr_deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid,
  underwriting_version_id uuid,
  deal_name text not null check (char_length(deal_name) between 1 and 160),
  inputs jsonb not null,
  results jsonb not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  foreign key (deal_id, organization_id)
    references public.deals(id, organization_id) on delete restrict,
  foreign key (underwriting_version_id, organization_id)
    references public.underwriting_versions(id, organization_id) on delete restrict
);
create index brrrr_deals_user_idx on public.brrrr_deals (user_id, created_at desc);
create index brrrr_deals_org_idx on public.brrrr_deals (organization_id, updated_at desc);

create or replace function private.assign_default_brrrr_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is null then
    select member.organization_id
      into new.organization_id
    from public.organization_members member
    where member.user_id = new.user_id
    order by case member.role when 'owner' then 0 else 1 end, member.joined_at
    limit 1;
  end if;
  if new.organization_id is null then
    raise exception 'User does not belong to a TW Ventures workspace';
  end if;
  return new;
end;
$$;
revoke all on function private.assign_default_brrrr_organization() from public, anon, authenticated;

create trigger brrrr_deals_default_organization
  before insert on public.brrrr_deals
  for each row execute function private.assign_default_brrrr_organization();

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid,
  property_id uuid not null,
  name text not null check (char_length(name) between 1 and 160),
  stage text not null default 'acquisition'
    check (stage in ('acquisition', 'development', 'construction', 'stabilization', 'management', 'disposed')),
  status text not null default 'active'
    check (status in ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
  project_manager_id uuid references auth.users(id) on delete set null,
  start_date date,
  target_completion_date date,
  actual_completion_date date,
  approved_budget numeric(16, 2) not null default 0 check (approved_budget >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (deal_id, organization_id)
    references public.deals(id, organization_id) on delete restrict,
  foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete restrict,
  check (actual_completion_date is null or start_date is null or actual_completion_date >= start_date),
  check (target_completion_date is null or start_date is null or target_completion_date >= start_date)
);
create index projects_org_stage_idx on public.projects (organization_id, stage, status);

create table public.project_budgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  version integer not null check (version > 0),
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'superseded', 'closed')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, version),
  unique (id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade,
  check ((status = 'approved') = (approved_at is not null and approved_by is not null) or status <> 'approved')
);

create table public.budget_line_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  budget_id uuid not null,
  code text not null,
  category text not null,
  description text not null,
  original_amount numeric(16, 2) not null default 0 check (original_amount >= 0),
  approved_changes numeric(16, 2) not null default 0,
  committed_amount numeric(16, 2) not null default 0 check (committed_amount >= 0),
  paid_amount numeric(16, 2) not null default 0 check (paid_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, code),
  unique (id, organization_id),
  foreign key (budget_id, organization_id)
    references public.project_budgets(id, organization_id) on delete cascade
);
create index budget_line_items_budget_idx on public.budget_line_items (budget_id, category, code);

create table public.project_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  budget_line_item_id uuid,
  vendor_name text,
  reference_number text,
  description text not null,
  amount numeric(16, 2) not null check (amount >= 0),
  cost_date date not null,
  status text not null default 'committed'
    check (status in ('committed', 'invoiced', 'approved', 'paid', 'void')),
  document_url text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade,
  foreign key (budget_line_item_id, organization_id)
    references public.budget_line_items(id, organization_id) on delete restrict
);
create index project_costs_project_idx on public.project_costs (project_id, cost_date desc);

create table public.draw_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  draw_number integer not null check (draw_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'funded', 'rejected', 'void')),
  requested_amount numeric(16, 2) not null default 0 check (requested_amount >= 0),
  approved_amount numeric(16, 2) check (approved_amount is null or approved_amount >= 0),
  submitted_at timestamptz,
  approved_at timestamptz,
  funded_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, draw_number),
  unique (id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create table public.draw_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  draw_request_id uuid not null,
  project_cost_id uuid,
  description text not null,
  amount numeric(16, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (draw_request_id, organization_id)
    references public.draw_requests(id, organization_id) on delete cascade,
  foreign key (project_cost_id, organization_id)
    references public.project_costs(id, organization_id) on delete restrict
);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  title text not null check (char_length(title) between 1 and 240),
  description text,
  milestone_type text not null default 'project',
  due_date date,
  completed_at timestamptz,
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'blocked', 'completed', 'cancelled')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);
create index project_milestones_due_idx
  on public.project_milestones (organization_id, due_date, status)
  where status not in ('completed', 'cancelled');

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'properties', 'deals', 'underwriting_versions',
    'projects', 'project_budgets', 'budget_line_items', 'project_costs',
    'draw_requests', 'draw_items', 'project_milestones'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.is_organization_member(organization_id))',
      table_name || '_select_member', table_name
    );
  end loop;
end;
$$;

-- Saved calculator rows are personal work product even when they share an
-- organization. Other lifecycle tables are managed by owner/admin/PM roles.
alter table public.brrrr_deals enable row level security;
create policy brrrr_deals_select_own
  on public.brrrr_deals for select to authenticated
  using (user_id = auth.uid());
create policy brrrr_deals_insert_own
  on public.brrrr_deals for insert to authenticated
  with check (user_id = auth.uid() and private.is_organization_member(organization_id));
create policy brrrr_deals_update_own
  on public.brrrr_deals for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and private.is_organization_member(organization_id));
create policy brrrr_deals_delete_own
  on public.brrrr_deals for delete to authenticated
  using (user_id = auth.uid());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'properties', 'deals', 'underwriting_versions', 'projects',
    'project_budgets', 'budget_line_items', 'project_costs',
    'draw_requests', 'draw_items', 'project_milestones'
  ] loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.can_manage_organization(organization_id))',
      table_name || '_insert_manager', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.can_manage_organization(organization_id)) with check (private.can_manage_organization(organization_id))',
      table_name || '_update_manager', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.can_manage_organization(organization_id))',
      table_name || '_delete_manager', table_name
    );
  end loop;
end;
$$;

revoke all on
  public.properties,
  public.deals,
  public.underwriting_versions,
  public.brrrr_deals,
  public.projects,
  public.project_budgets,
  public.budget_line_items,
  public.project_costs,
  public.draw_requests,
  public.draw_items,
  public.project_milestones
from anon, authenticated;
grant select, insert, update, delete on
  public.properties,
  public.deals,
  public.underwriting_versions,
  public.brrrr_deals,
  public.projects,
  public.project_budgets,
  public.budget_line_items,
  public.project_costs,
  public.draw_requests,
  public.draw_items,
  public.project_milestones
to authenticated;
grant all on
  public.properties,
  public.deals,
  public.underwriting_versions,
  public.brrrr_deals,
  public.projects,
  public.project_budgets,
  public.budget_line_items,
  public.project_costs,
  public.draw_requests,
  public.draw_items,
  public.project_milestones
to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'properties', 'deals', 'brrrr_deals', 'projects', 'project_budgets',
    'budget_line_items', 'project_costs', 'draw_requests', 'project_milestones'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      table_name || '_updated_at', table_name
    );
  end loop;
end;
$$;
