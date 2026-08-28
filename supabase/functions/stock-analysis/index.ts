import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsError, corsResponse, CORS_HEADERS } from "../_shared/cors.ts";
import { rankPeers, type PeerProfile } from "../_shared/peerScoring.ts";
import { TAGS, DERIVATION_INPUTS } from "../_shared/edgarTags.ts";
import { normalizeCompanyNews } from "../_shared/companyNews.ts";

const SEC_HEADERS = {
  "User-Agent": "Somatech research@somatech.pro",
  "Accept-Encoding": "gzip, deflate",
};
const FUNDAMENTALS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// 8: cover-page share counts no longer derive their fiscal year from the cover
//    date, and cash falls back to the restricted-cash-inclusive concept. Payloads
//    built before this carry a phantom leading year and share counts shifted back
//    by one.
// 9: depreciation falls back to the standalone `Depreciation` line, so filers that
//    report depreciation and amortisation separately stop returning null D&A —
//    without which EBITDA, and every valuation resting on it, cannot be computed.
// 10: capex falls back to the productive-assets and premises concepts, without
//    which filers like NVDA returned no capex, hence no free cash flow, hence no
//    valuation at all.
// 11: interest expense was spelled `InterestExpenseNonOperating` — us-gaap uses a
//    lowercase "o" — so it matched nothing and coverage sat at 7%. Plus synonym
//    fallbacks for receivables, debt issuance/repayment and D&A, found by
//    `npm run audit:edgar`.
// 12: fields a filer does not tag are now recovered by accounting identity —
//    gross profit, operating income, total liabilities and SG&A — each marked
//    `derived` in provenance with its formula.
const FUNDAMENTALS_CACHE_VERSION = 13;
const QUOTE_TTL_MS = 24 * 60 * 60 * 1000;
const QUOTE_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const PRICE_HISTORY_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const FUNDAMENTALS_STALE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PEER_SUGGESTIONS = 8;
const NEWS_TTL_MS = 30 * 60 * 1000;
const NEWS_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 12_000;
const fetchUpstream = (
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1] = {},
) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });

type PeerCandidate = { ticker: string; name: string; industry: string; sector: string };

// Classification seeds only. No peer financials are fetched until the user
// approves a suggestion. Unsupported classifications retain the manual flow.
const PEER_UNIVERSE: PeerCandidate[] = [
  { ticker: "AAPL", name: "Apple", industry: "Consumer Electronics", sector: "Technology" },
  { ticker: "MSFT", name: "Microsoft", industry: "Software Infrastructure", sector: "Technology" },
  { ticker: "GOOGL", name: "Alphabet", industry: "Internet Content Information", sector: "Communication Services" },
  { ticker: "DELL", name: "Dell Technologies", industry: "Computer Hardware", sector: "Technology" },
  { ticker: "HPQ", name: "HP", industry: "Computer Hardware", sector: "Technology" },
  { ticker: "QCOM", name: "Qualcomm", industry: "Semiconductors", sector: "Technology" },
  { ticker: "NVDA", name: "NVIDIA", industry: "Semiconductors", sector: "Technology" },
  { ticker: "AMD", name: "Advanced Micro Devices", industry: "Semiconductors", sector: "Technology" },
  { ticker: "INTC", name: "Intel", industry: "Semiconductors", sector: "Technology" },
  { ticker: "CRM", name: "Salesforce", industry: "Software Application", sector: "Technology" },
  { ticker: "ORCL", name: "Oracle", industry: "Software Infrastructure", sector: "Technology" },
  { ticker: "ADBE", name: "Adobe", industry: "Software Application", sector: "Technology" },
  { ticker: "AMZN", name: "Amazon", industry: "Internet Retail", sector: "Consumer Cyclical" },
  { ticker: "WMT", name: "Walmart", industry: "Discount Stores", sector: "Consumer Defensive" },
  { ticker: "COST", name: "Costco", industry: "Discount Stores", sector: "Consumer Defensive" },
  { ticker: "TGT", name: "Target", industry: "Discount Stores", sector: "Consumer Defensive" },
  { ticker: "HD", name: "Home Depot", industry: "Home Improvement Retail", sector: "Consumer Cyclical" },
  { ticker: "LOW", name: "Lowe's", industry: "Home Improvement Retail", sector: "Consumer Cyclical" },
  { ticker: "JPM", name: "JPMorgan Chase", industry: "Banks Diversified", sector: "Financial Services" },
  { ticker: "BAC", name: "Bank of America", industry: "Banks Diversified", sector: "Financial Services" },
  { ticker: "C", name: "Citigroup", industry: "Banks Diversified", sector: "Financial Services" },
  { ticker: "WFC", name: "Wells Fargo", industry: "Banks Diversified", sector: "Financial Services" },
  { ticker: "GS", name: "Goldman Sachs", industry: "Capital Markets", sector: "Financial Services" },
  { ticker: "MS", name: "Morgan Stanley", industry: "Capital Markets", sector: "Financial Services" },
  { ticker: "XOM", name: "Exxon Mobil", industry: "Oil Gas Integrated", sector: "Energy" },
  { ticker: "CVX", name: "Chevron", industry: "Oil Gas Integrated", sector: "Energy" },
  { ticker: "COP", name: "ConocoPhillips", industry: "Oil Gas Exploration Production", sector: "Energy" },
  { ticker: "PFE", name: "Pfizer", industry: "Drug Manufacturers General", sector: "Healthcare" },
  { ticker: "MRK", name: "Merck", industry: "Drug Manufacturers General", sector: "Healthcare" },
  { ticker: "LLY", name: "Eli Lilly", industry: "Drug Manufacturers General", sector: "Healthcare" },
  { ticker: "JNJ", name: "Johnson Johnson", industry: "Drug Manufacturers General", sector: "Healthcare" },
  { ticker: "KO", name: "Coca-Cola", industry: "Beverages Non-Alcoholic", sector: "Consumer Defensive" },
  { ticker: "PEP", name: "PepsiCo", industry: "Beverages Non-Alcoholic", sector: "Consumer Defensive" },
  { ticker: "MCD", name: "McDonald's", industry: "Restaurants", sector: "Consumer Cyclical" },
  { ticker: "SBUX", name: "Starbucks", industry: "Restaurants", sector: "Consumer Cyclical" },
  { ticker: "CAT", name: "Caterpillar", industry: "Farm Heavy Construction Machinery", sector: "Industrials" },
  { ticker: "DE", name: "Deere", industry: "Farm Heavy Construction Machinery", sector: "Industrials" },
  { ticker: "BA", name: "Boeing", industry: "Aerospace Defense", sector: "Industrials" },
  { ticker: "LMT", name: "Lockheed Martin", industry: "Aerospace Defense", sector: "Industrials" },
  { ticker: "NOC", name: "Northrop Grumman", industry: "Aerospace Defense", sector: "Industrials" },
  { ticker: "PLD", name: "Prologis", industry: "REIT Industrial", sector: "Real Estate" },
  { ticker: "AMT", name: "American Tower", industry: "REIT Specialty", sector: "Real Estate" },
  { ticker: "EQIX", name: "Equinix", industry: "REIT Specialty", sector: "Real Estate" },
];

