-- Add result column to plays table for storing WIN/LOSS/NEUTRAL status
-- This supports the new Alpha Vantage P&L backfill system

-- Add result column to plays table
ALTER TABLE public.plays 
ADD COLUMN IF NOT EXISTS result TEXT CHECK (result IN ('WIN', 'LOSS', 'NEUTRAL'));

-- Add comment for documentation
COMMENT ON COLUMN public.plays.result IS 'Trade result: WIN, LOSS, or NEUTRAL (set by P&L calculation)';

-- Create index for performance on result queries
CREATE INDEX IF NOT EXISTS plays_result_idx ON public.plays (result);

-- Drop and recreate the view to include the new result column
DROP VIEW IF EXISTS public.options_plays_dashboard;

CREATE VIEW public.options_plays_dashboard AS
SELECT 
    ticker,
    strike,
    option_type,
    expiry,
    status,
    entries,
    pnl,
    result,
    opened_at,
    closed_at
FROM public.plays
ORDER BY opened_at DESC;

-- Update the stats function to use the result column
CREATE OR REPLACE FUNCTION public.get_options_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_plays', COUNT(*),
        'open_plays', COUNT(*) FILTER (WHERE status = 'OPEN'),
        'closed_plays', COUNT(*) FILTER (WHERE status = 'CLOSED'),
        'wins', COUNT(*) FILTER (WHERE status = 'CLOSED' AND result = 'WIN'),
        'losses', COUNT(*) FILTER (WHERE status = 'CLOSED' AND result = 'LOSS'),
        'win_rate', ROUND(
            (COUNT(*) FILTER (WHERE status = 'CLOSED' AND result = 'WIN')::DECIMAL / 
             NULLIF(COUNT(*) FILTER (WHERE status = 'CLOSED'), 0)) * 100, 2
        )
    ) INTO result
    FROM public.plays;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Ensure the result column is included in RLS policies (no change needed since we're just adding a column)
-- The existing policies will automatically include the new column
