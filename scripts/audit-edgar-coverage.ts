/**
 * EDGAR coverage audit.
 *
 * Four separate bugs in one day had the same shape: a `TAGS` list held one
 * concept, a filer used a different one, the field came back null, and the null
 * cascaded until a whole screen went blank. NVDA had no free cash flow because
 * it tags capital spend as `PaymentsToAcquireProductiveAssets`; Intel had no
 * EBITDA because it reports depreciation and amortisation on separate lines.
 * Each was found by a person looking at a broken screen.
 *
 * This finds them first. It does two things against a universe of filers:
 *
 *   COVERAGE   For each field, what share of the universe resolves it with the
 *              tag list we actually ship. That is the regression baseline.
 *
 *   DISCOVERY  For each field, which concepts filers use that we do NOT list,
 *              ranked by how many companies each would newly cover. That is the
 *              list of candidates to consider adding.
 *
 * Discovery deliberately stops at "candidate". A concept that would raise
 * coverage is not automatically one that means the same thing — adding the
 * restricted-cash-inclusive concept fills Intel's gap but changes what "cash"
 * means for those years. Widening a list is a judgement about meaning, so this
 * reports and a human decides.
 *
 * Usage:
 *   npx tsx scripts/audit-edgar-coverage.ts                  # curated universe
 *   npx tsx scripts/audit-edgar-coverage.ts --tickers A,B,C  # explicit list
 *   npx tsx scripts/audit-edgar-coverage.ts --json out.json  # machine-readable
 *
 * Responses are cached under .cache/edgar/ so re-runs cost nothing and the SEC
 * is not hit repeatedly while iterating on tag lists.
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TAGS,
  DERIVATION_INPUTS,
  DURATION_FIELDS,
  INSTANT_FIELDS,
  type TagField,
} from '../supabase/functions/_shared/edgarTags';

/**
 * Fields the edge function can recover by identity when no concept is tagged.
 *
 * Coverage must count these, or the report understates what a user actually
 * sees and would push someone to widen a tag list that needs no widening.
 */
const DERIVABLE: Partial<Record<TagField, { inputs: (keyof typeof DERIVATION_INPUTS | TagField)[]; kinds: ('duration' | 'instant')[] }>> = {
  grossProfit: { inputs: ['revenue', 'costOfRevenue'], kinds: ['duration', 'duration'] },
  operatingIncome: { inputs: ['revenue', 'costsAndExpenses'], kinds: ['duration', 'duration'] },
  totalLiabilities: { inputs: ['balanceSheetTotal', 'equityForLiabilities'], kinds: ['instant', 'instant'] },
  sellingGeneralAdministrative: { inputs: ['generalAndAdministrative', 'sellingAndMarketing'], kinds: ['duration', 'duration'] },
};

const conceptsFor = (name: string): readonly string[] =>
  (TAGS as Record<string, readonly string[]>)[name] ?? (DERIVATION_INPUTS as Record<string, readonly string[]>)[name] ?? [];

// SEC asks for an identifying User-Agent and fair-access rate limiting.
const USER_AGENT = 'Somatech research@somatech.pro';
const MAX_REQUESTS_PER_SECOND = 8;
const CACHE_DIR = join(process.cwd(), '.cache', 'edgar');

/**
 * A sector-diverse universe rather than a large one.
 *
 * Tagging idiom varies by industry far more than by size: banks carry no gross
 * profit and an unclassified balance sheet, REITs and insurers have their own
 * vocabularies, oil majors report costs without an operating income line.
 * Twenty more software companies would add almost nothing; one bank, one REIT
 * and one retailer expose whole classes of gap. These are the seed names from
 * the peer universe plus the CIKs already curated alongside them.
 */
