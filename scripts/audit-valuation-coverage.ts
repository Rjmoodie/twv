/**
 * Valuation coverage audit — which companies can we actually put a number on?
 *
 * Field coverage and valuation coverage are different questions. A field can sit
 * at 68% while every company still gets valued, because the ladder falls through
 * to an instrument that does not need it. The number that matters to a user is
 * not "do we have gross profit" but "does this screen show a value or an N/A".
 *
 * This runs the real ladder over the cached EDGAR universe and reports which
 * rung each filer lands on, and which land nowhere.
 *
 * Prices are not fetched. Price affects only the upside percentage, never
 * whether a rung can produce a value, so its absence does not change the answer.
 *
 * Run `npm run audit:edgar` first to populate .cache/edgar.
 *   npx tsx scripts/audit-valuation-coverage.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TAGS, DERIVATION_INPUTS } from '../supabase/functions/_shared/edgarTags';
import { classifySic, type BusinessClass } from '../supabase/functions/_shared/sicClassification';
import { valueCompany, type ValuationRung } from '../src/components/somatech/valuationLadder';
import type { FinancialStatementPeriod } from '../src/components/somatech/types';

const CACHE_DIR = join(process.cwd(), '.cache', 'edgar');
const SUBMISSIONS_DIR = join(process.cwd(), '.cache', 'edgar-submissions');
const USER_AGENT = 'Somatech research@somatech.pro';

/** CIKs for the universe, matching the coverage audit. */
const CIK: Record<string, string> = {
  AAPL: '320193', ADBE: '796343', AMD: '2488', AMT: '1053507', AMZN: '1018724',
  BA: '12927', BAC: '70858', C: '831001', CAT: '18230', COP: '1163165',
  COST: '909832', CRM: '1108524', CVX: '93410', DE: '315189', DELL: '1571996',
  EQIX: '1101239', GOOGL: '1652044', GS: '886982', HD: '354950', HPQ: '47217',
  INTC: '50863', JNJ: '200406', JPM: '19617', KO: '21344', LLY: '59478',
  LMT: '936468', LOW: '60667', MCD: '63908', MRK: '310158', MS: '895421',
  MSFT: '789019', NOC: '1133421', NVDA: '1045810', ORCL: '1341439', PEP: '77476',
  PFE: '78003', PLD: '1045609', QCOM: '804328', SBUX: '829224', TGT: '27419',
  WFC: '72971', WMT: '104169', XOM: '34088', TSLA: '1318605',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * SIC code from EDGAR submissions — the same source the edge function reads.
 * Cached separately from company facts because it is a different endpoint.
 */
async function filedSic(ticker: string): Promise<{ sic: string | null; description: string | null }> {
  mkdirSync(SUBMISSIONS_DIR, { recursive: true });
  const path = join(SUBMISSIONS_DIR, `${ticker}.json`);
  let body: string | null = null;
  if (existsSync(path)) {
    body = readFileSync(path, 'utf8');
  } else {
    const cik = CIK[ticker];
    if (!cik) return { sic: null, description: null };
    const response = await fetch(`https://data.sec.gov/submissions/CIK${cik.padStart(10, '0')}.json`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip, deflate' },
    });
    if (!response.ok) return { sic: null, description: null };
    body = await response.text();
    writeFileSync(path, body);
    await sleep(130);
  }
  try {
    const parsed = JSON.parse(body) as { sic?: string; sicDescription?: string };
    return { sic: parsed.sic ?? null, description: parsed.sicDescription ?? null };
  } catch {
    return { sic: null, description: null };
  }
}

const UNIVERSE = [
  'AAPL', 'ADBE', 'AMD', 'AMT', 'AMZN', 'BA', 'BAC', 'C', 'CAT', 'COP',
  'COST', 'CRM', 'CVX', 'DE', 'DELL', 'EQIX', 'GOOGL', 'GS', 'HD', 'HPQ',
  'INTC', 'JNJ', 'JPM', 'KO', 'LLY', 'LMT', 'LOW', 'MCD', 'MRK', 'MS',
  'MSFT', 'NOC', 'NVDA', 'ORCL', 'PEP', 'PFE', 'PLD', 'QCOM', 'SBUX', 'TGT',
  'WFC', 'WMT', 'XOM', 'TSLA',
];

