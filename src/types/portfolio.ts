// ─── Goal & Bucket Enumerations ─────────────────────────────────────────────

export type GoalType =
  | 'total_return'
  | 'quality_growth'
  | 'dividend_income'
  | 'capital_preservation'
  | 'deep_value'
  | 'balanced'

export type AssetBucket =
  | 'US_EQUITY_LARGE'
  | 'US_EQUITY_SMALL'
  | 'INTL_EQUITY_DEVELOPED'
  | 'INTL_EQUITY_EMERGING'
  | 'FIXED_INCOME_INVESTMENT_GRADE'
  | 'FIXED_INCOME_HIGH_YIELD'
  | 'REAL_ASSETS'
  | 'ALTERNATIVES'
  | 'CASH'

// ─── Allocation Policy (IPS equivalent) ─────────────────────────────────────

export interface AllocationTarget {
  bucket: AssetBucket
  target_pct: number
  min_pct: number
  max_pct: number
}

export interface PolicyConstraints {
  max_single_position_pct: number
  max_sector_concentration_pct: number
  min_positions: number
  max_positions: number
  exclude_sectors?: string[]
}

export interface AllocationPolicy {
  goal: GoalType
  horizon_years: number
  risk_tolerance: 1 | 2 | 3 | 4 | 5
  risk_capacity: 1 | 2 | 3 | 4 | 5
  target_allocations: AllocationTarget[]
  constraints: PolicyConstraints
  rebalance_threshold_pct: number
  min_conviction_score: number
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export interface Portfolio {
  id: string
  user_id: string
  name: string
  description?: string
  is_default: boolean
  goal: GoalType
  horizon_years: number
  risk_tolerance: number
  risk_capacity: number
  rebalance_threshold_pct: number
  min_conviction_score: number
  max_single_position_pct: number
  max_sector_concentration_pct: number
  min_positions: number
  max_positions: number
  exclude_sectors?: string[]
  initial_capital?: number
  investment_goal_id?: string
  target_amount?: number
  monthly_contribution?: number
  created_at: string
  updated_at: string
  allocations?: AllocationTarget[]
  holdings?: PortfolioHolding[]
}

export interface CreatePortfolioInput {
  name: string
  description?: string
  goal: GoalType
  horizon_years: number
  risk_tolerance: 1 | 2 | 3 | 4 | 5
  risk_capacity: 1 | 2 | 3 | 4 | 5
  initial_capital?: number
  investment_goal_id?: string
  target_amount?: number
  monthly_contribution?: number
  target_allocations: AllocationTarget[]
  constraints?: Partial<PolicyConstraints>
}

export interface PortfolioHolding {
  id: string
  portfolio_id: string
  ticker: string
  company_name?: string
  bucket: AssetBucket
  shares?: number
  cost_basis?: number
  current_price?: number
  market_value?: number
  target_pct?: number
  current_pct?: number
  notes?: string
  source?: 'manual' | 'alpaca' | 'schwab'
  provider_data_as_of?: string
  classification_source?: 'user' | 'inferred'
  is_stale?: boolean
  added_at: string
  updated_at: string
}

// ─── EDGAR Normalized Financials ─────────────────────────────────────────────

export interface AnnualFinancials {
  fiscal_year: number
  period_end: string
  revenue: number | null
  gross_profit: number | null
  operating_income: number | null
  net_income: number | null
  operating_cf: number | null
  capex: number | null
  free_cash_flow: number | null
  total_assets: number | null
  current_assets: number | null
  current_liabilities: number | null
  long_term_debt: number | null
  short_term_debt: number | null
  total_equity: number | null
  cash: number | null
  ppe_net: number | null
  shares_outstanding: number | null
  rd_expense: number | null
  interest_expense: number | null
  dividends_paid: number | null
  da_expense: number | null
  tax_expense: number | null
  pretax_income: number | null
}

export interface NormalizedFinancials {
  ticker: string
  cik: string
  company_name: string
  annual: AnnualFinancials[]   // sorted desc by fiscal_year, latest first
  market_cap?: number
  current_price?: number
  beta?: number
  sector?: string
  industry?: string
  week52_high?: number
  week52_low?: number
  ma_200day?: number
  analyst_target?: number
  /**
   * When the quote was last true. The provider is a free-tier end-of-day feed
   * that explicitly does not represent itself as real-time, and the response is
   * cached, so a price rendered without this reads as live when it is not.
   */
  price_as_of?: string
  /** Provider string, so the screen can attribute the number it is showing. */
  price_provider?: string
  /**
   * When the Overview-derived fields — 52w range, 200d MA, analyst target —
   * were fetched. They cache on a longer cycle than the quote, so every ratio
   * combining them with the price mixes two different moments.
   */
  market_stats_as_of?: string
}

// ─── Scoring Results ──────────────────────────────────────────────────────────

export interface QualityScoreResult {
  // Piotroski signals (each 0 or 1)
  f1_roa_positive: boolean
  f2_ocf_positive: boolean
  f3_roa_improving: boolean
  f4_accruals_clean: boolean
  f5_leverage_decreasing: boolean
  f6_liquidity_improving: boolean
  f7_no_dilution: boolean
  f8_gross_margin_improving: boolean
  f9_asset_turnover_improving: boolean
  piotroski: number              // 0–9 sum of signals
  roic_5yr_avg: number | null
  fcf_consistency: number | null // fraction of last 10 years with positive FCF
  composite: number              // 0–10 normalized
}

export interface ValueScoreResult {
  /** Share of this score's inputs that were actually available, 0–1. A 7.0 from
   *  five metrics and a 7.0 from one are not the same claim. */
  coverage?: number
  earnings_yield: number | null    // EBIT / EV
  return_on_capital: number | null // Greenblatt ROIC: EBIT / (NWC + Fixed Assets)
  dcf_upside_pct: number | null
  fcf_yield: number | null
  ev_ebit: number | null
  composite: number                // 0–10 normalized
}

export interface GrowthScoreResult {
  /** Share of this score's inputs that were actually available, 0–1. A 7.0 from
   *  five metrics and a 7.0 from one are not the same claim. */
  coverage?: number
  revenue_cagr_3yr: number | null
  revenue_cagr_5yr: number | null
  reinvestment_rate: number | null // (CapEx + R&D - D&A) / Revenue
  roiic: number | null             // ΔOperating Income / ΔInvested Capital
  composite: number                // 0–10 normalized
}

export interface EarningsQualityResult {
  /** Share of this score's inputs that were available, 0–1. */
  coverage?: number
  ocf_to_ni: number | null         // OCF / Net Income; target > 1
  accruals_ratio: number | null    // (NI - FCF) / Avg Assets; target < 0.05
  composite: number                // 0–10 normalized
}

export interface MoatScoreResult {
  gross_margin_stability: number | null  // 1 - std_dev(GM%) over 10yr
  roic_vs_wacc_years: number | null      // years ROIC > WACC in last 5
  composite: number                      // 0–5
}

export interface DividendScoreResult {
  fcf_payout_ratio: number | null    // |dividends_paid| / FCF — lower is safer
  dividend_cagr_5yr: number | null   // 5yr dividend growth rate
  dividend_consistency: number | null // fraction of last 5 years with dividends paid
  composite: number                  // 0–10
}

// ─── Research Filter ──────────────────────────────────────────────────────────

export interface ResearchFilter {
  min_piotroski?: number
  min_roic_pct?: number
  min_revenue_cagr_3yr?: number
  min_moat_score?: number
  max_pe?: number
  earnings_quality_min?: number
  max_ev_ebit?: number
  min_dcf_upside_pct?: number
  min_fcf_yield?: number
  min_dividend_yield?: number
  max_fcf_payout_ratio?: number
  min_dividend_growth_5yr?: number
  chowder_rule_min?: number
  max_beta?: number
  max_debt_to_equity?: number
  min_current_ratio?: number
  horizon_boost: string[]
}

// ─── Price Context ────────────────────────────────────────────────────────────

export interface PriceContextResult {
  /** When the quote was last true; the feed is end-of-day and cached. */
  price_as_of?:       string | null
  price_provider?:    string | null
  /** When the 52w range / 200d MA / analyst target were fetched. */
  market_stats_as_of?: string | null
  current_price:      number | null
  week52_high:        number | null
  week52_low:         number | null
  week52_position_pct: number | null  // 0–100: where price sits in 52w range
  ma_200day:          number | null
  above_200d_ma:      boolean | null  // null = no data
  analyst_target:     number | null
  analyst_upside_pct: number | null   // (target - price) / price
}

// ─── Valuation ────────────────────────────────────────────────────────────────

export interface DCFScenario {
  growth_rate:    number   // annual FCF growth assumed
  discount_rate:  number
  terminal_rate:  number
  intrinsic_value: number | null
  upside_pct:     number | null
}

export interface DCFRangeResult {
  conservative: DCFScenario
  base:         DCFScenario
  optimistic:   DCFScenario
  graham_number: number | null   // null when sector makes it inapplicable
}

// ─── Research Output ──────────────────────────────────────────────────────────

export type ResearchFlag =
  | 'ACCRUALS_SPIKE'
  | 'DILUTION_WARNING'
  | 'FCF_DIVERGENCE'
  | 'LEVERAGE_RISING'
  | 'MARGIN_COMPRESSION'
  | 'INSIDER_SELLING'
  | 'INSIDER_FUNDAMENTALS_DIVERGENCE'
  | 'MOAT_EROSION'
  | 'DIVIDEND_AT_RISK'
  | 'EARNINGS_QUALITY_LOW'
  | 'BALANCE_SHEET_WEAK'

export interface ResearchResult {
  ticker: string
  company_name: string
  composite_score: number         // 0–10 weighted by goal boost factors
  quality: QualityScoreResult
  value: ValueScoreResult
  growth: GrowthScoreResult
  earnings_quality: EarningsQualityResult
  moat: MoatScoreResult
  dividend_score?: DividendScoreResult  // present when goal = dividend_income or dividends detected
  goal_alignment_pct: number      // 0–100: how fully the company passes goal filters
  bucket: AssetBucket
  flags: ResearchFlag[]
  institutional_context?: {
    manager_count: number
    accumulating_count: number
    reducing_count: number
    latest_report_period: string | null
  }
  passes_filters: boolean
  data_as_of: string
  data_sources: string[]
  // Raw ratios used by balance-sheet filters (computed from EDGAR, not scored)
  raw_current_ratio: number | null
  raw_debt_to_equity: number | null
  raw_beta: number | null
  raw_dividend_yield: number | null      // |dividends_paid| / market_cap
  raw_fcf_payout_ratio: number | null   // |dividends_paid| / FCF
  current_price: number | null
  price_context: PriceContextResult | null
  valuation: DCFRangeResult | null
}

// ─── Display Helpers ──────────────────────────────────────────────────────────

export const GOAL_LABELS: Record<GoalType, string> = {
  total_return: 'Total Return',
  quality_growth: 'Quality Growth',
  dividend_income: 'Dividend Income',
  capital_preservation: 'Capital Preservation',
  deep_value: 'Deep Value',
  balanced: 'Balanced',
}

export const GOAL_DESCRIPTIONS: Record<GoalType, string> = {
  total_return: 'Maximize long-term wealth accumulation',
  quality_growth: 'Compound capital through high-ROIC businesses',
  dividend_income: 'Generate sustainable and growing income',
  capital_preservation: 'Protect principal, minimize drawdown',
  deep_value: 'Buy undervalued assets with margin of safety',
  balanced: 'Risk-parity across economic environments',
}

export const BUCKET_LABELS: Record<AssetBucket, string> = {
  US_EQUITY_LARGE: 'US Large Cap',
  US_EQUITY_SMALL: 'US Small Cap',
  INTL_EQUITY_DEVELOPED: 'Intl Developed',
  INTL_EQUITY_EMERGING: 'Emerging Markets',
  FIXED_INCOME_INVESTMENT_GRADE: 'Investment Grade Bonds',
  FIXED_INCOME_HIGH_YIELD: 'High Yield Bonds',
  REAL_ASSETS: 'Real Assets / REITs',
  ALTERNATIVES: 'Alternatives',
  CASH: 'Cash & Equivalents',
}

export const DEFAULT_ALLOCATIONS: Record<GoalType, AllocationTarget[]> = {
  quality_growth: [
    { bucket: 'US_EQUITY_LARGE', target_pct: 55, min_pct: 40, max_pct: 70 },
    { bucket: 'INTL_EQUITY_DEVELOPED', target_pct: 20, min_pct: 10, max_pct: 30 },
    { bucket: 'US_EQUITY_SMALL', target_pct: 15, min_pct: 5, max_pct: 25 },
    { bucket: 'CASH', target_pct: 10, min_pct: 5, max_pct: 20 },
  ],
  total_return: [
    { bucket: 'US_EQUITY_LARGE', target_pct: 50, min_pct: 35, max_pct: 65 },
    { bucket: 'INTL_EQUITY_DEVELOPED', target_pct: 20, min_pct: 10, max_pct: 30 },
    { bucket: 'US_EQUITY_SMALL', target_pct: 15, min_pct: 5, max_pct: 25 },
    { bucket: 'FIXED_INCOME_INVESTMENT_GRADE', target_pct: 10, min_pct: 5, max_pct: 20 },
    { bucket: 'CASH', target_pct: 5, min_pct: 2, max_pct: 15 },
  ],
  dividend_income: [
    { bucket: 'US_EQUITY_LARGE', target_pct: 40, min_pct: 30, max_pct: 55 },
    { bucket: 'REAL_ASSETS', target_pct: 20, min_pct: 10, max_pct: 30 },
    { bucket: 'FIXED_INCOME_INVESTMENT_GRADE', target_pct: 25, min_pct: 15, max_pct: 40 },
    { bucket: 'INTL_EQUITY_DEVELOPED', target_pct: 10, min_pct: 5, max_pct: 20 },
    { bucket: 'CASH', target_pct: 5, min_pct: 2, max_pct: 15 },
  ],
  capital_preservation: [
    { bucket: 'FIXED_INCOME_INVESTMENT_GRADE', target_pct: 50, min_pct: 35, max_pct: 65 },
    { bucket: 'US_EQUITY_LARGE', target_pct: 25, min_pct: 15, max_pct: 35 },
    { bucket: 'REAL_ASSETS', target_pct: 10, min_pct: 5, max_pct: 20 },
    { bucket: 'CASH', target_pct: 15, min_pct: 10, max_pct: 25 },
  ],
  deep_value: [
    { bucket: 'US_EQUITY_LARGE', target_pct: 45, min_pct: 30, max_pct: 60 },
    { bucket: 'US_EQUITY_SMALL', target_pct: 30, min_pct: 15, max_pct: 45 },
    { bucket: 'INTL_EQUITY_DEVELOPED', target_pct: 15, min_pct: 5, max_pct: 30 },
    { bucket: 'CASH', target_pct: 10, min_pct: 5, max_pct: 20 },
  ],
  balanced: [
    { bucket: 'US_EQUITY_LARGE', target_pct: 35, min_pct: 25, max_pct: 45 },
    { bucket: 'FIXED_INCOME_INVESTMENT_GRADE', target_pct: 30, min_pct: 20, max_pct: 40 },
    { bucket: 'INTL_EQUITY_DEVELOPED', target_pct: 15, min_pct: 5, max_pct: 25 },
    { bucket: 'REAL_ASSETS', target_pct: 10, min_pct: 5, max_pct: 20 },
    { bucket: 'CASH', target_pct: 10, min_pct: 5, max_pct: 20 },
  ],
}

export const DEFAULT_CONSTRAINTS: PolicyConstraints = {
  max_single_position_pct: 10,
  max_sector_concentration_pct: 30,
  min_positions: 10,
  max_positions: 30,
}
