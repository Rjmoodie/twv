/**
 * Does a filed period hold together?
 *
 * EDGAR is authoritative but not tidy: filers tag inconsistently, a 10-Q's
 * standalone quarter often has to be recovered by subtracting one cumulative
 * fact from another, and the newest filing is the one most likely to be labelled
 * in a way the selector reads wrong. When that happens the result is not a blank
 * -- it is a confident number, rendered with exactly the same weight as a
 * correct one. GOOG Q2 FY2026 showed net income of $112.2B beside operating
 * income of $40.8B, a 94% net margin, and a cash-conversion tile of 0.35x that
 * was computed off it.
 *
 * These checks do not repair anything and never discard a value. They answer one
 * question -- can this number be what it claims to be -- so a caller can refuse
 * to build a headline percentage or a derived ratio on top of an input that
 * failed. Same stance as the price sanity check on insider transactions: keep
 * the row, mark it, do not let it drive a conclusion.
 *
 * Every check is skipped rather than failed when its inputs are absent. A filer
 * that does not tag `Liabilities` -- roughly a quarter of the audited universe --
 * must not be reported as violating the accounting identity.
 */

import type { AnnualFinancial } from './financialStatementAnalytics';

const finite = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export type AnomalySeverity =
  /** Violates an accounting identity or a sign that cannot be negative. */
  | 'impossible'
  /** Internally consistent but far outside what the rest of the series supports. */
  | 'implausible';

export interface Anomaly {
  /** The field whose value is in question, matching a key of AnnualFinancial. */
  field: string;
  severity: AnomalySeverity;
  /** Written for a reader of the panel, not a maintainer of the parser. */
  reason: string;
}

/**
 * How far assets may sit from liabilities plus equity before the period is
 * called broken.
 *
 * Not a rounding allowance. `shareholderEquity` resolves to a parent-only
 * concept by preference (see TAGS.shareholderEquity), so for any filer that
 * consolidates a subsidiary it does not wholly own, the identity is short by the
 * noncontrolling interest -- and that is a correct filing, not a defect. At a 2%
 * tolerance this rule fired on Tesla, Exxon and Prologis across nearly every
 * year they have filed, labelling all of them "impossible".
 *
 * So the question it actually answers is: is the gap too large for minority
 * interests to explain? A parent consolidating entities it barely owns is rare;
 * a fifth of total assets is far beyond it. The check stays useful because the
 * failure it exists to catch is not subtle -- GOOG Q2 FY2026 showed $922B of
 * assets against $600B of liabilities and equity, a 35% gap.
 */
const IDENTITY_TOLERANCE = 0.2;
/** Non-operating income above this share of revenue is a one-off, not a quarter. */
const NON_OPERATING_SHARE = 0.25;
/** A flow this far above its own trailing median is an outlier, not growth. */
const FLOW_OUTLIER_MULTIPLE = 4;
/** Fewest trailing periods before a median means anything. */
const MIN_HISTORY = 3;
/** Balance sheets are stocks: they move gradually, absent an acquisition. */
const STOCK_JUMP = 0.5;

/** Fields that accumulate over a period, compared against their own history. */
const FLOW_FIELDS = ['revenue', 'netIncome', 'operatingIncome', 'operatingCashFlow', 'capex'] as const;

/** Fields that cannot be negative in any filing. Equity and retained earnings can. */
const NON_NEGATIVE_FIELDS = ['revenue', 'totalAssets', 'currentAssets', 'currentLiabilities', 'cash', 'capex'] as const;

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Checks that need only the period itself. These are the strong ones: an
 * accounting identity does not care how fast the company is growing, so it
 * cannot be tripped by an unusual but real quarter.
 */
