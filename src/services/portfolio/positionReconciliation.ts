import type { PortfolioHolding } from '@/types/portfolio'

/**
 * Plan versus actual.
 *
 * A SomaTech holding is an intention: what the policy says you should own.
 * A broker-sourced holding is a fact: what the account actually holds. They are
 * stored as separate rows on purpose (portfolio_holdings is keyed by
 * portfolio_id, ticker, source), so the two can disagree — and the disagreement
 * is the useful part. Every difference below is something a person can act on.
 */

export type ReconciliationState =
  | 'reconciled'         // planned and held, quantities agree
  | 'planned_not_held'   // intent recorded, nothing bought yet
  | 'held_not_planned'   // the broker holds something the plan never called for
  | 'quantity_variance'  // both sides exist but disagree on size

/** Sources that represent broker fact rather than user intent. */
const BROKER_SOURCES = new Set(['schwab', 'alpaca'])

/** Cash is an allocation input, not a position anyone plans to "buy". */
const NON_POSITION_BUCKETS = new Set(['CASH'])

export interface ReconciledPosition {
  ticker: string
  company_name: string | null
  state: ReconciliationState
  planned: PortfolioHolding | null
  actual: PortfolioHolding | null
  plannedShares: number | null
  actualShares: number | null
  /** actual − planned. Positive means the account holds more than intended. */
  shareVariance: number | null
  /** Market value of the broker position, when known. */
  actualValue: number | null
}

const shares = (holding: PortfolioHolding | null): number | null =>
  holding?.shares == null ? null : Number(holding.shares)

/**
 * Quantities are compared with a relative tolerance so fractional-share
 * rounding at the broker does not read as a discrepancy.
 */
function quantitiesAgree(planned: number | null, actual: number | null): boolean {
  if (planned == null || actual == null) return planned === actual
  const tolerance = Math.max(0.01, Math.abs(planned) * 0.005)
  return Math.abs(actual - planned) <= tolerance
}

export function reconcilePositions(holdings: PortfolioHolding[]): ReconciledPosition[] {
  const planned = new Map<string, PortfolioHolding>()
  const actual = new Map<string, PortfolioHolding>()

  for (const holding of holdings) {
    if (NON_POSITION_BUCKETS.has(String(holding.bucket))) continue
    const ticker = holding.ticker?.toUpperCase()
    if (!ticker) continue

    if (BROKER_SOURCES.has(String(holding.source))) {
      // Several broker rows can map to one ticker (multiple accounts); the
      // account's total is what the plan should be measured against.
      const existing = actual.get(ticker)
      if (!existing) {
        actual.set(ticker, holding)
      } else {
        actual.set(ticker, {
          ...existing,
          shares: (Number(existing.shares ?? 0)) + Number(holding.shares ?? 0),
          market_value: (Number(existing.market_value ?? 0)) + Number(holding.market_value ?? 0),
        })
      }
    } else {
      planned.set(ticker, holding)
    }
  }

  const tickers = [...new Set([...planned.keys(), ...actual.keys()])].sort()

  return tickers.map(ticker => {
    const plannedHolding = planned.get(ticker) ?? null
    const actualHolding = actual.get(ticker) ?? null
    const plannedShares = shares(plannedHolding)
    const actualShares = shares(actualHolding)

    let state: ReconciliationState
    if (plannedHolding && !actualHolding) state = 'planned_not_held'
    else if (!plannedHolding && actualHolding) state = 'held_not_planned'
    else if (quantitiesAgree(plannedShares, actualShares)) state = 'reconciled'
    else state = 'quantity_variance'

    return {
      ticker,
      company_name: plannedHolding?.company_name ?? actualHolding?.company_name ?? null,
      state,
      planned: plannedHolding,
      actual: actualHolding,
      plannedShares,
      actualShares,
      shareVariance:
        plannedShares == null || actualShares == null ? null : actualShares - plannedShares,
      actualValue: actualHolding?.market_value == null ? null : Number(actualHolding.market_value),
    }
  })
}

/** Only the rows that need a decision. */
export function unreconciledPositions(holdings: PortfolioHolding[]): ReconciledPosition[] {
  return reconcilePositions(holdings).filter(position => position.state !== 'reconciled')
}

export const RECONCILIATION_COPY: Record<ReconciliationState, { label: string; detail: string }> = {
  reconciled: {
    label: 'Reconciled',
    detail: 'Your plan and your broker agree.',
  },
  planned_not_held: {
    label: 'Planned, not held',
    detail: 'This position is in your plan but the broker does not hold it.',
  },
  held_not_planned: {
    label: 'Held, not planned',
    detail: 'Your broker holds this but your plan never called for it.',
  },
  quantity_variance: {
    label: 'Size differs',
    detail: 'Your plan and the broker disagree on how much you hold.',
  },
}
