import { supabase } from '@/integrations/supabase/client'
import {
  compareToProjection,
  projectInvestmentGoalPath,
  type ProjectionComparison,
  type ProjectionPath,
} from '@/lib/investmentGoalEngine'
import type { InvestmentGoalRecord } from '@/services/investmentGoalService'

const db = supabase as any

export interface PortfolioValuePoint {
  as_of_date: string
  total_value: number
  cash_value: number
  connection_count: number
  last_synced_at: string
}

/**
 * Daily portfolio value, one row per day, from portfolio_value_history.
 * The view already collapses ~20-minute snapshots to a daily close, so this
 * returns hundreds of rows rather than tens of thousands.
 */
export async function getPortfolioValueHistory(
  portfolioId: string,
  sinceDays = 730,
): Promise<PortfolioValuePoint[]> {
  const since = new Date()
  since.setDate(since.getDate() - sinceDays)

  const { data, error } = await db.from('portfolio_value_history')
    .select('as_of_date,total_value,cash_value,connection_count,last_synced_at')
    .eq('portfolio_id', portfolioId)
    .gte('as_of_date', since.toISOString().slice(0, 10))
    .order('as_of_date', { ascending: true })
  if (error) throw error

  return (data ?? []).map((row: any) => ({
    as_of_date: row.as_of_date,
    total_value: Number(row.total_value ?? 0),
    cash_value: Number(row.cash_value ?? 0),
    connection_count: Number(row.connection_count ?? 0),
    last_synced_at: row.last_synced_at,
  }))
}

/**
 * The projection to measure progress against.
 *
 * Rebuilt from the goal's stored inputs and anchored at the goal's creation
 * date, not recomputed from today's balance. A projection that restarts from
 * wherever you are now would always report you exactly on plan, which is the
 * one thing a progress chart must never do.
 *
 * projectInvestmentGoalPath is seeded from its inputs, so the same goal always
 * reproduces the same baseline.
 */
export function baselineFor(goal: InvestmentGoalRecord): ProjectionPath | null {
  try {
    return projectInvestmentGoalPath(
      {
        targetAmount: Number(goal.target_amount),
        currentBalance: Number(goal.current_balance ?? 0),
        monthlyContribution: Number(goal.monthly_contribution ?? 0),
        horizonYears: Number(goal.horizon_years),
        riskProfile: goal.risk_profile as never,
        annualContributionGrowthPct: goal.annual_contribution_growth_pct ?? undefined,
        inflationPct: goal.inflation_pct ?? undefined,
      },
      goal.created_at,
    )
  } catch {
    // A goal saved before validation tightened, or with incomplete inputs, is
    // simply not chartable — better than throwing inside a dashboard render.
    return null
  }
}

export interface ProgressInsight {
  latest: PortfolioValuePoint | null
  comparison: ProjectionComparison | null
  /** Value change since the first recorded day. */
  changeSinceStartUsd: number | null
  changeSinceStartPct: number | null
  /** Days of history actually recorded — a chart needs at least a couple. */
  observedDays: number
  /** Growth beyond what contributions alone would explain, at the latest point. */
  growthVsContributionsUsd: number | null
  /**
   * Set when the plan was built from a starting balance the broker never
   * reported. Without this the chart reads a data disagreement as a shortfall,
   * which is the difference between "you are behind" and "your plan started
   * from a number that was never true".
   */
  startingBalanceMismatch: { planned: number; observed: number; differenceUsd: number } | null
  /** Progress toward the goal, 0–100+. */
  targetProgressPct: number | null
}

export function buildProgressInsight(
  history: PortfolioValuePoint[],
  baseline: ProjectionPath | null,
): ProgressInsight {
  const latest = history.at(-1) ?? null
  const first = history[0] ?? null

  const comparison = latest && baseline
    ? compareToProjection(baseline, latest.last_synced_at ?? latest.as_of_date, latest.total_value)
    : null

  const contributionsOnly = comparison && baseline
    ? baseline.points[comparison.month]?.contributionsOnly ?? null
    : null

  // The plan's month-0 balance against the first value the broker ever reported.
  // A material gap means the baseline was seeded from an assumption, not a fact.
  const plannedStart = baseline?.points[0]?.p50 ?? null
  const observedStart = first?.total_value ?? null
  const startTolerance =
    plannedStart == null ? 0 : Math.max(1, Math.abs(plannedStart) * 0.02)
  const startingBalanceMismatch =
    plannedStart != null && observedStart != null
      && Math.abs(plannedStart - observedStart) > startTolerance
      ? { planned: plannedStart, observed: observedStart, differenceUsd: plannedStart - observedStart }
      : null

  return {
    latest,
    comparison,
    changeSinceStartUsd: latest && first ? latest.total_value - first.total_value : null,
    changeSinceStartPct: latest && first && first.total_value !== 0
      ? ((latest.total_value - first.total_value) / first.total_value) * 100
      : null,
    observedDays: history.length,
    // Only meaningful once contributions have had time to accumulate; at month 0
    // it restates the starting balance and reads as a loss that never happened.
    growthVsContributionsUsd:
      latest && contributionsOnly != null && (comparison?.month ?? 0) >= 1
        ? latest.total_value - contributionsOnly
        : null,
    startingBalanceMismatch,
    targetProgressPct:
      latest && baseline && baseline.targetAmount > 0
        ? (latest.total_value / baseline.targetAmount) * 100
        : null,
  }
}
