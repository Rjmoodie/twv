/**
 * Recommendation Engine
 *
 * Given a scored universe, allocation drift, and available capital,
 * produces a ranked, dollar-allocated list of specific stocks to buy.
 *
 * Logic:
 *   1. Identify underweight buckets from drift data
 *   2. Allocate available capital across those buckets (pro-rata by drift severity)
 *   3. Within each bucket, pick the top-scored unowned (or under-sized) stock
 *   4. Size each position using conviction weighting, capped at max_single_position_pct
 */

import type { Portfolio, ResearchResult, AssetBucket } from '@/types/portfolio'
import { getHoldingMarketValue, type AllocationDrift } from './portfolioService'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BuyRecommendation {
  ticker:             string
  company_name:       string
  bucket:             AssetBucket
  composite_score:    number
  amount_usd:         number
  shares:             number | null   // amount_usd / current_price
  current_price:      number | null
  dcf_upside_pct:     number | null   // base scenario
  goal_alignment_pct: number
  rationale:          string
  priority:           'high' | 'medium' | 'low'
  is_existing:        boolean         // already held — adding to position
}

export interface DeploymentPlan {
  recommendations:     BuyRecommendation[]
  total_allocated_usd: number
  unallocated_usd:     number          // capital left after position sizing
  buckets_addressed:   AssetBucket[]
  coverage_pct:        number          // % of available capital deployed
}

// ─── Severity weight for capital allocation ────────────────────────────────────

const SEVERITY_WEIGHT: Record<AllocationDrift['drift_severity'], number> = {
  critical:  4,
  moderate:  2,
  minor:     1,
  on_target: 0,
}

// ─── Main function ─────────────────────────────────────────────────────────────

