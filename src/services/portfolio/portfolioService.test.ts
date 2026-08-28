import { describe, it, expect } from 'vitest';

import { computeAllocationDrift, getHoldingMarketValue, normalizePortfolio } from './portfolioService';

describe('portfolio valuation logic', () => {
  it('derives market value from live price when the stored market_value is stale', () => {
    const holding = {
      id: '1',
      portfolio_id: 'p1',
      ticker: 'AAPL',
      bucket: 'US_EQUITY_LARGE',
      shares: 10,
      current_price: 200,
      market_value: 100,
      added_at: '2024-01-01',
      updated_at: '2024-01-01',
    } as any;

    expect(getHoldingMarketValue(holding)).toBe(2000);
  });

  it('computes drift from the derived live market value instead of stale snapshots', () => {
    const holdings = [{
      id: '1',
      portfolio_id: 'p1',
      ticker: 'AAPL',
      bucket: 'US_EQUITY_LARGE',
      shares: 10,
      current_price: 200,
      market_value: 100,
      added_at: '2024-01-01',
      updated_at: '2024-01-01',
    }] as any;

    const drift = computeAllocationDrift([
      { bucket: 'US_EQUITY_LARGE', target_pct: 60, min_pct: 0, max_pct: 100 },
      { bucket: 'CASH', target_pct: 40, min_pct: 0, max_pct: 100 },
    ], holdings, 2000);

    expect(drift[0].actual_pct).toBeGreaterThan(90);
    expect(drift[0].drift_pct).toBeGreaterThan(30);
  });

  it('normalizes numeric database strings and missing nested relations before rendering', () => {
    const portfolio = normalizePortfolio({
      id: 'p1',
      user_id: 'u1',
      name: 'Long Term',
      goal: 'balanced',
      horizon_years: '12',
      risk_tolerance: '3',
      risk_capacity: null,
      initial_capital: '25000.50',
      allocations: null,
      holdings: [{
        id: 'h1',
        portfolio_id: 'p1',
        ticker: ' aapl ',
        bucket: 'US_EQUITY_LARGE',
        shares: '2.5',
        current_price: '200.25',
      }],
    });

    expect(portfolio?.horizon_years).toBe(12);
    expect(portfolio?.risk_tolerance).toBe(3);
    expect(portfolio?.initial_capital).toBe(25000.5);
    expect(portfolio?.allocations).toEqual([]);
    expect(portfolio?.holdings?.[0]).toMatchObject({ ticker: 'AAPL', shares: 2.5, current_price: 200.25 });
  });

  it('drops malformed rows instead of allowing them to crash the Portfolio module', () => {
    expect(normalizePortfolio(null)).toBeNull();
    expect(normalizePortfolio({ id: 'p1' })).toBeNull();

    const portfolio = normalizePortfolio({
      id: 'p1',
      user_id: 'u1',
      name: '',
      holdings: [null, { ticker: 'MSFT' }],
      allocations: ['bad-row'],
    });
    expect(portfolio?.name).toBe('Portfolio');
    expect(portfolio?.goal).toBe('balanced');
    expect(portfolio?.holdings).toEqual([]);
    expect(portfolio?.allocations).toEqual([]);
  });

  it('uses Schwab holdings exclusively when a primary Schwab projection exists', () => {
    const portfolio = normalizePortfolio({
      id: 'p1', user_id: 'u1', name: 'Primary',
      holdings: [
        { id: 'manual', portfolio_id: 'p1', ticker: 'AAPL', bucket: 'US_EQUITY_LARGE', shares: 10, current_price: 100, source: 'manual' },
        { id: 'schwab', portfolio_id: 'p1', ticker: 'AAPL', bucket: 'US_EQUITY_LARGE', shares: 2, current_price: 100, source: 'schwab' },
      ],
    });
    expect(portfolio?.holdings).toHaveLength(1);
    expect(portfolio?.holdings?.[0]).toMatchObject({ id: 'schwab', source: 'schwab', shares: 2 });
  });

  it('keeps drift output finite when persisted numeric data is invalid', () => {
    const drift = computeAllocationDrift([
      { bucket: 'CASH', target_pct: Number.NaN, min_pct: 0, max_pct: 100 },
    ], [{
      bucket: 'CASH',
      shares: Number.POSITIVE_INFINITY,
      current_price: 10,
    } as any], Number.NaN);

    expect(drift[0]).toMatchObject({ target_pct: 0, actual_pct: 0, drift_pct: 0 });
  });

  it('treats an unfunded target allocation as underweight rather than on target', () => {
    const drift = computeAllocationDrift([
      { bucket: 'US_EQUITY_LARGE', target_pct: 60, min_pct: 50, max_pct: 70 },
      { bucket: 'CASH', target_pct: 40, min_pct: 30, max_pct: 50 },
    ], [], 0);

    expect(drift[0]).toMatchObject({ actual_pct: 0, drift_pct: -60, drift_severity: 'critical' });
    expect(drift[1]).toMatchObject({ actual_pct: 0, drift_pct: -40, drift_severity: 'critical' });
  });
});
