-- Allow multiple Plaid connections per user (replaces single-user unique constraint).
-- Access is controlled per-user via max_plaid_connections in financial_profiles.

-- ── 1. Replace unique(user_id) with unique(user_id, item_id) ─────────────────

ALTER TABLE public.plaid_connections
  DROP CONSTRAINT IF EXISTS plaid_connections_user_id_key;

ALTER TABLE public.plaid_connections
  ADD CONSTRAINT plaid_connections_user_item_key UNIQUE (user_id, item_id);

-- ── 2. Add per-user connection limit to financial_profiles ────────────────────
-- Default is 1 (standard users). Elevated users are set explicitly below.

ALTER TABLE public.financial_profiles
  ADD COLUMN IF NOT EXISTS max_plaid_connections integer NOT NULL DEFAULT 1;

-- ── 3. Grant support@somatech.pro a limit of 5 ───────────────────────────────
-- Upsert in case the profile row doesn't exist yet for this user.

INSERT INTO public.financial_profiles (user_id, max_plaid_connections)
SELECT u.id, 5
FROM auth.users u
WHERE u.email = 'support@somatech.pro'
ON CONFLICT (user_id)
  DO UPDATE SET max_plaid_connections = 5;
