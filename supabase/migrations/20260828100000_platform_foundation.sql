-- TW Ventures platform foundation.
--
-- This is intentionally a fresh schema, not a replay of the inherited
-- SomaTech ledger. It establishes the account, organization, membership, and
-- billing boundaries needed by every later domain migration.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public;

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'user'
    check (role in ('user', 'admin', 'super_admin')),
  subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'tier1', 'tier2', 'tier3')),
  subscription_status text not null default 'active'
    check (subscription_status in ('active', 'trialing', 'canceled', 'past_due', 'unpaid')),
  subscription_ends_at timestamptz,
  stripe_customer_id text unique,
  discord_id text unique,
  discord_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  email text,
  avatar_url text,
  bio text check (bio is null or char_length(bio) <= 1000),
  location text,
  website text,
  theme_preference text not null default 'system'
    check (theme_preference in ('light', 'dark', 'system')),
  onboarding_completed boolean not null default false,
  onboarding_step integer not null default 0 check (onboarding_step >= 0),
  onboarding_progress jsonb not null default '{}'::jsonb,
  profile_completion_score integer not null default 0
    check (profile_completion_score between 0 and 100),
  tutorial_completed boolean not null default false,
  two_factor_enabled boolean not null default false,
  email_notifications_enabled boolean not null default true,
  push_notifications_enabled boolean not null default true,
  marketing_emails_enabled boolean not null default false,
  weekly_summary_enabled boolean not null default false,
  price_alerts_enabled boolean not null default false,
  first_login_at timestamptz,
  last_login_at timestamptz,
  login_count integer not null default 0 check (login_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique
    check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('owner', 'admin', 'project_manager', 'investor', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx
  on public.organization_members (user_id, organization_id);

create or replace function private.is_organization_member(target_organization uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization
      and member.user_id = auth.uid()
  );
$$;

create or replace function private.can_manage_organization(target_organization uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization
      and member.user_id = auth.uid()
      and member.role in ('owner', 'admin', 'project_manager')
  );
$$;

create or replace function private.is_organization_admin(target_organization uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization
      and member.user_id = auth.uid()
      and member.role in ('owner', 'admin')
  );
$$;

revoke all on function private.is_organization_member(uuid) from public;
revoke all on function private.can_manage_organization(uuid) from public;
revoke all on function private.is_organization_admin(uuid) from public;
grant execute on function private.is_organization_member(uuid) to authenticated, service_role;
grant execute on function private.can_manage_organization(uuid) to authenticated, service_role;
grant execute on function private.is_organization_admin(uuid) to authenticated, service_role;

create or replace function public.create_organization(organization_name text, organization_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_organization public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if char_length(trim(organization_name)) not between 1 and 120 then
    raise exception 'Organization name must be between 1 and 120 characters';
  end if;
  if organization_slug !~ '^[a-z0-9][a-z0-9-]{2,62}$' then
    raise exception 'Organization slug must use lowercase letters, numbers, and hyphens';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (trim(organization_name), organization_slug, auth.uid())
  returning * into created_organization;

  insert into public.organization_members (organization_id, user_id, role)
  values (created_organization.id, auth.uid(), 'owner');

  return created_organization;
end;
$$;
revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;

alter table public.user_profiles enable row level security;
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy user_profiles_select_own
  on public.user_profiles for select to authenticated
  using (id = auth.uid());
create policy user_profiles_update_own
  on public.user_profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_select_own
  on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy organizations_select_member
  on public.organizations for select to authenticated
  using (private.is_organization_member(id));
create policy organizations_update_admin
  on public.organizations for update to authenticated
  using (private.is_organization_admin(id))
  with check (private.is_organization_admin(id));
create policy organizations_delete_owner
  on public.organizations for delete to authenticated
  using (
    exists (
      select 1 from public.organization_members member
      where member.organization_id = id
        and member.user_id = auth.uid()
        and member.role = 'owner'
    )
  );

create policy organization_members_select_member
  on public.organization_members for select to authenticated
  using (private.is_organization_member(organization_id));
create policy organization_members_insert_admin
  on public.organization_members for insert to authenticated
  with check (private.is_organization_admin(organization_id));
create policy organization_members_update_admin
  on public.organization_members for update to authenticated
  using (private.is_organization_admin(organization_id))
  with check (private.is_organization_admin(organization_id));
create policy organization_members_delete_admin
  on public.organization_members for delete to authenticated
  using (
    private.is_organization_admin(organization_id)
    and not (user_id = auth.uid() and role = 'owner')
  );

revoke all on
  public.user_profiles,
  public.profiles,
  public.organizations,
  public.organization_members
from anon, authenticated;
grant select on public.user_profiles to authenticated;
grant update (name, discord_id, discord_username) on public.user_profiles to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;

create table public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  plan text not null default 'free'
    check (plan in ('free', 'tier1', 'tier2', 'tier3')),
  status text not null
    check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id, updated_at desc);

create table public.processed_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create table public.usage_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_type text not null,
  month_year text not null default to_char(current_date, 'YYYY-MM')
    check (month_year ~ '^\d{4}-\d{2}$'),
  usage_count integer not null default 0 check (usage_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature_type, month_year)
);

alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.processed_webhook_events enable row level security;
alter table public.usage_tracking enable row level security;

create policy billing_customers_select_own
  on public.billing_customers for select to authenticated
  using (user_id = auth.uid());
create policy subscriptions_select_own
  on public.subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy usage_tracking_manage_own
  on public.usage_tracking for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on
  public.billing_customers,
  public.subscriptions,
  public.processed_webhook_events,
  public.usage_tracking
from anon, authenticated;
grant select on public.billing_customers, public.subscriptions to authenticated;
grant select, insert, update, delete on public.usage_tracking to authenticated;
grant all on
  public.user_profiles,
  public.profiles,
  public.organizations,
  public.organization_members,
  public.billing_customers,
  public.subscriptions,
  public.processed_webhook_events,
  public.usage_tracking
to service_role;

create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger billing_customers_updated_at
  before update on public.billing_customers
  for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger usage_tracking_updated_at
  before update on public.usage_tracking
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_id uuid;
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

  if not exists (
    select 1 from public.organization_members member where member.user_id = new.id
  ) then
    insert into public.organizations (name, slug, created_by)
    values (
      display_name || ' Workspace',
      'workspace-' || replace(new.id::text, '-', ''),
      new.id
    )
    returning id into workspace_id;

    insert into public.organization_members (organization_id, user_id, role)
    values (workspace_id, new.id, 'owner');
  end if;

  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Fresh projects are empty, but this also makes the migration safe to apply to
-- a project where Auth was enabled before the schema was installed.
do $$
declare
  existing_user auth.users%rowtype;
  workspace_id uuid;
  display_name text;
begin
  for existing_user in select * from auth.users loop
    display_name := coalesce(
      nullif(existing_user.raw_user_meta_data ->> 'full_name', ''),
      nullif(existing_user.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(existing_user.email, 'User'), '@', 1)
    );

    insert into public.user_profiles (id, email, name)
    values (existing_user.id, coalesce(existing_user.email, ''), display_name)
    on conflict (id) do nothing;

    insert into public.profiles (id, email, username)
    values (existing_user.id, existing_user.email, display_name)
    on conflict (id) do nothing;

    if not exists (
      select 1 from public.organization_members member
      where member.user_id = existing_user.id
    ) then
      insert into public.organizations (name, slug, created_by)
      values (
        display_name || ' Workspace',
        'workspace-' || replace(existing_user.id::text, '-', ''),
        existing_user.id
      )
      returning id into workspace_id;

      insert into public.organization_members (organization_id, user_id, role)
      values (workspace_id, existing_user.id, 'owner');
    end if;
  end loop;
exception when others then
  -- The trigger covers all future users. Existing-user provisioning can be
  -- retried explicitly if a hosted Auth schema differs from local Supabase.
  raise notice 'Existing Auth users require provisioning: %', sqlerrm;
end;
$$;

-- Profile photos are public assets, but only the owning user may write below
-- their UUID prefix.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_public_read
  on storage.objects for select
  using (bucket_id = 'avatars');
create policy avatars_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy avatars_update_own
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and owner_id = auth.uid()::text)
  with check (bucket_id = 'avatars' and owner_id = auth.uid()::text);
create policy avatars_delete_own
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and owner_id = auth.uid()::text);