interface FactUnit { val: number; start?: string; end: string; filed: string; form: string; fy?: number; fp?: string }
interface Facts { 'us-gaap'?: Record<string, { units: Record<string, FactUnit[]> }>; dei?: Record<string, { units: Record<string, FactUnit[]> }> }

const spanDays = (f: FactUnit) => (Date.parse(f.end) - Date.parse(f.start!)) / 86_400_000;

/** Mirrors annualDurationSeries in the edge function. */
function durationSeries(facts: Facts, tags: readonly string[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const tag of tags) {
    const candidates = new Map<number, FactUnit>();
    for (const f of facts['us-gaap']?.[tag]?.units?.USD ?? []) {
      if (f.form !== '10-K' || !f.start) continue;
      if (spanDays(f) < 340 || spanDays(f) > 390) continue;
      const y = new Date(f.end).getUTCFullYear();
      const prev = candidates.get(y);
      if (!prev || Date.parse(f.filed) > Date.parse(prev.filed)) candidates.set(y, f);
    }
    for (const [y, f] of candidates) if (!out.has(y)) out.set(y, f.val);
  }
  return out;
}

/** Mirrors annualInstantSeries. */
function instantSeries(facts: Facts, tags: readonly string[], unit: 'USD' | 'shares' = 'USD'): Map<number, number> {
  const out = new Map<number, number>();
  const pool = { ...(facts['us-gaap'] ?? {}), ...(facts.dei ?? {}) };
  for (const tag of tags) {
    const candidates = new Map<number, FactUnit>();
    for (const f of pool[tag]?.units?.[unit] ?? []) {
      if (f.form !== '10-K' || f.start) continue;
      const y = new Date(f.end).getUTCFullYear();
      const prev = candidates.get(y);
      if (!prev || Date.parse(f.filed) > Date.parse(prev.filed)) candidates.set(y, f);
    }
    for (const [y, f] of candidates) if (!out.has(y)) out.set(y, f.val);
  }
  return out;
}

/** Mirrors annualCoverShareSeries — cover-page counts key by the filing's fiscal year. */
function coverShares(facts: Facts): Map<number, number> {
  const out = new Map<number, number>();
  for (const f of facts.dei?.EntityCommonStockSharesOutstanding?.units?.shares ?? []) {
    if (f.form !== '10-K' || f.start || f.fp !== 'FY' || !Number.isInteger(f.fy)) continue;
    out.set(f.fy!, f.val);
  }
  return out;
}

function buildAnnual(facts: Facts): FinancialStatementPeriod[] {
  const d = (k: keyof typeof TAGS) => durationSeries(facts, TAGS[k]);
  const i = (k: keyof typeof TAGS) => instantSeries(facts, TAGS[k]);
  const di = (k: keyof typeof DERIVATION_INPUTS) => DERIVATION_INPUTS[k];

  const revenue = d('revenue'), grossProfitF = d('grossProfit'), opIncF = d('operatingIncome');
  const ocf = d('operatingCashFlow'), capex = d('capex'), da = d('depreciationAmortization');
  const assets = i('totalAssets'), liabF = i('totalLiabilities'), equity = i('shareholderEquity');
  const ltd = i('longTermDebt'), std = i('shortTermDebt'), cash = i('cash');
  const costOfRevenue = durationSeries(facts, di('costOfRevenue'));
  const costsAndExpenses = durationSeries(facts, di('costsAndExpenses'));
  const bsTotal = instantSeries(facts, di('balanceSheetTotal'));
  const equityNCI = instantSeries(facts, di('equityForLiabilities'));
  const shares = new Map([...instantSeries(facts, ['CommonStockSharesOutstanding'], 'shares'), ...coverShares(facts)]);

  const years = [...new Set([
    ...revenue.keys(), ...grossProfitF.keys(), ...opIncF.keys(), ...ocf.keys(), ...capex.keys(),
    ...assets.keys(), ...liabF.keys(), ...equity.keys(), ...cash.keys(),
  ])].sort((a, b) => b - a).slice(0, 5);

  const sub = (a?: number, b?: number) => (a != null && b != null ? a - b : null);

  return years.map((y) => {
    const rev = revenue.get(y) ?? null;
    const rawCapex = capex.get(y);
    const cx = rawCapex == null ? null : Math.abs(rawCapex);
    const o = ocf.get(y) ?? null;
    return {
      fiscalYear: y, periodEnd: `${y}-12-31`, periodType: 'annual',
      revenue: rev,
      grossProfit: grossProfitF.get(y) ?? sub(rev ?? undefined, costOfRevenue.get(y)),
      operatingIncome: opIncF.get(y) ?? sub(rev ?? undefined, costsAndExpenses.get(y)),
      netIncome: null,
      operatingCashFlow: o, capex: cx,
      freeCashFlow: o != null && cx != null ? o - cx : null,
      totalAssets: assets.get(y) ?? null,
      totalLiabilities: liabF.get(y) ?? sub(bsTotal.get(y), equityNCI.get(y) ?? equity.get(y)),
      currentAssets: null, currentLiabilities: null,
      longTermDebt: ltd.get(y) ?? null, shortTermDebt: std.get(y) ?? null,
      shareholderEquity: equity.get(y) ?? equityNCI.get(y) ?? null,
      cash: cash.get(y) ?? null,
      sharesOutstanding: shares.get(y) ?? null,
      depreciationAmortization: da.get(y) ?? null,
    } as unknown as FinancialStatementPeriod;
  });
}

