import { describe, expect, it } from 'vitest';
import type { WatchlistItem } from './useWatchlistOperations';
import { compareByValuationGap, valuationGap, valuationGapDirection, valuationGapLabel, valuationGapText, watchlistSummary } from './watchlistMetrics';

const item = (overrides: Partial<WatchlistItem> = {}) => ({
  id: '1', user_id: 'u', ticker: 'TEST', added_at: '2026-01-01', updated_at: '2026-01-01',
  current_price: 200, dcf_intrinsic_value: 100, dcf_upside_percentage: 99, score: null,
  ...overrides,
} as WatchlistItem);

describe('watchlist valuation presentation', () => {
  it('recomputes the gap from current price and DCF value instead of trusting a stale percentage', () => {
    expect(valuationGap(item())).toBe(-50);
  });

  it('labels negative gaps as downside and presents the magnitude clearly', () => {
    expect(valuationGapLabel(-49.7)).toBe('DCF downside');
    expect(valuationGapText(-49.7)).toBe('49.7%');
  });

  it('excludes unavailable valuations from the average rather than treating them as zero', () => {
    const summary = watchlistSummary([item(), item({ id: '2', current_price: null, dcf_intrinsic_value: null, dcf_upside_percentage: null })]);
    expect(summary.averageUpside).toBe(-50);
    expect(summary.valuedCount).toBe(1);
    expect(summary.total).toBe(2);
  });

  it('returns an unavailable gap when neither current inputs nor a stored result are usable', () => {
    expect(valuationGap(item({ current_price: 0, dcf_intrinsic_value: null, dcf_upside_percentage: null }))).toBeNull();
  });
});

describe('valuation direction', () => {
  it('reports an unknown gap as unknown rather than defaulting it to a direction', () => {
    expect(valuationGapDirection(null)).toBe('unknown');
  });

  it('uses the same dead zone as the label, so a negligible gap is never shown with an arrow', () => {
    expect(valuationGapDirection(0.02)).toBe('flat');
    expect(valuationGapDirection(-0.02)).toBe('flat');
    expect(valuationGapLabel(0.02)).toBe('DCF fair-value gap');
    expect(valuationGapText(0.02)).toBe('0.0%');
  });

  it('reports meaningful gaps in the direction they point', () => {
    expect(valuationGapDirection(12)).toBe('up');
    expect(valuationGapDirection(-12)).toBe('down');
  });
});

describe('sorting by valuation gap', () => {
  it('never returns NaN for two unvalued items, which would leave the sort order undefined', () => {
    const blank = item({ current_price: null, dcf_intrinsic_value: null });
    expect(compareByValuationGap(blank, blank)).toBe(0);
  });

  it('ranks the widest upside first and pushes unvalued ideas to the end', () => {
    const wide = item({ id: 'wide', current_price: 100, dcf_intrinsic_value: 200 });     // +100%
    const narrow = item({ id: 'narrow', current_price: 100, dcf_intrinsic_value: 110 }); // +10%
    const unvalued = item({ id: 'unvalued', current_price: null, dcf_intrinsic_value: null });
    const sorted = [unvalued, narrow, wide].sort(compareByValuationGap).map((entry) => entry.id);
    expect(sorted).toEqual(['wide', 'narrow', 'unvalued']);
  });

  it('keeps unvalued ideas last even when the only valued idea is a deep downside', () => {
    const loss = item({ id: 'loss', current_price: 200, dcf_intrinsic_value: 50 });      // -75%
    const unvalued = item({ id: 'unvalued', current_price: null, dcf_intrinsic_value: null });
    expect([unvalued, loss].sort(compareByValuationGap).map((entry) => entry.id)).toEqual(['loss', 'unvalued']);
  });
});
