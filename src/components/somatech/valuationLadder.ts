/**
 * Valuation ladder — produce a defensible value for a company whatever its shape.
 *
 * The DCF in `utils.ts` returns null whenever free cash flow is not positive, and
 * that guard is right: projecting a negative FCF forward and multiplying it by a
 * terminal multiple yields a negative "intrinsic value", which is worse than no
 * answer. But refusing to value the company at all is also wrong. Intel generates
 * $9.7B of operating cash and holds $114B of equity; "N/A" is not an honest summary
 * of that.
 *
 * So instead of one instrument with a pass/fail gate, this walks a ladder of
 * instruments and uses the highest one the company's own financials support:
 *
 *   1. DCF on free cash flow      cash-generative, self-funding
 *   2. EV / EBITDA                capital-intensive, profitable before D&A
 *   3. EV / EBIT                  profitable at the operating line
 *   4. EV / Gross profit          gross-profitable but operating-loss making
 *   5. EV / Sales                 revenue-generating, not yet profitable
 *   6. Price / Book               asset-backed, income statement unusable
 *
 * Two rules keep this from manufacturing false precision.
 *
 * NORMALISATION. Every basis metric is averaged across available years rather than
 * taken from the latest one. A cyclical at a trough would otherwise be valued on
 * its worst year and a peak on its best: Intel's EBITDA ran $31.3B, $15.3B, $9.7B,
 * -$0.3B, $9.5B across five years, so single-year figures differ by more than an
 * order of magnitude. `computeDCFRange` already takes this position with its
 * three-year FCF average; this applies it to every rung.
 *
 * DISCLOSURE. Multiples are assumptions, not facts. Each default is deliberately
 * conservative, is reported alongside the value, and is overridable. A caller with
 * peer-derived multiples should pass them; the defaults exist so that a company
 * still gets a number, not so the number can pass as precise.
 */

import type { FinancialStatementPeriod } from './types';
import {
  businessClassLabel,
  type BusinessClass,
} from '../../../supabase/functions/_shared/sicClassification';

export type { BusinessClass };

export type ValuationMethod =
  | 'dcf-fcf'
  | 'ev-ebitda'
  | 'ev-ebit'
  | 'ev-gross-profit'
  | 'ev-sales'
  | 'price-book';

export interface ValuationInputs {
  annual: FinancialStatementPeriod[];
  /**
   * What kind of business this is, from its filed SIC code. Omitted behaves
   * exactly as before: the full ladder, in the general order.
   */
  businessClass?: BusinessClass;
  price: number | null;
  sharesOutstanding: number | null;
  /** Override the assumed multiple for any rung, e.g. from peer medians. */
  multiples?: Partial<Record<Exclude<ValuationMethod, 'dcf-fcf'>, number>>;
  /** Discount rate for the DCF rung, as a decimal. */
  discountRate?: number;
  /** Annual FCF growth for the DCF rung, as a decimal. */
  fcfGrowth?: number;
}

export interface ValuationRung {
  method: ValuationMethod;
  label: string;
  valuePerShare: number;
  upsidePct: number | null;
  /** Plain-English statement of what the value was computed from. */
  basis: string;
  /** The assumed multiple, or null for the DCF rung. */
  multiple: number | null;
  confidence: 'high' | 'medium' | 'low';
  /** Years of history behind the normalised basis metric. */
  yearsAveraged: number;
}

export interface SkippedRung {
  method: ValuationMethod;
  label: string;
  reason: string;
}

export interface ValuationLadderResult {
  selected: ValuationRung | null;
  /** Rungs ranked above the selected one, each with why it did not apply. */
  skipped: SkippedRung[];
  /** Rungs below the selected one that also produced a value, as a cross-check. */
  corroborating: ValuationRung[];
  /** Set only when nothing on the ladder applied. */
  unvaluableReason: string | null;
  /** The classification the ladder was ordered for. */
  businessClass: BusinessClass;
  /**
   * Set when the classification removed instruments from consideration entirely,
   * explaining why in one sentence. Collapsed to a single note rather than one
   * skip entry per excluded rung: for a bank the reason is identical five times
   * over, and repeating it would bury the one instrument actually used.
   */
  sectorNote: string | null;
}

/**
 * Which instruments each kind of business may be valued with, in order.
 *
 * This is a correctness constraint, not a preference. Enterprise value subtracts
 * net debt on the theory that debt is financing layered over an operating
 * business — for a bank, borrowing IS the business, so an EV multiple is a
 * category error rather than an imprecise answer. A REIT's depreciation is so
 * large and so non-cash that free cash flow systematically understates it, which
 * is why the industry reports funds from operations instead.
 *
 * Classes we do not yet treat specially fall through to the general ladder
 * deliberately. A class is added here only when it changes what we do.
 */
