import { describe, expect, it } from 'vitest'

/**
 * Mirrors the per-transaction rule in plaid-sync's rebuildCashFlows. The edge
 * function runs under Deno and cannot be imported here, so the rule is
 * reproduced exactly — the point is to pin the classification decisions that
 * caused the bugs, not the Supabase plumbing around them.
 *
 * Two bugs are pinned:
 *  - the current month was aggregated from an incremental sync delta and written
 *    as the month's total, zeroing it on every repeat sync;
 *  - transfers were classified by sign, so TRANSFER_IN (negative amount, and
 *    mapped to 'ignore') was counted as income.
 */

type Totals = { primary_income: number; other_income: number } & Record<string, number>

const empty = (): Totals => ({
  primary_income: 0, other_income: 0,
  housing: 0, food: 0, transport: 0, healthcare: 0, entertainment: 0,
  subscriptions: 0, clothing: 0, education: 0, travel: 0, other_expenses: 0,
})

const PRIMARY_INCOME_FLOOR = 500

interface Tx { date: string; amount: number; category_key: string | null }

function rebuild(rows: Tx[]): Map<string, Totals> {
  const byMonth = new Map<string, Totals>()
  for (const tx of rows) {
    const month = (tx.date ?? '').slice(0, 7)
    if (month.length !== 7) continue
    if (!byMonth.has(month)) byMonth.set(month, empty())
    const row = byMonth.get(month)!

    if (tx.category_key === 'income') {
      const incoming = Math.abs(tx.amount)
      if (incoming > PRIMARY_INCOME_FLOOR) row.primary_income += incoming
      else row.other_income += incoming
    } else if (tx.category_key && tx.amount > 0) {
      if (tx.category_key in row) row[tx.category_key] += tx.amount
      else row.other_expenses += tx.amount
    }
  }
  return byMonth
}

describe('cash flow rebuild', () => {
  it('is idempotent — the defect that produced "no data"', () => {
    const rows: Tx[] = [
      { date: '2026-08-01', amount: -3200, category_key: 'income' },
      { date: '2026-08-05', amount: 1400, category_key: 'housing' },
    ]
    // Running twice over the durable store must not change the answer. The old
    // path aggregated only what the incremental sync returned, so the second
    // run wrote near-zero over the first run's totals.
    const first = rebuild(rows).get('2026-08')!
    const second = rebuild(rows).get('2026-08')!
    expect(second).toEqual(first)
    expect(second.primary_income).toBe(3200)
    expect(second.housing).toBe(1400)
  })

  it('a later sync returning nothing new does not erase the month', () => {
    const stored: Tx[] = [{ date: '2026-08-01', amount: -3200, category_key: 'income' }]
    // The durable store is unchanged, so the rebuild is unchanged.
    expect(rebuild([...stored]).get('2026-08')!.primary_income).toBe(3200)
  })

  it('does not count an incoming transfer as income', () => {
    // TRANSFER_IN maps to 'ignore', stored as a null category_key, and carries a
    // negative amount. Classifying by sign inflated income and savings rate.
    const totals = rebuild([{ date: '2026-08-02', amount: -5000, category_key: null }]).get('2026-08')!
    expect(totals.primary_income).toBe(0)
    expect(totals.other_income).toBe(0)
  })

  it('does not count a card payment as an expense', () => {
    // Otherwise paying the card is double-counted against the original purchase.
    const totals = rebuild([{ date: '2026-08-02', amount: 400, category_key: null }]).get('2026-08')!
    const spent = Object.entries(totals)
      .filter(([k]) => !k.endsWith('income'))
      .reduce((s, [, v]) => s + v, 0)
    expect(spent).toBe(0)
  })

  it('splits income by the primary floor', () => {
    const totals = rebuild([
      { date: '2026-08-01', amount: -3200, category_key: 'income' },
      { date: '2026-08-09', amount: -120, category_key: 'income' },
    ]).get('2026-08')!
    expect(totals.primary_income).toBe(3200)
    expect(totals.other_income).toBe(120)
  })

  it('routes an unrecognised category to other_expenses rather than dropping it', () => {
    const totals = rebuild([{ date: '2026-08-03', amount: 75, category_key: 'crypto_mining' }]).get('2026-08')!
    expect(totals.other_expenses).toBe(75)
  })

  it('separates months', () => {
    const byMonth = rebuild([
      { date: '2026-07-31', amount: 100, category_key: 'food' },
      { date: '2026-08-01', amount: 250, category_key: 'food' },
    ])
    expect(byMonth.get('2026-07')!.food).toBe(100)
    expect(byMonth.get('2026-08')!.food).toBe(250)
  })

  it('ignores a malformed date instead of creating a junk month', () => {
    expect(rebuild([{ date: '', amount: 100, category_key: 'food' }]).size).toBe(0)
  })
})
