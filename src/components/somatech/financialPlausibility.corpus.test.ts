/**
 * The consistency checks, run against real filed periods.
 *
 * Unit tests prove a rule fires on a constructed break. They cannot prove it
 * stays quiet on a bank, a REIT or an oil major -- and a rule that fires on
 * healthy filers is worse than no rule, because "flagged for review" across a
 * third of the universe teaches every reader to ignore it.
 *
 * This reads the EDGAR cache that `npx tsx scripts/audit-edgar-coverage.ts`
 * populates: 44 sector-diverse filers, chosen there precisely because tagging
 * idiom varies by industry far more than by size. It skips when the cache is
 * absent, so a clean checkout and CI are unaffected.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TAGS } from '../../../supabase/functions/_shared/edgarTags';
import { checkPeriod, type Anomaly } from './financialPlausibility';
import type { AnnualFinancial } from './financialStatementAnalytics';

const CACHE_DIR = join(process.cwd(), '.cache', 'edgar');
const hasCorpus = existsSync(CACHE_DIR) && readdirSync(CACHE_DIR).some((name) => name.endsWith('.json'));

interface Fact { end: string; val: number; start?: string; form?: string; filed: string }
interface CompanyFacts { facts?: { 'us-gaap'?: Record<string, { units?: Record<string, Fact[]> }> } }

/** Mirrors annualDurationSeries / annualInstantSeries in the edge function. */
function annualSeries(facts: CompanyFacts, tags: readonly string[], kind: 'duration' | 'instant') {
  const concepts = facts.facts?.['us-gaap'] ?? {};
  const result = new Map<number, number>();
  for (const tag of tags) {
    const candidates = new Map<number, Fact>();
    for (const fact of concepts[tag]?.units?.USD ?? []) {
      if (!/^10-K(?:\/A)?$/.test(fact.form ?? '')) continue;
      if (kind === 'duration') {
        if (!fact.start) continue;
        const days = (Date.parse(fact.end) - Date.parse(fact.start)) / 86_400_000;
        if (days < 340 || days > 390) continue;
      } else if (fact.start) continue;
      const year = new Date(fact.end).getUTCFullYear();
      const previous = candidates.get(year);
      if (!previous || Date.parse(fact.filed) > Date.parse(previous.filed)) candidates.set(year, fact);
    }
    for (const [year, fact] of candidates) if (!result.has(year)) result.set(year, fact.val);
  }
  return result;
}

function periodsFor(facts: CompanyFacts): AnnualFinancial[] {
  const d = (tags: readonly string[]) => annualSeries(facts, tags, 'duration');
  const i = (tags: readonly string[]) => annualSeries(facts, tags, 'instant');
  const series = {
    revenue: d(TAGS.revenue), operatingIncome: d(TAGS.operatingIncome),
    netIncome: d(TAGS.netIncome), capex: d(TAGS.capex),
    totalAssets: i(TAGS.totalAssets), totalLiabilities: i(TAGS.totalLiabilities),
    shareholderEquity: i(TAGS.shareholderEquity), currentAssets: i(TAGS.currentAssets),
    currentLiabilities: i(TAGS.currentLiabilities), cash: i(TAGS.cash),
  };
  const years = [...new Set(Object.values(series).flatMap((entry) => [...entry.keys()]))].sort((a, b) => b - a);
  return years.map((year) => ({
    fiscalYear: year, periodEnd: `${year}-12-31`, periodType: 'annual',
    revenue: series.revenue.get(year) ?? null,
    operatingIncome: series.operatingIncome.get(year) ?? null,
    netIncome: series.netIncome.get(year) ?? null,
    // The edge function normalises capex to a magnitude, so mirror it here or
    // every filer tagging the outflow as negative trips the sign rule.
    capex: series.capex.has(year) ? Math.abs(series.capex.get(year)!) : null,
    totalAssets: series.totalAssets.get(year) ?? null,
    totalLiabilities: series.totalLiabilities.get(year) ?? null,
    shareholderEquity: series.shareholderEquity.get(year) ?? null,
    currentAssets: series.currentAssets.get(year) ?? null,
    currentLiabilities: series.currentLiabilities.get(year) ?? null,
    cash: series.cash.get(year) ?? null,
  } as AnnualFinancial));
}

function sweep() {
  const findings: Array<{ ticker: string; year: number; anomaly: Anomaly }> = [];
  let periods = 0;
  let tickers = 0;
  for (const file of readdirSync(CACHE_DIR).filter((name) => name.endsWith('.json'))) {
    const ticker = file.replace(/\.json$/, '');
    let facts: CompanyFacts;
    try {
      facts = JSON.parse(readFileSync(join(CACHE_DIR, file), 'utf8')) as CompanyFacts;
    } catch {
      continue;
    }
    tickers++;
    for (const period of periodsFor(facts)) {
      if (period.totalAssets == null && period.revenue == null) continue;
      periods++;
      for (const anomaly of checkPeriod(period)) findings.push({ ticker, year: period.fiscalYear, anomaly });
    }
  }
  return { findings, periods, tickers };
}

describe.skipIf(!hasCorpus)('consistency checks against filed periods', () => {
  const { findings, periods, tickers } = hasCorpus ? sweep() : { findings: [], periods: 0, tickers: 0 };

  it('has a corpus worth testing against', () => {
    expect(tickers).toBeGreaterThan(20);
    expect(periods).toBeGreaterThan(100);
  });

  it('stays quiet on filers that are fine', () => {
    const rate = findings.length / periods;
    if (rate > 0.02) {
      // Printed rather than merely asserted: the failure is only actionable if
      // you can see which rule fired and on whom.
      const grouped = new Map<string, string[]>();
      for (const finding of findings) {
        const key = finding.anomaly.reason;
        grouped.set(key, [...(grouped.get(key) ?? []), `${finding.ticker} FY${finding.year}`]);
      }
      for (const [reason, where] of [...grouped].sort((a, b) => b[1].length - a[1].length)) {
        console.error(`${String(where.length).padStart(4)}  ${reason}\n      ${where.slice(0, 10).join(', ')}`);
      }
    }
    expect(rate).toBeLessThanOrEqual(0.02);
  });

  it('never calls a real filed period impossible', () => {
    // `implausible` is a judgement and may fire on a genuinely odd year.
    // `impossible` claims an accounting identity was violated, and being wrong
    // about that on a real filing would discredit every other check.
    const impossible = findings.filter((finding) => finding.anomaly.severity === 'impossible');
    expect(impossible.map((finding) => `${finding.ticker} FY${finding.year}: ${finding.anomaly.reason}`)).toEqual([]);
  });
});
