/**
 * SomaTech Financial Formatting Library
 *
 * Institutional-grade number formatting aligned with Bloomberg Terminal
 * and buyside conventions.
 *
 * Rules:
 * - Negative values use parentheses:  (1,234.56) not -1,234.56
 * - Percentages: 2 decimal places by default
 * - Large numbers abbreviated: 1.2M, 3.4B, 1.2T
 * - Basis points: 125 bp  (not 1.25%)
 * - Use CSS class `font-tabular` (tabular-nums) on all numeric cells
 *   to prevent column jitter on updates
 */

// ─── Currency ─────────────────────────────────────────────────────────────────

interface CurrencyOptions {
  decimals?: number;
  abbreviate?: boolean;
  currency?: string;
  parens?: boolean; // institutional: negatives in parens
}

export function formatCurrency(
  value: number,
  options: CurrencyOptions = {}
): string {
  if (!isFinite(value) || isNaN(value)) return 'N/A';

  const {
    decimals = 2,
    abbreviate = false,
    currency = 'USD',
    parens = true,
  } = options;

  const abs = Math.abs(value);
  const negative = value < 0;

  let formatted: string;

  if (abbreviate) {
    if (abs >= 1e12) {
      formatted = `$${(abs / 1e12).toFixed(decimals)}T`;
    } else if (abs >= 1e9) {
      formatted = `$${(abs / 1e9).toFixed(decimals)}B`;
    } else if (abs >= 1e6) {
      formatted = `$${(abs / 1e6).toFixed(decimals)}M`;
    } else if (abs >= 1e3) {
      formatted = `$${(abs / 1e3).toFixed(decimals)}K`;
    } else {
      formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(abs);
    }
  } else {
    formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(abs);
  }

  if (negative) {
    return parens ? `(${formatted})` : `-${formatted}`;
  }
  return formatted;
}

// ─── Percentage ───────────────────────────────────────────────────────────────

interface PercentOptions {
  decimals?: number;
  parens?: boolean;
  /** If true, prepend + for positive values */
  sign?: boolean;
}

export function formatPercent(
  value: number,
  options: PercentOptions = {}
): string {
  if (!isFinite(value) || isNaN(value)) return 'N/A';
  const { decimals = 2, parens = true, sign = false } = options;
  const abs = Math.abs(value);
  const negative = value < 0;
  const formatted = `${abs.toFixed(decimals)}%`;

  if (negative) return parens ? `(${formatted})` : `-${formatted}`;
  if (sign && value > 0) return `+${formatted}`;
  return formatted;
}

// ─── Basis Points ─────────────────────────────────────────────────────────────

export function formatBps(value: number, decimals = 0): string {
  const abs = Math.abs(value);
  const negative = value < 0;
  const formatted = `${abs.toFixed(decimals)} bp`;
  return negative ? `(${formatted})` : formatted;
}

/** Convert a decimal to basis points and format */
export function decimalToBps(decimal: number, decimals = 0): string {
  return formatBps(decimal * 10000, decimals);
}

// ─── Large number abbreviation ───────────────────────────────────────────────

export function formatCompact(value: number, decimals = 1): string {
  if (!isFinite(value) || isNaN(value)) return 'N/A';
  const abs = Math.abs(value);
  const negative = value < 0;
  let formatted: string;

  if (abs >= 1e12)      formatted = `${(abs / 1e12).toFixed(decimals)}T`;
  else if (abs >= 1e9)  formatted = `${(abs / 1e9).toFixed(decimals)}B`;
  else if (abs >= 1e6)  formatted = `${(abs / 1e6).toFixed(decimals)}M`;
  else if (abs >= 1e3)  formatted = `${(abs / 1e3).toFixed(decimals)}K`;
  else                  formatted = abs.toFixed(decimals);

  return negative ? `(${formatted})` : formatted;
}

// ─── Plain number ─────────────────────────────────────────────────────────────

export function formatNumber(
  value: number,
  decimals = 0,
  parens = true
): string {
  const abs = Math.abs(value);
  const negative = value < 0;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(abs);
  return negative && parens ? `(${formatted})` : (negative ? `-${formatted}` : formatted);
}

// ─── Change / delta ───────────────────────────────────────────────────────────

export interface ChangeResult {
  formatted: string;
  direction: 'up' | 'down' | 'flat';
  isNegative: boolean;
}

export function formatChange(
  value: number,
  type: 'currency' | 'percent' | 'number' = 'currency'
): ChangeResult {
  const direction: ChangeResult['direction'] =
    value > 0 ? 'up' : value < 0 ? 'down' : 'flat';

  let formatted: string;
  if (type === 'currency')   formatted = formatCurrency(value, { parens: true });
  else if (type === 'percent') formatted = formatPercent(value, { parens: true });
  else                       formatted = formatNumber(value, 2, true);

  return { formatted, direction, isNegative: value < 0 };
}

// ─── Price ────────────────────────────────────────────────────────────────────

/** Format a security price with 2 decimal places (4 for sub-dollar assets) */
export function formatPrice(value: number): string {
  if (!isFinite(value) || isNaN(value)) return 'N/A';
  const decimals = value > 0 && value < 1 ? 4 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// ─── Market cap shorthand ────────────────────────────────────────────────────

export function formatMarketCap(value: number): string {
  return formatCurrency(value, { abbreviate: true, decimals: 2 });
}

// ─── Multiplier (e.g. EV/EBITDA = 12.4x) ────────────────────────────────────

export function formatMultiple(value: number, decimals = 1): string {
  if (!isFinite(value) || isNaN(value)) return 'N/M';
  return `${value.toFixed(decimals)}x`;
}

// ─── Ratio (e.g. debt/equity = 0.42) ─────────────────────────────────────────

export function formatRatio(value: number, decimals = 2): string {
  if (!isFinite(value) || isNaN(value)) return 'N/A';
  return value.toFixed(decimals);
}

// ─── Yield ────────────────────────────────────────────────────────────────────

export function formatYield(value: number): string {
  if (!isFinite(value) || isNaN(value)) return 'N/A';
  // Yields stored as decimals (0.0523 = 5.23%); values already > 1 are assumed
  // to already be in percent form (e.g. some APIs return 5.23 directly).
  const pct = value > 1 ? value : value * 100;
  return `${pct.toFixed(2)}%`;
}

// ─── Date formatting for financial contexts ───────────────────────────────────

export function formatFinancialDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function formatQuarter(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'N/A';
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

// ─── Staleness ────────────────────────────────────────────────────────────────

export function formatDataAge(updatedAt: string | Date): {
  label: string;
  isStale: boolean;
} {
  const d = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
  const ageMs = Date.now() - d.getTime();
  const ageMins = ageMs / 60000;

  if (ageMins < 1)   return { label: 'Live', isStale: false };
  if (ageMins < 5)   return { label: `${Math.floor(ageMins)}m ago`, isStale: false };
  if (ageMins < 60)  return { label: `${Math.floor(ageMins)}m ago`, isStale: true };
  const ageHrs = ageMs / 3600000;
  if (ageHrs < 24)   return { label: `${Math.floor(ageHrs)}h ago`, isStale: true };
  return { label: formatFinancialDate(d), isStale: true };
}

// ─── Tailwind class helpers ──────────────────────────────────────────────────

/** Returns Tailwind text-color class for a numeric change — colorblind safe when
 *  paired with a directional arrow icon (see <FinancialChange /> component). */
export function changeColorClass(value: number): string {
  if (value > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

/** CSS class for tabular (fixed-width) numerals — prevents column jitter */
export const TABULAR = 'font-mono tabular-nums slashed-zero';
