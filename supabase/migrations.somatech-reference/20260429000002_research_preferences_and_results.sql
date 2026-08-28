-- user_research_preferences: per-user defaults for the research engine
create table if not exists public.user_research_preferences (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade unique,
  default_tickers     text[] not null default '{}',
  preferred_goal      text check (preferred_goal in (
                        'total_return','quality_growth','dividend_income',
                        'capital_preservation','deep_value','balanced'
                      )),
  preferred_horizon   integer check (preferred_horizon between 1 and 50),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists user_research_prefs_user_idx on public.user_research_preferences(user_id);

alter table public.user_research_preferences enable row level security;

create policy "prefs: select own" on public.user_research_preferences for select using (auth.uid() = user_id);
create policy "prefs: insert own" on public.user_research_preferences for insert with check (auth.uid() = user_id);
create policy "prefs: update own" on public.user_research_preferences for update using (auth.uid() = user_id);
create policy "prefs: delete own" on public.user_research_preferences for delete using (auth.uid() = user_id);

create trigger user_research_prefs_updated_at
  before update on public.user_research_preferences
  for each row execute function public.set_updated_at();

-- Add raw_result column to research_results for full ResearchResult persistence
alter table public.research_results
  add column if not exists raw_result jsonb;
