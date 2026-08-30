-- The companion fix to 20260830120000.
--
-- That migration scoped the project_inquiries POLICIES but left
-- submit_project_inquiry carrying both original defects: it resolved the
-- organization with `count(*) = 1`, which a second account makes false forever,
-- and its notification fan-out selected every owner/admin in the table with no
-- organization filter -- mailing an enquirer's name, email, phone and message
-- to every owner on the platform.
--
-- Caught by querying pg_proc for fan-outs that touch organization_members
-- without correlating on organization_id, rather than by re-reading the file.

begin;

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

  -- The company, not "the only row in the table".
  resolved_organization := private.primary_organization();

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
  from public.organization_members member
  where member.role in ('owner', 'admin')
    and member.organization_id = resolved_organization;

  return new_inquiry_id;
end;
$$;
update public.project_inquiries
set organization_id = private.primary_organization()
where organization_id is null;

-- create-or-replace preserves grants, but restate them so the migration is
-- self-contained if it is ever replayed onto a fresh database.
revoke all on function public.submit_project_inquiry(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_project_inquiry(text, text, text, text, text, text, text, text, text) to anon, authenticated;

commit;