const DEFAULT_UNIVERSE: Record<string, string> = {
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

/**
 * Broad patterns used only to propose candidates.
 *
 * These are intentionally looser than the shipped tag lists: the point is to
 * surface concepts nobody thought to list, so a pattern that also catches a few
 * irrelevant tags is doing its job. The ranked output is read by a person.
 */
const DISCOVERY: Partial<Record<TagField, RegExp>> = {
  revenue: /^(Revenues?|RevenueFromContract|SalesRevenue|TotalRevenues)/,
  grossProfit: /^GrossProfit/,
  operatingIncome: /^OperatingIncome/,
  netIncome: /^(NetIncomeLoss|ProfitLoss)/,
  researchAndDevelopment: /^ResearchAndDevelopment/,
  sellingGeneralAdministrative: /^(SellingGeneral|GeneralAndAdministrative|SellingAndMarketing)/,
  pretaxIncome: /^IncomeLossFromContinuingOperationsBeforeIncomeTaxes/,
  incomeTaxExpense: /^IncomeTaxExpense/,
  interestExpense: /^Interest(Expense|AndDebtExpense)/,
  operatingCashFlow: /^NetCashProvidedByUsedInOperatingActivities/,
  capex: /^Payments(To|For)Acquire.*(Propert|Productive|Premises|Equipment|Capital)/,
  depreciationAmortization: /^(Depreciation|AmortizationOf(Intangible|Deferred))/,
  stockCompensation: /^(ShareBasedCompensation|AllocatedShareBasedCompensation)/,
  acquisitions: /^PaymentsToAcquireBusiness/,
  shareRepurchases: /^PaymentsForRepurchaseOf(Common|Equity)/,
  dividendsPaid: /^PaymentsOfDividends/,
  debtIssuance: /^ProceedsFromIssuanceOf.*Debt/,
  debtRepayment: /^RepaymentsOf.*Debt/,
  totalAssets: /^Assets$/,
  totalLiabilities: /^Liabilities(AndStockholdersEquity)?$/,
  currentAssets: /^AssetsCurrent$/,
  currentLiabilities: /^LiabilitiesCurrent$/,
  receivables: /^(AccountsReceivable|AccountsNotesAndLoansReceivable|ReceivablesNet)/,
  inventory: /^Inventor(y|ies)/,
  goodwill: /^Goodwill$/,
  retainedEarnings: /^RetainedEarnings/,
  longTermDebt: /^LongTerm(Debt|NotesPayable)/,
  shortTermDebt: /^(DebtCurrent|ShortTermBorrowings|LongTermDebtCurrent)/,
  shareholderEquity: /^StockholdersEquity/,
  cash: /^Cash(AndCashEquivalents|CashEquivalents)/,
  sharesOutstanding: /^(EntityCommonStockSharesOutstanding|CommonStockSharesOutstanding)/,
};

interface FactUnit { val: number; start?: string; end: string; filed: string; form: string }
interface CompanyFacts {
  entityName?: string;
  facts?: { 'us-gaap'?: Record<string, { units: Record<string, FactUnit[]> }>; dei?: Record<string, { units: Record<string, FactUnit[]> }> };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function companyFacts(ticker: string, cik: string): Promise<CompanyFacts | null> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cached = join(CACHE_DIR, `${ticker}.json`);
  if (existsSync(cached)) {
    try { return JSON.parse(readFileSync(cached, 'utf8')) as CompanyFacts; } catch { /* refetch */ }
  }
  const padded = cik.padStart(10, '0');
  const response = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip, deflate' },
  });
  if (!response.ok) {
    console.warn(`  ${ticker}: HTTP ${response.status}`);
    return null;
  }
  const body = await response.text();
  writeFileSync(cached, body);
  return JSON.parse(body) as CompanyFacts;
}

const spanDays = (fact: FactUnit): number =>
  fact.start ? (Date.parse(fact.end) - Date.parse(fact.start)) / 86_400_000 : 0;

/** Mirrors the edge function: annual 10-K facts only, roughly a year long. */
const isAnnualDuration = (fact: FactUnit): boolean =>
  fact.form === '10-K' && Boolean(fact.start) && spanDays(fact) >= 340 && spanDays(fact) <= 390;

const isAnnualInstant = (fact: FactUnit): boolean => fact.form === '10-K' && !fact.start;

/** Concepts in this filing that carry usable annual data, with their latest year. */
function usableConcepts(facts: CompanyFacts, kind: 'duration' | 'instant'): Map<string, number> {
  const found = new Map<string, number>();
  const pools = [facts.facts?.['us-gaap'] ?? {}, facts.facts?.dei ?? {}];
  const predicate = kind === 'duration' ? isAnnualDuration : isAnnualInstant;
  for (const pool of pools) {
    for (const [concept, body] of Object.entries(pool)) {
      for (const units of Object.values(body.units ?? {})) {
        for (const fact of units) {
          if (!predicate(fact)) continue;
          const year = Number(fact.end.slice(0, 4));
          if (!found.has(concept) || year > found.get(concept)!) found.set(concept, year);
        }
      }
    }
  }
  return found;
}

interface FieldReport {
  field: TagField;
  kind: 'duration' | 'instant';
  covered: string[];
  missing: string[];
  /** Filers covered only because an identity recovers the field. */
  derivedCover: string[];
  coveragePct: number;
  /** Concepts not in TAGS, with the tickers they would newly cover. */
  candidates: { concept: string; wouldCover: string[] }[];
}

