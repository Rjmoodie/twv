/**
 * Scoring Models
 *
 * Implements institutional-grade scoring algorithms against normalized EDGAR data.
 *   - Piotroski F-Score (Quality)
 *   - Greenblatt Magic Formula (Value)
 *   - Earnings Quality (accruals-based)
 *   - Growth Profile (CAGR, ROIIC, reinvestment rate)
 *   - Moat Proxy (gross margin stability, sustained excess returns)
 */

import type {
  NormalizedFinancials,
  AnnualFinancials,
  QualityScoreResult,
  ValueScoreResult,
  GrowthScoreResult,
  EarningsQualityResult,
  MoatScoreResult,
  ResearchFlag,
  PriceContextResult,
  DCFRangeResult,
  DCFScenario,
} from '@/types/portfolio'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function safe(a: number | null | undefined): number | null {
  return a == null || !isFinite(a) ? null : a
}

function div(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null
  return a / b
}

/**
 * A compound rate needs both endpoints positive. A non-positive END is not
 * merely an extreme growth rate: Math.pow of a negative base to a fractional
 * exponent is NaN, and a business that crossed zero has no compound rate to
 * quote anyway. Both endpoints are guarded so the caller gets a null it already
 * knows how to score, never a NaN it does not.
 */
function cagr(start: number | null, end: number | null, years: number): number | null {
  if (start == null || end == null || start <= 0 || end <= 0 || years <= 0) return null
  return Math.pow(end / start, 1 / years) - 1
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

/** Normalize a ratio to a 0–10 score given expected min/max for the metric. */
function normalize(
  val: number | null,
  low: number,
  high: number,
  invert = false,
): number | null {
  if (val == null || !Number.isFinite(val)) return null
  const pct = (val - low) / (high - low)
  const clamped = clamp(pct, 0, 1)
  return invert ? (1 - clamped) * 10 : clamped * 10
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  return Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length)
}

/** US federal statutory rate — the fallback when a filer's effective rate isn't derivable. */
const DEFAULT_TAX_RATE = 0.21

/**
 * Effective tax rate from the filing, clamped to a sane band. Loss-making years
 * and one-off tax benefits produce negative or absurd ratios, so fall back
 * rather than propagate them into NOPAT.
 */
function effectiveTaxRate(y: AnnualFinancials | undefined): number {
  const tax = y?.tax_expense
  const pretax = y?.pretax_income
  if (tax == null || pretax == null || pretax <= 0) return DEFAULT_TAX_RATE
  const rate = tax / pretax
  return rate >= 0 && rate <= 0.5 ? rate : DEFAULT_TAX_RATE
}

/**
 * Invested capital: working capital (floored at zero — negative NWC is a
 * feature for float-funded businesses, per Greenblatt) plus net fixed assets.
 */
function investedCapital(y: AnnualFinancials | undefined): number {
  const nwc = (y?.current_assets ?? 0) - (y?.current_liabilities ?? 0)
  return Math.max(nwc, 0) + (y?.ppe_net ?? 0)
}

/**
 * Return on invested capital using NOPAT, not raw EBIT.
 *
 * Operating income is pre-tax; comparing it against a WACC-style hurdle (an
 * after-tax cost) overstated returns by roughly the effective tax rate and let
 * companies clear the moat threshold on tax they never kept.
 */
function nopatROIC(y: AnnualFinancials | undefined): number | null {
  const capital = investedCapital(y)
  const ebit = y?.operating_income
  if (capital <= 0 || ebit == null) return null
  return (ebit * (1 - effectiveTaxRate(y))) / capital
}

/** Total debt for EV — long-term plus the current portion. */
function totalDebt(y: AnnualFinancials | undefined): number {
  return (y?.long_term_debt ?? 0) + (y?.short_term_debt ?? 0)
}

// ─── Piotroski F-Score + Quality ─────────────────────────────────────────────


/** Where a metric sits when we have no information about it. */
const NEUTRAL_SCORE = 5

