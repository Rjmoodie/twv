-- P0 fixes: role column on user_profiles + webhook idempotency table
-- Timestamp: 2026-03-15

-- 1. Add role column to user_profiles (default 'user')
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin', 'super_admin'));

-- 2. Set admin role for the known admin account
UPDATE public.user_profiles
  SET role = 'admin'
  WHERE email = 'rodzrj@gmail.com';

-- 3. Webhook idempotency table — prevents double-processing on Stripe retries
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  event_id   TEXT        PRIMARY KEY,
  event_type TEXT        NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only the service role (edge functions) may touch this table
CREATE POLICY "Service role can manage webhook events"
  ON public.processed_webhook_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- 4. Index to speed up subscription tier lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
