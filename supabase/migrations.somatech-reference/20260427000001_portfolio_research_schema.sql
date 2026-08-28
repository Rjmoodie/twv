-- Portfolio & Research Engine Schema
-- Phase 1: Core tables for goal-based portfolio management and EDGAR-backed research

-- ─── Portfolios ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS portfolios (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  description                 TEXT,
  is_default                  BOOLEAN NOT NULL DEFAULT false,

  -- IPS / Allocation Policy
  goal                        TEXT NOT NULL CHECK (goal IN (
                                'total_return','quality_growth','dividend_income',
                                'capital_preservation','deep_value','balanced'
                              )),
  horizon_years               INTEGER NOT NULL CHECK (horizon_years BETWEEN 1 AND 50),
  risk_tolerance              SMALLINT NOT NULL CHECK (risk_tolerance BETWEEN 1 AND 5),
  risk_capacity               SMALLINT NOT NULL CHECK (risk_capacity BETWEEN 1 AND 5),
  rebalance_threshold_pct     DECIMAL(5,2) NOT NULL DEFAULT 5.0,
  min_conviction_score        DECIMAL(4,2) NOT NULL DEFAULT 6.0,

  -- Position constraints
  max_single_position_pct     DECIMAL(5,2) NOT NULL DEFAULT 10.0,
  max_sector_concentration_pct DECIMAL(5,2) NOT NULL DEFAULT 30.0,
  min_positions               INTEGER NOT NULL DEFAULT 10,
  max_positions               INTEGER NOT NULL DEFAULT 30,
  exclude_sectors             TEXT[],

  initial_capital             DECIMAL(15,2),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);

-- Enforce only one default portfolio per user
CREATE UNIQUE INDEX idx_portfolios_user_default
  ON portfolios(user_id)
  WHERE is_default = true;

-- ─── Portfolio Allocations (target by bucket) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS portfolio_allocations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id  UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  bucket        TEXT NOT NULL CHECK (bucket IN (
                  'US_EQUITY_LARGE','US_EQUITY_SMALL',
                  'INTL_EQUITY_DEVELOPED','INTL_EQUITY_EMERGING',
                  'FIXED_INCOME_INVESTMENT_GRADE','FIXED_INCOME_HIGH_YIELD',
                  'REAL_ASSETS','ALTERNATIVES','CASH'
                )),
  target_pct    DECIMAL(5,2) NOT NULL CHECK (target_pct BETWEEN 0 AND 100),
  min_pct       DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (min_pct >= 0),
  max_pct       DECIMAL(5,2) NOT NULL DEFAULT 100 CHECK (max_pct <= 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portfolio_id, bucket)
);

CREATE INDEX idx_portfolio_allocations_portfolio ON portfolio_allocations(portfolio_id);

-- ─── Portfolio Holdings (actual positions) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  ticker          TEXT NOT NULL,
  company_name    TEXT,
  bucket          TEXT NOT NULL CHECK (bucket IN (
                    'US_EQUITY_LARGE','US_EQUITY_SMALL',
                    'INTL_EQUITY_DEVELOPED','INTL_EQUITY_EMERGING',
                    'FIXED_INCOME_INVESTMENT_GRADE','FIXED_INCOME_HIGH_YIELD',
                    'REAL_ASSETS','ALTERNATIVES','CASH'
                  )),
  shares          DECIMAL(15,6),
  cost_basis      DECIMAL(12,4),      -- per share
  current_price   DECIMAL(12,4),
  market_value    DECIMAL(15,2),
  target_pct      DECIMAL(5,2),       -- desired weight in portfolio
  current_pct     DECIMAL(5,2),       -- actual weight (computed)
  notes           TEXT,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portfolio_id, ticker)
);

CREATE INDEX idx_portfolio_holdings_portfolio ON portfolio_holdings(portfolio_id);
CREATE INDEX idx_portfolio_holdings_ticker ON portfolio_holdings(ticker);

-- ─── Research Scores (EDGAR-backed, cached per ticker) ────────────────────────

