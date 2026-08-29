-- Public-data lead sourcing and per-user review state.

create table public.real_estate_leads (
  id uuid primary key default gen_random_uuid(),
  data_source text not null,
  source_record_id text,
  source_url text,
  lead_type text not null,
  property_address text,
  normalized_address text,
  city text,
  state text,
  county text,
  zip text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  owner_name text,
  mailing_address text,
  is_absentee boolean not null default false,
  is_llc_owned boolean not null default false,
  property_value numeric(16, 2),
  equity_estimate numeric(16, 2),
  last_sale_date date,
  tax_amount numeric(16, 2),
  violation_description text,
  status text,
  severity text check (severity is null or severity in ('low', 'medium', 'high')),
  tags text[] not null default '{}',
  is_distressed boolean generated always as (
    coalesce('distressed' = any(tags), false)
    or lead_type in ('pre_foreclosure', 'tax_delinquent', 'reo')
  ) stored,
  incident_date date,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

create unique index real_estate_leads_source_key
  on public.real_estate_leads (data_source, source_record_id);
create index real_estate_leads_state_type_idx
  on public.real_estate_leads (state, lead_type);
create index real_estate_leads_source_fetched_idx
  on public.real_estate_leads (data_source, fetched_at desc);
create index real_estate_leads_severity_idx
  on public.real_estate_leads (severity) where severity is not null;
create index real_estate_leads_distressed_idx
  on public.real_estate_leads (fetched_at desc) where is_distressed;

create table public.real_estate_fetch_jobs (
  id uuid primary key default gen_random_uuid(),
  data_source text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  records_fetched integer not null default 0 check (records_fetched >= 0),
  records_inserted integer not null default 0 check (records_inserted >= 0),
  records_updated integer not null default 0 check (records_updated >= 0),
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (completed_at is null or completed_at >= started_at)
);
create index real_estate_fetch_jobs_recent_idx
  on public.real_estate_fetch_jobs (created_at desc);
create index real_estate_fetch_jobs_source_idx
  on public.real_estate_fetch_jobs (data_source, created_at desc);

create table public.lead_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data_source text not null,
  source_record_id text not null,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'analyzing', 'exported', 'dismissed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, data_source, source_record_id)
);
create index lead_reviews_user_status_idx
  on public.lead_reviews (user_id, status, updated_at desc);

alter table public.real_estate_leads enable row level security;
alter table public.real_estate_fetch_jobs enable row level security;
alter table public.lead_reviews enable row level security;

create policy real_estate_leads_read_authenticated
  on public.real_estate_leads for select to authenticated
  using (true);
create policy real_estate_fetch_jobs_read_authenticated
  on public.real_estate_fetch_jobs for select to authenticated
  using (true);
create policy lead_reviews_manage_own
  on public.lead_reviews for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on
  public.real_estate_leads,
  public.real_estate_fetch_jobs,
  public.lead_reviews
from anon, authenticated;
grant select on public.real_estate_leads, public.real_estate_fetch_jobs to authenticated;
grant select, insert, update, delete on public.lead_reviews to authenticated;
grant all on public.real_estate_leads, public.real_estate_fetch_jobs, public.lead_reviews to service_role;

create trigger real_estate_leads_updated_at
  before update on public.real_estate_leads
  for each row execute function public.set_updated_at();
create trigger lead_reviews_updated_at
  before update on public.lead_reviews
  for each row execute function public.set_updated_at();

alter table public.deals
  add constraint deals_source_lead_fkey
  foreign key (source_lead_id)
  references public.real_estate_leads(id)
  on delete set null;
