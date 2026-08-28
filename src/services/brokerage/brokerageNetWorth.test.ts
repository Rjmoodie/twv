import { describe, expect, it } from 'vitest'
import { latestPerConnection, snapshotValue, summarise } from './brokerageNetWorth'

const row = (over: Partial<Parameters<typeof snapshotValue>[0]> & {
  connection_id?: string
  provider_data_as_of?: string
} = {}) => ({
  connection_id: 'c1',
  liquidation_value: 1000,
  cash_balance: 100,
  long_market_value: 900,
  provider_data_as_of: '2026-08-27T12:00:00Z',
  ...over,
})

describe('snapshotValue', () => {
  it('prefers the broker\'s own total', () => {
    // Deliberately inconsistent parts: liquidation_value must win outright.
    expect(snapshotValue({ liquidation_value: 5000, cash_balance: 1, long_market_value: 1 })).toBe(5000)
  })

  it('reads numerics that arrive as strings', () => {
    expect(snapshotValue({ liquidation_value: '4200.50', cash_balance: null, long_market_value: null })).toBe(4200.5)
  })

  it('treats a real zero as a value, not a gap', () => {
    expect(snapshotValue({ liquidation_value: 0, cash_balance: null, long_market_value: null })).toBe(0)
  })

  it('falls back to the parts when the total is missing', () => {
    expect(snapshotValue({ liquidation_value: null, cash_balance: 250, long_market_value: 750 })).toBe(1000)
  })

  it('accepts a partial fallback rather than discarding it', () => {
    expect(snapshotValue({ liquidation_value: null, cash_balance: 250, long_market_value: null })).toBe(250)
  })

  it('returns null when nothing is usable — never a silent zero', () => {
    expect(snapshotValue({ liquidation_value: null, cash_balance: null, long_market_value: null })).toBeNull()
  })

  it('rejects non-numeric junk', () => {
    expect(snapshotValue({ liquidation_value: 'n/a', cash_balance: null, long_market_value: null })).toBeNull()
  })
})

describe('latestPerConnection', () => {
  it('keeps the first row seen per connection', () => {
    const latest = latestPerConnection([
      row({ connection_id: 'a', provider_data_as_of: '2026-08-27T12:00:00Z', liquidation_value: 300 }),
      row({ connection_id: 'a', provider_data_as_of: '2026-08-26T12:00:00Z', liquidation_value: 200 }),
      row({ connection_id: 'b', provider_data_as_of: '2026-08-25T12:00:00Z', liquidation_value: 100 }),
    ])
    expect(latest.get('a')?.liquidation_value).toBe(300)
    expect(latest.get('b')?.liquidation_value).toBe(100)
  })
})

describe('summarise', () => {
  it('sums across connections rather than reporting only one', () => {
    // getLatestCashSnapshot takes a single row across all connections; net worth
    // must not repeat that.
    const latest = latestPerConnection([
      row({ connection_id: 'a', liquidation_value: 1000 }),
      row({ connection_id: 'b', liquidation_value: 2500 }),
    ])
    expect(summarise(['a', 'b'], latest).totalUsd).toBe(3500)
  })

  it('reports the stalest snapshot time, not the freshest', () => {
    const latest = latestPerConnection([
      row({ connection_id: 'a', provider_data_as_of: '2026-08-27T12:00:00Z' }),
      row({ connection_id: 'b', provider_data_as_of: '2026-08-01T12:00:00Z' }),
    ])
    expect(summarise(['a', 'b'], latest).asOf).toBe('2026-08-01T12:00:00Z')
  })

  it('counts a connection with no snapshot as unvalued', () => {
    const result = summarise(['a', 'b'], latestPerConnection([row({ connection_id: 'a' })]))
    expect(result.unvaluedCount).toBe(1)
    expect(result.connectionCount).toBe(2)
    expect(result.totalUsd).toBe(1000)
  })

  it('counts an unusable snapshot as unvalued instead of adding zero', () => {
    const latest = latestPerConnection([
      row({ connection_id: 'a', liquidation_value: null, cash_balance: null, long_market_value: null }),
    ])
    const result = summarise(['a'], latest)
    expect(result.unvaluedCount).toBe(1)
    expect(result.totalUsd).toBe(0)
    // Nothing was valued, so there is no as-of to claim.
    expect(result.asOf).toBeNull()
  })

  it('handles a negative account value without special-casing it', () => {
    // A margin account can be worth less than nothing.
    const latest = latestPerConnection([row({ connection_id: 'a', liquidation_value: -500 })])
    expect(summarise(['a'], latest).totalUsd).toBe(-500)
  })
})
