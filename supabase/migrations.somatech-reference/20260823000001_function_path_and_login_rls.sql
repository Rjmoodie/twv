-- Follow-up cleanup for the remaining function-path and login-activity warnings.

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

ALTER TABLE public.login_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "System can insert login activity" ON public.login_activity;
DROP POLICY IF EXISTS "Users can read own login activity" ON public.login_activity;
DROP POLICY IF EXISTS "Service role can insert login activity" ON public.login_activity;

CREATE POLICY "Users can read own login activity"
  ON public.login_activity FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert login activity"
  ON public.login_activity FOR INSERT TO service_role
  WITH CHECK (auth.role() = 'service_role');