async function main() {
  const args = process.argv.slice(2);
  const tickerArg = args.indexOf('--tickers');
  const jsonArg = args.indexOf('--json');
  const recentOnly = Number(args[args.indexOf('--since') + 1]) || 2023;

  const universe = tickerArg >= 0
    ? Object.fromEntries(args[tickerArg + 1].split(',').map((t) => [t.trim().toUpperCase(), DEFAULT_UNIVERSE[t.trim().toUpperCase()] ?? '']).filter(([, cik]) => cik))
    : DEFAULT_UNIVERSE;

  const tickers = Object.keys(universe);
  console.log(`Auditing ${tickers.length} filers against ${Object.keys(TAGS).length} fields (annual 10-K facts since ${recentOnly}).\n`);

  const loaded: { ticker: string; duration: Map<string, number>; instant: Map<string, number> }[] = [];
  for (const ticker of tickers) {
    const facts = await companyFacts(ticker, universe[ticker]);
    if (!facts) continue;
    loaded.push({
      ticker,
      duration: usableConcepts(facts, 'duration'),
      instant: usableConcepts(facts, 'instant'),
    });
    process.stdout.write('.');
    await sleep(1000 / MAX_REQUESTS_PER_SECOND);
  }
  console.log(`\nLoaded ${loaded.length} filers.\n`);

  const fresh = (concepts: Map<string, number>, concept: string): boolean =>
    (concepts.get(concept) ?? 0) >= recentOnly;

  const reports: FieldReport[] = [];
  for (const field of [...DURATION_FIELDS, ...INSTANT_FIELDS] as TagField[]) {
    const kind = (DURATION_FIELDS as readonly string[]).includes(field) ? 'duration' : 'instant';
    const listed = new Set<string>(TAGS[field] as readonly string[]);
    const covered: string[] = [];
    const missing: string[] = [];
    const derivedCover: string[] = [];

    for (const entry of loaded) {
      const concepts = kind === 'duration' ? entry.duration : entry.instant;
      let hit = [...listed].some((concept) => fresh(concepts, concept));
      if (!hit) {
        const rule = DERIVABLE[field];
        if (rule) {
          hit = rule.inputs.every((input, i) => {
            const pool = rule.kinds[i] === 'duration' ? entry.duration : entry.instant;
            return conceptsFor(input).some((concept) => fresh(pool, concept));
          });
          if (hit) derivedCover.push(entry.ticker);
        }
      }
      (hit ? covered : missing).push(entry.ticker);
    }

    // Which unlisted concepts would newly cover the filers we currently miss?
    const candidateHits = new Map<string, string[]>();
    const pattern = DISCOVERY[field];
    if (pattern) {
      for (const ticker of missing) {
        const entry = loaded.find((e) => e.ticker === ticker)!;
        const concepts = kind === 'duration' ? entry.duration : entry.instant;
        for (const [concept, year] of concepts) {
          if (listed.has(concept) || year < recentOnly || !pattern.test(concept)) continue;
          candidateHits.set(concept, [...(candidateHits.get(concept) ?? []), ticker]);
        }
      }
    }

    reports.push({
      field, kind, covered, missing, derivedCover,
      coveragePct: loaded.length ? (covered.length / loaded.length) * 100 : 0,
      candidates: [...candidateHits.entries()]
        .map(([concept, wouldCover]) => ({ concept, wouldCover }))
        .sort((a, b) => b.wouldCover.length - a.wouldCover.length),
    });
  }

  reports.sort((a, b) => a.coveragePct - b.coveragePct);

  console.log('COVERAGE (worst first)\n');
  console.log(`${'field'.padEnd(30)}${'cover'.padStart(7)}   missing`);
  for (const r of reports) {
    const pct = `${r.coveragePct.toFixed(0)}%`.padStart(7);
    const miss = r.missing.length ? r.missing.join(' ') : '—';
    const via = r.derivedCover.length ? `  [${r.derivedCover.length} derived]` : '';
    console.log(`${r.field.padEnd(30)}${pct}${via.padEnd(15)}   ${miss}`);
  }

  const withCandidates = reports.filter((r) => r.candidates.length > 0);
  if (withCandidates.length) {
    console.log('\n\nCANDIDATE CONCEPTS (not currently listed, ranked by filers they would newly cover)\n');
    console.log('Adding one is a judgement about MEANING, not just coverage — a broader');
    console.log('concept can fill a gap while silently changing what the number is.\n');
    for (const r of withCandidates) {
      console.log(`${r.field}  (currently ${r.coveragePct.toFixed(0)}%)`);
      for (const c of r.candidates.slice(0, 5)) {
        console.log(`   +${String(c.wouldCover.length).padStart(2)}  ${c.concept.padEnd(58)} ${c.wouldCover.join(' ')}`);
      }
      console.log('');
    }
  }

  const perfect = reports.filter((r) => r.coveragePct === 100).length;
  console.log(`\n${perfect}/${reports.length} fields at full coverage across the universe.`);

  if (jsonArg >= 0) {
    writeFileSync(args[jsonArg + 1], JSON.stringify({ universe: tickers, reports }, null, 2));
    console.log(`Wrote ${args[jsonArg + 1]}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
