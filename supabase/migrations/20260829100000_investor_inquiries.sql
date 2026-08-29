-- Investor inquiry capture.
--
-- There was no way for an investor to reach TW Ventures. The only inbound
-- channel was a mailto on the client-services page, and the only route into the
-- platform was an admin-initiated project invitation. This adds the front of
-- that funnel.
--
-- ── Why the shape is what it is ──────────────────────────────────────────────
--
-- Regulation D decides the architecture, not product preference:
--
--   Rule 506(b) forbids general solicitation. A public page advertising a
--   specific offering is not allowed; the issuer needs a pre-existing,
--   substantive relationship before showing one. Up to 35 non-accredited but
--   sophisticated investors may participate, and self-certification is
--   acceptable.
--
--   Rule 506(c) permits general solicitation but admits accredited investors
--   only, and self-certification is explicitly NOT sufficient. The issuer must
--   take reasonable steps to verify — income documents, net-worth
--   documentation, or written confirmation from a licensed attorney, CPA,
--   broker-dealer or investment adviser.
--
-- TW has not chosen an exemption yet, so nothing here assumes one. The public
-- page carries the firm's approach and captures interest; it shows no offering,
-- no terms and no returns, which is safe under either rule. What an inquirer
-- tells us about their own status is stored as a SELF-REPORT and is explicitly
-- not verification — see the column comment. Verification, when counsel decides
-- what it must be, hangs off accreditation_records below.

create table public.investor_inquiries (
  id uuid primary key default gen_random_uuid(),
  -- Null until an administrator routes the lead. Inbound inquiries arrive
  -- before anyone has decided which entity they belong to.
  organization_id uuid references public.organizations(id) on delete set null,
  -- Set when an administrator promotes the lead into the CRM pipeline.
  contact_id uuid references public.crm_contacts(id) on delete set null,

  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  email text not null check (position('@' in email) > 1 and char_length(email) <= 320),
  phone text check (phone is null or char_length(phone) <= 40),

  -- What the person says about themselves on a web form. This is a lead
  -- qualifier for the firm's own triage. It is NOT an accreditation
  -- determination, it never satisfies Rule 506(c) verification, and nothing in
  -- the product may treat it as though it does.
  accreditation_self_report text not null default 'unsure'
    check (accreditation_self_report in ('accredited', 'not_accredited', 'unsure')),

  investment_range text
    check (investment_range is null or investment_range in
      ('under_50k', '50k_100k', '100k_250k', '250k_500k', '500k_plus', 'undecided')),
  timeframe text
    check (timeframe is null or timeframe in ('immediate', 'three_months', 'six_months', 'exploring')),
  heard_via text check (heard_via is null or char_length(heard_via) <= 120),
  message text check (message is null or char_length(message) <= 4000),

  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'converted', 'declined', 'spam')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  internal_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.investor_inquiries.accreditation_self_report is
  'Self-reported on a public form. Never sufficient for Rule 506(c) verification.';

create index investor_inquiries_status_idx on public.investor_inquiries (status, created_at desc);
create index investor_inquiries_email_idx on public.investor_inquiries (lower(email), created_at desc);

alter table public.investor_inquiries enable row level security;

-- Inbound leads are firm-wide until routed, so any organization administrator
-- may triage them. Writes go through the RPC below, never straight from a client.
create policy investor_inquiries_admin_read on public.investor_inquiries for select to authenticated
  using (
    exists (
      select 1 from public.organization_members member
      where member.user_id = auth.uid() and member.role in ('owner', 'admin')
    )
  );
create policy investor_inquiries_admin_update on public.investor_inquiries for update to authenticated
  using (
    exists (
      select 1 from public.organization_members member
      where member.user_id = auth.uid() and member.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members member
      where member.user_id = auth.uid() and member.role in ('owner', 'admin')
    )
  );

revoke all on public.investor_inquiries from anon, authenticated;
grant select, update on public.investor_inquiries to authenticated;
grant all on public.investor_inquiries to service_role;

create trigger investor_inquiries_updated_at before update on public.investor_inquiries
  for each row execute function public.set_updated_at();

-- ── Submission ───────────────────────────────────────────────────────────────
--
-- Anonymous callers reach this and nothing else. The table itself grants no
-- insert to anon, so the only way in is through these validations.

