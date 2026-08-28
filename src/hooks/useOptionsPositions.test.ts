import { describe, expect, it } from 'vitest';
import { parseOptionsPositions, parseVolumeAlerts } from './useOptionsPositions';

describe('parseVolumeAlerts', () => {
  it('normalizes provider percentages and volumes into finite numbers', () => {
    expect(parseVolumeAlerts([{ ticker: 'aapl', changePercent: '1.25%', volume: '1,200' }]))
      .toEqual([{ ticker: 'AAPL', changePercent: 1.25, volume: 1200, sentiment: 'Bullish' }]);
  });

  it('derives sentiment from the normalized change and drops malformed rows', () => {
    expect(parseVolumeAlerts([
      { ticker: 'TSLA', changePercent: -2, volume: 10 },
      { ticker: '', changePercent: 2, volume: 10 },
      { ticker: 'BAD', changePercent: 'n/a', volume: 10 },
    ])).toEqual([{ ticker: 'TSLA', changePercent: -2, volume: 10, sentiment: 'Bearish' }]);
  });
});

describe('parseOptionsPositions', () => {
  const position = {
    symbol: 'AAPL260116C00200000', ticker: 'AAPL', expiry: '2026-01-16', optionType: 'Call',
    strike: 200, daysToExpiry: 10, qty: '1', avgEntryPrice: '5', currentPrice: '6',
    marketValue: '600', unrealizedPl: '100', unrealizedPlPct: '20',
  };

  it('normalizes finite position values and rejects rows that would poison totals', () => {
    expect(parseOptionsPositions([position, { ...position, symbol: 'BAD', marketValue: 'NaN' }]))
      .toHaveLength(1);
    expect(parseOptionsPositions([position])[0]).toMatchObject({ qty: 1, marketValue: 600, optionType: 'Call' });
  });
});