/**
 * Composite of sub-scores, with missing evidence held at neutral.
 *
 * Averaging only the metrics that happened to be available lets one saturated
 * input produce a perfect score: AAPL scored 10/10 on growth from ROIIC alone
 * while both revenue CAGRs were missing, because the two nulls were dropped
 * from the mean rather than counted. Scoring the missing ones as zero is the
 * opposite error — absence of evidence is not evidence of weakness, and it is
 * what made a thinly-covered company look worse than a genuinely bad one.
 *
 * Each absent input contributes NEUTRAL_SCORE instead. A full set of strong
 * metrics still scores 10; one strong metric out of three cannot; a company we
 * know nothing about lands at neutral rather than at either extreme.
 *
 * `coverage` is returned so callers can say how much is actually known — a 7.0
 * from five metrics and a 7.0 from one are not the same claim.
 */
function compositeOf(parts: (number | null)[]): { composite: number; coverage: number } {
  if (parts.length === 0) return { composite: NEUTRAL_SCORE, coverage: 0 }
  // Non-finite is missing evidence, not evidence. NaN passes a `!= null` test
  // and then propagates through the sum, so a single bad input would silently
  // turn the whole composite -- and the score built on it -- into NaN.
  const available = parts.filter((p): p is number => p != null && Number.isFinite(p))
  const total = available.reduce((sum, v) => sum + v, 0)
    + (parts.length - available.length) * NEUTRAL_SCORE
  return {
    composite: Math.round(clamp(total / parts.length, 0, 10) * 100) / 100,
    coverage: available.length / parts.length,
  }
}

export function computeQualityScore(fin: NormalizedFinancials): QualityScoreResult {
  const [t, t1] = [fin.annual[0], fin.annual[1]] // latest, prior year

  const roaT  = div(t?.net_income, t?.total_assets)
  const roaT1 = div(t1?.net_income, t1?.total_assets)

  const ocfToAssets = div(t?.operating_cf, t?.total_assets)

  const leverageT  = div(t?.long_term_debt, t?.total_assets)
  const leverageT1 = div(t1?.long_term_debt, t1?.total_assets)

  const currentRatioT  = div(t?.current_assets, t?.current_liabilities)
  const currentRatioT1 = div(t1?.current_assets, t1?.current_liabilities)

  const gmT  = div(t?.gross_profit, t?.revenue)
  const gmT1 = div(t1?.gross_profit, t1?.revenue)

  const atT  = div(t?.revenue, t?.total_assets)
  const atT1 = div(t1?.revenue, t1?.total_assets)

  // Piotroski signals
  const f1 = roaT != null && roaT > 0
  const f2 = t?.operating_cf != null && t.operating_cf > 0
  const f3 = roaT != null && roaT1 != null && roaT > roaT1
  const f4 = ocfToAssets != null && roaT != null && ocfToAssets > roaT   // cash > accrual earnings
  // F5: leverage decreased OR company carries zero debt (no leverage risk at all)
  const f5 = (t?.long_term_debt === 0 && t1?.long_term_debt === 0)
    || (leverageT != null && leverageT1 != null && leverageT < leverageT1)
  const f6 = currentRatioT != null && currentRatioT1 != null && currentRatioT > currentRatioT1
  const f7 = t?.shares_outstanding != null && t1?.shares_outstanding != null &&
             t.shares_outstanding <= t1.shares_outstanding
  const f8 = gmT != null && gmT1 != null && gmT > gmT1
  const f9 = atT != null && atT1 != null && atT > atT1

  const piotroski = [f1, f2, f3, f4, f5, f6, f7, f8, f9].filter(Boolean).length

  // ROIC trend (5yr average), NOPAT-based — see nopatROIC.
  const roicValues: number[] = fin.annual.slice(0, 5)
    .map((y) => nopatROIC(y))
    .filter((v): v is number => v != null)
  const roic5yrAvg = roicValues.length > 0
    ? roicValues.reduce((s, v) => s + v, 0) / roicValues.length
    : null

  // FCF consistency: positive-FCF years over a FIXED 10-year window.
  //
  // Dividing by however many years EDGAR happened to return made the metric
  // incomparable across companies — 1 of 2 good years scored the same as 5 of
  // 10. Require at least 3 years of history, then score against 10 so a short
  // filing record cannot manufacture a perfect ratio.
  const FCF_WINDOW = 10
  const fcfYears = fin.annual.slice(0, FCF_WINDOW)
  const fcfConsistency = fcfYears.length >= 3
    ? fcfYears.filter((y) => (y.free_cash_flow ?? 0) > 0).length / Math.max(fcfYears.length, FCF_WINDOW)
    : null

  // Composite: piotroski contributes 0–9, normalize to 0–10; bonus for ROIC and FCF consistency
  let composite = (piotroski / 9) * 7                       // 0–7 from Piotroski
  if (roic5yrAvg != null) composite += clamp(roic5yrAvg * 10, 0, 1.5)  // 0–1.5 bonus
  if (fcfConsistency != null) composite += fcfConsistency * 1.5          // 0–1.5 bonus
  composite = clamp(composite, 0, 10)

  return {
    f1_roa_positive:           f1,
    f2_ocf_positive:           f2,
    f3_roa_improving:          f3,
    f4_accruals_clean:         f4,
    f5_leverage_decreasing:    f5,
    f6_liquidity_improving:    f6,
    f7_no_dilution:            f7,
    f8_gross_margin_improving: f8,
    f9_asset_turnover_improving: f9,
    piotroski,
    roic_5yr_avg:              safe(roic5yrAvg),
    fcf_consistency:           safe(fcfConsistency),
    composite: Math.round(composite * 100) / 100,
  }
}

