import { describe, expect, it } from 'vitest'
import { reconcilePositions, unreconciledPositions } from './positionReconciliation'
import type { PortfolioHolding } from '@/types/portfolio'

const holding = (over: Partial<PortfolioHolding>): PortfolioHolding => ({
  id: Math.random().toString(36).slice(2),
  portfolio_id: 'p1',
  ticker: 'AAPL',
  bucket: 'US_EQUITY_LARGE' as PortfolioHolding['bucket'],
  added_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  ...over,
})

describe('position reconciliation', () => {
  it('marks a plan with no broker position as not yet held', () => {
    const [row] = reconcilePositions([holding({ ticker: 'LMT', source: 'manual', shares: 10 })])
    expect(row.state).toBe('planned_not_held')
    expect(row.plannedShares).toBe(10)
    expect(row.actualShares).toBeNull()
  })

  it('marks a broker position with no plan as unplanned', () => {
    const [row] = reconcilePositions([holding({ ticker: 'TSLA', source: 'schwab', shares: 4 })])
    expect(row.state).toBe('held_not_planned')
    expect(row.actualShares).toBe(4)
    expect(row.planned).toBeNull()
  })

  it('reconciles when both sides agree', () => {
    const [row] = reconcilePositions([
      holding({ ticker: 'AAPL', source: 'manual', shares: 10 }),
      holding({ ticker: 'AAPL', source: 'schwab', shares: 10 }),
    ])
    expect(row.state).toBe('reconciled')
    expect(row.shareVariance).toBe(0)
  })

  it('reports a size difference with its direction', () => {
    const [row] = reconcilePositions([
      holding({ ticker: 'AAPL', source: 'manual', shares: 10 }),
      holding({ ticker: 'AAPL', source: 'schwab', shares: 6 }),
    ])
    expect(row.state).toBe('quantity_variance')
    expect(row.shareVariance).toBe(-4) // holds less than planned
  })

  it('tolerates fractional-share rounding rather than flagging it', () => {
    const [row] = reconcilePositions([
      holding({ ticker: 'AAPL', source: 'manual', shares: 100 }),
      holding({ ticker: 'AAPL', source: 'schwab', shares: 100.004 }),
    ])
    expect(row.state).toBe('reconciled')
  })

  it('sums several broker rows for one ticker before comparing', () => {
    const [row] = reconcilePositions([
      holding({ ticker: 'AAPL', source: 'manual', shares: 10 }),
      holding({ ticker: 'AAPL', source: 'schwab', shares: 6, market_value: 600 }),
      holding({ ticker: 'AAPL', source: 'alpaca', shares: 4, market_value: 400 }),
    ])
    expect(row.state).toBe('reconciled')
    expect(row.actualShares).toBe(10)
    expect(row.actualValue).toBe(1000)
  })

  it('ignores cash, which is an allocation input rather than a position', () => {
    expect(reconcilePositions([
      holding({ ticker: 'CASH', bucket: 'CASH' as PortfolioHolding['bucket'], source: 'schwab', shares: 3.4 }),
    ])).toHaveLength(0)
  })

  it('returns only rows needing a decision', () => {
    const rows = unreconciledPositions([
      holding({ ticker: 'AAPL', source: 'manual', shares: 10 }),
      holding({ ticker: 'AAPL', source: 'schwab', shares: 10 }),
      holding({ ticker: 'LMT', source: 'manual', shares: 5 }),
    ])
    expect(rows.map(r => r.ticker)).toEqual(['LMT'])
  })
})
