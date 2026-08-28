/**
 * Rebalancing Engine
 *
 * Converts AllocationDrift data into prioritized BUY/TRIM/HOLD/REVIEW actions.
 * Uses portfolio rebalance_threshold_pct as the trigger, not a hardcoded constant.
 */

import type { Portfolio, AssetBucket } from '@/types/portfolio'
import type { AllocationDrift } from './portfolioService'

export type RebalanceAction = 'BUY' | 'TRIM' | 'HOLD' | 'REVIEW'

export interface RebalancingRecommendation {
  bucket: AssetBucket
  action: RebalanceAction
  drift_pct: number
  drift_severity: AllocationDrift['drift_severity']
  gap_usd: number | null   // positive = need to buy, negative = need to trim
  gap_pct: number          // target_pct - actual_pct (positive = underweight)
  target_pct: number
  actual_pct: number
  rationale: string
  priority: number         // 1 = highest urgency
}

const SEVERITY_PRIORITY: Record<AllocationDrift['drift_severity'], number> = {
  critical:  1,
  moderate:  2,
  minor:     3,
  on_target: 4,
}

export function buildRebalancingPlan(
  portfolio: Pick<Portfolio, 'rebalance_threshold_pct' | 'initial_capital'>,
  drifts: AllocationDrift[],
  totalValue: number,
): RebalancingRecommendation[] {
  const threshold = portfolio.rebalance_threshold_pct ?? 5
  const capital = totalValue > 0 ? totalValue : (portfolio.initial_capital ?? 0)

  const recs: RebalancingRecommendation[] = drifts.map((d) => {
    // gap is positive when underweight (need to buy), negative when overweight (need to trim)
    const gap_pct = d.target_pct - d.actual_pct
    const gap_usd = capital > 0 ? (gap_pct / 100) * capital : null

    let action: RebalanceAction
    let rationale: string

    if (d.drift_severity === 'on_target') {
      action = 'HOLD'
      rationale = `Within ±${threshold}% band — no action needed.`
    } else if (gap_pct > 0) {
      // Underweight
      if (d.drift_severity === 'critical' || d.drift_severity === 'moderate') {
        action = 'BUY'
        rationale = `${d.drift_severity === 'critical' ? 'Critically' : 'Moderately'} underweight by ${Math.abs(gap_pct).toFixed(1)}%. Add new positions or increase existing holdings in this bucket.`
      } else {
        action = 'HOLD'
        rationale = `Slightly underweight by ${Math.abs(gap_pct).toFixed(1)}%. Monitor — can address at next rebalance.`
      }
    } else {
      // Overweight
      if (d.drift_severity === 'critical' || d.drift_severity === 'moderate') {
        action = 'TRIM'
        rationale = `${d.drift_severity === 'critical' ? 'Critically' : 'Moderately'} overweight by ${Math.abs(gap_pct).toFixed(1)}%. Consider trimming or redirecting new capital elsewhere.`
      } else {
        action = 'HOLD'
        rationale = `Slightly overweight by ${Math.abs(gap_pct).toFixed(1)}%. Monitor — redirect new capital to underweight buckets.`
      }
    }

    return {
      bucket: d.bucket,
      action,
      drift_pct: d.drift_pct,
      drift_severity: d.drift_severity,
      gap_usd,
      gap_pct,
      target_pct: d.target_pct,
      actual_pct: d.actual_pct,
      rationale,
      priority: SEVERITY_PRIORITY[d.drift_severity],
    }
  })

  // Sort by priority (critical first), then by abs drift magnitude descending
  return recs.sort((a, b) =>
    a.priority !== b.priority
      ? a.priority - b.priority
      : Math.abs(b.gap_pct) - Math.abs(a.gap_pct)
  )
}

export function rebalanceSummary(recs: RebalancingRecommendation[]): {
  buyCount: number
  trimCount: number
  holdCount: number
  totalToBuy: number | null
  totalToTrim: number | null
} {
  let buyCount = 0, trimCount = 0, holdCount = 0
  let totalToBuy: number | null = null
  let totalToTrim: number | null = null

  for (const r of recs) {
    if (r.action === 'BUY') {
      buyCount++
      if (r.gap_usd != null) totalToBuy = (totalToBuy ?? 0) + r.gap_usd
    } else if (r.action === 'TRIM') {
      trimCount++
      if (r.gap_usd != null) totalToTrim = (totalToTrim ?? 0) + Math.abs(r.gap_usd)
    } else {
      holdCount++
    }
  }

  return { buyCount, trimCount, holdCount, totalToBuy, totalToTrim }
}