// ─── Value Score (Greenblatt + DCF upside + FCF yield) ───────────────────────

export interface ValueScoreInput {
  financials: NormalizedFinancials
  market_cap?: number         // current market cap in USD
  dcf_upside_pct?: number     // from Somatech DCF engine
}

export function computeValueScore(input: ValueScoreInput): ValueScoreResult {
  const { financials: fin, market_cap, dcf_upside_pct } = input
  const t = fin.annual[0]
  // A company with no annual facts is unknown, not expensive. This was the one
  // scorer that answered 0 here while every other one routes its empty case
  // through compositeOf and lands on neutral -- so a ticker EDGAR had nothing
  // for ranked below a genuinely dear one, and Value carries up to 40% of the
  // goal-weighted composite on deep_value. coverage: 0 says the score is
  // entirely unevidenced, which is the honest reading of it.
  if (!t) return { earnings_yield: null, return_on_capital: null, dcf_upside_pct: null, fcf_yield: null, ev_ebit: null, composite: NEUTRAL_SCORE, coverage: 0 }

  // EV must carry the full debt load — long-term plus the current portion.
  const debt       = totalDebt(t)
  const cashVal    = (t.cash ?? 0)
  const ev         = market_cap != null ? market_cap + debt - cashVal : null

  // Greenblatt earnings yield: EBIT / EV
  const earningsYield = ev != null && ev > 0 && t.operating_income != null
    ? t.operating_income / ev
    : null

  // Greenblatt return on capital, after tax — see nopatROIC.
  const returnOnCapital = nopatROIC(t)

  const fcfYield   = market_cap != null && market_cap > 0 && t.free_cash_flow != null
    ? t.free_cash_flow / market_cap
    : null

  const evEbit     = ev != null && ev > 0 && t.operating_income != null && t.operating_income > 0
    ? ev / t.operating_income
    : null

  // Normalize each component to 0–10 and average

  const eyScore = normalize(earningsYield, -0.05, 0.15)

  const rocScore = normalize(returnOnCapital, 0, 0.40)

  const fcfScore = normalize(fcfYield, -0.02, 0.12)

  const dcfScore = dcf_upside_pct != null ? normalize(dcf_upside_pct, -0.2, 0.8) : null

  // EV/EBIT: lower = cheaper (inverted)
  const evEbitScore = evEbit != null ? normalize(evEbit, 5, 40, true) : null

  const { composite, coverage } = compositeOf([eyScore, rocScore, fcfScore, dcfScore, evEbitScore])

  return {
    coverage,
    earnings_yield:    safe(earningsYield),
    return_on_capital: safe(returnOnCapital),
    dcf_upside_pct:    dcf_upside_pct ?? null,
    fcf_yield:         safe(fcfYield),
    ev_ebit:           safe(evEbit),
    composite:         Math.round(clamp(composite, 0, 10) * 100) / 100,
  }
}

