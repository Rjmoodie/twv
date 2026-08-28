/**
 * False-positive audit for the period consistency checks.
 *
 * financialPlausibility.ts refuses to build a growth badge or a derived ratio on
 * a field that fails a structural check. That is only worth doing if the checks
 * are quiet on filers that are fine. A check firing on a bank because banks do
 * not present a classified balance sheet would put "flagged for review" across a
 * third of the universe and teach every reader to ignore it.
 *
 * So this runs checkPeriod over real filed annual periods and reports how often
 * each rule fires, and on whom. Anything above a percent or two on this universe
 * is a rule that needs narrowing, not a discovery about the companies.
 *
 * It reads the cache that audit-edgar-coverage.ts populates, so it needs no
 * network and cannot hit the SEC:
 *
 *   npx tsx scripts/audit-edgar-coverage.ts     # populate .cache/edgar first
 *   npx tsx scripts/audit-plausibility.ts       # then this
 *   npx tsx scripts/audit-plausibility.ts --verbose   # list every firing
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TAGS } from '../supabase/functions/_shared/edgarTags';
import { checkPeriod } from '../src/components/somatech/financialPlausibility';
import type { AnnualFinancial } from '../src/components/somatech/financialStatementAnalytics';

const CACHE_DIR = join(process.cwd(), '.cache', 'edgar');
const VERBOSE = process.argv.includes('--verbose');

interface Fact { end: string; val: number; start?: string; form?: string; filed: string; fy?: number; fp?: string }
interface CompanyFacts { facts?: { 'us-gaap'?: Record<string, { units?: Record<string, Fact[]> }> } }

/** 10-K duration facts covering a full year, newest filing winning per year. */
function annualDuration(facts: CompanyFacts, tags: readonly string[]): Map<number, number> {
  const concepts = facts.facts?.['us-gaap'] ?? {};
  const result = new Map<number, number>();
  for (const tag of tags) {
    const candidates = new Map<number, Fact>();
    for (const fact of concepts[tag]?.units?.USD ?? []) {
      if (!/^10-K(?:\/A)?$/.test(fact.form ?? '') || !fact.start) continue;
      const days = (Date.parse(fact.end) - Date.parse(fact.start)) / 86_400_000;
      if (days < 340 || days > 390) continue;
      const year = new Date(fact.end).getUTCFullYear();
      const previous = candidates.get(year);
      if (!previous || Date.parse(fact.filed) > Date.parse(previous.filed)) candidates.set(year, fact);
    }
    // Tag lists are ordered by preference: a fallback fills a gap, never replaces.
    for (const [year, fact] of candidates) if (!result.has(year)) result.set(year, fact.val);
  }
  return result;
}

/** 10-K point-in-time facts, same precedence rules. */
function annualInstant(facts: CompanyFacts, tags: readonly string[]): Map<number, number> {
  const concepts = facts.facts?.['us-gaap'] ?? {};
  const result = new Map<number, number>();
  for (const tag of tags) {
    const candidates = new Map<number, Fact>();
    for (const fact of concepts[tag]?.units?.USD ?? []) {
      if (!/^10-K(?:\/A)?$/.test(fact.form ?? '') || fact.start) continue;
      const year = new Date(fact.end).getUTCFullYear();
      const previous = candidates.get(year);
      if (!previous || Date.parse(fact.filed) > Date.parse(previous.filed)) candidates.set(year, fact);
    }
    for (const [year, fact] of candidates) if (!result.has(year)) result.set(year, fact.val);
  }
  return result;
}

