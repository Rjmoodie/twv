import type { WatchlistItem } from './useWatchlistOperations';

const finite = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);

export function valuationGap(item: Pick<WatchlistItem, 'current_price' | 'dcf_intrinsic_value'>): number | null {
  if (finite(item.current_price) && item.current_price > 0 && finite(item.dcf_intrinsic_value) && item.dcf_intrinsic_value >= 0) {
    return ((item.dcf_intrinsic_value - item.current_price) / item.current_price) * 100;
  }
  return null;
}

export function valuationGapLabel(gap: number | null, average = false): string {
  const prefix = average ? 'Average DCF ' : 'DCF ';
  if (gap == null) return `${prefix}gap`;
  if (gap > 0.05) return `${prefix}upside`;
  if (gap < -0.05) return `${prefix}downside`;
  return `${prefix}fair-value gap`;
}

export function valuationGapText(gap: number | null): string {
  if (gap == null) return 'N/A';
  if (Math.abs(gap) <= 0.05) return '0.0%';
  return `${Math.abs(gap).toFixed(1)}%`;
}

export type ValuationDirection = 'up' | 'down' | 'flat' | 'unknown';

/**
 * The single source of truth for which way a gap points.
 *
 * `valuationGapText` deliberately drops the sign — direction is carried by the
 * label and the colour beside it. That only works if every call site agrees on
 * the same thresholds, and they previously did not: one card treated a missing
 * gap as a downward arrow, a summary tile treated it as an upward one, and both
 * used a bare `> 0` while the label used a ±0.05 dead zone. So an unvalued idea
 * displayed "N/A" under a confident red arrow. Direction lives here now.
 */
export function valuationGapDirection(gap: number | null): ValuationDirection {
  if (gap == null) return 'unknown';
  if (Math.abs(gap) <= 0.05) return 'flat';
  return gap > 0 ? 'up' : 'down';
}

/**
 * Descending sort by valuation gap, unvalued ideas always last.
 *
 * Not `(gapB ?? -Infinity) - (gapA ?? -Infinity)`: two unvalued items make that
 * `-Infinity - -Infinity`, which is NaN, and a comparator returning NaN leaves
 * Array.prototype.sort free to produce any order it likes.
 */
export function compareByValuationGap(
  a: Pick<WatchlistItem, 'current_price' | 'dcf_intrinsic_value'>,
  b: Pick<WatchlistItem, 'current_price' | 'dcf_intrinsic_value'>,
): number {
  const gapA = valuationGap(a);
  const gapB = valuationGap(b);
  if (gapA == null && gapB == null) return 0;
  if (gapA == null) return 1;
  if (gapB == null) return -1;
  return gapB - gapA;
}

export function watchlistSummary(items: WatchlistItem[]) {
  const gaps = items.map(valuationGap).filter((value): value is number => value != null);
  const scores = items.map((item) => item.score).filter((value): value is number => finite(value));
  return {
    total: items.length,
    averageUpside: gaps.length ? gaps.reduce((sum, value) => sum + value, 0) / gaps.length : null,
    valuedCount: gaps.length,
    positiveCount: gaps.filter((value) => value > 0.05).length,
    highConviction: scores.filter((value) => value >= 80).length,
  };
}