export function checkPeriod(period: AnnualFinancial): Anomaly[] {
  const anomalies: Anomaly[] = [];

  for (const field of NON_NEGATIVE_FIELDS) {
    const value = period[field];
    if (finite(value) && value < 0) {
      anomalies.push({ field, severity: 'impossible', reason: `${field} is filed as a negative amount.` });
    }
  }

  // Assets = liabilities + equity. Skipped entirely unless all three are
  // present, because a filer that omits `Liabilities` has a gap, not an error.
  const { totalAssets, totalLiabilities, shareholderEquity } = period;
  if (finite(totalAssets) && finite(totalLiabilities) && finite(shareholderEquity) && totalAssets > 0) {
    const gap = Math.abs(totalAssets - (totalLiabilities + shareholderEquity));
    if (gap / totalAssets > IDENTITY_TOLERANCE) {
      anomalies.push({
        field: 'totalAssets',
        severity: 'impossible',
        reason: 'Total assets do not equal liabilities plus equity for this period.',
      });
    }
  }

  if (finite(period.currentAssets) && finite(totalAssets) && period.currentAssets > totalAssets) {
    anomalies.push({ field: 'currentAssets', severity: 'impossible', reason: 'Current assets exceed total assets.' });
  }

  if (finite(period.cash) && finite(period.currentAssets) && period.cash > period.currentAssets) {
    anomalies.push({ field: 'cash', severity: 'impossible', reason: 'Cash exceeds total current assets.' });
  }

  // A large gap between net and operating income is a one-off gain, a tax
  // benefit, or a mis-selected fact -- all three are worth verifying before a
  // percentage is quoted off it. Requiring positive net income keeps a
  // loss-making filer, whose operating loss is larger still, from tripping it.
  const { netIncome, operatingIncome, revenue } = period;
  if (finite(netIncome) && finite(operatingIncome) && finite(revenue)
      && netIncome > 0 && revenue > 0
      && netIncome - operatingIncome > NON_OPERATING_SHARE * revenue) {
    anomalies.push({
      field: 'netIncome',
      severity: 'implausible',
      reason: 'Net income exceeds operating income by more than a quarter of revenue.',
    });
  }

  return anomalies;
}

/**
 * Checks that need the surrounding series. Weaker than the structural ones --
 * a genuinely exceptional quarter can trip them -- so everything here is
 * `implausible`, never `impossible`.
 *
 * `history` must be periods of the same shape as `period`: comparing a quarter
 * against annual figures would flag every quarter ever filed. TTM rows are
 * excluded by the caller for the same reason.
 */
export function checkAgainstHistory(period: AnnualFinancial, history: AnnualFinancial[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  for (const field of FLOW_FIELDS) {
    const value = period[field];
    if (!finite(value)) continue;
    const priorMagnitudes = history
      .map((entry) => entry[field])
      .filter(finite)
      .map(Math.abs);
    if (priorMagnitudes.length < MIN_HISTORY) continue;
    const typical = median(priorMagnitudes);
    // A zero median carries no scale, so no multiple of it means anything.
    if (typical == null || typical <= 0) continue;
    if (Math.abs(value) > typical * FLOW_OUTLIER_MULTIPLE) {
      anomalies.push({
        field,
        severity: 'implausible',
        reason: `${field} is more than ${FLOW_OUTLIER_MULTIPLE} times its own recent median.`,
      });
    }
  }

  // Total assets only. Cash and debt legitimately move in large steps -- a bond
  // programme or a buyback does exactly that -- so a jump threshold there would
  // fire constantly on companies doing nothing unusual.
  const previous = history[0];
  if (previous && finite(period.totalAssets) && finite(previous.totalAssets) && previous.totalAssets > 0) {
    const step = Math.abs(period.totalAssets / previous.totalAssets - 1);
    if (step > STOCK_JUMP) {
      anomalies.push({
        field: 'totalAssets',
        severity: 'implausible',
        reason: 'Total assets moved more than half in a single period.',
      });
    }
  }

  return anomalies;
}

/**
 * Every anomaly for the newest period in a series, structural and historical.
 * `periods` is expected newest-first, as normalizeAnnual returns it.
 */
export function detectAnomalies(periods: AnnualFinancial[]): Anomaly[] {
  const [latest, ...history] = periods.filter((period) => period.periodType !== 'ttm');
  if (!latest) return [];
  const seen = new Set<string>();
  return [...checkPeriod(latest), ...checkAgainstHistory(latest, history)]
    .filter((anomaly) => {
      // One field failing two checks is one problem, and the structural reason
      // is listed first, so it is the one worth showing.
      const key = `${anomaly.field}:${anomaly.severity}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** The field names a caller should not build a derived figure on top of. */
export const suspectFields = (anomalies: Anomaly[]): Set<string> =>
  new Set(anomalies.map((anomaly) => anomaly.field));

/**
 * One sentence naming what could not be relied on, or null when the period is
 * clean. Deliberately does not say "wrong" -- the check establishes that a
 * figure needs verifying against the filing, not that the filer is mistaken.
 */
export function anomalyNotice(anomalies: Anomaly[]): string | null {
  if (!anomalies.length) return null;
  const fields = [...new Set(anomalies.map((anomaly) => anomaly.field))];
  const labelled = fields.length === 1
    ? fields[0]
    : `${fields.slice(0, -1).join(', ')} and ${fields[fields.length - 1]}`;
  return `${labelled} did not pass a consistency check for this period; verify against the filing before relying on it.`;
}
