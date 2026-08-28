import type { FinancialStatementPeriod, StockData } from '../types';
import type { Catalyst, CompanyStorySnapshot, MacroExposure, StoryEvidence, StoryEvent } from './types';

const finite = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
const pct = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
const bps = (value: number) => `${value >= 0 ? '+' : ''}${Math.round(value * 10_000)} bps`;

function currencyCode(stock: StockData): string {
  const code = stock.currency?.trim().toUpperCase();
  return code && /^[A-Z]{3}$/.test(code) ? code : 'USD';
}

function money(value: number, currency: string, compact: boolean): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency,
      ...(compact && Math.abs(value) >= 1_000_000
        ? { notation: 'compact' as const, minimumFractionDigits: 1, maximumFractionDigits: 1 }
        : { maximumFractionDigits: currency === 'JPY' ? 0 : 2 }),
    }).format(value);
  } catch {
    return `${currency} ${compact ? value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 }) : value.toLocaleString('en-US')}`;
  }
}

function sourceUrl(cik: string | undefined, accession: string | null): string | null {
  if (!cik || !accession) return null;
  const normalizedCik = String(Number(cik));
  const compact = accession.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${normalizedCik}/${compact}/`;
}

function evidence(stock: StockData, period: FinancialStatementPeriod, key: keyof FinancialStatementPeriod, label: string, value: string, exactValue?: string): StoryEvidence {
  const provenance = period.provenance?.[String(key)];
  return {
    label,
    value,
    exactValue,
    periodEnd: period.periodEnd || null,
    form: provenance?.form ?? null,
    filedAt: provenance?.filed ?? null,
    accession: provenance?.accession ?? null,
    sourceUrl: sourceUrl(stock.secCik, provenance?.accession ?? null),
  };
}

function eventId(category: StoryEvent['category'], period: string | null) {
  return `${category}:${period ?? 'unknown'}`;
}

function metricChangeEvent(
  stock: StockData,
  latest: FinancialStatementPeriod,
  prior: FinancialStatementPeriod,
  key: 'revenue' | 'freeCashFlow',
  category: StoryEvent['category'],
  label: string,
  watchNext: string,
): StoryEvent | null {
  const current = latest[key];
  const previous = prior[key];
  if (!finite(current) || !finite(previous) || previous === 0) return null;
  const change = (current - previous) / Math.abs(previous);
  const material = Math.abs(change) >= 0.03;
  const currency = currencyCode(stock);
  const comparisonLabel = latest.periodType === 'quarter' ? 'comparable prior-year quarter' : 'prior filed annual period';
  // A ratio taken through zero states a magnitude nobody can read: free cash
  // flow moving from +$5.3B to -$5.9B is not a "210.5% decline", because
  // nothing declines by more than all of itself. The ratio is still correct as
  // a signed direction, so it keeps driving `direction` and `change` -- only
  // the headline switches to naming both amounts.
  const crossedZero = (current < 0) !== (previous < 0);
  return {
    id: eventId(category, latest.periodEnd), category,
    headline: crossedZero
      ? `${label} swung from ${money(previous, currency, true)} to ${money(current, currency, true)}`
      : `${label} ${change >= 0 ? 'increased' : 'declined'} ${Math.abs(change * 100).toFixed(1)}%`,
    detail: `${label} changed from the ${comparisonLabel}. This identifies what changed; management narrative is still required to attribute the cause.`,
    direction: change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral',
    change: material ? (change > 0 ? 'strengthening' : 'weakening') : 'unchanged',
    classification: 'calculated', confidence: 'high',
    disclosureDate: latest.provenance?.[key]?.filed ?? null,
    reportingPeriod: latest.periodEnd || null,
    evidence: [
      evidence(stock, latest, key, `${label}, current`, money(current, currency, true), money(current, currency, false)),
      evidence(stock, prior, key, `${label}, prior`, money(previous, currency, true), money(previous, currency, false)),
    ],
    watchNext,
  };
}

/**
 * Free cash flow, with the two filed figures it is made of.
 *
 * FCF is operating cash flow minus capital expenditure, so a fall in it means
 * one of two opposite things: the business generated less cash, or it generated
 * more and spent past it. The headline alone cannot separate those, and the
 * difference is the whole point -- GOOG's FCF turned negative in Q2 FY2026 while
 * operating cash flow rose 40.8%, because capex doubled.
 *
 * Naming both components is arithmetic on filed facts, so it stays inside the
 * promise this module makes: identify what changed, attribute nothing. Why capex
 * doubled is in the MD&A, and belongs to the narrative claims that quote it.
 */
function cashFlowEvent(stock: StockData, latest: FinancialStatementPeriod, prior: FinancialStatementPeriod): StoryEvent | null {
  const event = metricChangeEvent(
    stock, latest, prior, 'freeCashFlow', 'cash-flow', 'Free cash flow',
    'Cash conversion, working capital and capital expenditure.',
  );
  if (!event) return event;

  const currency = currencyCode(stock);
  const components = (['operatingCashFlow', 'capex'] as const)
    .filter((key) => finite(latest[key]) && finite(prior[key]));
  if (components.length < 2) return event;

  const describe = (key: 'operatingCashFlow' | 'capex', label: string) => {
    const current = latest[key] as number;
    const previous = prior[key] as number;
    // Same rule as the headline: no percentage across zero or off a non-positive
    // base. Capex is filed as a magnitude, so in practice it always has one.
    const usable = previous > 0 && current >= 0;
    const move = usable
      ? `${current >= previous ? 'rose' : 'fell'} ${Math.abs((current - previous) / previous * 100).toFixed(1)}% to ${money(current, currency, true)}`
      : `moved to ${money(current, currency, true)}`;
    return `${label} ${move}`;
  };

  return {
    ...event,
    detail: `${describe('operatingCashFlow', 'Operating cash flow')}; ${describe('capex', 'capital expenditure')}. `
      + 'Free cash flow is the difference, so this identifies whether cash generation or capital spending moved it; '
      + 'management narrative is still required to attribute the cause.',
    evidence: [
      ...event.evidence,
      evidence(stock, latest, 'operatingCashFlow', 'Operating cash flow, current', money(latest.operatingCashFlow as number, currency, true), money(latest.operatingCashFlow as number, currency, false)),
      evidence(stock, latest, 'capex', 'Capital expenditure, current', money(latest.capex as number, currency, true), money(latest.capex as number, currency, false)),
    ],
  };
}

function marginEvent(stock: StockData, latest: FinancialStatementPeriod, prior: FinancialStatementPeriod): StoryEvent | null {
  if (![latest.revenue, latest.grossProfit, prior.revenue, prior.grossProfit].every(finite)) return null;
  if (!latest.revenue || !prior.revenue) return null;
  const current = latest.grossProfit! / latest.revenue;
  const previous = prior.grossProfit! / prior.revenue;
  const delta = current - previous;
  const points = Math.abs(delta * 100).toFixed(1);
  return {
    id: eventId('margin', latest.periodEnd), category: 'margin',
    headline: `Gross margin ${delta >= 0 ? 'expanded' : 'contracted'} ${points} percentage points`,
    detail: `Filed gross profit as a share of revenue moved from ${(previous * 100).toFixed(1)}% to ${(current * 100).toFixed(1)}%. The filing narrative is needed before assigning the move to price, volume, mix or cost.`,
    direction: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral',
    change: Math.abs(delta) < 0.0025 ? 'unchanged' : delta > 0 ? 'strengthening' : 'weakening',
    classification: 'calculated', confidence: 'high',
    disclosureDate: latest.provenance?.grossProfit?.filed ?? latest.provenance?.revenue?.filed ?? null,
    reportingPeriod: latest.periodEnd || null,
    evidence: [
      evidence(stock, latest, 'grossProfit', 'Current gross margin', `${(current * 100).toFixed(1)}%`),
      evidence(stock, prior, 'grossProfit', 'Prior gross margin', `${(previous * 100).toFixed(1)}%`),
    ],
    watchNext: 'Pricing, product mix and cost commentary in the next MD&A.',
  };
}

function catalystProfile(stock: StockData): Catalyst[] {
  const text = `${stock.sector ?? ''} ${stock.industry ?? ''}`.toLowerCase();
  const common: Catalyst[] = [
    { id: 'earnings-guidance', title: 'Earnings and guidance revisions', rationale: 'Changes in reported execution or forward guidance commonly reset expectations and valuation.', status: 'typical', direction: 'mixed', horizon: 'near', classification: 'typical', confidence: 'high', signals: ['Revenue growth', 'Operating margin', 'Management guidance'], invalidation: 'No material change in results, outlook or market expectations.' },
    { id: 'capital-allocation', title: 'Capital allocation', rationale: 'Buybacks, dividends, debt changes and acquisitions can alter per-share value and risk.', status: 'typical', direction: 'mixed', horizon: 'medium', classification: 'typical', confidence: 'medium', signals: ['Free cash flow', 'Share repurchases', 'Debt issuance and repayment'], invalidation: 'Capital deployment remains immaterial relative to enterprise value.' },
  ];
  if (text.includes('technology') || text.includes('software') || text.includes('semiconductor')) common.push(
    { id: 'product-cycle', title: 'Product and platform cycle', rationale: 'New products, platform adoption and mix shifts can change growth and margins.', status: 'typical', direction: 'mixed', horizon: 'medium', classification: 'typical', confidence: 'medium', signals: ['Segment growth', 'R&D intensity', 'Gross margin'], invalidation: 'Launches do not produce measurable adoption, revenue or margin effects.' },
  );
  if (text.includes('health') || text.includes('pharma') || text.includes('biotech')) common.push(
    { id: 'regulatory-milestone', title: 'Clinical and regulatory milestones', rationale: 'Trial results, submissions and regulatory decisions can materially change commercial probability.', status: 'typical', direction: 'mixed', horizon: 'medium', classification: 'typical', confidence: 'medium', signals: ['Company-confirmed trial dates', 'FDA submissions', 'Regulatory decisions'], invalidation: 'The program is discontinued, delayed indefinitely or immaterial to valuation.' },
  );
  if (text.includes('financial') || text.includes('bank') || text.includes('insurance')) common.push(
    { id: 'credit-rate-cycle', title: 'Rates and credit cycle', rationale: 'Funding costs, spreads, credit losses and asset values are sensitive to the rate and credit environment.', status: 'typical', direction: 'mixed', horizon: 'medium', classification: 'typical', confidence: 'medium', signals: ['Net interest margin', 'Credit losses', 'Funding costs'], invalidation: 'Hedging or business mix makes the exposure immaterial.' },
  );
  return common;
}

function macroProfile(stock: StockData): MacroExposure[] {
  const text = `${stock.sector ?? ''} ${stock.industry ?? ''} ${stock.description ?? ''}`.toLowerCase();
  const exposures: MacroExposure[] = [
    { id: 'rates', factor: 'Interest rates and financial conditions', expectedRelationship: 'May affect discount rates, financing costs and valuation multiples.', relevantMetrics: ['Interest expense', 'Debt', 'Free cash flow'], classification: 'structurally-exposed', confidence: 'medium' },
  ];
  if (/consumer|retail|auto|apparel|device/.test(text)) exposures.push({ id: 'consumer-demand', factor: 'Consumer spending and employment', expectedRelationship: 'Stronger household demand generally supports volume; weakening demand can pressure growth and mix.', relevantMetrics: ['Revenue', 'Inventory', 'Receivables'], classification: 'structurally-exposed', confidence: 'medium' });
  if (/international|global|worldwide|multinational/.test(text)) exposures.push({ id: 'fx', factor: 'Foreign exchange', expectedRelationship: 'A stronger reporting currency can reduce translated revenue and earnings from international operations.', relevantMetrics: ['Revenue', 'Operating income'], classification: 'structurally-exposed', confidence: 'medium' });
  if (/industrial|manufactur|energy|material|transport/.test(text)) exposures.push({ id: 'input-cycle', factor: 'Industrial demand and input costs', expectedRelationship: 'Activity, utilization and commodity costs can influence volume and margins.', relevantMetrics: ['Revenue', 'Gross margin', 'Inventory'], classification: 'structurally-exposed', confidence: 'medium' });
  return exposures;
}

export function buildCompanyStory(stock: StockData, generatedAt = new Date().toISOString()): CompanyStorySnapshot {
  const annual = [...(stock.annualFinancials ?? [])]
    .filter((period) => period.periodType === 'annual' || period.fiscalQuarter == null)
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  const latest = annual[0];
  const prior = annual[1];
  const quarters = [...(stock.quarterlyFinancials ?? [])]
    .filter((period) => period.periodType === 'quarter' && period.fiscalQuarter != null)
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  const latestQuarter = quarters[0];
  const comparableQuarter = latestQuarter
    ? quarters.find((period) => period.fiscalQuarter === latestQuarter.fiscalQuarter && period.fiscalYear === latestQuarter.fiscalYear - 1)
    : undefined;
  // Prefer like-for-like quarterly evidence when both periods exist. Never use
  // a sequential quarter as a substitute because seasonality can reverse the
  // apparent direction of the business.
  const currentPeriod = latestQuarter && comparableQuarter ? latestQuarter : latest;
  const comparisonPeriod = latestQuarter && comparableQuarter ? comparableQuarter : prior;
  const events: StoryEvent[] = [];
  if (currentPeriod && comparisonPeriod) {
    const candidates = [
      metricChangeEvent(stock, currentPeriod, comparisonPeriod, 'revenue', 'revenue', 'Revenue', 'Price, volume, mix and segment growth in the next filing.'),
      marginEvent(stock, currentPeriod, comparisonPeriod),
      cashFlowEvent(stock, currentPeriod, comparisonPeriod),
    ];
    events.push(...candidates.filter((item): item is StoryEvent => Boolean(item)));
  }
  const summary = events.length
    ? events.slice(0, 2).map((event) => event.headline).join('; ') + '.'
    : 'A comparable pair of complete annual SEC periods is not available, so no financial story change was inferred.';
  return {
    schemaVersion: 'story-v1', ticker: stock.symbol, companyName: stock.companyName || stock.name || stock.symbol,
    generatedAt, sourceAsOf: currentPeriod?.periodEnd ?? stock.dataSources?.fundamentals.asOf ?? generatedAt,
    reportingPeriod: currentPeriod?.periodEnd ?? null, summary, events,
    catalysts: catalystProfile(stock), macroExposures: macroProfile(stock),
    limitations: [
      'Financial changes are calculated from SEC XBRL facts; they do not attribute cause without filing narrative evidence.',
      'Typical catalysts and structural macro exposures are profile-based candidates, not confirmed events or predictions.',
      'Price movement must not be attributed to an event without independent supporting evidence.',
    ],
  };
}

export const storyFormatters = { pct, bps };