// ─── Earnings Quality (accruals-based) ───────────────────────────────────────

export function computeEarningsQuality(fin: NormalizedFinancials): EarningsQualityResult {
  const t  = fin.annual[0]
  const t1 = fin.annual[1]

  // OCF/NI inverts through zero: a $100M loss funded by $200M of cash burn is
  // -200/-100 = +2.0, which this scale reads as perfect cash conversion -- so
  // the worst case outscored a profitable filer. The ratio only means what it
  // claims when earnings are positive; below that it is missing evidence, which
  // compositeOf already holds at neutral. Matches `ratio()` in
  // financialStatementAnalytics, which guards the same denominator.
  const ocfToNi = t?.net_income != null && t.net_income > 0
    ? div(t.operating_cf, t.net_income)
    : null

  // Accruals ratio: (NI − FCF) / Avg Total Assets
  const avgAssets = t?.total_assets != null && t1?.total_assets != null
    ? (t.total_assets + t1.total_assets) / 2
    : t?.total_assets ?? null
  const accruals  = t?.net_income != null && t?.free_cash_flow != null
    ? t.net_income - t.free_cash_flow
    : null
  const accrualsRatio = div(accruals, avgAssets)

  // Score: OCF/NI >= 1 is ideal; accruals ratio near 0 or negative is ideal
  const ocfScore = normalize(ocfToNi, 0, 2)         // 0→0, 1.0→5, ≥2→10
  // Accruals ratio: lower = better. Use invert=true with normal low→high range.
  // -0.05 (cash earnings >> accrual) = 10/10; 0.15 (heavy accruals) = 0/10
  const accScore = normalize(accrualsRatio, -0.05, 0.15, true)

  // This scorer already treated no-data as neutral; compositeOf now applies the
  // same rule to a partial set instead of only to an empty one.
  const { composite, coverage } = compositeOf([ocfScore, accScore])

  return {
    coverage,
    ocf_to_ni:      safe(ocfToNi),
    accruals_ratio: safe(accrualsRatio),
    composite,
  }
}

// ─── Growth Profile ───────────────────────────────────────────────────────────

export function computeGrowthScore(fin: NormalizedFinancials): GrowthScoreResult {
  const years = fin.annual

  const rev0 = years[0]?.revenue
  const rev3 = years[3]?.revenue
  const rev5 = years[5]?.revenue

  const cagr3 = cagr(rev3, rev0, 3)
  const cagr5 = cagr(rev5, rev0, 5)

  // ROIIC: ΔOperating Income / ΔInvested Capital (3yr change)
  // Require a minimum $10M capital change to avoid dividing by noise
  let roiic: number | null = null
  if (years.length >= 4) {
    const deltaOpIncome = (years[0].operating_income ?? 0) - (years[3].operating_income ?? 0)
    const deltaCapital  = investedCapital(years[0]) - investedCapital(years[3])
    if (Math.abs(deltaCapital) >= 10_000_000) {
      roiic = clamp(deltaOpIncome / Math.abs(deltaCapital), -5, 10)
    }
  }

  // Reinvestment rate: (CapEx + R&D − D&A) / Revenue
  const t = years[0]
  const reinvestment = t?.revenue != null && t.revenue > 0
    ? ((t.capex ?? 0) + (t.rd_expense ?? 0) - (t.da_expense ?? 0)) / t.revenue
    : null

  // Normalize to 0–10

  const c3Score = normalize(cagr3, -0.05, 0.30)

  const c5Score = normalize(cagr5, -0.05, 0.25)

  const roiicScore = normalize(roiic, -0.1, 0.5)

  const { composite, coverage } = compositeOf([c3Score, c5Score, roiicScore])

  return {
    coverage,
    revenue_cagr_3yr:  safe(cagr3),
    revenue_cagr_5yr:  safe(cagr5),
    reinvestment_rate: safe(reinvestment),
    roiic:             safe(roiic),
    composite:         Math.round(clamp(composite, 0, 10) * 100) / 100,
  }
}

// ─── Moat Score (quantitative proxies) ───────────────────────────────────────

