import { describe, it, expect } from 'vitest';
import { calculateDCF, clampDcfInput } from './utils';
import type { DCFParams, StockData } from './types';

const scenario: DCFParams = {
  revenueGrowth: 8,
  netMargin: 20,
  fcfGrowth: 10,
  exitMultiple: 18,
  discountRate: 10,
};

/** Same company, only the quoted price differs. */
const stockAt = (price: number): StockData => ({
  symbol: 'TEST',
  price,
  pe: 20,
  roe: 15,
  debtToEquity: 0.4,
  currentRatio: 1.8,
  marketCap: 100_000_000_000,
  eps: 5,
  financials: {
    revenue:   '25000000000',   // $25B
    netIncome: '5000000000',    // $5B  → 1,000M shares at $5 EPS
    freeCashFlow: '4500000000',
    sharesOutstanding: '1000000000',
  },
} as unknown as StockData);

describe('calculateDCF', () => {
  it('produces the same intrinsic value regardless of the current price', () => {
    // The defining bug: shares were derived as marketCap/price, so intrinsic
    // value scaled 1:1 with price and upside was constant at every price.
    const a = calculateDCF(scenario, stockAt(50));
    const b = calculateDCF(scenario, stockAt(100));
    const c = calculateDCF(scenario, stockAt(200));

    expect(a.intrinsicValue).toBeGreaterThan(0);
    expect(b.intrinsicValue).toBe(a.intrinsicValue);
    expect(c.intrinsicValue).toBe(a.intrinsicValue);
  });

  it('reports a cheaper price as more upside', () => {
    const cheap = calculateDCF(scenario, stockAt(50));
    const rich  = calculateDCF(scenario, stockAt(200));

    expect(cheap.upside!).toBeGreaterThan(rich.upside!);
  });

  it('discounts interim cash flows, not only the terminal value', () => {
    // If only the terminal value were discounted, halving the exit multiple
    // would halve the valuation exactly. With five years of discounted interim
    // flows in the sum, it cannot.
    const full = calculateDCF(scenario, stockAt(100)).intrinsicValue!;
    const half = calculateDCF({ ...scenario, exitMultiple: 9 }, stockAt(100)).intrinsicValue!;

    expect(half).toBeGreaterThan(full / 2);
  });

  it('returns null rather than a fabricated $0 when data is missing', () => {
    const result = calculateDCF(scenario, { symbol: 'X', price: 10 } as unknown as StockData);
    expect(result.intrinsicValue).toBeNull();
  });

  it('returns null for a null stock rather than 0', () => {
    expect(calculateDCF(scenario, null).intrinsicValue).toBeNull();
  });

  it('does not round intrinsic value to whole dollars', () => {
    // A sub-$5 result rounded to integers carried >15% quantisation error.
    const r = calculateDCF({ ...scenario, exitMultiple: 1, fcfGrowth: 0 }, stockAt(3));
    expect(Number.isInteger(r.intrinsicValue!)).toBe(false);
  });

  it('does not require revenue for a free-cash-flow valuation', () => {
    const stock = stockAt(100);
    stock.financials!.revenue = '';
    expect(calculateDCF(scenario, stock).intrinsicValue).toBeGreaterThan(0);
  });

  it('rejects persisted scenarios outside the editable safety bounds', () => {
    expect(calculateDCF({ ...scenario, discountRate: 0 }, stockAt(100)).intrinsicValue).toBeNull();
    expect(calculateDCF({ ...scenario, fcfGrowth: 75 }, stockAt(100)).intrinsicValue).toBeNull();
    expect(calculateDCF({ ...scenario, exitMultiple: 100 }, stockAt(100)).intrinsicValue).toBeNull();
  });

  it('clamps interactive inputs to their documented bounds', () => {
    expect(clampDcfInput('discountRate', -5)).toBe(1);
    expect(clampDcfInput('fcfGrowth', 80)).toBe(50);
    expect(clampDcfInput('exitMultiple', Number.NaN)).toBeNull();
  });
});
