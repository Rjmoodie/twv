-- Tool sessions: captures what users model in planning tools.
-- The Financial Coach reads recent sessions to give contextually grounded advice.

create table if not exists public.tool_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  tool        text not null,             -- e.g. 'retirement-planning', 'business-valuation'
  summary     text not null,             -- plain-English summary injected into Coach system prompt
  key_outputs jsonb not null default '{}', -- key metrics for potential structured display
  created_at  timestamptz not null default now()
);

alter table public.tool_sessions enable row level security;

-- Users can read and write their own sessions
create policy "Users manage own tool sessions"
  on public.tool_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Service role (edge functions) has full access for Coach context fetch
create policy "Service role full access: tool_sessions"
  on public.tool_sessions for all
  to service_role using (true) with check (true);

-- Fast lookup: most-recent sessions per user (used by Coach on every message)
create index if not exists idx_tool_sessions_user_created
  on public.tool_sessions (user_id, created_at desc);