export function computeMoatScore(fin: NormalizedFinancials): MoatScoreResult {
  // Gross margin stability: 1 − std_dev(GM%) over available years
  const gmValues = fin.annual
    .map((y) => div(y.gross_profit, y.revenue))
    .filter((v): v is number => v != null)

  const gmStability = gmValues.length >= 3
    ? 1 - clamp(stdDev(gmValues) / 0.15, 0, 1)   // 15% std dev = 0 stability
    : null

  // Sustained ROIC > 10% (proxy for excess returns over WACC) — count of years in last 5
  const roicYears = fin.annual.slice(0, 5).filter((y) => {
    const roic = nopatROIC(y)
    return roic != null && roic > 0.10
  }).length

  // Score: 0–5
  let score = 0
  if (gmStability != null) score += gmStability * 2.5    // 0–2.5
  score += (roicYears / 5) * 2.5                          // 0–2.5

  return {
    gross_margin_stability: safe(gmStability),
    roic_vs_wacc_years:     roicYears,
    composite:              Math.round(clamp(score, 0, 5) * 100) / 100,
  }
}

// ─── Red Flag Detection ───────────────────────────────────────────────────────

export function detectFlags(
  fin: NormalizedFinancials,
  quality: QualityScoreResult,
  earningsQuality: EarningsQualityResult,
  insiderTransactions: InsiderSignalTransaction[] = [],
): ResearchFlag[] {
  const flags: ResearchFlag[] = []
  const [t, t1] = [fin.annual[0], fin.annual[1]]

  // Accruals spike: accruals ratio deteriorated significantly YoY
  if (earningsQuality.accruals_ratio != null && earningsQuality.accruals_ratio > 0.08) {
    flags.push('ACCRUALS_SPIKE')
  }

  // FCF divergence: net income growing but FCF shrinking
  // Guard: skip when prior-year base is null or zero (ratio would be meaningless / infinite)
  if (t && t1) {
    const t1ni  = t1.net_income
    const t1fcf = t1.free_cash_flow
    const niGrowth  = t1ni  != null && t1ni  !== 0 ? div((t.net_income   ?? 0) - t1ni,  Math.abs(t1ni))  : null
    const fcfGrowth = t1fcf != null && t1fcf !== 0 ? div((t.free_cash_flow ?? 0) - t1fcf, Math.abs(t1fcf)) : null
    if (niGrowth != null && fcfGrowth != null && niGrowth > 0.1 && fcfGrowth < -0.1) {
      flags.push('FCF_DIVERGENCE')
    }
  }

  // Dilution warning — only when shares data exists for both years (not on missing data)
  const t0shares = fin.annual[0]?.shares_outstanding
  const t1shares = fin.annual[1]?.shares_outstanding
  if (t0shares != null && t1shares != null && t0shares > t1shares) {
    flags.push('DILUTION_WARNING')
  }

  // Leverage rising
  if (!quality.f5_leverage_decreasing && t?.long_term_debt != null && t1?.long_term_debt != null) {
    const debtNow = totalDebt(t)
    const debtPrior = totalDebt(t1)
    const ltdGrowth = debtPrior > 0 ? (debtNow - debtPrior) / debtPrior : null
    if (ltdGrowth != null && ltdGrowth > 0.20) flags.push('LEVERAGE_RISING')
  }

  // Margin compression
  const gmT  = div(t?.gross_profit, t?.revenue)
  const gmT1 = div(t1?.gross_profit, t1?.revenue)
  if (gmT != null && gmT1 != null && gmT1 - gmT > 0.03) {
    flags.push('MARGIN_COMPRESSION')
  }

  // Earnings quality low
  if (earningsQuality.composite < 4) flags.push('EARNINGS_QUALITY_LOW')

  // Balance sheet weak
  const currentRatio = div(t?.current_assets, t?.current_liabilities)
  if (currentRatio != null && currentRatio < 1.0) flags.push('BALANCE_SHEET_WEAK')

  // Dividend at risk: FCF payout > 90%
  if (t?.dividends_paid != null && t?.free_cash_flow != null && t.free_cash_flow > 0) {
    const payout = Math.abs(t.dividends_paid) / t.free_cash_flow
    if (payout > 0.90) flags.push('DIVIDEND_AT_RISK')
  }

  // Routine sales are not a red flag. Require multiple named executives, no
  // disclosed 10b5-1 plan, and at least 10% of each seller's pre-trade stake.
  const cutoff = Date.now() - 90 * 86_400_000
  const discretionaryExecutiveSales = insiderTransactions.filter(row => {
    if (row.classification !== 'open_market_sale' || row.plan_10b5_1 || row.price_suspect || !row.is_officer) return false
    const before = row.shares_owned_after == null ? null : row.shares_owned_after + row.shares
    return new Date(`${row.transaction_date}T00:00:00Z`).getTime() >= cutoff
      && before != null && before > 0 && row.shares / before >= 0.10
  })
  if (new Set(discretionaryExecutiveSales.map(row => row.actor_key ?? row.owner_cik)).size >= 2) {
    flags.push('INSIDER_SELLING')
    if (flags.includes('ACCRUALS_SPIKE') || flags.includes('FCF_DIVERGENCE')) {
      flags.push('INSIDER_FUNDAMENTALS_DIVERGENCE')
    }
  }

  return flags
}

