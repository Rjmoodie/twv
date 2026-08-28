/**
 * Research Engine
 *
 * Orchestrates EDGAR data fetching + scoring + goal-aligned filtering.
 * Entry point for all research queue generation.
 *
 * Public API:
 *   scoreCompany(ticker, goal, marketCap?, dcfUpsidePct?) → ResearchResult
 *   buildResearchQueue(portfolio, tickers) → ResearchResult[]
 *   passesFilters(result, filter) → boolean
 */

import { getFinancials } from './edgarService'
import { supabase } from '@/integrations/supabase/client'
import type { InsiderSignalTransaction } from './scoringModels'
import {
  computeQualityScore,
  computeValueScore,
  computeEarningsQuality,
  computeGrowthScore,
  computeMoatScore,
  computeCompositeScore,
  computePriceContext,
  computeDCFRange,
  detectFlags,
} from './scoringModels'
import type {
  Portfolio,
  ResearchResult,
  ResearchFilter,
  AssetBucket,
  GoalType,
} from '@/types/portfolio'

// ─── Goal → Filter mapping ─────────────────────────────────────────────────────

export const RESEARCH_FILTERS: Record<GoalType, ResearchFilter> = {
  quality_growth: {
    min_piotroski:        6,
    min_roic_pct:         0.15,
    min_revenue_cagr_3yr: 0.08,
    min_moat_score:       3,
    earnings_quality_min: 0.85,
    horizon_boost:        ['moat', 'roiic', 'growth_profile'],
  },
  total_return: {
    min_piotroski:        5,
    min_roic_pct:         0.10,
    min_dcf_upside_pct:   0.10,
    earnings_quality_min: 0.75,
    horizon_boost:        ['roiic', 'moat', 'value_score'],
  },
  dividend_income: {
    min_piotroski:        5,
    min_dividend_yield:   0.03,
    max_fcf_payout_ratio: 0.70,
    earnings_quality_min: 0.80,
    chowder_rule_min:     12,
    horizon_boost:        ['earnings_quality', 'leverage', 'dividend_safety'],
  },
  capital_preservation: {
    min_piotroski:        6,
    max_beta:             0.80,
    max_debt_to_equity:   0.50,
    min_current_ratio:    1.50,
    min_moat_score:       3,
    earnings_quality_min: 0.90,
    horizon_boost:        ['balance_sheet', 'earnings_quality', 'low_volatility'],
  },
  deep_value: {
    min_piotroski:        7,
    max_ev_ebit:          12,
    min_dcf_upside_pct:   0.20,
    min_fcf_yield:        0.05,
    earnings_quality_min: 0.70,
    horizon_boost:        ['value_score', 'balance_sheet'],
  },
  balanced: {
    min_piotroski:        5,
    max_beta:             1.10,
    earnings_quality_min: 0.80,
    horizon_boost:        ['earnings_quality', 'value_score'],
  },
}

// ─── Horizon modifier ─────────────────────────────────────────────────────────

export function applyHorizonModifier(base: ResearchFilter, horizonYears: number): ResearchFilter {
  const filter = { ...base, horizon_boost: [...base.horizon_boost] }

  if (horizonYears <= 3) {
    filter.min_piotroski = Math.max(filter.min_piotroski ?? 0, 7)
    filter.earnings_quality_min = Math.max(filter.earnings_quality_min ?? 0, 0.90)
    if (filter.max_debt_to_equity == null) filter.max_debt_to_equity = 0.60
    else filter.max_debt_to_equity = Math.min(filter.max_debt_to_equity, 0.60)
  } else if (horizonYears >= 10) {
    if (!filter.horizon_boost.includes('moat')) filter.horizon_boost.push('moat')
    if (!filter.horizon_boost.includes('roiic')) filter.horizon_boost.push('roiic')
    if (!filter.horizon_boost.includes('growth_profile')) filter.horizon_boost.push('growth_profile')
    if (filter.min_dcf_upside_pct != null) {
      filter.min_dcf_upside_pct = Math.max(0, filter.min_dcf_upside_pct - 0.05)
    }
  }

  return filter
}

// ─── Filter evaluation ────────────────────────────────────────────────────────

