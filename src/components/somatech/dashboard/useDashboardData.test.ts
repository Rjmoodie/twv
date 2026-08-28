import { describe, expect, it } from 'vitest';
import { parseDashboardQuote } from './useDashboardData';

describe('parseDashboardQuote', () => {
  it('normalizes a valid provider quote', () => {
    expect(parseDashboardQuote({
      'Global Quote': {
        '05. price': '523.4500',
        '10. change percent': '-1.25%',
      },
    })).toEqual({ price: 523.45, change: -1.25 });
  });

  it('rejects missing, invalid, and zero prices', () => {
    expect(parseDashboardQuote(null)).toBeNull();
    expect(parseDashboardQuote({ 'Global Quote': {} })).toBeNull();
    expect(parseDashboardQuote({ 'Global Quote': { '05. price': '0' } })).toBeNull();
  });

  it('keeps change unknown when the provider omits a valid percentage', () => {
    expect(parseDashboardQuote({
      'Global Quote': { '05. price': '100', '10. change percent': 'n/a' },
    })).toEqual({ price: 100, change: null });
  });
});