// Official SEC CIKs for the reviewed seed universe. Keeping these identities
// local prevents one full SEC ticker-directory request per selected peer.
const CURATED_CIK: Record<string, string> = {
  AAPL: "320193", ADBE: "796343", AMD: "2488", AMT: "1053507", AMZN: "1018724",
  BA: "12927", BAC: "70858", C: "831001", CAT: "18230", COP: "1163165",
  COST: "909832", CRM: "1108524", CVX: "93410", DE: "315189", DELL: "1571996",
  EQIX: "1101239", GOOGL: "1652044", GS: "886982", HD: "354950", HPQ: "47217",
  INTC: "50863", JNJ: "200406", JPM: "19617", KO: "21344", LLY: "59478",
  LMT: "936468", LOW: "60667", MCD: "63908", MRK: "310158", MS: "895421",
  MSFT: "789019", NOC: "1133421", NVDA: "1045810", ORCL: "1341439", PEP: "77476",
  PFE: "78003", PLD: "1045609", QCOM: "804328", SBUX: "829224", TGT: "27419",
  WFC: "72971", WMT: "104169", XOM: "2115436",
};

type FactUnit = {
  val: number;
  start?: string;
  end: string;
  filed: string;
  form: string;
  frame?: string;
  fy?: number;
  fp?: string;
  accn?: string;
  concept?: string;
};

type NormalizedFact = { val: number; end: string; filed: string; form: string; derived: boolean; concept: string; accn?: string };

type CompanyFacts = {
  entityName: string;
  facts: {
    "us-gaap"?: Record<string, { units: Record<string, FactUnit[]> }>;
    dei?: Record<string, { units: Record<string, FactUnit[]> }>;
  };
};


function annualDurationSeries(facts: CompanyFacts, tags: readonly string[]): Map<number, FactUnit> {
  const concepts = facts.facts["us-gaap"] ?? {};
  const result = new Map<number, FactUnit>();
  for (const tag of tags) {
    const entries = concepts[tag]?.units?.USD ?? [];
    const annual = entries.filter((entry) => {
      if (!/^10-K(?:\/A)?$/.test(entry.form) || !entry.start) return false;
      const days = (Date.parse(entry.end) - Date.parse(entry.start)) / 86_400_000;
      return days >= 340 && days <= 390;
    });
    const candidates = new Map<number, FactUnit>();
    for (const entry of annual) {
      const year = new Date(entry.end).getUTCFullYear();
      const previous = candidates.get(year);
      if (!previous || Date.parse(entry.filed) > Date.parse(previous.filed)) candidates.set(year, entry);
    }
    // Tags are ordered by preference. A fallback fills gaps, but never replaces
    // a value sourced from a more specific concept.
    for (const [year, entry] of candidates) if (!result.has(year)) result.set(year, { ...entry, concept: tag });
  }
  return result;
}

function annualInstantSeries(
  facts: CompanyFacts,
  tags: readonly string[],
  unit: "USD" | "shares" = "USD",
): Map<number, FactUnit> {
  const concepts = { ...(facts.facts["us-gaap"] ?? {}), ...(facts.facts.dei ?? {}) };
  const result = new Map<number, FactUnit>();
  for (const tag of tags) {
    const entries = concepts[tag]?.units?.[unit] ?? [];
    const annual = entries.filter((entry) => /^10-K(?:\/A)?$/.test(entry.form) && !entry.start);
    const candidates = new Map<number, FactUnit>();
    for (const entry of annual) {
      const year = new Date(entry.end).getUTCFullYear();
      const previous = candidates.get(year);
      if (!previous || Date.parse(entry.filed) > Date.parse(previous.filed)) candidates.set(year, entry);
    }
    for (const [year, entry] of candidates) if (!result.has(year)) result.set(year, { ...entry, concept: tag });
  }
  return result;
}

/**
 * Cover-page share counts, keyed by the fiscal year they actually describe.
 *
 * `dei:EntityCommonStockSharesOutstanding` is the count printed on the front of a
 * 10-K, and its `end` is the day the cover was dated — in January of the FOLLOWING
 * calendar year for a December filer. Deriving the year from `end`, as every real
 * financial fact correctly does, therefore filed Intel's FY2025 cover count under
 * "2026": a fiscal year that does not exist yet, holding a share count and nothing
 * else. It sorted to the front as the newest period, so every headline tile, ratio
 * and data-quality check read a period that was empty by construction, and the
 * five-year window spent a slot on it. The same off-by-one silently shifted every
 * other year's share count back one year.
 *
 * Unlike a financial fact, this one is unique per filing, so the filing's own `fy`
 * is exactly the period it belongs to. That is not true in general — `fy` labels
 * the report, not the fact, and a 10-K restates several prior years under its own
 * `fy` — which is why this is a dedicated path and not a blanket substitution.
 */
function annualCoverShareSeries(facts: CompanyFacts): Map<number, FactUnit> {
  const result = new Map<number, FactUnit>();
  const entries = (facts.facts.dei?.EntityCommonStockSharesOutstanding?.units?.shares ?? [])
    .filter((entry) => /^10-K(?:\/A)?$/.test(entry.form) && !entry.start && entry.fp === "FY" && Number.isInteger(entry.fy));
  for (const entry of entries) {
    const year = entry.fy!;
    const previous = result.get(year);
    if (!previous || Date.parse(entry.filed) > Date.parse(previous.filed)) {
      result.set(year, { ...entry, concept: "EntityCommonStockSharesOutstanding" });
    }
  }
  return result;
}

const daysInFact = (fact: FactUnit) => fact.start
  ? (Date.parse(fact.end) - Date.parse(fact.start)) / 86_400_000
  : null;

const latestFact = (facts: FactUnit[]) => facts.reduce<FactUnit | null>((latest, fact) =>
  !latest || Date.parse(fact.filed) > Date.parse(latest.filed) ? fact : latest, null);

const isTimelyPrimaryFact = (fact: FactUnit) => {
  const lag = (Date.parse(fact.filed) - Date.parse(fact.end)) / 86_400_000;
  return lag >= 0 && lag <= 150;
};