export function passesFilters(result: ResearchResult, filter: ResearchFilter): boolean {
  const { quality, value, earnings_quality: eq, moat } = result

  if (filter.min_piotroski != null && quality.piotroski < filter.min_piotroski) return false
  if (filter.min_moat_score != null && moat.composite < filter.min_moat_score) return false
  // Only enforce DCF upside when we actually have the value — no market_cap = skip, not fail
  if (filter.min_dcf_upside_pct != null && value.dcf_upside_pct != null
    && value.dcf_upside_pct < filter.min_dcf_upside_pct) return false
  if (filter.max_ev_ebit != null && value.ev_ebit != null && value.ev_ebit > filter.max_ev_ebit) return false
  // Only enforce FCF yield when we have market cap data
  if (filter.min_fcf_yield != null && value.fcf_yield != null
    && value.fcf_yield < filter.min_fcf_yield) return false
  // Only enforce OCF/NI ratio when NI > 0; when NI is negative the ratio is meaningless
  // (positive OCF / negative NI = negative ratio, which would unfairly fail cash-generative companies)
  if (filter.earnings_quality_min != null && eq.ocf_to_ni != null && eq.ocf_to_ni > 0
    && eq.ocf_to_ni < filter.earnings_quality_min) return false
  if (filter.min_current_ratio != null && result.raw_current_ratio != null
    && result.raw_current_ratio < filter.min_current_ratio) return false
  if (filter.max_debt_to_equity != null && result.raw_debt_to_equity != null
    && result.raw_debt_to_equity > filter.max_debt_to_equity) return false
  if (filter.max_beta != null && result.raw_beta != null
    && result.raw_beta > filter.max_beta) return false
  // ROIC and growth filters — only enforce when we have computed values
  if (filter.min_roic_pct != null && result.quality.roic_5yr_avg != null
    && result.quality.roic_5yr_avg < filter.min_roic_pct) return false
  if (filter.min_revenue_cagr_3yr != null && result.growth.revenue_cagr_3yr != null
    && result.growth.revenue_cagr_3yr < filter.min_revenue_cagr_3yr) return false
  // Dividend filters — only enforce when market cap data is available
  if (filter.min_dividend_yield != null && result.raw_dividend_yield != null
    && result.raw_dividend_yield < filter.min_dividend_yield) return false
  if (filter.max_fcf_payout_ratio != null && result.raw_fcf_payout_ratio != null
    && result.raw_fcf_payout_ratio > filter.max_fcf_payout_ratio) return false

  return true
}

/**
 * Compute goal alignment percentage: how many filter criteria the company meets (0–100).
 * Used for ranking within the research queue even if not all filters pass.
 */