export function generateDeploymentPlan(
  portfolio:        Portfolio,
  availableCapital: number,
  scoredResults:    ResearchResult[],
  drifts:           AllocationDrift[],
): DeploymentPlan {
  if (availableCapital <= 0 || scoredResults.length === 0) {
    return { recommendations: [], total_allocated_usd: 0, unallocated_usd: availableCapital, buckets_addressed: [], coverage_pct: 0 }
  }

  const holdings      = portfolio.holdings ?? []
  const heldTickers   = new Set(holdings.map((h) => h.ticker.toUpperCase()))
  const totalValue    = holdings.reduce((s, h) => s + getHoldingMarketValue(h), 0)
  // Use initial_capital as the portfolio basis when no holdings recorded yet
  const portfolioBasis = totalValue > 0 ? totalValue : (portfolio.initial_capital ?? availableCapital)
  const maxPositionPct = portfolio.max_single_position_pct / 100  // e.g. 0.10

  // ── Step 1: find underweight buckets ──────────────────────────────────────────
  const underweightBuckets = drifts
    .filter((d) => d.target_pct > d.actual_pct)   // any bucket short of target
    .sort((a, b) => {
      const wa = SEVERITY_WEIGHT[a.drift_severity]
      const wb = SEVERITY_WEIGHT[b.drift_severity]
      return wb !== wa
        ? wb - wa
        : (b.target_pct - b.actual_pct) - (a.target_pct - a.actual_pct)
    })

  // If no allocation targets set, treat all scored results as eligible
  const noTargets = drifts.length === 0

  // ── Step 2: allocate capital across underweight buckets ───────────────────────
  const totalWeight = underweightBuckets.reduce((s, d) => s + SEVERITY_WEIGHT[d.drift_severity], 0)
  const bucketBudget = new Map<AssetBucket, number>()

  if (noTargets) {
    // No allocations set — put all capital in the most general bucket
    bucketBudget.set('US_EQUITY_LARGE', availableCapital)
  } else {
    for (const d of underweightBuckets) {
      const weight = totalWeight > 0
        ? SEVERITY_WEIGHT[d.drift_severity]
        : Math.max(0, d.target_pct - d.actual_pct)
      const denominator = totalWeight > 0
        ? totalWeight
        : underweightBuckets.reduce((sum, item) => sum + Math.max(0, item.target_pct - item.actual_pct), 0)
      if (weight === 0 || denominator === 0) continue
      const share  = (weight / denominator) * availableCapital
      bucketBudget.set(d.bucket, share)
    }

    // When the portfolio is already on target, new cash still needs a policy.
    // Allocate it across target weights so the deposit maintains the allocation
    // rather than returning an empty plan.
    if (bucketBudget.size === 0) {
      const totalTarget = drifts.reduce((sum, item) => sum + Math.max(0, item.target_pct), 0)
      if (totalTarget > 0) {
        for (const drift of drifts) {
          if (drift.target_pct > 0) bucketBudget.set(drift.bucket, (drift.target_pct / totalTarget) * availableCapital)
        }
      }
    }
  }

  // ── Step 3: pick best candidates per bucket ───────────────────────────────────
  const recommendations: BuyRecommendation[] = []

  for (const [bucket, bucketCapital] of bucketBudget) {
    // Get passing results for this bucket, sorted by score
    let candidates = scoredResults
      .filter((r) => r.bucket === bucket && r.passes_filters)
      .sort((a, b) => b.composite_score - a.composite_score)

    // Fall back to any scored result if no passing ones in this bucket
    if (candidates.length === 0) {
      candidates = scoredResults
        .filter((r) => r.bucket === bucket)
        .sort((a, b) => b.composite_score - a.composite_score)
    }

    if (candidates.length === 0) continue

    // Pick the top candidate (prefer unowned, but will add to existing if nothing else)
    const unowned   = candidates.filter((r) => !heldTickers.has(r.ticker))
    const candidate = unowned[0] ?? candidates[0]

    // ── Step 4: conviction-weighted position sizing ───────────────────────────
    const score       = candidate.composite_score
    // Scale from 20% of max (score=0) to 100% of max (score=10)
    const scaleFactor = 0.20 + (score / 10) * 0.80
    const suggestedPct = scaleFactor * maxPositionPct

    // Position size = suggested % of total portfolio basis
    const maxPositionUsd  = suggestedPct * (portfolioBasis + availableCapital)
    const existingPositionValue = holdings
      .filter((holding) => holding.ticker.toUpperCase() === candidate.ticker.toUpperCase())
      .reduce((sum, holding) => sum + getHoldingMarketValue(holding), 0)
    const remainingPositionCapacity = Math.max(0, maxPositionUsd - existingPositionValue)
    // Don't allocate more than the bucket's budget or the max position cap
    const amount_usd      = Math.min(bucketCapital, remainingPositionCapacity)

    if (amount_usd <= 0) continue

    const current_price   = candidate.current_price ?? candidate.price_context?.current_price ?? null
    const shares          = current_price != null && current_price > 0
      ? amount_usd / current_price
      : null

    const dcf_upside_pct  = candidate.valuation?.base.upside_pct
      ?? candidate.value.dcf_upside_pct
      ?? null

    const drift           = drifts.find((d) => d.bucket === bucket)
    const gap             = drift ? (drift.target_pct - drift.actual_pct).toFixed(1) : null

    const rationale = buildRationale(candidate, gap, bucket)

    const priority: BuyRecommendation['priority'] =
      drift?.drift_severity === 'critical' ? 'high'
      : drift?.drift_severity === 'moderate' ? 'medium'
      : 'low'

    recommendations.push({
      ticker:             candidate.ticker,
      company_name:       candidate.company_name,
      bucket,
      composite_score:    candidate.composite_score,
      amount_usd,
      shares,
      current_price,
      dcf_upside_pct,
      goal_alignment_pct: candidate.goal_alignment_pct,
      rationale,
      priority,
      is_existing:        heldTickers.has(candidate.ticker),
    })
  }

  const total_allocated_usd = recommendations.reduce((s, r) => s + r.amount_usd, 0)
  const unallocated_usd     = availableCapital - total_allocated_usd
  const buckets_addressed   = [...bucketBudget.keys()]
  const coverage_pct        = availableCapital > 0
    ? Math.min(100, (total_allocated_usd / availableCapital) * 100)
    : 0

  // Sort: high priority first, then by score
  recommendations.sort((a, b) => {
    const pOrder = { high: 0, medium: 1, low: 2 }
    return pOrder[a.priority] !== pOrder[b.priority]
      ? pOrder[a.priority] - pOrder[b.priority]
      : b.composite_score - a.composite_score
  })

  return { recommendations, total_allocated_usd, unallocated_usd, buckets_addressed, coverage_pct }
}

// ─── Rationale builder ─────────────────────────────────────────────────────────

function buildRationale(r: ResearchResult, gapPct: string | null, bucket: AssetBucket): string {
  const parts: string[] = []

  if (gapPct != null) parts.push(`${bucket.replace(/_/g, ' ')} underweight by ${gapPct}%`)

  const roic = r.quality.roic_5yr_avg
  if (roic != null) parts.push(`ROIC ${(roic * 100).toFixed(0)}%`)

  const fcfYield = r.value.fcf_yield
  if (fcfYield != null) parts.push(`FCF yield ${(fcfYield * 100).toFixed(1)}%`)

  const dcfUpside = r.valuation?.base.upside_pct ?? r.value.dcf_upside_pct
  if (dcfUpside != null && dcfUpside > 0) parts.push(`DCF upside ${(dcfUpside * 100).toFixed(0)}%`)

  const revCagr = r.growth.revenue_cagr_3yr
  if (revCagr != null && revCagr > 0.05) parts.push(`Rev CAGR ${(revCagr * 100).toFixed(0)}%/yr`)

  if (r.quality.piotroski >= 7) parts.push(`Piotroski ${r.quality.piotroski}/9`)

  return parts.length > 0 ? parts.join(' · ') : `Score ${r.composite_score.toFixed(1)} — top in bucket`
}