function quarterlyDurationSeries(facts: CompanyFacts, tags: readonly string[]): Map<string, NormalizedFact> {
  const concepts = facts.facts["us-gaap"] ?? {};
  const result = new Map<string, NormalizedFact>();
  for (const tag of tags) {
    const allEntries = (concepts[tag]?.units?.USD ?? []).filter((fact) =>
      /^(10-Q|10-K)(\/A)?$/.test(fact.form) && fact.start && Number.isInteger(fact.fy));
    // Company Facts repeats comparative contexts with the later filing's FY/FP.
    // Only timely primary contexts are safe to classify automatically. A late
    // amendment is omitted rather than allowed to relabel a comparative period.
    const entries = allEntries.filter(isTimelyPrimaryFact);
    for (const fy of [...new Set(entries.map((fact) => fact.fy!))]) {
      const yearFacts = entries.filter((fact) => fact.fy === fy);
      const pick = (fp: string, min: number, max: number) => latestFact(yearFacts.filter((fact) => {
        const days = daysInFact(fact);
        return fact.fp === fp && days != null && days >= min && days <= max;
      }));
      const direct = [pick("Q1", 70, 110), pick("Q2", 70, 110), pick("Q3", 70, 110), null];
      const cumulative = [pick("Q1", 70, 110), pick("Q2", 150, 200), pick("Q3", 235, 300), pick("FY", 340, 390)];
      for (let quarter = 1; quarter <= 4; quarter++) {
        const key = `${fy}-Q${quarter}`;
        if (result.has(key)) continue;
        const filed = direct[quarter - 1];
        if (filed) {
          result.set(key, { val: filed.val, end: filed.end, filed: filed.filed, form: filed.form, derived: false, concept: tag, accn: filed.accn });
          continue;
        }
        const current = cumulative[quarter - 1];
        const previous = cumulative[quarter - 2];
        if (quarter > 1 && current && previous && current.start === previous.start && Date.parse(current.end) > Date.parse(previous.end)) {
          result.set(key, { val: current.val - previous.val, end: current.end, filed: current.filed, form: current.form, derived: true, concept: tag, accn: current.accn });
        }
      }
    }
  }
  return result;
}

function quarterlyInstantSeries(facts: CompanyFacts, tags: readonly string[], unit: "USD" | "shares" = "USD") {
  const concepts = { ...(facts.facts["us-gaap"] ?? {}), ...(facts.facts.dei ?? {}) };
  const result = new Map<string, NormalizedFact>();
  for (const tag of tags) {
    const allEntries = (concepts[tag]?.units?.[unit] ?? []).filter((fact) =>
      /^(10-Q|10-K)(\/A)?$/.test(fact.form) && !fact.start && Number.isInteger(fact.fy) && /^(Q[1-3]|FY)$/.test(fact.fp ?? ""));
    const entries = allEntries.filter(isTimelyPrimaryFact);
    for (const fact of entries) {
      const quarter = fact.fp === "FY" ? 4 : Number(fact.fp?.slice(1));
      const key = `${fact.fy}-Q${quarter}`;
      const previous = result.get(key);
      if (!previous || Date.parse(fact.filed) > Date.parse(previous.filed)) {
        result.set(key, { val: fact.val, end: fact.end, filed: fact.filed, form: fact.form, derived: false, concept: tag, accn: fact.accn });
      }
    }
  }
  return result;
}

