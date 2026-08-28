-- Fix RLS policies for plays table to allow dashboard access
-- This migration ensures anonymous users can read plays for the dashboard

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage plays" ON public.plays;
DROP POLICY IF EXISTS "Authenticated users can read plays" ON public.plays;
DROP POLICY IF EXISTS "Users can read plays" ON public.plays;

-- Create new policies
-- Service role can do everything (for Discord bot)
CREATE POLICY "Service role can manage plays" ON public.plays
    FOR ALL USING (auth.role() = 'service_role');

-- Allow anyone to read plays (for dashboard)
CREATE POLICY "Anyone can read plays" ON public.plays
    FOR SELECT USING (true);

-- Grant permissions to all roles
GRANT ALL ON public.plays TO service_role;
GRANT SELECT ON public.plays TO authenticated;
GRANT SELECT ON public.plays TO anon;

-- Ensure the table exists and is accessible
DO $$
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'plays' AND table_schema = 'public') THEN
        RAISE NOTICE 'plays table exists and policies have been updated';
    ELSE
        RAISE NOTICE 'plays table does not exist - this migration assumes the table was created by previous migrations';
    END IF;
END $$;

