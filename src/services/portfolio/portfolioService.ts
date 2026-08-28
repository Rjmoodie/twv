/**
 * Portfolio Service
 *
 * Supabase CRUD for portfolios, allocations, and holdings.
 * All operations are scoped to the authenticated user via RLS.
 */

import { supabase } from '@/integrations/supabase/client'
import type {
  Portfolio,
  PortfolioHolding,
  AllocationTarget,
  CreatePortfolioInput,
  AssetBucket,
  GoalType,
} from '@/types/portfolio'
import { DEFAULT_ALLOCATIONS, DEFAULT_CONSTRAINTS } from '@/types/portfolio'

const VALID_GOALS = new Set<GoalType>([
  'total_return',
  'quality_growth',
  'dividend_income',
  'capital_preservation',
  'deep_value',
  'balanced',
])

const finiteNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const optionalFiniteNumber = (value: unknown): number | undefined => {
  if (value == null || value === '') return undefined
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const normalizeHolding = (value: unknown): PortfolioHolding | null => {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (
    typeof row.id !== 'string' ||
    typeof row.portfolio_id !== 'string' ||
    typeof row.ticker !== 'string' ||
    !row.ticker.trim()
  ) return null
  return {
    ...row,
    ticker: row.ticker.trim().toUpperCase(),
    source: row.source === 'alpaca' || row.source === 'schwab' ? row.source : 'manual',
    provider_data_as_of: typeof row.provider_data_as_of === 'string' ? row.provider_data_as_of : undefined,
    classification_source: row.classification_source === 'inferred' ? 'inferred' : 'user',
    is_stale: row.is_stale === true,
    shares: optionalFiniteNumber(row.shares),
    cost_basis: optionalFiniteNumber(row.cost_basis),
    current_price: optionalFiniteNumber(row.current_price),
    market_value: optionalFiniteNumber(row.market_value),
    target_pct: optionalFiniteNumber(row.target_pct),
    current_pct: optionalFiniteNumber(row.current_pct),
  } as PortfolioHolding
}

export function normalizePortfolio(value: unknown): Portfolio | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.user_id !== 'string') return null

  const allocations = Array.isArray(row.allocations)
    ? row.allocations
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .filter((item) => typeof item.bucket === 'string')
        .map((item) => ({
          ...item,
          target_pct: finiteNumber(item.target_pct),
          min_pct: finiteNumber(item.min_pct),
          max_pct: finiteNumber(item.max_pct),
        } as AllocationTarget))
    : []
  const importedHoldings = Array.isArray(row.holdings)
    ? row.holdings.map(normalizeHolding).filter((item): item is PortfolioHolding => item !== null)
    : []
  // Schwab is the portfolio source of truth. Manual/Alpaca rows remain stored
  // as reversible planning or legacy data, but cannot be summed beside the
  // linked Schwab account and double-count the same assets.
  const holdings = importedHoldings.some(item => item.source === 'schwab')
    ? importedHoldings.filter(item => item.source === 'schwab')
    : importedHoldings

  return {
    ...row,
    name: typeof row.name === 'string' && row.name.trim() ? row.name : 'Portfolio',
    goal: typeof row.goal === 'string' && VALID_GOALS.has(row.goal as GoalType)
      ? row.goal as GoalType
      : 'balanced',
    is_default: row.is_default === true,
    horizon_years: finiteNumber(row.horizon_years),
    risk_tolerance: finiteNumber(row.risk_tolerance),
    risk_capacity: finiteNumber(row.risk_capacity),
    rebalance_threshold_pct: finiteNumber(row.rebalance_threshold_pct, 5),
    min_conviction_score: finiteNumber(row.min_conviction_score, 6),
    max_single_position_pct: finiteNumber(row.max_single_position_pct),
    max_sector_concentration_pct: finiteNumber(row.max_sector_concentration_pct),
    min_positions: finiteNumber(row.min_positions),
    max_positions: finiteNumber(row.max_positions),
    initial_capital: optionalFiniteNumber(row.initial_capital),
    investment_goal_id: typeof row.investment_goal_id === 'string' ? row.investment_goal_id : undefined,
    target_amount: optionalFiniteNumber(row.target_amount),
    monthly_contribution: optionalFiniteNumber(row.monthly_contribution),
    allocations,
    holdings,
  } as Portfolio
}

// ─── Portfolio CRUD ───────────────────────────────────────────────────────────

