-- Security linter cleanup
-- Apply after reviewing the affected RPC call sites and storage workflows.

-- The dashboard must evaluate permissions and RLS as the querying user.
DROP VIEW IF EXISTS public.options_plays_dashboard;
CREATE VIEW public.options_plays_dashboard
  WITH (security_invoker = true)
AS
SELECT
  ticker,
  strike,
  option_type,
  expiry,
  status,
  entries,
  pnl,
  opened_at,
  closed_at,
  CASE
    WHEN status = 'CLOSED' AND pnl IS NOT NULL THEN
      CASE
        WHEN pnl LIKE '+%' THEN 'WIN'
        WHEN pnl LIKE '-%' THEN 'LOSS'
        ELSE 'NEUTRAL'
      END
    ELSE NULL
  END AS result
FROM public.plays
ORDER BY opened_at DESC;

GRANT SELECT ON public.options_plays_dashboard TO authenticated;
REVOKE SELECT ON public.options_plays_dashboard FROM anon;

-- Keep function name resolution deterministic and remove direct API execution of
-- SECURITY DEFINER functions. Triggers continue to execute normally.
DO $$
DECLARE
  function_record RECORD;
BEGIN
  FOR function_record IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, extensions',
      function_record.schema_name,
      function_record.function_name,
      function_record.arguments
    );
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      function_record.schema_name,
      function_record.function_name,
      function_record.arguments
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      function_record.schema_name,
      function_record.function_name,
      function_record.arguments
    );
  END LOOP;
END
$$;

-- Apply the same deterministic path to invoker functions as well. This removes
-- search_path warnings without changing their execution privileges.
DO $$
DECLARE
  function_record RECORD;
BEGIN
  FOR function_record IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) config
        WHERE config LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, extensions',
      function_record.schema_name,
      function_record.function_name,
      function_record.arguments
    );
  END LOOP;
END
$$;

-- These tables are user-owned workflows. The policies deliberately require an
-- authenticated owner instead of using unrestricted TRUE expressions.
ALTER TABLE public.feature_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create feature_votes" ON public.feature_votes;
DROP POLICY IF EXISTS "Anyone can create user_feedback" ON public.user_feedback;

CREATE POLICY "Authenticated users can read feedback"
  ON public.user_feedback FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can submit own feedback"
  ON public.user_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can read votes"
  ON public.feature_votes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can manage own votes"
  ON public.feature_votes FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Remove the two reported no-policy states if the tables exist in this project.
-- The policies above are intentionally explicit and do not grant anonymous access.

-- Remove unrestricted legacy write policies. The application should submit
-- donations and subscriber changes through authenticated/server-side flows.
DROP POLICY IF EXISTS "Anyone can create donations" ON public.donations;
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "System can insert login activity" ON public.login_activity;

CREATE POLICY "Users can read own login activity"
  ON public.login_activity FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert login activity"
  ON public.login_activity FOR INSERT TO service_role
  WITH CHECK (auth.role() = 'service_role');

-- Sensitive tables must never be discoverable through the public GraphQL API.
REVOKE ALL ON TABLE
  public.plaid_secrets,
  public.user_alpaca_keys,
  public.billing_customers,
  public.stripe_checkout_requests
FROM anon, authenticated;