function periodsFor(facts: CompanyFacts): AnnualFinancial[] {
  const duration = {
    revenue: annualDuration(facts, TAGS.revenue),
    operatingIncome: annualDuration(facts, TAGS.operatingIncome),
    netIncome: annualDuration(facts, TAGS.netIncome),
    capex: annualDuration(facts, TAGS.capex),
  };
  const instant = {
    totalAssets: annualInstant(facts, TAGS.totalAssets),
    totalLiabilities: annualInstant(facts, TAGS.totalLiabilities),
    shareholderEquity: annualInstant(facts, TAGS.shareholderEquity),
    currentAssets: annualInstant(facts, TAGS.currentAssets),
    currentLiabilities: annualInstant(facts, TAGS.currentLiabilities),
    cash: annualInstant(facts, TAGS.cash),
  };
  const years = [...new Set([
    ...Object.values(duration).flatMap((series) => [...series.keys()]),
    ...Object.values(instant).flatMap((series) => [...series.keys()]),
  ])].sort((a, b) => b - a);

  const pick = (series: Map<number, number>, year: number) => series.get(year) ?? null;
  return years.map((year) => ({
    fiscalYear: year, periodEnd: `${year}-12-31`, periodType: 'annual',
    revenue: pick(duration.revenue, year),
    operatingIncome: pick(duration.operatingIncome, year),
    netIncome: pick(duration.netIncome, year),
    // The edge function normalises capex to a magnitude before use; mirror it,
    // or every filer that tags the outflow as negative trips the sign rule.
    capex: duration.capex.has(year) ? Math.abs(duration.capex.get(year)!) : null,
    totalAssets: pick(instant.totalAssets, year),
    totalLiabilities: pick(instant.totalLiabilities, year),
    shareholderEquity: pick(instant.shareholderEquity, year),
    currentAssets: pick(instant.currentAssets, year),
    currentLiabilities: pick(instant.currentLiabilities, year),
    cash: pick(instant.cash, year),
  } as AnnualFinancial));
}

function main() {
  if (!existsSync(CACHE_DIR)) {
    console.error(`No cache at ${CACHE_DIR}. Run: npx tsx scripts/audit-edgar-coverage.ts`);
    process.exit(1);
  }
  const files = readdirSync(CACHE_DIR).filter((name) => name.endsWith('.json'));
  if (!files.length) {
    console.error('Cache is empty. Run the coverage audit first.');
    process.exit(1);
  }

  const firings = new Map<string, { count: number; where: string[] }>();
  let companies = 0;
  let periods = 0;

  for (const file of files) {
    const ticker = file.replace(/\.json$/, '');
    let facts: CompanyFacts;
    try {
      facts = JSON.parse(readFileSync(join(CACHE_DIR, file), 'utf8')) as CompanyFacts;
    } catch {
      console.warn(`skipped ${ticker}: cache entry is not readable JSON`);
      continue;
    }
    companies++;
    for (const period of periodsFor(facts)) {
      // A year with nothing filed is a cache artefact, not a period to judge.
      if (period.totalAssets == null && period.revenue == null) continue;
      periods++;
      for (const anomaly of checkPeriod(period)) {
        const key = `${anomaly.severity}: ${anomaly.reason}`;
        const entry = firings.get(key) ?? { count: 0, where: [] };
        entry.count++;
        entry.where.push(`${ticker} FY${period.fiscalYear}`);
        firings.set(key, entry);
      }
    }
  }

  const total = [...firings.values()].reduce((sum, entry) => sum + entry.count, 0);
  console.log(`\nPeriod consistency audit — ${companies} filers, ${periods} annual periods\n`);

  if (!firings.size) {
    console.log('  No rule fired. The checks are silent on filers that are fine.\n');
    return;
  }

  const ranked = [...firings.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [reason, entry] of ranked) {
    const rate = ((entry.count / periods) * 100).toFixed(1);
    console.log(`  ${String(entry.count).padStart(4)}  ${rate.padStart(5)}%  ${reason}`);
    const sample = VERBOSE ? entry.where : entry.where.slice(0, 8);
    console.log(`        ${sample.join(', ')}${!VERBOSE && entry.where.length > 8 ? `, +${entry.where.length - 8} more` : ''}`);
  }
  console.log(`\n  ${total} firings across ${periods} periods (${((total / periods) * 100).toFixed(1)}%).`);
  console.log('  Anything above a percent or two is a rule to narrow, not a finding about the filers.\n');
}

main();