function normalizeFundamentals(facts: CompanyFacts) {
  const duration = {
    revenue: annualDurationSeries(facts, TAGS.revenue),
    grossProfit: annualDurationSeries(facts, TAGS.grossProfit),
    operatingIncome: annualDurationSeries(facts, TAGS.operatingIncome),
    netIncome: annualDurationSeries(facts, TAGS.netIncome),
    researchAndDevelopment: annualDurationSeries(facts, TAGS.researchAndDevelopment),
    sellingGeneralAdministrative: annualDurationSeries(facts, TAGS.sellingGeneralAdministrative),
    pretaxIncome: annualDurationSeries(facts, TAGS.pretaxIncome),
    incomeTaxExpense: annualDurationSeries(facts, TAGS.incomeTaxExpense),
    interestExpense: annualDurationSeries(facts, TAGS.interestExpense),
    operatingCashFlow: annualDurationSeries(facts, TAGS.operatingCashFlow),
    capex: annualDurationSeries(facts, TAGS.capex),
    depreciationAmortization: annualDurationSeries(facts, TAGS.depreciationAmortization),
    stockCompensation: annualDurationSeries(facts, TAGS.stockCompensation),
    acquisitions: annualDurationSeries(facts, TAGS.acquisitions),
    shareRepurchases: annualDurationSeries(facts, TAGS.shareRepurchases),
    dividendsPaid: annualDurationSeries(facts, TAGS.dividendsPaid),
    debtIssuance: annualDurationSeries(facts, TAGS.debtIssuance),
    debtRepayment: annualDurationSeries(facts, TAGS.debtRepayment),
  };
  const instant = {
    totalAssets: annualInstantSeries(facts, TAGS.totalAssets),
    totalLiabilities: annualInstantSeries(facts, TAGS.totalLiabilities),
    currentAssets: annualInstantSeries(facts, TAGS.currentAssets),
    currentLiabilities: annualInstantSeries(facts, TAGS.currentLiabilities),
    receivables: annualInstantSeries(facts, TAGS.receivables),
    inventory: annualInstantSeries(facts, TAGS.inventory),
    goodwill: annualInstantSeries(facts, TAGS.goodwill),
    retainedEarnings: annualInstantSeries(facts, TAGS.retainedEarnings),
    longTermDebt: annualInstantSeries(facts, TAGS.longTermDebt),
    shortTermDebt: annualInstantSeries(facts, TAGS.shortTermDebt),
    shareholderEquity: annualInstantSeries(facts, TAGS.shareholderEquity),
    cash: annualInstantSeries(facts, TAGS.cash),
    sharesOutstanding: new Map([
      // Balance-sheet share counts are dated at period end and key normally; the
      // cover-page count is authoritative where both exist, so it is applied last.
      ...annualInstantSeries(facts, ["CommonStockSharesOutstanding"], "shares"),
      ...annualCoverShareSeries(facts),
    ]),
  };
  // A fiscal year is established by substantive financial facts alone. Cover-page
  // metadata must never bring a year into existence on its own — that is how an
  // empty period reached the front of the list and blanked every downstream tile.
  const yearBearing = Object.entries(instant)
    .filter(([field]) => field !== "sharesOutstanding")
    .map(([, series]) => series);
  const years = [...new Set([
    ...Object.values(duration).flatMap((series) => [...series.keys()]),
    ...yearBearing.flatMap((series) => [...series.keys()]),
  ])].sort((a, b) => b - a).slice(0, 5);

  // Derivation inputs are resolved separately so they cannot enlarge `years`:
  // a company must not acquire a fiscal year because it tagged a cost line.
  const derivationInput = {
    costOfRevenue: annualDurationSeries(facts, DERIVATION_INPUTS.costOfRevenue),
    costsAndExpenses: annualDurationSeries(facts, DERIVATION_INPUTS.costsAndExpenses),
    generalAndAdministrative: annualDurationSeries(facts, DERIVATION_INPUTS.generalAndAdministrative),
    sellingAndMarketing: annualDurationSeries(facts, DERIVATION_INPUTS.sellingAndMarketing),
    balanceSheetTotal: annualInstantSeries(facts, DERIVATION_INPUTS.balanceSheetTotal),
    equityForLiabilities: annualInstantSeries(facts, DERIVATION_INPUTS.equityForLiabilities),
  };

  const value = (series: Map<number, FactUnit>, year: number) => series.get(year)?.val ?? null;
  const provenanceForYear = (year: number) => Object.fromEntries([...Object.entries(duration), ...Object.entries(instant)].flatMap(([field, series]) => {
    const fact = series.get(year);
    return fact ? [[field, { concept: fact.concept ?? null, accession: fact.accn ?? null, filed: fact.filed, form: fact.form, classification: "filed" }]] : [];
  }));
  const annual = years.map((year) => {
    const operatingCashFlow = value(duration.operatingCashFlow, year);
    const rawCapex = value(duration.capex, year);
    const capex = rawCapex == null ? null : Math.abs(rawCapex);
    const periodEnd = duration.revenue.get(year)?.end ?? instant.totalAssets.get(year)?.end ?? `${year}-12-31`;

    // ── Derivation ────────────────────────────────────────────────────────────
    //
    // Filers do not all tag every line. Roughly half of the audited universe
    // reports no `GrossProfit` concept and a quarter no `Liabilities` concept,
    // not because the figures do not exist but because they are recoverable from
    // ones that do. Chasing synonyms cannot close those: the concept genuinely
    // is not in the filing. An accounting identity can.
    //
    // A derivation only ever fills a null. It never replaces a filed figure, and
    // every result is marked `derived` in provenance with the formula that made
    // it, so a reader can tell a computed number from a reported one.
    const derived: Record<string, { concept: null; accession: null; filed: null; form: null; classification: "derived"; formula: string }> = {};
    const derive = (field: string, formula: string, result: number | null): number | null => {
      if (result == null || !Number.isFinite(result)) return null;
      derived[field] = { concept: null, accession: null, filed: null, form: null, classification: "derived", formula };
      return result;
    };
    const sub = (a: number | null, b: number | null) => (a != null && b != null ? a - b : null);
    const add = (a: number | null, b: number | null) => (a != null && b != null ? a + b : null);

    const revenue = value(duration.revenue, year);
    const shareholderEquity = value(instant.shareholderEquity, year);

    const grossProfit = value(duration.grossProfit, year)
      ?? derive("grossProfit", "revenue - costOfRevenue",
                sub(revenue, value(derivationInput.costOfRevenue, year)));

    const operatingIncome = value(duration.operatingIncome, year)
      ?? derive("operatingIncome", "revenue - costsAndExpenses",
                sub(revenue, value(derivationInput.costsAndExpenses, year)));

    // Assets = liabilities + equity, so the balance-sheet total less equity is
    // total liabilities. Used only when the filer tags no `Liabilities` at all.
    const totalLiabilities = value(instant.totalLiabilities, year)
      ?? derive("totalLiabilities", "liabilitiesAndStockholdersEquity - totalEquityIncludingNCI",
                sub(value(derivationInput.balanceSheetTotal, year),
                    value(derivationInput.equityForLiabilities, year) ?? shareholderEquity));

    // Only when BOTH components are present. One alone is not a smaller SG&A,
    // it is a different figure, and presenting it as SG&A would understate costs.
    const gAndA = value(derivationInput.generalAndAdministrative, year);
    const sAndM = value(derivationInput.sellingAndMarketing, year);
    const sellingGeneralAdministrative = value(duration.sellingGeneralAdministrative, year)
      ?? derive("sellingGeneralAdministrative", "generalAndAdministrative + sellingAndMarketing",
                add(gAndA, sAndM));

    return {
      fiscalYear: year,
      periodEnd,
      revenue,
      grossProfit,
      operatingIncome,
      netIncome: value(duration.netIncome, year),
      researchAndDevelopment: value(duration.researchAndDevelopment, year),
      sellingGeneralAdministrative,
      pretaxIncome: value(duration.pretaxIncome, year),
      incomeTaxExpense: value(duration.incomeTaxExpense, year),
      interestExpense: value(duration.interestExpense, year),
      operatingCashFlow,
      capex,
      freeCashFlow: operatingCashFlow != null && capex != null ? operatingCashFlow - capex : null,
      totalAssets: value(instant.totalAssets, year),
      totalLiabilities,
      currentAssets: value(instant.currentAssets, year),
      currentLiabilities: value(instant.currentLiabilities, year),
      receivables: value(instant.receivables, year), inventory: value(instant.inventory, year),
      goodwill: value(instant.goodwill, year), retainedEarnings: value(instant.retainedEarnings, year),
      longTermDebt: value(instant.longTermDebt, year),
      shortTermDebt: value(instant.shortTermDebt, year),
      shareholderEquity,
      cash: value(instant.cash, year),
      sharesOutstanding: value(instant.sharesOutstanding, year),
      depreciationAmortization: value(duration.depreciationAmortization, year),
      stockCompensation: value(duration.stockCompensation, year), acquisitions: value(duration.acquisitions, year),
      shareRepurchases: value(duration.shareRepurchases, year), dividendsPaid: value(duration.dividendsPaid, year),
      debtIssuance: value(duration.debtIssuance, year), debtRepayment: value(duration.debtRepayment, year),
      // `mixed` when any field on this period was recovered by identity rather
      // than filed, so the statement header stops labelling it plainly "Filed".
      derivation: Object.keys(derived).length > 0 ? "mixed" : "filed",
      provenance: {
        ...provenanceForYear(year),
        ...(operatingCashFlow != null && capex != null ? { freeCashFlow: { concept: null, accession: null, filed: null, form: null, classification: "derived", formula: "operatingCashFlow - capex" } } : {}),
        ...derived,
      },
    };
  });
  const qDuration = {
    revenue: quarterlyDurationSeries(facts, TAGS.revenue), grossProfit: quarterlyDurationSeries(facts, TAGS.grossProfit),
    operatingIncome: quarterlyDurationSeries(facts, TAGS.operatingIncome), netIncome: quarterlyDurationSeries(facts, TAGS.netIncome),
    researchAndDevelopment: quarterlyDurationSeries(facts, TAGS.researchAndDevelopment), sellingGeneralAdministrative: quarterlyDurationSeries(facts, TAGS.sellingGeneralAdministrative),
    pretaxIncome: quarterlyDurationSeries(facts, TAGS.pretaxIncome), incomeTaxExpense: quarterlyDurationSeries(facts, TAGS.incomeTaxExpense), interestExpense: quarterlyDurationSeries(facts, TAGS.interestExpense),
    operatingCashFlow: quarterlyDurationSeries(facts, TAGS.operatingCashFlow), capex: quarterlyDurationSeries(facts, TAGS.capex),
    depreciationAmortization: quarterlyDurationSeries(facts, TAGS.depreciationAmortization), stockCompensation: quarterlyDurationSeries(facts, TAGS.stockCompensation),
    acquisitions: quarterlyDurationSeries(facts, TAGS.acquisitions), shareRepurchases: quarterlyDurationSeries(facts, TAGS.shareRepurchases), dividendsPaid: quarterlyDurationSeries(facts, TAGS.dividendsPaid),
    debtIssuance: quarterlyDurationSeries(facts, TAGS.debtIssuance), debtRepayment: quarterlyDurationSeries(facts, TAGS.debtRepayment),
  };
  const qInstant = {
    totalAssets: quarterlyInstantSeries(facts, TAGS.totalAssets), currentAssets: quarterlyInstantSeries(facts, TAGS.currentAssets),
    totalLiabilities: quarterlyInstantSeries(facts, TAGS.totalLiabilities), receivables: quarterlyInstantSeries(facts, TAGS.receivables), inventory: quarterlyInstantSeries(facts, TAGS.inventory),
    goodwill: quarterlyInstantSeries(facts, TAGS.goodwill), retainedEarnings: quarterlyInstantSeries(facts, TAGS.retainedEarnings),
    currentLiabilities: quarterlyInstantSeries(facts, TAGS.currentLiabilities), longTermDebt: quarterlyInstantSeries(facts, TAGS.longTermDebt),
    shortTermDebt: quarterlyInstantSeries(facts, TAGS.shortTermDebt), shareholderEquity: quarterlyInstantSeries(facts, TAGS.shareholderEquity),
    cash: quarterlyInstantSeries(facts, TAGS.cash), sharesOutstanding: quarterlyInstantSeries(facts, TAGS.sharesOutstanding, "shares"),
  };
  const quarterKeys = [...new Set([...Object.values(qDuration).flatMap((series) => [...series.keys()]), ...Object.values(qInstant).flatMap((series) => [...series.keys()])])]
    .sort((a, b) => b.localeCompare(a)).slice(0, 12);
  const qValue = (series: Map<string, NormalizedFact>, key: string) => series.get(key)?.val ?? null;
  const qProvenance = (key: string) => Object.fromEntries([...Object.entries(qDuration), ...Object.entries(qInstant)].flatMap(([field, series]) => {
    const fact = series.get(key);
    return fact ? [[field, { concept: fact.concept, accession: fact.accn ?? null, filed: fact.filed, form: fact.form, classification: fact.derived ? "derived" : "filed", ...(fact.derived ? { formula: "current cumulative fact - prior cumulative fact" } : {}) }]] : [];
  }));
  const quarterly = quarterKeys.map((key) => {
    const [fy, q] = key.split("-Q").map(Number);
    const ocf = qValue(qDuration.operatingCashFlow, key);
    const rawCapex = qValue(qDuration.capex, key);
    const capex = rawCapex == null ? null : Math.abs(rawCapex);
    const factsForPeriod = [...Object.values(qDuration), ...Object.values(qInstant)].map((series) => series.get(key)).filter(Boolean) as NormalizedFact[];
    // Cover-page share facts can be dated weeks after the balance-sheet date.
    // Anchor the period to a statement fact, not the latest arbitrary instant.
    const periodEnd = qDuration.revenue.get(key)?.end ?? qInstant.totalAssets.get(key)?.end ?? factsForPeriod[0]?.end ?? "";
    return {
      fiscalYear: fy, fiscalQuarter: q, periodEnd, periodType: "quarter" as const,
      derivation: factsForPeriod.some((fact) => fact.derived) ? "mixed" : "filed",
      revenue: qValue(qDuration.revenue, key), grossProfit: qValue(qDuration.grossProfit, key),
      operatingIncome: qValue(qDuration.operatingIncome, key), netIncome: qValue(qDuration.netIncome, key),
      researchAndDevelopment: qValue(qDuration.researchAndDevelopment, key), sellingGeneralAdministrative: qValue(qDuration.sellingGeneralAdministrative, key),
      pretaxIncome: qValue(qDuration.pretaxIncome, key), incomeTaxExpense: qValue(qDuration.incomeTaxExpense, key), interestExpense: qValue(qDuration.interestExpense, key),
      operatingCashFlow: ocf, capex, freeCashFlow: ocf != null && capex != null ? ocf - capex : null,
      totalAssets: qValue(qInstant.totalAssets, key), currentAssets: qValue(qInstant.currentAssets, key),
      totalLiabilities: qValue(qInstant.totalLiabilities, key), receivables: qValue(qInstant.receivables, key), inventory: qValue(qInstant.inventory, key),
      goodwill: qValue(qInstant.goodwill, key), retainedEarnings: qValue(qInstant.retainedEarnings, key),
      currentLiabilities: qValue(qInstant.currentLiabilities, key), longTermDebt: qValue(qInstant.longTermDebt, key),
      shortTermDebt: qValue(qInstant.shortTermDebt, key), shareholderEquity: qValue(qInstant.shareholderEquity, key),
      cash: qValue(qInstant.cash, key), sharesOutstanding: qValue(qInstant.sharesOutstanding, key),
      depreciationAmortization: qValue(qDuration.depreciationAmortization, key), stockCompensation: qValue(qDuration.stockCompensation, key),
      acquisitions: qValue(qDuration.acquisitions, key), shareRepurchases: qValue(qDuration.shareRepurchases, key), dividendsPaid: qValue(qDuration.dividendsPaid, key),
      debtIssuance: qValue(qDuration.debtIssuance, key), debtRepayment: qValue(qDuration.debtRepayment, key),
      provenance: {
        ...qProvenance(key),
        ...(ocf != null && capex != null ? { freeCashFlow: { concept: null, accession: null, filed: null, form: null, classification: "derived", formula: "operatingCashFlow - capex" } } : {}),
      },
    };
  }).filter((period) => period.periodEnd);
  if (!annual.length) throw new Error("SEC EDGAR has no annual US-GAAP facts for this ticker");
  return { annual, quarterly, cacheVersion: FUNDAMENTALS_CACHE_VERSION };
}

