-- Tighten RLS on discord_role_mappings and lms_course_mappings.
-- These tables contain internal tier→role/course mapping config that only
-- Edge Functions (service_role) need to read. No end-user query should hit them.

-- discord_role_mappings
DROP POLICY IF EXISTS "Authenticated users can view Discord role mappings" ON discord_role_mappings;

CREATE POLICY "Service role only: discord_role_mappings"
  ON discord_role_mappings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- lms_course_mappings
DROP POLICY IF EXISTS "Authenticated users can view LMS course mappings" ON lms_course_mappings;

CREATE POLICY "Service role only: lms_course_mappings"
  ON lms_course_mappings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
