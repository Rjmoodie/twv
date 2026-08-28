-- SomaTech Billing and Discord Integration Schema
-- Created: September 7, 2025

-- Billing customers table to link Supabase users with Stripe customers
create table if not exists billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique not null,
  created_at timestamptz default now()
);

-- Subscriptions table to track user subscription status
create table if not exists subscriptions (
  user_id uuid references auth.users(id) on delete cascade,
  stripe_subscription_id text unique,
  plan text not null,
  status text not null,
  current_period_end timestamptz,
  updated_at timestamptz default now(),
  primary key (user_id)
);

-- Optional: store plan on your profile as a denormalized field
alter table public.profiles add column if not exists plan text;

-- Discord links table to connect Supabase users with Discord accounts
create table if not exists discord_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_user_id text unique not null,
  created_at timestamptz default now()
);

-- Discord role jobs queue for async role management
create table if not exists discord_role_jobs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('grant','revoke')),
  attempts int default 0,
  run_after timestamptz default now(),
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table billing_customers enable row level security;
alter table subscriptions enable row level security;
alter table discord_links enable row level security;
alter table discord_role_jobs enable row level security;

-- RLS Policies for billing_customers
create policy "Users can read their own billing customer data" 
  on billing_customers for select 
  using (auth.uid() = user_id);

create policy "Service role can manage billing customers" 
  on billing_customers for all 
  using (auth.role() = 'service_role');

-- RLS Policies for subscriptions
create policy "Users can read their own subscription data" 
  on subscriptions for select 
  using (auth.uid() = user_id);

create policy "Service role can manage subscriptions" 
  on subscriptions for all 
  using (auth.role() = 'service_role');

-- RLS Policies for discord_links
create policy "Users can read their own Discord links" 
  on discord_links for select 
  using (auth.uid() = user_id);

create policy "Users can manage their own Discord links" 
  on discord_links for all 
  using (auth.uid() = user_id);

create policy "Service role can manage Discord links" 
  on discord_links for all 
  using (auth.role() = 'service_role');

-- RLS Policies for discord_role_jobs
create policy "Service role can manage Discord role jobs" 
  on discord_role_jobs for all 
  using (auth.role() = 'service_role');

-- Indexes for performance
create index if not exists idx_billing_customers_stripe_id on billing_customers(stripe_customer_id);
create index if not exists idx_subscriptions_stripe_id on subscriptions(stripe_subscription_id);
create index if not exists idx_discord_links_discord_id on discord_links(discord_user_id);
create index if not exists idx_discord_role_jobs_run_after on discord_role_jobs(run_after);
create index if not exists idx_discord_role_jobs_user_id on discord_role_jobs(user_id);

-- Comments for documentation
comment on table billing_customers is 'Links Supabase users to Stripe customers';
comment on table subscriptions is 'Tracks user subscription status and billing information';
comment on table discord_links is 'Connects Supabase users with Discord accounts';
comment on table discord_role_jobs is 'Queue for async Discord role management operations';

