/**
 * Recurring charge detector — pure function, no React, no side effects.
 *
 * A charge is "recurring" when the same merchant appears in ≥2 of the
 * last 3 calendar months with an amount within ±20% variance.
 *
 * Edge cases:
 *   - Merchant name null → falls back to raw transaction name (trimmed)
 *   - Wildly varying amounts (e.g. Amazon for both $8 and $340) → not flagged
 *     as recurring because variance threshold filters them out
 *   - Same merchant, multiple charges per month (e.g. weekly Spotify) →
 *     only the most recent single charge amount is used for display
 *   - Transactions in future dates → excluded (pending edge case)
 *   - Empty input → returns []
 *
 * "possibly_cancelled": merchant appeared in month[-2] or month[-3] but NOT
 * in the most recent complete month — may have been cancelled but still shows
 * as a historical charge worth reviewing.
 */

import { PlaidTransaction } from '@/hooks/useTransactions';
import { format, subMonths, startOfMonth } from 'date-fns';

export interface RecurringCharge {
  /** Display name — merchant_name if available, otherwise cleaned raw name */
  merchant:        string;
  /** Median amount across seen months */
  amount:          number;
  /** How many of the last 3 months this merchant appeared */
  monthsActive:    number;
  /** ISO date string of most recent charge */
  lastSeen:        string;
  /** Our category key */
  categoryKey:     string | null;
  /** True if seen historically but not in the most recent month */
  possiblyCancelled: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayName(tx: PlaidTransaction): string {
  const raw = tx.merchant_name ?? tx.name;
  // Strip trailing asterisks, reference numbers, trailing spaces
  return raw.replace(/\s*\*\s*\w+$/, '').replace(/\s{2,}/g, ' ').trim();
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function detectRecurringCharges(transactions: PlaidTransaction[]): RecurringCharge[] {
  if (transactions.length === 0) return [];

  const now      = new Date();
  const today    = format(now, 'yyyy-MM-dd');

  // Build the 3 month-keys we care about (current + 2 prior)
  const months = [0, 1, 2].map(offset =>
    format(startOfMonth(subMonths(now, offset)), 'yyyy-MM')
  );
  const [currentMonth, prevMonth, prevPrevMonth] = months;

  // Only look at non-pending debits within our 90-day window
  const debits = transactions.filter(
    tx => !tx.pending && tx.amount > 0 && tx.date <= today && tx.category_key !== null
  );

  // Group by normalised merchant key
  const byMerchant = new Map<string, PlaidTransaction[]>();
  for (const tx of debits) {
    const key = displayName(tx).toLowerCase();
    if (!byMerchant.has(key)) byMerchant.set(key, []);
    byMerchant.get(key)!.push(tx);
  }

  const results: RecurringCharge[] = [];

  for (const [, txs] of byMerchant) {
    // Which of our 3 months does this merchant appear in?
    const appearsInMonth = new Map<string, number[]>(); // month → amounts
    for (const tx of txs) {
      const m = tx.date.slice(0, 7);
      if (!months.includes(m)) continue;
      if (!appearsInMonth.has(m)) appearsInMonth.set(m, []);
      appearsInMonth.get(m)!.push(tx.amount);
    }

    const monthsActive = appearsInMonth.size;
    if (monthsActive < 2) continue; // must appear in at least 2 months

    // Compute per-month medians and check amount variance
    const monthMedians = [...appearsInMonth.values()].map(median);
    const overallMedian = median(monthMedians);
    const maxDeviation = Math.max(...monthMedians.map(m => Math.abs(m - overallMedian) / overallMedian));
    if (maxDeviation > 0.20) continue; // >20% variance → not a stable recurring charge

    const representativeTx = txs.sort((a, b) => b.date.localeCompare(a.date))[0];
    const possiblyCancelled = !appearsInMonth.has(currentMonth) &&
      (appearsInMonth.has(prevMonth) || appearsInMonth.has(prevPrevMonth));

    results.push({
      merchant:         displayName(representativeTx),
      amount:           overallMedian,
      monthsActive,
      lastSeen:         representativeTx.date,
      categoryKey:      representativeTx.category_key,
      possiblyCancelled,
    });
  }

  // Sort: possibly-cancelled last, then by amount desc
  return results.sort((a, b) => {
    if (a.possiblyCancelled !== b.possiblyCancelled) return a.possiblyCancelled ? 1 : -1;
    return b.amount - a.amount;
  });
}

// ── Convenience aggregates ────────────────────────────────────────────────────

export function totalRecurringPerMonth(charges: RecurringCharge[]): number {
  return charges.filter(c => !c.possiblyCancelled).reduce((sum, c) => sum + c.amount, 0);
}

export function opportunityCost(monthlyAmount: number, years: number, rate = 0.07): number {
  // FV of monthly annuity: PMT × [((1+r)^n − 1) / r]
  const r = rate / 12;
  const n = years * 12;
  return monthlyAmount * ((Math.pow(1 + r, n) - 1) / r);
}
