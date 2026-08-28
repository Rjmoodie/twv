import { describe, expect, it } from 'vitest'
import {
  compareToProjection,
  projectInvestmentGoalPath,
  type InvestmentGoalInputs,
} from './investmentGoalEngine'

const inputs: InvestmentGoalInputs = {
  targetAmount: 100_000,
  currentBalance: 10_000,
  monthlyContribution: 500,
  horizonYears: 10,
  riskProfile: 'moderate',
}

describe('projectInvestmentGoalPath', () => {
  it('emits one point per month plus the starting point', () => {
    const path = projectInvestmentGoalPath(inputs, '2026-01-01T00:00:00Z')
    expect(path.points).toHaveLength(10 * 12 + 1)
    expect(path.points[0].month).toBe(0)
  })

  it('starts every band at the current balance', () => {
    const { points } = projectInvestmentGoalPath(inputs, '2026-01-01T00:00:00Z')
    expect(points[0].p10).toBe(10_000)
    expect(points[0].p50).toBe(10_000)
    expect(points[0].p90).toBe(10_000)
    expect(points[0].contributionsOnly).toBe(10_000)
  })

  it('keeps the percentiles ordered at every step', () => {
    const { points } = projectInvestmentGoalPath(inputs, '2026-01-01T00:00:00Z')
    for (const point of points) {
      expect(point.p10).toBeLessThanOrEqual(point.p50)
      expect(point.p50).toBeLessThanOrEqual(point.p90)
    }
  })

  it('is deterministic — the same inputs must not redraw the baseline', () => {
    const a = projectInvestmentGoalPath(inputs, '2026-01-01T00:00:00Z')
    const b = projectInvestmentGoalPath(inputs, '2026-01-01T00:00:00Z')
    expect(a.points.at(-1)!.p50).toBe(b.points.at(-1)!.p50)
  })

  it('tracks contributions with no market return', () => {
    const { points } = projectInvestmentGoalPath(inputs, '2026-01-01T00:00:00Z')
    // 12 months of $500 on top of $10,000, no growth applied in year one.
    expect(points[12].contributionsOnly).toBe(10_000 + 500 * 12)
  })

  it('advances the date by one month per step', () => {
    const { points } = projectInvestmentGoalPath(inputs, '2026-01-15T00:00:00Z')
    expect(points[0].date).toBe('2026-01-15')
    expect(points[1].date.slice(0, 7)).toBe('2026-02')
  })

  it('rejects an out-of-range horizon rather than charting nonsense', () => {
    expect(() => projectInvestmentGoalPath({ ...inputs, horizonYears: 0 }, '2026-01-01T00:00:00Z'))
      .toThrow(/horizon/i)
  })

  it('accepts the shortest valid horizon', () => {
    const path = projectInvestmentGoalPath({ ...inputs, horizonYears: 1 }, '2026-01-01T00:00:00Z')
    expect(path.points).toHaveLength(13)
  })
})

describe('compareToProjection', () => {
  const path = projectInvestmentGoalPath(inputs, '2026-01-01T00:00:00Z')

  it('reports being ahead of the median as a positive variance', () => {
    const ahead = compareToProjection(path, '2026-01-01T00:00:00Z', 12_000)
    expect(ahead!.varianceUsd).toBe(2_000)
    expect(ahead!.variancePct).toBeCloseTo(20, 5)
  })

  it('classifies a value inside the band as within', () => {
    const point = path.points[12]
    const mid = (point.p10 + point.p90) / 2
    expect(compareToProjection(path, '2027-01-01T00:00:00Z', mid)!.band).toBe('within')
  })

  it('classifies extremes as below and above', () => {
    expect(compareToProjection(path, '2027-01-01T00:00:00Z', 0)!.band).toBe('below')
    expect(compareToProjection(path, '2027-01-01T00:00:00Z', 10_000_000)!.band).toBe('above')
  })

  it('clamps a date past the horizon to the final month rather than failing', () => {
    const result = compareToProjection(path, '2099-01-01T00:00:00Z', 50_000)
    expect(result!.month).toBe(path.points.length - 1)
  })

  it('returns null for an unparseable date', () => {
    expect(compareToProjection(path, 'not-a-date', 1_000)).toBeNull()
  })
})