function goalAlignmentPct(result: ResearchResult, filter: ResearchFilter): number {
  const checks: boolean[] = []

  if (filter.min_piotroski != null)
    checks.push(result.quality.piotroski >= filter.min_piotroski)
  if (filter.min_moat_score != null)
    checks.push(result.moat.composite >= filter.min_moat_score)
  // Skip DCF / FCF yield criteria when values are null (no market cap available)
  if (filter.min_dcf_upside_pct != null && result.value.dcf_upside_pct != null)
    checks.push(result.value.dcf_upside_pct >= filter.min_dcf_upside_pct)
  if (filter.max_ev_ebit != null && result.value.ev_ebit != null)
    checks.push(result.value.ev_ebit <= filter.max_ev_ebit)
  if (filter.min_fcf_yield != null && result.value.fcf_yield != null)
    checks.push(result.value.fcf_yield >= filter.min_fcf_yield)
  if (filter.earnings_quality_min != null && result.earnings_quality.ocf_to_ni != null)
    checks.push(result.earnings_quality.ocf_to_ni >= filter.earnings_quality_min)
  if (filter.min_revenue_cagr_3yr != null && result.growth.revenue_cagr_3yr != null)
    checks.push(result.growth.revenue_cagr_3yr >= filter.min_revenue_cagr_3yr)
  if (filter.min_roic_pct != null && result.quality.roic_5yr_avg != null)
    checks.push(result.quality.roic_5yr_avg >= filter.min_roic_pct)
  if (filter.min_current_ratio != null && result.raw_current_ratio != null)
    checks.push(result.raw_current_ratio >= filter.min_current_ratio)
  if (filter.max_debt_to_equity != null && result.raw_debt_to_equity != null)
    checks.push(result.raw_debt_to_equity <= filter.max_debt_to_equity)
  if (filter.max_beta != null && result.raw_beta != null)
    checks.push(result.raw_beta <= filter.max_beta)
  if (filter.min_roic_pct != null && result.quality.roic_5yr_avg != null)
    checks.push(result.quality.roic_5yr_avg >= filter.min_roic_pct)
  if (filter.min_revenue_cagr_3yr != null && result.growth.revenue_cagr_3yr != null)
    checks.push(result.growth.revenue_cagr_3yr >= filter.min_revenue_cagr_3yr)
  if (filter.min_dividend_yield != null && result.raw_dividend_yield != null)
    checks.push(result.raw_dividend_yield >= filter.min_dividend_yield)
  if (filter.max_fcf_payout_ratio != null && result.raw_fcf_payout_ratio != null)
    checks.push(result.raw_fcf_payout_ratio <= filter.max_fcf_payout_ratio)

  if (checks.length === 0) return 100
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

// ─── Core scoring function ────────────────────────────────────────────────────

export interface ScoreCompanyOptions {
  goal: GoalType
  horizon_years?: number
  market_cap?: number
  dcf_upside_pct?: number
  target_bucket?: AssetBucket
}

async function getRecentInsiderTransactions(ticker: string): Promise<InsiderSignalTransaction[]> {
  const since = new Date(Date.now() - 366 * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await (supabase as any).from('insider_transactions')
    .select('accession,line_index,actor_key,owner_cik,is_officer,transaction_date,classification,shares,shares_owned_after,plan_10b5_1,price_suspect')
    .eq('ticker', ticker.toUpperCase()).eq('is_superseded', false)
    .gte('transaction_date', since).order('transaction_date', { ascending: false })
  // Insider data is additive context. A fresh deployment before its migration,
  // or a transient read failure, must not make the fundamentals engine fail.
  if (error) return []
  const unique = new Map<string, InsiderSignalTransaction>()
  for (const row of (data ?? []) as InsiderSignalTransaction[]) {
    const key = `${row.accession ?? ''}:${row.line_index ?? ''}:${row.actor_key ?? row.owner_cik}`
    if (!unique.has(key)) unique.set(key, row)
  }
  return [...unique.values()]
}

async function getInstitutionalContext(ticker: string): Promise<NonNullable<ResearchResult['institutional_context']>> {
  const { data, error } = await (supabase as any).rpc('institutional_signal_for_ticker', { p_ticker: ticker.toUpperCase() })
  const rows = error || !Array.isArray(data) ? [] : data as Array<{ change_direction?: string; report_period?: string }>
  return {
    manager_count: rows.length,
    accumulating_count: rows.filter(row => row.change_direction === 'new' || row.change_direction === 'increased').length,
    reducing_count: rows.filter(row => row.change_direction === 'decreased' || row.change_direction === 'exited').length,
    latest_report_period: rows.map(row => row.report_period ?? '').filter(Boolean).sort().at(-1) ?? null,
  }
}

export async function scoreCompany(
  ticker: string,
  options: ScoreCompanyOptions,
): Promise<ResearchResult> {
  const { goal, horizon_years = 7, dcf_upside_pct, target_bucket } = options

  const [financials, insiderTransactions, institutionalContext] = await Promise.all([
    getFinancials(ticker),
    getRecentInsiderTransactions(ticker),
    getInstitutionalContext(ticker),
  ])
  const t = financials.annual[0]

  // Use market_cap from options if provided (e.g. from caller), else fall back to
  // the enriched value fetched from Alpha Vantage inside getFinancials
  const market_cap = options.market_cap ?? financials.market_cap ?? undefined

  // The DCF has to exist before the value score, not after it. It used to be
  // computed further down for the display panel only, while computeValueScore
  // waited for a dcf_upside_pct argument that no caller ever passed — so the
  // DCF input to Value was null for every ticker, and the goal filters keyed on
  // min_dcf_upside_pct silently never applied.
  const valuation      = computeDCFRange(financials)
  // An explicitly supplied figure still wins; otherwise use the base case, which
  // is the scenario the panel presents as the central estimate.
  const effectiveDcfUpside = dcf_upside_pct ?? valuation?.base?.upside_pct ?? undefined

  const quality        = computeQualityScore(financials)
  const value          = computeValueScore({ financials, market_cap, dcf_upside_pct: effectiveDcfUpside })
  const earningsQual   = computeEarningsQuality(financials)
  const growth         = computeGrowthScore(financials)
  const moat           = computeMoatScore(financials)
  const flags          = detectFlags(financials, quality, earningsQual, insiderTransactions)
  const compositeScore = computeCompositeScore(quality, value, growth, earningsQual, moat, goal)

  // Raw balance-sheet ratios used by capital_preservation and other filters
  const rawCurrentRatio =
    t?.current_assets != null && t?.current_liabilities != null && t.current_liabilities > 0
      ? t.current_assets / t.current_liabilities
      : null
  const rawDebtToEquity =
    t?.long_term_debt != null && t?.total_equity != null && t.total_equity > 0
      ? t.long_term_debt / t.total_equity
      : null
  const rawBeta         = financials.beta          ?? null
  const currentPrice    = financials.current_price ?? null
  const rawDividendYield =
    t?.dividends_paid != null && market_cap != null && market_cap > 0
      ? Math.abs(t.dividends_paid) / market_cap
      : null
  const rawFcfPayoutRatio =
    t?.dividends_paid != null && t?.free_cash_flow != null && t.free_cash_flow > 0
      ? Math.abs(t.dividends_paid) / t.free_cash_flow
      : null

  const priceContext  = computePriceContext(financials)

  const baseFilter = RESEARCH_FILTERS[goal]
  const filter     = applyHorizonModifier(baseFilter, horizon_years)

  const partial: ResearchResult = {
    ticker:              financials.ticker,
    company_name:        financials.company_name,
    composite_score:     compositeScore,
    quality,
    value,
    growth,
    earnings_quality:    earningsQual,
    moat,
    goal_alignment_pct:  0,
    bucket:              target_bucket ?? 'US_EQUITY_LARGE',
    flags,
    institutional_context: institutionalContext,
    passes_filters:      false,
    data_as_of:          t?.period_end ?? '',
    data_sources:        [`SEC EDGAR ${t?.period_end ?? ''}`],
    raw_current_ratio:    rawCurrentRatio,
    raw_debt_to_equity:   rawDebtToEquity,
    raw_beta:             rawBeta,
    raw_dividend_yield:   rawDividendYield,
    raw_fcf_payout_ratio: rawFcfPayoutRatio,
    current_price:        currentPrice,
    price_context:       priceContext,
    valuation,
  }

  return {
    ...partial,
    passes_filters:     passesFilters(partial, filter),
    goal_alignment_pct: goalAlignmentPct(partial, filter),
  }
}

// ─── Research Queue ───────────────────────────────────────────────────────────

export interface ResearchQueueOptions {
  tickers: string[]
  onProgress?: (done: number, total: number) => void
}

/**
 * Scores a list of tickers against the portfolio's goal and horizon.
 * Returns results sorted by composite score descending.
 * Failures are silently skipped so one bad ticker doesn't block the queue.
 */
export async function buildResearchQueue(
  portfolio: Portfolio,
  options: ResearchQueueOptions,
): Promise<ResearchResult[]> {
  const { tickers, onProgress } = options
  const results: ResearchResult[] = []

  for (let i = 0; i < tickers.length; i++) {
    try {
      const result = await scoreCompany(tickers[i], {
        goal: portfolio.goal as GoalType,
        horizon_years: portfolio.horizon_years,
      })
      results.push(result)
    } catch {
      // skip — EDGAR may not have data for all tickers
    }
    onProgress?.(i + 1, tickers.length)
    if (i < tickers.length - 1) await new Promise((r) => setTimeout(r, 100))
  }

  return results.sort((a, b) => b.composite_score - a.composite_score)
}

/**
 * Returns the active filter for a given goal + horizon (for UI display).
 */
export function getActiveFilter(goal: GoalType, horizonYears: number): ResearchFilter {
  return applyHorizonModifier(RESEARCH_FILTERS[goal], horizonYears)
}
