-- Financial Roadmap: snapshot columns on financial_profiles + user_milestones table
-- Run this in Supabase Dashboard → SQL Editor

-- ── 1. Extend financial_profiles with snapshot numbers ───────────────────────
ALTER TABLE public.financial_profiles
  ADD COLUMN IF NOT EXISTS monthly_take_home     integer,
  ADD COLUMN IF NOT EXISTS monthly_expenses      integer,
  ADD COLUMN IF NOT EXISTS high_interest_debt    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_interest_debt     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liquid_savings        integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employer_match_pct    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_hsa_access        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS snapshot_completed    boolean DEFAULT false;

-- ── 2. Milestone tracking table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_milestones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_id  text NOT NULL,
  status        text NOT NULL CHECK (status IN ('complete', 'skipped', 'in_progress')),
  completed_at  timestamptz,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(user_id, milestone_id)
);

ALTER TABLE public.user_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own milestones"
  ON public.user_milestones FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
