import { supabase } from '@/integrations/supabase/client';

export type RateGroup = 'policy' | 'treasury' | 'lending';

export interface RateReading {
  id: string;
  label: string;
  group: RateGroup;
  cadence: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  /** Percent, e.g. 4.18. Null when the source has no usable recent value. */
  value: number | null;
  /** Change from the previous observation, in basis points. */
  changeBps: number | null;
  /** Observation date of `value` (YYYY-MM-DD). */
  asOf: string | null;
}

export interface RatesSnapshot {
  rates: RateReading[];
  nextFomc: { date: string; hasProjections: boolean } | null;
  fomcUrl: string;
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  cached: boolean;
  warning?: string;
}

export const ratesAPI = {
  async snapshot(): Promise<RatesSnapshot> {
    const { data, error } = await supabase.functions.invoke<RatesSnapshot>('fetch-rates');
    if (error) throw error;
    if (!data) throw new Error('Rate data is unavailable');
    return data;
  },
};

/** Look up one reading by FRED series id. */
export const findRate = (rates: RateReading[], id: string): RateReading | undefined =>
  rates.find((rate) => rate.id === id);

/**
 * Rates are quoted to two decimals; a bare number reads as a price otherwise.
 */
export const formatRate = (value: number | null): string =>
  value == null ? '—' : `${value.toFixed(2)}%`;

/**
 * A spread can legitimately be negative — an inverted curve is the signal, not
 * an error — so it keeps its sign where a level would not.
 */
export const formatSpread = (value: number | null): string =>
  value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

export const formatChangeBps = (changeBps: number | null): string | null => {
  if (changeBps == null || changeBps === 0) return null;
  return `${changeBps > 0 ? '+' : ''}${changeBps} bps`;
};

const CADENCE_LABEL: Record<RateReading['cadence'], string> = {
  daily: 'Updated daily',
  weekly: 'Updated weekly',
  monthly: 'Updated monthly',
  quarterly: 'Updated quarterly',
};

/**
 * These series republish on wildly different schedules — the Treasury curve
 * moves every day, the credit-card average once a quarter. Showing the
 * observation date alongside the cadence stops a three-month-old figure from
 * being read as today's number.
 */
export const describeFreshness = (rate: RateReading | undefined): string => {
  if (!rate?.asOf) return '';
  const date = new Date(`${rate.asOf}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return CADENCE_LABEL[rate.cadence];
  const asOf = date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  });
  return `${CADENCE_LABEL[rate.cadence]} · as of ${asOf}`;
};