async function resolveTicker(ticker: string) {
  const curatedCik = CURATED_CIK[ticker];
  if (curatedCik) {
    return {
      cik: curatedCik.padStart(10, "0"),
      companyName: PEER_UNIVERSE.find((candidate) => candidate.ticker === ticker)?.name ?? ticker,
    };
  }
  const response = await fetchUpstream("https://www.sec.gov/files/company_tickers.json", { headers: SEC_HEADERS });
  if (response.status === 429) throw new Error("The SEC identity service is temporarily rate limited. Please retry shortly.");
  if (!response.ok) throw new Error(`SEC ticker lookup failed (${response.status})`);
  const payload = await response.json();
  const match = Object.values(payload).find((entry: any) => String(entry.ticker).toUpperCase() === ticker);
  if (!match) return null;
  return {
    cik: String((match as any).cik_str).padStart(10, "0"),
    companyName: String((match as any).title),
  };
}

const nullableNumber = (value: unknown) => {
  if (value == null || value === "" || value === "None" || value === "-") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const nullableString = (value: unknown) => typeof value === "string" && value.trim() ? value : null;
function peerProfileFromJson(value: unknown) {
  const profile = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    sic: nullableString(profile.sic), sicDescription: nullableString(profile.sicDescription),
    industry: nullableString(profile.industry), sector: nullableString(profile.sector),
    marketCapitalization: nullableNumber(profile.marketCapitalization), revenueTTM: nullableNumber(profile.revenueTTM),
    profitMarginTTM: nullableNumber(profile.profitMarginTTM), quarterlyRevenueGrowthYOY: nullableNumber(profile.quarterlyRevenueGrowthYOY),
  };
}

