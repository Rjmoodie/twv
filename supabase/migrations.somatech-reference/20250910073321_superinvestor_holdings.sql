-- Create superinvestor_holdings table for investor guide functionality
CREATE TABLE IF NOT EXISTS public.superinvestor_holdings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  investor TEXT NOT NULL,
  stock TEXT NOT NULL,
  ticker TEXT NOT NULL,
  sector TEXT NOT NULL,
  quarter TEXT NOT NULL,
  position_value BIGINT,
  shares BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.superinvestor_holdings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Holdings are viewable by everyone"
ON public.superinvestor_holdings
FOR SELECT
USING (true);

-- Create indexes for performance
CREATE INDEX idx_superinvestor_holdings_investor ON public.superinvestor_holdings(investor);
CREATE INDEX idx_superinvestor_holdings_ticker ON public.superinvestor_holdings(ticker);
CREATE INDEX idx_superinvestor_holdings_quarter ON public.superinvestor_holdings(quarter);