export async function listPortfolios(userId: string): Promise<Portfolio[]> {
  const { data, error } = await supabase
    .from('portfolios')
    .select(`
      *,
      allocations:portfolio_allocations(*),
      holdings:portfolio_holdings(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!Array.isArray(data)) return []
  return data.map(normalizePortfolio).filter((item): item is Portfolio => item !== null)
}

export async function getPortfolio(id: string): Promise<Portfolio | null> {
  const { data, error } = await supabase
    .from('portfolios')
    .select(`
      *,
      allocations:portfolio_allocations(*),
      holdings:portfolio_holdings(*)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return normalizePortfolio(data)
}

export async function createPortfolio(
  userId: string,
  input: CreatePortfolioInput,
): Promise<Portfolio> {
  const constraints = { ...DEFAULT_CONSTRAINTS, ...input.constraints }
  const allocations = input.target_allocations.length > 0
    ? input.target_allocations
    : DEFAULT_ALLOCATIONS[input.goal]

  // First portfolio for this user becomes the default automatically
  const { count } = await supabase
    .from('portfolios')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  const isFirstPortfolio = (count ?? 0) === 0

  // Insert portfolio row
  const { data: portfolio, error: pErr } = await supabase
    .from('portfolios')
    .insert({
      user_id:                     userId,
      name:                        input.name,
      description:                 input.description,
      goal:                        input.goal,
      horizon_years:               input.horizon_years,
      risk_tolerance:              input.risk_tolerance,
      risk_capacity:               input.risk_capacity,
      rebalance_threshold_pct:     5.0,
      min_conviction_score:        6.0,
      max_single_position_pct:     constraints.max_single_position_pct,
      max_sector_concentration_pct: constraints.max_sector_concentration_pct,
      min_positions:               constraints.min_positions,
      max_positions:               constraints.max_positions,
      exclude_sectors:             constraints.exclude_sectors ?? [],
      initial_capital:             input.initial_capital,
      investment_goal_id:          input.investment_goal_id,
      target_amount:               input.target_amount,
      monthly_contribution:        input.monthly_contribution,
      is_default:                  isFirstPortfolio,
    })
    .select()
    .single()

  if (pErr) throw pErr

  // Insert allocation targets
  if (allocations.length > 0) {
    const { error: aErr } = await supabase
      .from('portfolio_allocations')
      .insert(
        allocations.map((a) => ({
          portfolio_id: portfolio.id,
          bucket:       a.bucket,
          target_pct:   a.target_pct,
          min_pct:      a.min_pct,
          max_pct:      a.max_pct,
        }))
      )
    if (aErr) {
      // Avoid leaving an unusable policy shell when the dependent allocation
      // insert fails. The database FK cascade removes any partial children.
      const { error: cleanupError } = await supabase.from('portfolios').delete().eq('id', portfolio.id)
      if (cleanupError) console.error('Failed to clean up incomplete portfolio:', cleanupError)
      throw aErr
    }
  }

  return normalizePortfolio({ ...portfolio, allocations, holdings: [] })!
}

export async function updatePortfolio(
  id: string,
  updates: Partial<Omit<Portfolio, 'id' | 'user_id' | 'created_at'>>,
): Promise<void> {
  const { allocations, holdings, ...fields } = updates as Portfolio & { allocations?: AllocationTarget[]; holdings?: PortfolioHolding[] }

  if (Object.keys(fields).length > 0) {
    const { error } = await supabase
      .from('portfolios')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }

  // Replace allocations if provided
  if (allocations) {
    await supabase.from('portfolio_allocations').delete().eq('portfolio_id', id)
    if (allocations.length > 0) {
      const { error } = await supabase
        .from('portfolio_allocations')
        .insert(allocations.map((a) => ({ portfolio_id: id, ...a })))
      if (error) throw error
    }
  }
}

export async function deletePortfolio(id: string): Promise<void> {
  const { error } = await supabase.from('portfolios').delete().eq('id', id)
  if (error) throw error
}

export async function setDefaultPortfolio(userId: string, portfolioId: string): Promise<void> {
  // Clear existing default
  await supabase
    .from('portfolios')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('is_default', true)

  // Set new default
  const { error } = await supabase
    .from('portfolios')
    .update({ is_default: true })
    .eq('id', portfolioId)
  if (error) throw error
}

// ─── Holdings CRUD ────────────────────────────────────────────────────────────

export async function listHoldings(portfolioId: string): Promise<PortfolioHolding[]> {
  const { data, error } = await supabase
    .from('portfolio_holdings')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('added_at', { ascending: true })

  if (error) throw error
  if (!Array.isArray(data)) return []
  return data.map(normalizeHolding).filter((item): item is PortfolioHolding => item !== null)
}

export async function upsertHolding(
  portfolioId: string,
  holding: Omit<PortfolioHolding, 'id' | 'portfolio_id' | 'added_at' | 'updated_at' | 'source'>,
): Promise<PortfolioHolding> {
  const { data, error } = await supabase
    .from('portfolio_holdings')
    .upsert(
      { portfolio_id: portfolioId, ...holding, source: 'manual', updated_at: new Date().toISOString() },
      { onConflict: 'portfolio_id,ticker,source' },
    )
    .select()
    .single()

  if (error) throw error
  return normalizeHolding(data) ?? data as unknown as PortfolioHolding
}

export async function deleteHolding(portfolioId: string, ticker: string): Promise<void> {
  const { error } = await supabase
    .from('portfolio_holdings')
    .delete()
    .eq('portfolio_id', portfolioId)
    .eq('ticker', ticker)
    .eq('source', 'manual')
  if (error) throw error
}

// ─── Allocation drift calculation ─────────────────────────────────────────────

export interface AllocationDrift {
  bucket: AssetBucket
  target_pct: number
  actual_pct: number
  drift_pct: number             // actual - target
  drift_severity: 'on_target' | 'minor' | 'moderate' | 'critical'
}

/**
 * Whether a broker vouches for this position, as opposed to the user having
 * typed it in as an intention. The plan and the account routinely disagree —
 * that difference is what the reconciliation surfaces — so any figure claiming
 * to be "actual" has to filter on this.
 */
export function isBrokerSourced(holding: PortfolioHolding): boolean {
  return holding.source === 'schwab' || holding.source === 'alpaca'
}

export function getHoldingMarketValue(holding: PortfolioHolding): number {
  if (holding.shares != null && holding.current_price != null) {
    return finiteNumber(holding.shares) * finiteNumber(holding.current_price)
  }
  return finiteNumber(holding.market_value)
}

export function computeAllocationDrift(
  allocations: AllocationTarget[],
  holdings: PortfolioHolding[],
  totalValue: number,
): AllocationDrift[] {
  const safeTotalValue = finiteNumber(totalValue)
  if (holdings.length === 0 || safeTotalValue <= 0) {
    return allocations.map((a) => {
      const target_pct = finiteNumber(a.target_pct)
      const absDrift = Math.abs(target_pct)
      const drift_severity: AllocationDrift['drift_severity'] =
        absDrift < 3 ? 'on_target' :
        absDrift < 8 ? 'minor' :
        absDrift < 15 ? 'moderate' :
        'critical'
      return {
        bucket: a.bucket as AssetBucket,
        target_pct,
        actual_pct: 0,
        drift_pct: target_pct === 0 ? 0 : -target_pct,
        drift_severity,
      }
    })
  }

  const actualByBucket = new Map<string, number>()
  for (const h of holdings) {
    const mv = getHoldingMarketValue(h)
    actualByBucket.set(h.bucket, (actualByBucket.get(h.bucket) ?? 0) + mv)
  }

  return allocations.map((a) => {
    const actualValue  = actualByBucket.get(a.bucket) ?? 0
    const target_pct   = finiteNumber(a.target_pct)
    const actual_pct   = safeTotalValue > 0 ? (actualValue / safeTotalValue) * 100 : 0
    const drift_pct    = actual_pct - target_pct
    const absDrift     = Math.abs(drift_pct)
    const drift_severity =
      absDrift < 3   ? 'on_target' :
      absDrift < 8   ? 'minor' :
      absDrift < 15  ? 'moderate' :
                       'critical'
    return { bucket: a.bucket as AssetBucket, target_pct, actual_pct, drift_pct, drift_severity }
  })
}

// ─── Goal metadata ─────────────────────────────────────────────────────────────

export const GOAL_METADATA: Record<GoalType, { typical_horizon: string; risk_range: string; primary_metric: string }> = {
  quality_growth:       { typical_horizon: '10yr+', risk_range: '3–4', primary_metric: 'ROIC, Revenue growth' },
  total_return:         { typical_horizon: '7–15yr', risk_range: '3–5', primary_metric: 'CAGR vs benchmark' },
  dividend_income:      { typical_horizon: '5–10yr', risk_range: '2–3', primary_metric: 'FCF yield, payout ratio' },
  capital_preservation: { typical_horizon: '1–5yr',  risk_range: '1–2', primary_metric: 'Max drawdown, Sharpe' },
  deep_value:           { typical_horizon: '3–7yr',  risk_range: '3–5', primary_metric: 'DCF upside, EV/EBIT' },
  balanced:             { typical_horizon: '5–10yr', risk_range: '2–3', primary_metric: 'Correlation, vol-weighted' },
}
