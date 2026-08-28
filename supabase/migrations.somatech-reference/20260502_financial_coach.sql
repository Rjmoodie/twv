-- Financial Coach: user profile, conversation threads, and messages

create table if not exists public.financial_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  age integer,
  income_range text,           -- e.g. '<30k','30-60k','60-100k','100-200k','>200k'
  marital_status text,         -- 'single','married','partnered','divorced','widowed'
  dependents integer default 0,
  employment_type text,        -- 'employed','self-employed','business-owner','student','retired','unemployed'
  housing_status text,         -- 'renting','owning','living-with-family','other'
  primary_concern text,        -- 'saving-more','investing','buying-home','retirement','debt','tax','other'
  risk_tolerance text,         -- 'conservative','moderate','aggressive'
  current_savings_range text,  -- '<5k','5-25k','25-100k','100-500k','>500k'
  has_retirement_account boolean default false,
  has_emergency_fund boolean default false,
  completed_intake boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

create table if not exists public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.coach_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  tool_launch jsonb,           -- {type: 'rent-vs-own', prefill: {...}} when coach triggers a tool
  created_at timestamptz default now()
);

-- RLS
alter table public.financial_profiles enable row level security;
alter table public.coach_conversations enable row level security;
alter table public.coach_messages enable row level security;

create policy "users manage own profile"
  on public.financial_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage own conversations"
  on public.coach_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage own messages"
  on public.coach_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger financial_profiles_updated_at
  before update on public.financial_profiles
  for each row execute procedure public.set_updated_at();

create trigger coach_conversations_updated_at
  before update on public.coach_conversations
  for each row execute procedure public.set_updated_at();