const GENERAL_ORDER: ValuationMethod[] = [
  'dcf-fcf', 'ev-ebitda', 'ev-ebit', 'ev-gross-profit', 'ev-sales', 'price-book',
];

const LADDER_BY_CLASS: Record<BusinessClass, ValuationMethod[]> = {
  general: GENERAL_ORDER,
  bank: ['price-book'],
  insurer: ['price-book'],
  'financial-other': ['price-book'],
  // EBITDA is the closest available proxy for a REIT until FFO exists; book value
  // is meaningful for a property owner; revenue is the last resort.
  reit: ['ev-ebitda', 'price-book', 'ev-sales'],
};

/**
 * Which instruments this kind of business may legitimately be valued with.
 *
 * Exported because the ladder is not the only screen that runs a valuation: the
 * standalone DCF scenario tool must ask the same question, or a bank with
 * positive free cash flow would still be shown a discounted cash flow — the
 * exact category error the classification exists to prevent, relocated.
 */
export function permittedMethods(businessClass: BusinessClass | undefined): ValuationMethod[] {
  return LADDER_BY_CLASS[businessClass ?? 'general'] ?? GENERAL_ORDER;
}

/** The one-line explanation of what the classification ruled out, if anything. */
export function sectorNoteFor(businessClass: BusinessClass | undefined): string | null {
  const cls = businessClass ?? 'general';
  return permittedMethods(cls).length === GENERAL_ORDER.length ? null : SECTOR_NOTE[cls];
}

const SECTOR_NOTE: Record<BusinessClass, string | null> = {
  general: null,
  bank: 'Enterprise-value and cash-flow instruments are not used for a bank or credit institution. Enterprise value subtracts net debt, but for a bank borrowing is raw material rather than a financing choice, and free cash flow is not a meaningful measure of a lender.',
  insurer: 'Enterprise-value and cash-flow instruments are not used for an insurer. Premium float behaves as neither debt nor operating cash flow, so book value is the working measure.',
  'financial-other': 'Enterprise-value and cash-flow instruments are not used for a financial institution, where borrowing is part of the business rather than a financing choice.',
  reit: 'Discounted cash flow is not used for a real estate investment trust. Depreciation dominates a property owner\u2019s income statement, so free cash flow understates the business; funds from operations is the industry measure and is not yet computed.',
};

// Deliberately conservative, and deliberately round: these are stated assumptions,
// not measurements, and a precise-looking default would imply otherwise.
const DEFAULT_MULTIPLES: Record<Exclude<ValuationMethod, 'dcf-fcf'>, number> = {
  'ev-ebitda': 8,
  'ev-ebit': 12,
  'ev-gross-profit': 6,
  'ev-sales': 2,
  'price-book': 1.5,
};

const LABELS: Record<ValuationMethod, string> = {
  'dcf-fcf': 'Discounted cash flow',
  'ev-ebitda': 'EV / EBITDA',
  'ev-ebit': 'EV / EBIT',
  'ev-gross-profit': 'EV / Gross profit',
  'ev-sales': 'EV / Sales',
  'price-book': 'Price / Book',
};

const PROJECTION_YEARS = 5;