const RUNG_ORDER: (ValuationRung['method'] | 'none')[] = [
  'dcf-fcf', 'ev-ebitda', 'ev-ebit', 'ev-gross-profit', 'ev-sales', 'price-book', 'none',
];

async function main() {
  const rows: { ticker: string; method: string; label: string; reason: string; value: number | null; cls: BusinessClass; sic: string | null }[] = [];

  for (const ticker of UNIVERSE) {
    const path = join(CACHE_DIR, `${ticker}.json`);
    if (!existsSync(path)) { console.warn(`  ${ticker}: not cached — run npm run audit:edgar first`); continue; }
    const facts = (JSON.parse(readFileSync(path, 'utf8')) as { facts: Facts }).facts;
    const annual = buildAnnual(facts);
    const shares = annual[0]?.sharesOutstanding ?? null;
    const { sic } = await filedSic(ticker);
    const businessClass = classifySic(sic);
    const result = valueCompany({ annual, price: null, sharesOutstanding: shares, businessClass });
    rows.push({
      ticker,
      method: result.selected?.method ?? 'none',
      label: result.selected?.label ?? 'NOT VALUABLE',
      reason: result.selected ? (result.skipped.at(-1)?.reason ?? 'best instrument available') : (result.unvaluableReason ?? ''),
      value: result.selected?.valuePerShare ?? null,
      cls: businessClass, sic,
    });
  }

  console.log(`\nVALUATION COVERAGE — ${rows.length} filers\n`);
  for (const method of RUNG_ORDER) {
    const group = rows.filter((r) => r.method === method);
    if (!group.length) continue;
    const label = group[0].label;
    console.log(`${label}  (${group.length})`);
    for (const r of group) {
      const v = r.value != null ? `$${r.value.toFixed(2)}` : '—';
      const tag = r.cls === 'general' ? '' : `  [${r.cls} · SIC ${r.sic ?? '?'}]`;
      console.log(`   ${r.ticker.padEnd(6)} ${v.padStart(10)}${tag}   ${r.method === 'none' ? r.reason : ''}`);
    }
    console.log('');
  }

  const valued = rows.filter((r) => r.method !== 'none').length;
  console.log(`Valued: ${valued}/${rows.length}  (${((valued / rows.length) * 100).toFixed(0)}%)`);
  const byQuality = {
    'cash-flow based': rows.filter((r) => r.method === 'dcf-fcf').length,
    'earnings based': rows.filter((r) => r.method === 'ev-ebitda' || r.method === 'ev-ebit').length,
    'revenue or asset based': rows.filter((r) => ['ev-gross-profit', 'ev-sales', 'price-book'].includes(r.method)).length,
    'not valuable': rows.length - valued,
  };
  console.log('\nBy instrument quality:');
  for (const [k, v] of Object.entries(byQuality)) console.log(`   ${k.padEnd(24)} ${v}`);

  const classified = rows.filter((r) => r.cls !== 'general');
  console.log(`\nSector-classified from filed SIC codes: ${classified.length}`);
  for (const r of classified) console.log(`   ${r.ticker.padEnd(6)} ${r.cls.padEnd(16)} ${r.label}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