export interface InsiderSignalTransaction {
  accession?: string
  line_index?: number
  actor_key?: string
  owner_cik: string
  is_officer: boolean
  transaction_date: string
  classification: string
  shares: number
  shares_owned_after: number | null
  plan_10b5_1: boolean
  price_suspect: boolean
}

// ─── Composite Score (goal-weighted) ─────────────────────────────────────────

export interface CompositeWeights {
  quality: number
  value: number
  growth: number
  earnings_quality: number
  moat: number
}

const GOAL_WEIGHTS: Record<string, CompositeWeights> = {
  quality_growth: { quality: 0.30, value: 0.15, growth: 0.30, earnings_quality: 0.10, moat: 0.15 },
  total_return:   { quality: 0.25, value: 0.20, growth: 0.25, earnings_quality: 0.15, moat: 0.15 },
  dividend_income:{ quality: 0.20, value: 0.20, growth: 0.15, earnings_quality: 0.30, moat: 0.15 },
  capital_preservation: { quality: 0.30, value: 0.10, growth: 0.10, earnings_quality: 0.35, moat: 0.15 },
  deep_value:     { quality: 0.20, value: 0.40, growth: 0.10, earnings_quality: 0.20, moat: 0.10 },
  balanced:       { quality: 0.25, value: 0.20, growth: 0.20, earnings_quality: 0.20, moat: 0.15 },
}

export function computeCompositeScore(
  quality: QualityScoreResult,
  value: ValueScoreResult,
  growth: GrowthScoreResult,
  eq: EarningsQualityResult,
  moat: MoatScoreResult,
  goal: string,
): number {
  const w = GOAL_WEIGHTS[goal] ?? GOAL_WEIGHTS.balanced
  const moatNorm = (moat.composite / 5) * 10  // normalize 0–5 to 0–10
  const score =
    quality.composite    * w.quality +
    value.composite      * w.value +
    growth.composite     * w.growth +
    eq.composite         * w.earnings_quality +
    moatNorm             * w.moat
  return Math.round(clamp(score, 0, 10) * 100) / 100
}

// ─── Price Context ────────────────────────────────────────────────────────────

export function computePriceContext(fin: NormalizedFinancials): PriceContextResult {
  const price         = fin.current_price   ?? null
  const high52        = fin.week52_high     ?? null
  const low52         = fin.week52_low      ?? null
  const ma200         = fin.ma_200day       ?? null
  const target        = fin.analyst_target  ?? null

  const week52_position_pct =
    price != null && high52 != null && low52 != null && high52 > low52
      ? clamp(((price - low52) / (high52 - low52)) * 100, 0, 100)
      : null

  const above_200d_ma =
    price != null && ma200 != null ? price > ma200 : null

  const analyst_upside_pct =
    price != null && target != null && price > 0
      ? (target - price) / price
      : null

  return {
    // Carried so the screen can attribute the number rather than implying it is
    // live. The quote and the Overview-derived bounds cache on different cycles,
    // so week52_position and analyst_upside each combine two different moments.
    price_as_of:          fin.price_as_of ?? null,
    price_provider:       fin.price_provider ?? null,
    market_stats_as_of:   fin.market_stats_as_of ?? null,
    current_price:        price,
    week52_high:          high52,
    week52_low:           low52,
    week52_position_pct,
    ma_200day:            ma200,
    above_200d_ma,
    analyst_target:       target,
    analyst_upside_pct,
  }
}