const finite = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const money = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${value < 0 ? '-' : ''}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${value < 0 ? '-' : ''}$${(abs / 1e6).toFixed(1)}M`;
  return `${value < 0 ? '-' : ''}$${abs.toFixed(0)}`;
};

/**
 * Mean of a metric across the available years.
 *
 * Returns null when nothing is available, and reports how many years contributed
 * so a one-year "average" is never mistaken for a normalised figure.
 */
function normalized(
  annual: FinancialStatementPeriod[],
  pick: (period: FinancialStatementPeriod) => number | null | undefined,
  maxYears = 5,
): { value: number; years: number } | null {
  const values = annual.slice(0, maxYears).map(pick).filter(finite);
  if (!values.length) return null;
  return { value: values.reduce((sum, v) => sum + v, 0) / values.length, years: values.length };
}

const ebitda = (period: FinancialStatementPeriod): number | null =>
  finite(period.operatingIncome) && finite(period.depreciationAmortization)
    ? period.operatingIncome + period.depreciationAmortization
    : null;

/** Latest reported net debt: total borrowings less cash. */
function netDebt(annual: FinancialStatementPeriod[]): number | null {
  const latest = annual[0];
  if (!latest) return null;
  const debt = (finite(latest.longTermDebt) ? latest.longTermDebt : 0)
    + (finite(latest.shortTermDebt) ? latest.shortTermDebt : 0);
  const cash = finite(latest.cash) ? latest.cash : 0;
  if (!finite(latest.longTermDebt) && !finite(latest.shortTermDebt) && !finite(latest.cash)) return null;
  return debt - cash;
}

const upside = (value: number, price: number | null): number | null =>
  finite(price) && price > 0 ? ((value - price) / price) * 100 : null;

/**
 * Enterprise-value rung: multiple × normalised metric, less net debt, per share.
 *
 * Net debt must be subtracted — an enterprise value belongs to debt and equity
 * together, and treating it as equity value would overstate a leveraged company
 * dramatically. Intel carries roughly $36B net, about a third of its market value.
 */
function enterpriseRung(
  method: Exclude<ValuationMethod, 'dcf-fcf' | 'price-book'>,
  metric: { value: number; years: number },
  metricName: string,
  inputs: ValuationInputs,
  confidence: ValuationRung['confidence'],
): ValuationRung | null {
  const shares = inputs.sharesOutstanding;
  if (!finite(shares) || shares <= 0) return null;
  const debt = netDebt(inputs.annual);
  if (debt == null) return null;

  const multiple = inputs.multiples?.[method] ?? DEFAULT_MULTIPLES[method];
  const equityValue = metric.value * multiple - debt;
  const valuePerShare = equityValue / shares;
  if (!Number.isFinite(valuePerShare) || valuePerShare <= 0) return null;

  return {
    method,
    label: LABELS[method],
    valuePerShare,
    upsidePct: upside(valuePerShare, inputs.price),
    basis: `${multiple}× ${metricName} of ${money(metric.value)}${metric.years > 1 ? `, averaged over ${metric.years} years` : ' (one year only)'}, less ${money(debt)} net debt`,
    multiple,
    confidence,
    yearsAveraged: metric.years,
  };
}

function dcfRung(inputs: ValuationInputs): ValuationRung | null {
  const fcf = normalized(inputs.annual, (p) => p.freeCashFlow, 3);
  const shares = inputs.sharesOutstanding;
  if (!fcf || fcf.value <= 0 || !finite(shares) || shares <= 0) return null;

  const g = inputs.fcfGrowth ?? 0.07;
  const r = inputs.discountRate ?? 0.10;
  const terminalRate = 0.025;
  if (r <= terminalRate) return null;

  let projected = fcf.value;
  let presentValue = 0;
  for (let year = 1; year <= PROJECTION_YEARS; year++) {
    projected *= 1 + g;
    presentValue += projected / Math.pow(1 + r, year);
  }
  // Gordon growth terminal, not an exit multiple: a perpetuity is the assumption
  // actually being made, and stating it that way makes the sensitivity visible.
  const terminal = (projected * (1 + terminalRate)) / (r - terminalRate);
  presentValue += terminal / Math.pow(1 + r, PROJECTION_YEARS);

  const debt = netDebt(inputs.annual) ?? 0;
  const valuePerShare = (presentValue - debt) / shares;
  if (!Number.isFinite(valuePerShare) || valuePerShare <= 0) return null;

  return {
    method: 'dcf-fcf',
    label: LABELS['dcf-fcf'],
    valuePerShare,
    upsidePct: upside(valuePerShare, inputs.price),
    basis: `Free cash flow of ${money(fcf.value)}${fcf.years > 1 ? `, averaged over ${fcf.years} years` : ''}, grown ${(g * 100).toFixed(0)}% and discounted at ${(r * 100).toFixed(0)}%`,
    multiple: null,
    confidence: 'high',
    yearsAveraged: fcf.years,
  };
}

function bookRung(inputs: ValuationInputs): ValuationRung | null {
  const equity = normalized(inputs.annual, (p) => p.shareholderEquity, 1);
  const shares = inputs.sharesOutstanding;
  if (!equity || equity.value <= 0 || !finite(shares) || shares <= 0) return null;

  const multiple = inputs.multiples?.['price-book'] ?? DEFAULT_MULTIPLES['price-book'];
  const valuePerShare = (equity.value / shares) * multiple;
  if (!Number.isFinite(valuePerShare) || valuePerShare <= 0) return null;

  return {
    method: 'price-book',
    label: LABELS['price-book'],
    valuePerShare,
    upsidePct: upside(valuePerShare, inputs.price),
    // Book value is a point-in-time balance, so averaging it across years would
    // blend stale balance sheets rather than smooth a cycle.
    basis: `${multiple}× book value of ${money(equity.value)} at the latest balance sheet date`,
    multiple,
    confidence: 'low',
    yearsAveraged: 1,
  };
}

/**
 * Walks the ladder and returns the best-supported valuation, the reason each
 * better instrument did not apply, and any lower rungs that agree.
 */
export function valueCompany(inputs: ValuationInputs): ValuationLadderResult {
  const businessClass = inputs.businessClass ?? 'general';
  const permitted = LADDER_BY_CLASS[businessClass] ?? GENERAL_ORDER;
  const sectorNote = permitted.length === GENERAL_ORDER.length ? null : SECTOR_NOTE[businessClass];

  const bail = (reason: string): ValuationLadderResult => ({
    selected: null, skipped: [], corroborating: [], unvaluableReason: reason,
    businessClass, sectorNote,
  });

  if (!inputs.annual.length) return bail('No filed annual financials are available.');
  if (!finite(inputs.sharesOutstanding) || inputs.sharesOutstanding <= 0) {
    return bail('Shares outstanding are unavailable, so no per-share value can be computed.');
  }

  const fcf = normalized(inputs.annual, (p) => p.freeCashFlow, 3);
  const eb = normalized(inputs.annual, ebitda);
  const ebit = normalized(inputs.annual, (p) => p.operatingIncome);
  const gross = normalized(inputs.annual, (p) => p.grossProfit);
  const sales = normalized(inputs.annual, (p) => p.revenue);

  // Every instrument is described once. Which of them are eligible, and in what
  // order, is decided by the classification rather than baked into this list.
  const candidates: Record<ValuationMethod, { rung: ValuationRung | null; reason: string }> = {
    'dcf-fcf': {
      rung: dcfRung(inputs),
      reason: fcf == null
        ? 'Free cash flow is unavailable.'
        : fcf.value <= 0
          ? `Free cash flow averaged ${money(fcf.value)} over ${fcf.years} year${fcf.years === 1 ? '' : 's'}. Discounting requires positive cash flow.`
          : 'Inputs were insufficient.',
    },
    'ev-ebitda': {
      rung: eb && eb.value > 0 ? enterpriseRung('ev-ebitda', eb, 'EBITDA', inputs, 'medium') : null,
      reason: eb == null
        ? 'EBITDA is unavailable: operating income or depreciation is missing.'
        : `EBITDA averaged ${money(eb.value)}, which is not positive.`,
    },
    'ev-ebit': {
      rung: ebit && ebit.value > 0 ? enterpriseRung('ev-ebit', ebit, 'operating income', inputs, 'medium') : null,
      reason: ebit == null ? 'Operating income is unavailable.' : `Operating income averaged ${money(ebit.value)}, which is not positive.`,
    },
    'ev-gross-profit': {
      rung: gross && gross.value > 0 ? enterpriseRung('ev-gross-profit', gross, 'gross profit', inputs, 'low') : null,
      reason: gross == null ? 'Gross profit is unavailable.' : `Gross profit averaged ${money(gross.value)}, which is not positive.`,
    },
    'ev-sales': {
      rung: sales && sales.value > 0 ? enterpriseRung('ev-sales', sales, 'revenue', inputs, 'low') : null,
      reason: sales == null ? 'Revenue is unavailable.' : `Revenue averaged ${money(sales.value)}, which is not positive.`,
    },
    'price-book': {
      rung: bookRung(inputs),
      reason: 'Shareholder equity is unavailable or not positive.',
    },
  };

  const selectedIndex = permitted.findIndex((method) => candidates[method].rung != null);

  if (selectedIndex === -1) {
    // Distinguish "this company reports nothing usable" from "the instruments
    // appropriate to this kind of company did not apply" — for a bank the second
    // is a much narrower statement and the reader deserves the narrower one.
    const tried = permitted.map((method) => LABELS[method]).join(' or ');
    return {
      selected: null,
      skipped: permitted.map((method) => ({ method, label: LABELS[method], reason: candidates[method].reason })),
      corroborating: [],
      unvaluableReason: sectorNote
        ? `No value could be produced for ${businessClassLabel(businessClass)}. ${tried} did not apply, and the remaining instruments are inappropriate for this kind of business.`
        : 'No filed figure on the income statement or balance sheet supports a valuation.',
      businessClass,
      sectorNote,
    };
  }

  return {
    selected: candidates[permitted[selectedIndex]].rung!,
    skipped: permitted.slice(0, selectedIndex).map((method) => ({
      method, label: LABELS[method], reason: candidates[method].reason,
    })),
    // Only instruments this kind of business may legitimately use can corroborate.
    // Offering a bank an EV/Sales "cross-check" would reintroduce, as supporting
    // evidence, exactly the number the classification exists to suppress.
    corroborating: permitted.slice(selectedIndex + 1)
      .flatMap((method) => candidates[method].rung ? [candidates[method].rung!] : []),
    unvaluableReason: null,
    businessClass,
    sectorNote,
  };
}