async function fetchCompanyProfile(ticker: string, cik: string) {
  const submissionsRequest = fetchUpstream(
    `https://data.sec.gov/submissions/CIK${cik}.json`,
    { headers: SEC_HEADERS },
  );
  const apiKey = Deno.env.get("ALPHA_VANTAGE_API_KEY");
  const overviewRequest = apiKey
    ? fetchUpstream(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(ticker)}&apikey=${encodeURIComponent(apiKey)}`)
    : null;

  const [submissionsResponse, overviewResponse] = await Promise.all([submissionsRequest, overviewRequest]);
  const submissions = submissionsResponse.ok ? await submissionsResponse.json() : null;
  const overview = overviewResponse?.ok ? await overviewResponse.json() : null;
  const overviewData = overview && !overview.Note && !overview.Information && !overview["Error Message"] && overview.Symbol
    ? overview
    : null;
  const businessAddress = submissions?.addresses?.business;
  const address = overviewData?.Address || (businessAddress
    ? [businessAddress.street1, businessAddress.street2, businessAddress.city, businessAddress.stateOrCountry, businessAddress.zipCode].filter(Boolean).join(", ")
    : null);

  return {
    sic: submissions?.sic ? String(submissions.sic) : null,
    sicDescription: submissions?.sicDescription || null,
    exchange: overviewData?.Exchange || submissions?.exchanges?.[0] || null,
    currency: overviewData?.Currency || null,
    sector: overviewData?.Sector || null,
    industry: overviewData?.Industry || submissions?.sicDescription || null,
    description: overviewData?.Description || null,
    address,
    fiscalYearEnd: overviewData?.FiscalYearEnd || null,
    latestQuarter: overviewData?.LatestQuarter || null,
    marketCapitalization: nullableNumber(overviewData?.MarketCapitalization),
    ebitda: nullableNumber(overviewData?.EBITDA),
    trailingPE: nullableNumber(overviewData?.TrailingPE ?? overviewData?.PERatio),
    forwardPE: nullableNumber(overviewData?.ForwardPE),
    pegRatio: nullableNumber(overviewData?.PEGRatio),
    bookValuePerShare: nullableNumber(overviewData?.BookValue),
    dividendPerShare: nullableNumber(overviewData?.DividendPerShare),
    dividendYield: nullableNumber(overviewData?.DividendYield),
    epsTTM: nullableNumber(overviewData?.DilutedEPSTTM ?? overviewData?.EPS),
    revenueTTM: nullableNumber(overviewData?.RevenueTTM),
    profitMarginTTM: nullableNumber(overviewData?.ProfitMargin),
    operatingMarginTTM: nullableNumber(overviewData?.OperatingMarginTTM),
    returnOnAssetsTTM: nullableNumber(overviewData?.ReturnOnAssetsTTM),
    returnOnEquityTTM: nullableNumber(overviewData?.ReturnOnEquityTTM),
    quarterlyEarningsGrowthYOY: nullableNumber(overviewData?.QuarterlyEarningsGrowthYOY),
    quarterlyRevenueGrowthYOY: nullableNumber(overviewData?.QuarterlyRevenueGrowthYOY),
    analystTargetPrice: nullableNumber(overviewData?.AnalystTargetPrice),
    priceToSalesTTM: nullableNumber(overviewData?.PriceToSalesRatioTTM),
    priceToBook: nullableNumber(overviewData?.PriceToBookRatio),
    evToRevenue: nullableNumber(overviewData?.EVToRevenue),
    evToEbitda: nullableNumber(overviewData?.EVToEBITDA),
    beta: nullableNumber(overviewData?.Beta),
    week52High: nullableNumber(overviewData?.["52WeekHigh"]),
    week52Low: nullableNumber(overviewData?.["52WeekLow"]),
    ma50: nullableNumber(overviewData?.["50DayMovingAverage"]),
    ma200: nullableNumber(overviewData?.["200DayMovingAverage"]),
    sharesOutstanding: nullableNumber(overviewData?.SharesOutstanding),
    dividendDate: overviewData?.DividendDate || null,
    exDividendDate: overviewData?.ExDividendDate || null,
    overviewAvailable: Boolean(overviewData),
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchFundamentals(ticker: string, knownCompany?: { cik: string; companyName: string }) {
  const company = knownCompany ?? await resolveTicker(ticker);
  if (!company) throw new Error(`Ticker ${ticker} was not found in SEC EDGAR`);
  const [response, profile] = await Promise.all([
    fetchUpstream(`https://data.sec.gov/api/xbrl/companyfacts/CIK${company.cik}.json`, { headers: SEC_HEADERS }),
    fetchCompanyProfile(ticker, company.cik),
  ]);
  if (!response.ok) throw new Error(`SEC Company Facts failed (${response.status})`);
  const facts = await response.json() as CompanyFacts;
  return {
    ...company,
    companyName: facts.entityName || company.companyName,
    fundamentals: { ...normalizeFundamentals(facts), profile },
  };
}

async function fetchQuote(ticker: string) {
  const apiKey = Deno.env.get("ALPHA_VANTAGE_API_KEY");
  if (!apiKey) throw new Error("Market quote service is not configured");
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "GLOBAL_QUOTE");
  url.searchParams.set("symbol", ticker);
  url.searchParams.set("apikey", apiKey);
  const response = await fetchUpstream(url);
  if (!response.ok) throw new Error(`Market quote request failed (${response.status})`);
  const payload = await response.json();
  if (payload.Note || payload.Information) {
    throw new Error("The daily market-data refresh limit has been reached. Please use the cached quote or try again tomorrow.");
  }
  if (payload["Error Message"]) throw new Error(`No market quote was found for ${ticker}`);
  const q = payload["Global Quote"];
  if (!q || !q["05. price"]) throw new Error(`No market quote was returned for ${ticker}`);
  const number = (key: string) => {
    const parsed = Number(String(q[key] ?? "").replace("%", ""));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const price = number("05. price");
  if (price == null || price <= 0) throw new Error(`No usable market quote was returned for ${ticker}`);
  return {
    price,
    open: number("02. open"),
    high: number("03. high"),
    low: number("04. low"),
    volume: number("06. volume"),
    latestTradingDay: q["07. latest trading day"] ?? null,
    previousClose: number("08. previous close"),
    change: number("09. change"),
    changePercent: number("10. change percent"),
    fetchedAt: new Date().toISOString(),
  };
}

// Story chapters are pinned to filing dates, so the price window has to reach back
// far enough to hold them. "compact" returns only the latest 100 sessions — roughly
// five months — which silently made every older point of interest unplottable. Ask
// for the full series and trim here instead, so the window is our decision rather
// than the provider's default.
const PRICE_HISTORY_YEARS = 3;