CREATE TABLE IF NOT EXISTS research_scores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker              TEXT NOT NULL UNIQUE,
  company_name        TEXT,
  cik                 TEXT,
  sector              TEXT,
  industry            TEXT,

  -- Piotroski / Quality
  piotroski_score     SMALLINT CHECK (piotroski_score BETWEEN 0 AND 9),
  quality_composite   DECIMAL(4,2),   -- 0–10

  -- Value
  earnings_yield      DECIMAL(8,4),   -- EBIT / EV
  return_on_capital   DECIMAL(8,4),   -- Greenblatt ROIC
  fcf_yield           DECIMAL(8,4),
  ev_ebit             DECIMAL(8,2),
  dcf_upside_pct      DECIMAL(8,4),
  value_composite     DECIMAL(4,2),   -- 0–10

  -- Growth
  revenue_cagr_3yr    DECIMAL(8,4),
  revenue_cagr_5yr    DECIMAL(8,4),
  roiic               DECIMAL(8,4),
  growth_composite    DECIMAL(4,2),   -- 0–10

  -- Earnings Quality
  ocf_to_ni           DECIMAL(8,4),
  accruals_ratio      DECIMAL(8,4),
  eq_composite        DECIMAL(4,2),   -- 0–10

  -- Moat
  moat_composite      DECIMAL(4,2),   -- 0–5

  -- Flags
  flags               TEXT[],

  -- Raw normalized financials for recomputation
  raw_financials      JSONB,

  -- Metadata
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_as_of          TEXT            -- fiscal period end date e.g. "2024-09-28"
);

CREATE INDEX idx_research_scores_ticker ON research_scores(ticker);
CREATE INDEX idx_research_scores_computed_at ON research_scores(computed_at);
CREATE INDEX idx_research_scores_piotroski ON research_scores(piotroski_score);
CREATE INDEX idx_research_scores_quality ON research_scores(quality_composite);

-- ─── Research Results (goal-filtered queue per portfolio) ─────────────────────

CREATE TABLE IF NOT EXISTS research_results (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id          UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  ticker                TEXT NOT NULL,
  composite_score       DECIMAL(4,2),
  goal_alignment_pct    DECIMAL(5,2),
  passes_filters        BOOLEAN DEFAULT false,
  bucket                TEXT,
  rank_in_bucket        INTEGER,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portfolio_id, ticker)
);

CREATE INDEX idx_research_results_portfolio ON research_results(portfolio_id);
CREATE INDEX idx_research_results_score ON research_results(composite_score DESC);

-- ─── RLS Policies ─────────────────────────────────────────────────────────────

ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_results ENABLE ROW LEVEL SECURITY;

-- Portfolios: user owns their own
CREATE POLICY "portfolios_select_own" ON portfolios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "portfolios_insert_own" ON portfolios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "portfolios_update_own" ON portfolios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "portfolios_delete_own" ON portfolios FOR DELETE USING (auth.uid() = user_id);

-- Allocations: scoped through portfolio ownership
CREATE POLICY "allocations_select_own" ON portfolio_allocations FOR SELECT
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));
CREATE POLICY "allocations_insert_own" ON portfolio_allocations FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));
CREATE POLICY "allocations_update_own" ON portfolio_allocations FOR UPDATE
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));
CREATE POLICY "allocations_delete_own" ON portfolio_allocations FOR DELETE
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

-- Holdings: scoped through portfolio ownership
CREATE POLICY "holdings_select_own" ON portfolio_holdings FOR SELECT
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));
CREATE POLICY "holdings_insert_own" ON portfolio_holdings FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));
CREATE POLICY "holdings_update_own" ON portfolio_holdings FOR UPDATE
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));
CREATE POLICY "holdings_delete_own" ON portfolio_holdings FOR DELETE
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

-- Research scores: readable by all authenticated users (shared cache), writable by auth
CREATE POLICY "research_scores_select_auth" ON research_scores FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "research_scores_insert_auth" ON research_scores FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "research_scores_update_auth" ON research_scores FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Research results: scoped through portfolio ownership
CREATE POLICY "research_results_select_own" ON research_results FOR SELECT
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));
CREATE POLICY "research_results_insert_own" ON research_results FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));
CREATE POLICY "research_results_update_own" ON research_results FOR UPDATE
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));
CREATE POLICY "research_results_delete_own" ON research_results FOR DELETE
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER portfolio_holdings_updated_at
  BEFORE UPDATE ON portfolio_holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
