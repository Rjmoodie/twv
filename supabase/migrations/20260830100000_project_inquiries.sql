-- Public client-service intake. Submitting an inquiry does not create an
-- account, project, membership, or contract; administrators triage it first.

create table public.project_inquiries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  email text not null check (position('@' in email) > 1 and char_length(email) <= 320),
  phone text check (phone is null or char_length(phone) <= 40),
  company_name text check (company_name is null or char_length(company_name) <= 160),
  project_type text not null check (project_type in ('acquisition', 'development', 'construction', 'renovation', 'management', 'consultation', 'other')),
  property_address text check (property_address is null or char_length(property_address) <= 500),
  budget_range text check (budget_range is null or budget_range in ('under_100k', '100k_500k', '500k_1m', '1m_5m', '5m_plus', 'undecided')),
  desired_timeline text check (desired_timeline is null or char_length(desired_timeline) <= 240),
  message text not null check (char_length(trim(message)) between 10 and 4000),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'converted', 'declined', 'spam')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_inquiries_status_idx on public.project_inquiries (status, created_at desc);
create index project_inquiries_email_idx on public.project_inquiries (lower(email), created_at desc);
alter table public.project_inquiries enable row level security;

create policy project_inquiries_admin_read on public.project_inquiries for select to authenticated
  using (exists (select 1 from public.organization_members member where member.user_id = auth.uid() and member.role in ('owner', 'admin')));
create policy project_inquiries_admin_update on public.project_inquiries for update to authenticated
  using (exists (select 1 from public.organization_members member where member.user_id = auth.uid() and member.role in ('owner', 'admin')))
  with check (exists (select 1 from public.organization_members member where member.user_id = auth.uid() and member.role in ('owner', 'admin')));

revoke all on public.project_inquiries from anon, authenticated;
grant select, update on public.project_inquiries to authenticated;
grant all on public.project_inquiries to service_role;

create trigger project_inquiries_updated_at before update on public.project_inquiries
  for each row execute function public.set_updated_at();

create or replace function public.submit_project_inquiry(
  full_name text,
  email text,
  phone text default null,
  company_name text default null,
  project_type text default 'other',
  property_address text default null,
  budget_range text default null,
  desired_timeline text default null,
  message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_inquiry_id uuid;
  resolved_organization uuid;
  clean_email text := lower(trim(email));
  recent_count integer;
begin
  if nullif(trim(full_name), '') is null or char_length(trim(full_name)) < 2 then raise exception 'Please provide your name'; end if;
  if position('@' in clean_email) <= 1 or position(E'\n' in clean_email) > 0 or position(E'\r' in clean_email) > 0 or char_length(clean_email) > 320 then raise exception 'Please provide a valid email address'; end if;
  if project_type not in ('acquisition', 'development', 'construction', 'renovation', 'management', 'consultation', 'other') then raise exception 'Please select a valid project type'; end if;
  if nullif(trim(message), '') is null or char_length(trim(message)) < 10 then raise exception 'Please tell us a little more about your project'; end if;
  if char_length(trim(message)) > 4000 then raise exception 'Project details must be 4,000 characters or fewer'; end if;

  select count(*) into recent_count from public.project_inquiries inquiry
  where lower(inquiry.email) = clean_email and inquiry.created_at > now() - interval '1 hour';
  if recent_count >= 3 then raise exception 'We already have your request. Someone will be in touch shortly.'; end if;
  select count(*) into recent_count from public.project_inquiries inquiry where inquiry.created_at > now() - interval '1 minute';
  if recent_count >= 20 then raise exception 'Too many submissions right now. Please try again shortly.'; end if;

  if (select count(*) from public.organizations) = 1 then
    select organization.id into resolved_organization from public.organizations organization;
  end if;

  insert into public.project_inquiries (
    organization_id, full_name, email, phone, company_name, project_type,
    property_address, budget_range, desired_timeline, message
  ) values (
    resolved_organization, trim(full_name), clean_email, nullif(trim(phone), ''),
    nullif(trim(company_name), ''), project_type, nullif(trim(property_address), ''),
    budget_range, nullif(trim(desired_timeline), ''), trim(message)
  ) returning id into new_inquiry_id;

  insert into public.notification_outbox (user_id, event_type, payload, channels)
  select distinct member.user_id, 'project_inquiry_received',
    jsonb_build_object('inquiry_id', new_inquiry_id, 'full_name', trim(full_name), 'email', clean_email, 'project_type', project_type),
    array['in_app', 'email']::text[]
  from public.organization_members member where member.role in ('owner', 'admin');

  return new_inquiry_id;
end;
$$;

revoke all on function public.submit_project_inquiry(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_project_inquiry(text, text, text, text, text, text, text, text, text) to anon, authenticated;

insert into public.notification_channel_policies (
  event_type, importance, push_mode, email_mode, email_variant, email_preference_key, description
) values (
  'project_inquiry_received', 'time_sensitive', 'preference', 'required', 'internal', 'transactional_enabled',
  'A prospective client submitted a project request through the public intake form.'
) on conflict (event_type) do update set description = excluded.description, updated_at = now();