async function fetchPriceHistory(ticker: string) {
  const apiKey = Deno.env.get("ALPHA_VANTAGE_API_KEY");
  if (!apiKey) throw new Error("Market price-history service is not configured");
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "TIME_SERIES_DAILY");
  url.searchParams.set("symbol", ticker);
  url.searchParams.set("outputsize", "full");
  url.searchParams.set("apikey", apiKey);
  const response = await fetchUpstream(url);
  if (!response.ok) throw new Error(`Market price-history request failed (${response.status})`);
  const payload = await response.json();
  if (payload.Note || payload.Information) throw new Error("The daily market-data refresh limit has been reached. Please retry after the provider window resets.");
  if (payload["Error Message"]) throw new Error(`No price history was found for ${ticker}`);
  const rows = payload["Time Series (Daily)"];
  if (!rows || typeof rows !== "object") throw new Error(`No daily price series was returned for ${ticker}`);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - PRICE_HISTORY_YEARS);
  const earliest = cutoff.toISOString().slice(0, 10);
  const series = Object.entries(rows).flatMap(([date, raw]) => {
    const close = Number((raw as Record<string, string>)["4. close"]);
    const volume = Number((raw as Record<string, string>)["5. volume"]);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= earliest && Number.isFinite(close) && close > 0
      ? [{ date, close, volume: Number.isFinite(volume) && volume >= 0 ? volume : null }]
      : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
  if (series.length < 2) throw new Error(`Price history for ${ticker} is incomplete`);
  return { series, adjusted: false, provider: "Alpha Vantage Daily", asOf: series.at(-1)?.date ?? null, fetchedAt: new Date().toISOString() };
}

async function fetchCompanyNews(ticker: string) {
  const apiKey = Deno.env.get("ALPHA_VANTAGE_API_KEY");
  if (!apiKey) throw new Error("Company-news service is not configured");
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "NEWS_SENTIMENT");
  url.searchParams.set("tickers", ticker);
  url.searchParams.set("sort", "LATEST");
  url.searchParams.set("limit", "50");
  url.searchParams.set("apikey", apiKey);
  const response = await fetchUpstream(url);
  if (!response.ok) throw new Error(`Company-news request failed (${response.status})`);
  const payload = await response.json();
  if (payload.Note || payload.Information) throw new Error("The company-news provider refresh limit has been reached");
  if (payload["Error Message"]) throw new Error(`No company news was found for ${ticker}`);
  return normalizeCompanyNews(payload, ticker, 12);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return corsError("Method not allowed", 405);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return corsError("Authentication required", 401);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(auth.slice(7));
  if (authError || !user) return corsError("Invalid or expired session", 401);

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("subscription_tier, subscription_status, role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const tier = profile?.subscription_tier ?? "free";
  const inactive = profile?.subscription_status === "canceled" || profile?.subscription_status === "unpaid";
  if (!isAdmin && (inactive || !["tier2", "tier3"].includes(tier))) {
    return corsError("Stock Analysis requires an Investor or Complete subscription", 403);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const ticker = String(body.ticker ?? "").trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) return corsError("Enter a valid US stock ticker", 400);

    if (body.operation === "price-history") {
      const now = Date.now();
      const { data: cachedHistory, error: historyCacheError } = await supabase.from("stock_price_history_cache")
        .select("series,adjusted,provider,as_of,fetched_at,expires_at").eq("ticker", ticker).maybeSingle();
      if (historyCacheError) throw new Error("Price-history cache is temporarily unavailable");
      if (cachedHistory?.expires_at && Date.parse(cachedHistory.expires_at) > now) {
        return corsResponse({ ticker, ...cachedHistory, cacheHit: true });
      }
      let history;
      let historyStale = false;
      let historyWarning: string | undefined;
      try {
        history = await fetchPriceHistory(ticker);
      } catch (historyError) {
        const cachedAge = cachedHistory?.fetched_at ? now - Date.parse(cachedHistory.fetched_at) : Number.POSITIVE_INFINITY;
        if (!cachedHistory?.series || cachedAge > PRICE_HISTORY_STALE_MS) throw historyError;
        history = {
          series: cachedHistory.series,
          adjusted: cachedHistory.adjusted,
          provider: cachedHistory.provider,
          asOf: cachedHistory.as_of,
          fetchedAt: cachedHistory.fetched_at,
        };
        historyStale = true;
        historyWarning = "Showing the last cached daily price history while the provider refresh is unavailable.";
      }
      const expiresAt = new Date(now + 6 * 60 * 60 * 1000).toISOString();
      if (!historyStale) {
        const { error: cacheWriteError } = await supabase.from("stock_price_history_cache").upsert({
          ticker, series: history.series, adjusted: history.adjusted, provider: history.provider,
          as_of: history.asOf, fetched_at: history.fetchedAt, expires_at: expiresAt,
        }, { onConflict: "ticker" });
        if (cacheWriteError) console.error("price-history cache write failed:", cacheWriteError);
      }
      return corsResponse({
        ticker, ...history,
        expires_at: historyStale ? cachedHistory?.expires_at : expiresAt,
        cacheHit: historyStale,
        stale: historyStale,
        warning: historyWarning,
      });
    }

    if (body.operation === "news") {
      const now = Date.now();
      const { data: cachedNews, error: newsCacheError } = await supabase.from("stock_news_cache")
        .select("articles,provider,fetched_at,expires_at,last_provider_error").eq("ticker", ticker).maybeSingle();
      if (newsCacheError) throw new Error("Company-news cache is temporarily unavailable");
      if (cachedNews?.expires_at && Date.parse(cachedNews.expires_at) > now) {
        return corsResponse({ ticker, articles: cachedNews.articles, provider: cachedNews.provider, fetchedAt: cachedNews.fetched_at, cacheHit: true, stale: false });
      }
      try {
        const articles = await fetchCompanyNews(ticker);
        const fetchedAt = new Date(now).toISOString();
        const expiresAt = new Date(now + NEWS_TTL_MS).toISOString();
        const { error: cacheWriteError } = await supabase.from("stock_news_cache").upsert({
          ticker, articles, provider: "Alpha Vantage Market News & Sentiment", fetched_at: fetchedAt,
          expires_at: expiresAt, last_provider_error: null, updated_at: fetchedAt,
        }, { onConflict: "ticker" });
        if (cacheWriteError) console.error("company-news cache write failed:", cacheWriteError);
        return corsResponse({ ticker, articles, provider: "Alpha Vantage Market News & Sentiment", fetchedAt, cacheHit: false, stale: false });
      } catch (newsError) {
        const message = newsError instanceof Error ? newsError.message : "Company-news refresh failed";
        if (cachedNews?.fetched_at && now - Date.parse(cachedNews.fetched_at) <= NEWS_STALE_MS && Array.isArray(cachedNews.articles)) {
          await supabase.from("stock_news_cache").update({ last_provider_error: message.slice(0, 500), updated_at: new Date(now).toISOString() }).eq("ticker", ticker);
          return corsResponse({ ticker, articles: cachedNews.articles, provider: cachedNews.provider, fetchedAt: cachedNews.fetched_at, cacheHit: true, stale: true, warning: "Showing the latest cached company news while the provider refresh is unavailable." });
        }
        throw newsError;
      }
    }

    if (body.operation === "suggest-peers") {
      const { data: cachedTarget, error: targetError } = await supabase.from("stock_analysis_cache")
        .select("cik, company_name, profile:fundamentals->profile, fundamentals_fetched_at").eq("ticker", ticker).maybeSingle();
      if (targetError) throw new Error("Peer classification cache is temporarily unavailable");
      if (!cachedTarget?.profile) return corsError("Run the primary stock analysis before requesting peer suggestions", 409);
      const cachedProfile = peerProfileFromJson(cachedTarget.profile);
      const { data: cachedCandidates, error: candidateError } = await supabase.from("stock_analysis_cache")
        .select("ticker, cik, company_name, profile:fundamentals->profile, fundamentals_fetched_at")
        .neq("ticker", ticker).order("updated_at", { ascending: false }).limit(250);
      if (candidateError) throw new Error("Peer candidate cache is temporarily unavailable");
      const targetProfile: PeerProfile = {
        ticker, cik: cachedTarget.cik, name: cachedTarget.company_name, industry: cachedProfile.industry, sector: cachedProfile.sector,
        sic: cachedProfile.sic, marketCapitalization: cachedProfile.marketCapitalization,
        revenueTTM: cachedProfile.revenueTTM, profitMarginTTM: cachedProfile.profitMarginTTM,
        quarterlyRevenueGrowthYOY: cachedProfile.quarterlyRevenueGrowthYOY,
      };
      const dynamicCandidates: PeerProfile[] = (cachedCandidates ?? []).map((row) => {
        const candidate = peerProfileFromJson(row.profile);
        return {
          ticker: row.ticker, cik: row.cik, name: row.company_name, industry: candidate.industry, sector: candidate.sector,
          sic: candidate.sic, marketCapitalization: candidate.marketCapitalization,
          revenueTTM: candidate.revenueTTM, profitMarginTTM: candidate.profitMarginTTM,
          quarterlyRevenueGrowthYOY: candidate.quarterlyRevenueGrowthYOY,
        };
      });
      return corsResponse({
        ticker,
        companyName: cachedTarget.company_name,
        classification: {
          sic: cachedProfile.sic ?? null,
          sicDescription: cachedProfile.sicDescription ?? null,
          industry: cachedProfile.industry ?? null,
          sector: cachedProfile.sector ?? null,
        },
        suggestions: rankPeers(targetProfile, [...dynamicCandidates, ...PEER_UNIVERSE], MAX_PEER_SUGGESTIONS),
        generatedAt: new Date().toISOString(),
        classificationAsOf: cachedTarget.fundamentals_fetched_at,
        methodology: "Specific industry, SIC, operating-cohort and available scale/quality matches; broad-sector-only matches are excluded.",
      });
    }

    const now = Date.now();
    const { data: cached } = await supabase
      .from("stock_analysis_cache")
      .select("*")
      .eq("ticker", ticker)
      .maybeSingle();

    const profileTtl = cached?.fundamentals?.profile?.overviewAvailable
      ? FUNDAMENTALS_TTL_MS
      : 24 * 60 * 60 * 1000;
    const fundamentalsFresh = cached?.fundamentals_fetched_at && cached?.fundamentals?.profile &&
      cached.fundamentals.cacheVersion === FUNDAMENTALS_CACHE_VERSION &&
      now - Date.parse(cached.fundamentals_fetched_at) < profileTtl;
    let fundamentalsStale = false;
    let base;
    if (fundamentalsFresh) {
      base = { cik: cached.cik, companyName: cached.company_name, fundamentals: cached.fundamentals };
    } else {
      try {
        base = await fetchFundamentals(ticker, cached?.cik && cached?.company_name
          ? { cik: cached.cik, companyName: cached.company_name }
          : undefined);
      } catch (fundamentalsError) {
        const cacheAge = cached?.fundamentals_fetched_at ? now - Date.parse(cached.fundamentals_fetched_at) : Number.POSITIVE_INFINITY;
        const usableCache = cached?.fundamentals?.cacheVersion === FUNDAMENTALS_CACHE_VERSION &&
          Array.isArray(cached.fundamentals.annual) && cached.fundamentals.annual.length > 0 &&
          cacheAge <= FUNDAMENTALS_STALE_MS;
        if (!usableCache) throw fundamentalsError;
        base = { cik: cached.cik, companyName: cached.company_name, fundamentals: cached.fundamentals };
        fundamentalsStale = true;
      }
    }

    const cachedQuoteUsable = Number.isFinite(Number(cached?.quote?.price)) && Number(cached?.quote?.price) > 0;
    const quoteFresh = cachedQuoteUsable && cached?.quote_expires_at && Date.parse(cached.quote_expires_at) > now;
    let quoteStale = false;
    let quote;
    if (quoteFresh) {
      quote = cached.quote;
    } else {
      try {
        quote = await fetchQuote(ticker);
      } catch (quoteError) {
        const quoteAge = cached?.quote_as_of ? now - Date.parse(cached.quote_as_of) :
          cached?.quote?.fetchedAt ? now - Date.parse(cached.quote.fetchedAt) : Number.POSITIVE_INFINITY;
        if (!cachedQuoteUsable || quoteAge > QUOTE_STALE_MS) throw quoteError;
        quote = cached.quote;
        quoteStale = true;
      }
    }
    const fundamentalsAsOf = base.fundamentals.annual[0]?.periodEnd ?? null;
    const fetchedAt = new Date().toISOString();

    await supabase.from("stock_analysis_cache").upsert({
      ticker,
      cik: base.cik,
      company_name: base.companyName,
      fundamentals: base.fundamentals,
      fundamentals_as_of: fundamentalsAsOf,
      fundamentals_fetched_at: fundamentalsFresh || fundamentalsStale ? cached.fundamentals_fetched_at : fetchedAt,
      quote,
      quote_as_of: quoteFresh || quoteStale ? cached.quote_as_of : quote.fetchedAt,
      quote_expires_at: quoteFresh || quoteStale ? cached.quote_expires_at : new Date(now + QUOTE_TTL_MS).toISOString(),
      updated_at: fetchedAt,
    }, { onConflict: "ticker" });

    return corsResponse({
      ticker,
      cik: base.cik,
      companyName: base.companyName,
      fundamentals: base.fundamentals,
      quote,
      cache: {
        quoteHit: Boolean(quoteFresh || quoteStale),
        fundamentalsHit: Boolean(fundamentalsFresh || fundamentalsStale),
        quoteStale,
        fundamentalsStale,
      },
      sources: {
        fundamentals: { provider: "SEC EDGAR Company Facts + Alpha Vantage Overview", asOf: fundamentalsAsOf, fetchedAt: fundamentalsFresh || fundamentalsStale ? cached.fundamentals_fetched_at : fetchedAt, stale: fundamentalsStale },
        quote: {
          provider: "Alpha Vantage Global Quote",
          asOf: quote.latestTradingDay ?? quote.fetchedAt,
          fetchedAt: quote.fetchedAt,
          freshness: quoteStale
            ? "Provider refresh unavailable; showing the last cached quote, not real-time"
            : "Provider free-tier quote; not represented as real-time",
          stale: quoteStale,
        },
        chart: { provider: "TradingView" },
      },
    });
  } catch (error) {
    console.error("stock-analysis error:", error);
    const message = error instanceof Error ? error.message : "Stock analysis failed";
    const status = /refresh limit|rate limit|temporarily rate limited|\(429\)/i.test(message) ? 429 : message.includes("not found") ? 404 : 502;
    return corsError(message, status);
  }
});
