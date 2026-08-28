import { describe, expect, it } from 'vitest'

import { generateDeploymentPlan } from './recommendationEngine'
import type { Portfolio, ResearchResult } from '@/types/portfolio'

const portfolio = {
  id: 'p1',
  user_id: 'u1',
  name: 'Growth',
  goal: 'quality_growth',
  horizon_years: 10,
  risk_tolerance: 4,
  risk_capacity: 4,
  rebalance_threshold_pct: 5,
  min_conviction_score: 6,
  max_single_position_pct: 10,
  max_sector_concentration_pct: 30,
  min_positions: 5,
  max_positions: 20,
  initial_capital: 10_000,
  is_default: true,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  holdings: [],
} satisfies Portfolio

const candidate = {
  ticker: 'AAPL',
  company_name: 'Apple',
  bucket: 'US_EQUITY_LARGE',
  composite_score: 8,
  goal_alignment_pct: 90,
  passes_filters: true,
  current_price: 200,
  quality: { piotroski: 8, roic_5yr_avg: 0.2 },
  value: { fcf_yield: 0.04, dcf_upside_pct: 0.1 },
  growth: { revenue_cagr_3yr: 0.08 },
  valuation: { base: { upside_pct: 0.1 } },
} as ResearchResult

describe('generateDeploymentPlan', () => {
  it('produces finite, capped recommendations for a new unfunded portfolio', () => {
    const plan = generateDeploymentPlan(portfolio, 5_000, [candidate], [{
      bucket: 'US_EQUITY_LARGE',
      target_pct: 100,
      actual_pct: 0,
      drift_pct: -100,
      drift_severity: 'critical',
    }])

    expect(plan.recommendations).toHaveLength(1)
    expect(Number.isFinite(plan.recommendations[0].amount_usd)).toBe(true)
    expect(plan.recommendations[0].amount_usd).toBeLessThanOrEqual(1_500)
    expect(plan.unallocated_usd).toBeGreaterThanOrEqual(0)
  })

  it('does not fabricate a recommendation when no researched candidate fits the bucket', () => {
    const plan = generateDeploymentPlan(portfolio, 5_000, [candidate], [{
      bucket: 'FIXED_INCOME_INVESTMENT_GRADE',
      target_pct: 100,
      actual_pct: 0,
      drift_pct: -100,
      drift_severity: 'critical',
    }])

    expect(plan.recommendations).toEqual([])
    expect(plan.unallocated_usd).toBe(5_000)
  })

  it('allocates new cash by target weight when every bucket is currently on target', () => {
    const plan = generateDeploymentPlan(portfolio, 1_000, [candidate], [{
      bucket: 'US_EQUITY_LARGE',
      target_pct: 100,
      actual_pct: 100,
      drift_pct: 0,
      drift_severity: 'on_target',
    }])

    expect(plan.recommendations).toHaveLength(1)
    expect(plan.recommendations[0].amount_usd).toBeGreaterThan(0)
  })

  it('does not recommend adding to a position that is already above its position cap', () => {
    const concentrated = {
      ...portfolio,
      holdings: [{
        id: 'h1', portfolio_id: portfolio.id, ticker: 'AAPL', bucket: 'US_EQUITY_LARGE' as const,
        market_value: 5_000, added_at: '2026-01-01', updated_at: '2026-01-01',
      }],
    }
    const plan = generateDeploymentPlan(concentrated, 1_000, [candidate], [{
      bucket: 'US_EQUITY_LARGE', target_pct: 100, actual_pct: 100, drift_pct: 0, drift_severity: 'on_target',
    }])

    expect(plan.recommendations).toEqual([])
    expect(plan.unallocated_usd).toBe(1_000)
  })
})