// ─── DCF Range Model ──────────────────────────────────────────────────────────

// Sector overrides that make Graham Number applicable (traditional businesses with stable earnings)
const GRAHAM_SECTORS = new Set([
  'Financials', 'Industrials', 'Consumer Staples', 'Healthcare',
  'Consumer Defensive', 'Health Care',
])

function dcfScenario(
  baseFCF: number,
  growthRate: number,
  discountRate: number,
  terminalRate: number,
  sharesOut: number,
  currentPrice: number | null,
): DCFScenario {
  // 10-year explicit FCF projection + terminal value
  let pv = 0
  let fcf = baseFCF
  for (let y = 1; y <= 10; y++) {
    fcf *= (1 + growthRate)
    pv  += fcf / Math.pow(1 + discountRate, y)
  }
  // Gordon Growth terminal value
  const terminalFCF = fcf * (1 + terminalRate)
  const terminalValue = terminalFCF / (discountRate - terminalRate)
  pv += terminalValue / Math.pow(1 + discountRate, 10)

  const intrinsic_value = sharesOut > 0 ? pv / sharesOut : null
  const upside_pct = intrinsic_value != null && currentPrice != null && currentPrice > 0
    ? (intrinsic_value - currentPrice) / currentPrice
    : null

  return { growth_rate: growthRate, discount_rate: discountRate, terminal_rate: terminalRate, intrinsic_value, upside_pct }
}

export function computeDCFRange(fin: NormalizedFinancials): DCFRangeResult | null {
  const latest   = fin.annual[0]
  const price    = fin.current_price ?? null
  const sharesOut = latest?.shares_outstanding ?? null

  // Need at least FCF and shares to run DCF
  const fcf = latest?.free_cash_flow ?? null
  if (fcf == null || fcf <= 0 || sharesOut == null || sharesOut <= 0) return null

  // Use 3yr average FCF if available to smooth lumpy capex
  const fcfValues = fin.annual
    .slice(0, 3)
    .map((y) => y.free_cash_flow)
    .filter((v): v is number => v != null && v > 0)
  const baseFCF = fcfValues.length > 0
    ? fcfValues.reduce((s, v) => s + v, 0) / fcfValues.length
    : fcf

  // Beta-adjusted CAPM discount rate: risk-free (4%) + beta × equity premium (5%)
  // Floor beta at 0.5 to prevent unrealistically cheap rates for low-vol stocks
  const beta         = Math.max(fin.beta ?? 1.0, 0.5)
  const baseDiscount = clamp(0.04 + beta * 0.05, 0.07, 0.15)
  const consDiscount = Math.min(baseDiscount + 0.01, 0.15)

  const conservative = dcfScenario(baseFCF, 0.04, consDiscount, 0.025, sharesOut, price)
  const base         = dcfScenario(baseFCF, 0.07, baseDiscount, 0.025, sharesOut, price)
  const optimistic   = dcfScenario(baseFCF, 0.12, baseDiscount, 0.03,  sharesOut, price)

  // Graham Number: only meaningful for stable non-tech businesses
  const sector = fin.sector ?? ''
  let graham_number: number | null = null
  if (GRAHAM_SECTORS.has(sector)) {
    // Graham Number = sqrt(22.5 × EPS × Book Value Per Share)
    // Use EDGAR values: net_income / shares and equity / shares
    const ni    = latest?.net_income       ?? null
    const equity = latest?.total_equity   ?? null
    const eps   = ni    != null && sharesOut > 0 ? ni    / sharesOut : null
    const bvps  = equity != null && sharesOut > 0 ? equity / sharesOut : null
    if (eps != null && eps > 0 && bvps != null && bvps > 0) {
      graham_number = Math.sqrt(22.5 * eps * bvps)
    }
  }

  return { conservative, base, optimistic, graham_number }
}