create or replace function public.submit_investor_inquiry(
  full_name text,
  email text,
  phone text default null,
  accreditation_self_report text default 'unsure',
  investment_range text default null,
  timeframe text default null,
  heard_via text default null,
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
  clean_email text;
  recent_count integer;
begin
  clean_email := lower(trim(email));

  if nullif(trim(full_name), '') is null or char_length(trim(full_name)) < 2 then
    raise exception 'Please provide your name';
  end if;

  -- Same guard the CRM contact path uses: reject header-injection attempts as
  -- well as malformed addresses, because this value ends up in outbound mail.
  if position('@' in clean_email) <= 1
     or position(E'\n' in clean_email) > 0
     or position(E'\r' in clean_email) > 0
     or char_length(clean_email) > 320 then
    raise exception 'Please provide a valid email address';
  end if;

  if accreditation_self_report not in ('accredited', 'not_accredited', 'unsure') then
    raise exception 'Invalid accreditation selection';
  end if;

  -- Rate limit. The endpoint is public, so both a single address hammering it
  -- and a broad flood have to be bounded, or the triage queue becomes useless.
  select count(*) into recent_count
  from public.investor_inquiries
  where lower(public.investor_inquiries.email) = clean_email
    and public.investor_inquiries.created_at > now() - interval '1 hour';
  if recent_count >= 3 then
    raise exception 'We already have your enquiry. Someone will be in touch shortly.';
  end if;

  select count(*) into recent_count
  from public.investor_inquiries
  where public.investor_inquiries.created_at > now() - interval '1 minute';
  if recent_count >= 20 then
    raise exception 'Too many submissions right now. Please try again shortly.';
  end if;

  -- Attach to the organization when the answer is unambiguous. With none or
  -- more than one, routing is a human decision and the lead stays unassigned
  -- rather than being filed against an arbitrary entity.
  if (select count(*) from public.organizations) = 1 then
    select organization.id into resolved_organization from public.organizations organization;
  else
    resolved_organization := null;
  end if;

  insert into public.investor_inquiries (
    organization_id, full_name, email, phone, accreditation_self_report,
    investment_range, timeframe, heard_via, message
  ) values (
    resolved_organization,
    trim(full_name),
    clean_email,
    nullif(trim(phone), ''),
    accreditation_self_report,
    investment_range,
    timeframe,
    nullif(trim(heard_via), ''),
    nullif(trim(message), '')
  )
  returning id into new_inquiry_id;

  -- Tell the administrators. Reuses the existing outbox and dispatcher rather
  -- than introducing a second delivery path.
  insert into public.notification_outbox (user_id, event_type, payload, channels)
  select distinct member.user_id,
         'investor_inquiry_received',
         jsonb_build_object(
           'inquiry_id', new_inquiry_id,
           'full_name', trim(full_name),
           'email', clean_email,
           'accreditation_self_report', accreditation_self_report,
           'investment_range', investment_range
         ),
         array['in_app', 'email']::text[]
  from public.organization_members member
  where member.role in ('owner', 'admin');

  return new_inquiry_id;
end;
$$;

revoke all on function public.submit_investor_inquiry(text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_investor_inquiry(text, text, text, text, text, text, text, text) to anon, authenticated;

insert into public.notification_channel_policies (
  event_type, importance, push_mode, email_mode, email_variant, email_preference_key
) values (
  'investor_inquiry_received', 'time_sensitive', 'preference', 'required', 'internal', 'transactional_enabled'
) on conflict (event_type) do nothing;

-- ── Accreditation ────────────────────────────────────────────────────────────
--
-- Modelled now, enforced when counsel picks the exemption. Getting the columns
-- right today costs nothing; adding them after investors exist means
-- backfilling a compliance record, which is the wrong time to be guessing.
--
-- `method` carries the distinction that matters: self_certification is the
-- 506(b) path and is NOT sufficient under 506(c). The document and third-party
-- methods are. high_minimum_representation reflects the SEC's 2025 guidance
-- allowing written representations alone above $200k individual / $1m entity
-- minimums.

create table public.accreditation_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  status text not null default 'unverified'
    check (status in ('unverified', 'pending_review', 'verified', 'expired', 'rejected')),
  method text
    check (method is null or method in (
      'self_certification',
      'income_documents',
      'net_worth_documents',
      'third_party_letter',
      'high_minimum_representation'
    )),
  basis text
    check (basis is null or basis in ('income', 'net_worth', 'professional_certification', 'entity')),

  verified_at timestamptz,
  -- Verification goes stale. Third-party confirmations are conventionally
  -- treated as good for 90 days, and income tests rest on the two most recent
  -- years, so a record without an expiry is a record nobody will revisit.
  expires_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  -- A verified record must say how and when, or it is an assertion rather than
  -- evidence.
  check (status <> 'verified' or (method is not null and verified_at is not null))
);

comment on table public.accreditation_records is
  'Compliance record. Gating is not yet switched on — the exemption is undecided.';
comment on column public.accreditation_records.method is
  'self_certification satisfies 506(b) only. 506(c) requires a document or third-party method.';

create index accreditation_records_expiry_idx
  on public.accreditation_records (organization_id, status, expires_at);

alter table public.accreditation_records enable row level security;

create policy accreditation_own_read on public.accreditation_records for select to authenticated
  using (user_id = auth.uid() or private.is_organization_admin(organization_id));
create policy accreditation_admin_manage on public.accreditation_records for all to authenticated
  using (private.is_organization_admin(organization_id))
  with check (private.is_organization_admin(organization_id));

revoke all on public.accreditation_records from anon, authenticated;
grant select on public.accreditation_records to authenticated;
grant all on public.accreditation_records to service_role;

create trigger accreditation_records_updated_at before update on public.accreditation_records
  for each row execute function public.set_updated_at();
