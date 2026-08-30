-- TW Ventures is one company, not a platform hosting many.
--
-- The schema was built org-scoped -- which is right, and worth keeping -- but
-- three pieces were written as though exactly one organization would ever
-- exist, while `handle_new_user` minted a fresh one on every signup. Those two
-- assumptions are incompatible, and together they leak.
--
--   1. `investor_inquiries` / `project_inquiries` read+update policies asked
--      "is this user an owner or admin of ANYTHING", never correlating to the
--      row's organization_id. Because every signup became the owner of its own
--      auto-created workspace, that predicate was true for every account that
--      had ever registered -- so any user could read and edit every investor
--      lead: name, email, phone, accreditation, investment range, message.
--
--   2. The notification fan-out selected every owner/admin in the database with
--      no organization filter, mailing those details to all of them.
--
--   3. `submit_investor_inquiry` attached a lead to an organization only when
--      `count(*) = 1`. The second signup made that false forever, so every
--      subsequent lead filed with a null organization -- which also meant
--      fixing (1) alone would have made existing leads invisible to everyone.
--
-- This migration settles the model: one organization, membership by invitation.

begin;

-- ── 1. Name the organization that is the company ────────────────────────────
-- A flag on the row rather than a settings table: it is self-describing, and
-- the partial unique index makes "more than one primary" unrepresentable.

alter table public.organizations
  add column if not exists is_primary boolean not null default false;

create unique index if not exists organizations_one_primary
  on public.organizations (is_primary) where is_primary;

-- Backfill: the org holding the real work. Most projects wins; oldest breaks a
-- tie. Skipped entirely if one is already marked.
update public.organizations
set is_primary = true
where id = (
  select candidate.id
  from public.organizations candidate
  left join public.projects project on project.organization_id = candidate.id
  group by candidate.id, candidate.created_at
  order by count(project.id) desc, candidate.created_at asc
  limit 1
)
and not exists (select 1 from public.organizations existing where existing.is_primary);

create or replace function private.primary_organization()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.organizations where is_primary limit 1;
$$;
revoke all on function private.primary_organization() from public, anon, authenticated;

-- ── 2. Stop minting an organization per signup ──────────────────────────────
-- Access here is by invitation. A new account with no membership sees the
-- shell with every gated module locked, which is what the persona rules
-- already describe -- rather than becoming the owner of an empty workspace and
-- reading as fully privileged.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, 'User'), '@', 1)
  );

  insert into public.user_profiles (id, email, name)
  values (new.id, coalesce(new.email, ''), display_name)
  on conflict (id) do nothing;

  insert into public.profiles (id, email, username)
  values (new.id, new.email, display_name)
  on conflict (id) do nothing;

  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ── 3. Give existing leads an organization ──────────────────────────────────
-- Must run before the policies below, or rows with a null organization_id
-- become unreadable by anyone.

update public.investor_inquiries
set organization_id = private.primary_organization()
where organization_id is null;


-- ── 4. Scope the inquiry policies to the row's organization ─────────────────
-- `is_organization_admin(organization_id)` is the helper crm_contacts already
-- uses; these tables simply were not using it.

drop policy if exists investor_inquiries_admin_read   on public.investor_inquiries;
drop policy if exists investor_inquiries_admin_update on public.investor_inquiries;

create policy investor_inquiries_admin_read on public.investor_inquiries
  for select to authenticated
  using (private.is_organization_admin(organization_id));

create policy investor_inquiries_admin_update on public.investor_inquiries
  for update to authenticated
  using (private.is_organization_admin(organization_id))
  with check (private.is_organization_admin(organization_id));

-- ── 5. Fan out to the right organization only ───────────────────────────────
-- Same validation as before; the changes are the organization resolution and
-- the `where` on the notification select.

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

  -- The company, not "the only row in the table". Counting organizations broke
  -- the moment a second account existed.
  resolved_organization := private.primary_organization();

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

  -- Tell that organization's administrators -- not every owner in the table.
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
  where member.role in ('owner', 'admin')
    and member.organization_id = resolved_organization;

  return new_inquiry_id;
end;
$$;

revoke all on function public.submit_investor_inquiry(text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_investor_inquiry(text, text, text, text, text, text, text, text) to anon, authenticated;

-- ── 6. Upgrade a role rather than silently keeping the lesser one ───────────
-- accept_project_invitation upserted membership `on conflict do nothing`, so
-- someone invited as viewer first and project_manager later kept viewer: they
-- saw the portfolio controls and every publish failed on RLS.

create or replace function private.organization_role_rank(role_name text)
returns integer
language sql
immutable
as $$
  select case role_name
    when 'owner' then 5 when 'admin' then 4 when 'project_manager' then 3
    when 'investor' then 2 else 1 end;
$$;


-- project_inquiries carries the identical defect and is already applied.
drop policy if exists project_inquiries_admin_read   on public.project_inquiries;
drop policy if exists project_inquiries_admin_update on public.project_inquiries;

create policy project_inquiries_admin_read on public.project_inquiries
  for select to authenticated
  using (private.is_organization_admin(organization_id));

create policy project_inquiries_admin_update on public.project_inquiries
  for update to authenticated
  using (private.is_organization_admin(organization_id))
  with check (private.is_organization_admin(organization_id));

update public.project_inquiries
set organization_id = private.primary_organization()
where organization_id is null;

-- ── 7. Apply the rank: an invitation may raise a role, never lower it ───────

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
  on conflict (organization_id, user_id) do update
    set role = excluded.role
    where private.organization_role_rank(excluded.role)
        > private.organization_role_rank(public.organization_members.role);

  insert into public.project_members (project_id, organization_id, user_id, role, invited_by)
  values (invitation.project_id, invitation.organization_id, auth.uid(), invitation.role, invitation.invited_by)
  on conflict (project_id, user_id) do update set role = excluded.role;

  update public.project_invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = invitation.id;
  return invitation.role;
end;
$$;

revoke all on function public.accept_project_invitation(text) from public, anon, authenticated;
grant execute on function public.accept_project_invitation(text) to authenticated;

commit;
