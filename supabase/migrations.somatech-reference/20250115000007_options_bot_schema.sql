-- Options Trading Bot Schema for SomaTech
-- Creates tables for Discord options trading bot integration

-- Options plays table
CREATE TABLE IF NOT EXISTS public.plays (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  strike NUMERIC NOT NULL,
  option_type TEXT NOT NULL CHECK (option_type IN ('C','P')),
  expiry DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN','ADDED','CLOSED')) DEFAULT 'OPEN',
  thread_id BIGINT,
  main_msg_id BIGINT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  entries TEXT DEFAULT '',
  pnl TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helpful indexes for performance
CREATE INDEX IF NOT EXISTS plays_lookup_idx ON public.plays (ticker, strike, option_type, status);
CREATE INDEX IF NOT EXISTS plays_thread_idx ON public.plays (thread_id);
CREATE INDEX IF NOT EXISTS plays_opened_idx ON public.plays (opened_at);
CREATE INDEX IF NOT EXISTS plays_closed_idx ON public.plays (closed_at);
CREATE INDEX IF NOT EXISTS plays_ticker_idx ON public.plays (ticker);
CREATE INDEX IF NOT EXISTS plays_status_idx ON public.plays (status);

-- Enable RLS
ALTER TABLE public.plays ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
CREATE POLICY "Service role can manage plays" ON public.plays
    FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read plays (for dashboard)
CREATE POLICY "Authenticated users can read plays" ON public.plays
    FOR SELECT USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT ALL ON public.plays TO service_role;
GRANT SELECT ON public.plays TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.plays IS 'Options trading plays tracked by Discord bot';
COMMENT ON COLUMN public.plays.ticker IS 'Stock ticker symbol (e.g., AMD)';
COMMENT ON COLUMN public.plays.strike IS 'Option strike price';
COMMENT ON COLUMN public.plays.option_type IS 'Call (C) or Put (P)';
COMMENT ON COLUMN public.plays.expiry IS 'Option expiration date';
COMMENT ON COLUMN public.plays.status IS 'Current status: OPEN, ADDED, or CLOSED';
COMMENT ON COLUMN public.plays.thread_id IS 'Discord thread ID for this play';
COMMENT ON COLUMN public.plays.main_msg_id IS 'Discord message ID for the main play message';
COMMENT ON COLUMN public.plays.entries IS 'Additional entries/adds to the position';
COMMENT ON COLUMN public.plays.pnl IS 'Profit/Loss information when closed';

-- Create a view for public dashboard (read-only)
CREATE OR REPLACE VIEW public.options_plays_dashboard AS
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
    END as result
FROM public.plays
ORDER BY opened_at DESC;

-- Grant access to the view
GRANT SELECT ON public.options_plays_dashboard TO authenticated;
GRANT SELECT ON public.options_plays_dashboard TO anon;

-- Create function to get play statistics
CREATE OR REPLACE FUNCTION public.get_options_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_plays', COUNT(*),
        'open_plays', COUNT(*) FILTER (WHERE status = 'OPEN'),
        'closed_plays', COUNT(*) FILTER (WHERE status = 'CLOSED'),
        'wins', COUNT(*) FILTER (WHERE status = 'CLOSED' AND pnl LIKE '+%'),
        'losses', COUNT(*) FILTER (WHERE status = 'CLOSED' AND pnl LIKE '-%'),
        'win_rate', ROUND(
            (COUNT(*) FILTER (WHERE status = 'CLOSED' AND pnl LIKE '+%')::DECIMAL / 
             NULLIF(COUNT(*) FILTER (WHERE status = 'CLOSED'), 0)) * 100, 2
        )
    ) INTO result
    FROM public.plays;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_options_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_options_stats() TO anon;
