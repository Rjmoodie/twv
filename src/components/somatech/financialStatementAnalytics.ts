import type { StockData } from './types';
import { anomalyNotice, detectAnomalies, suspectFields } from './financialPlausibility';

export type AnnualFinancial = NonNullable<StockData['annualFinancials']>[number];
export type StatementKind = 'income' | 'balance' | 'cashflow';

export interface StatementKpi {
  label: string;
  value: number | null;
  format: 'money' | 'percent' | 'ratio';
  change?: number | null;
  detail: string;
}

export interface StatementSignal {
  label: string;
  detail: string;
  tone: 'positive' | 'neutral' | 'caution';
}

const finite = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const ratio = (a: number | null | undefined, b: number | null | undefined) =>
  finite(a) && finite(b) && b > 0 ? a / b : null;

// A percentage change is not economically meaningful from a zero or negative
// base, nor across a sign flip: free cash flow moving from +$5.3B to -$5.9B is
// a swing, not a "211% decline", because nothing declines by more than all of
// itself. In all of those cases the UI reports the underlying dollars, but does
// not invent a growth rate.
export const change = (current: number | null | undefined, prior: number | null | undefined) =>
  finite(current) && finite(prior) && prior > 0 && current >= 0 ? current / prior - 1 : null;

export const normalizeAnnual = (annual: AnnualFinancial[]) => {
  const byYear = new Map<string, AnnualFinancial>();
  for (const period of annual) {
    if (!Number.isInteger(period.fiscalYear) || !period.periodEnd) continue;
    const key = `${period.fiscalYear}-${period.fiscalQuarter ?? 0}`;
    const existing = byYear.get(key);
    if (!existing || period.periodEnd > existing.periodEnd) byYear.set(key, period);
  }
  return [...byYear.values()].sort((a, b) =>
    b.fiscalYear - a.fiscalYear || (b.fiscalQuarter ?? 0) - (a.fiscalQuarter ?? 0) || b.periodEnd.localeCompare(a.periodEnd));
};

const SUM_FIELDS: Array<keyof AnnualFinancial> = ['revenue', 'grossProfit', 'operatingIncome', 'netIncome', 'researchAndDevelopment', 'sellingGeneralAdministrative', 'pretaxIncome', 'incomeTaxExpense', 'interestExpense', 'operatingCashFlow', 'capex', 'depreciationAmortization', 'stockCompensation', 'acquisitions', 'shareRepurchases', 'dividendsPaid', 'debtIssuance', 'debtRepayment'];
export function buildTtmPeriod(quarterly: AnnualFinancial[]): AnnualFinancial | null {
  const periods = normalizeAnnual(quarterly).filter((period) => period.fiscalQuarter != null);
  const latest = periods[0];
  if (!latest || periods.length < 4) return null;
  const ordinal = (period: AnnualFinancial) => period.fiscalYear * 4 + (period.fiscalQuarter ?? 0);
  const four = periods.slice(0, 4);
  if (four.some((period, index) => ordinal(period) !== ordinal(latest) - index)) return null;
  const result = { ...latest, periodType: 'ttm' as const, derivation: 'derived' as const };
  for (const field of SUM_FIELDS) {
    const values = four.map((period) => period[field]);
    (result as Record<string, unknown>)[field] = values.every(finite) ? (values as number[]).reduce((sum, value) => sum + value, 0) : null;
    result.provenance = { ...result.provenance, [String(field)]: { concept: null, accession: null, filed: null, form: null, classification: 'derived', formula: 'sum of latest four consecutive standalone fiscal quarters' } };
  }
  result.freeCashFlow = derivedFreeCashFlow(result);
  result.provenance = { ...result.provenance, freeCashFlow: { concept: null, accession: null, filed: null, form: null, classification: 'derived', formula: 'TTM operatingCashFlow - TTM capex' } };
  return result;
}

export const totalDebt = (period: AnnualFinancial) =>
  finite(period.longTermDebt) && finite(period.shortTermDebt)
    ? period.longTermDebt + period.shortTermDebt
    : null;

export const derivedFreeCashFlow = (period: AnnualFinancial) =>
  finite(period.operatingCashFlow) && finite(period.capex) && period.capex >= 0
    ? period.operatingCashFlow - period.capex
    : null;

const bpsChange = (current: number | null, prior: number | null) =>
  current != null && prior != null ? Math.round((current - prior) * 10_000) : null;

const direction = (value: number | null) => value == null ? 'unavailable' : value >= 0 ? 'increased' : 'decreased';

/**
 * Scale-adaptive filed-dollar formatting. It lives beside the builders rather
 * than in the panel because the prose below has to name amounts too, and a KPI
 * tile and the sentence describing it must not format the same number two
 * different ways.
 */
export const money = (value: number | null | undefined, digits = 1) => {
  if (value == null || !Number.isFinite(value)) return '—';
  const absolute = Math.abs(value), sign = value < 0 ? '-' : '';
  if (absolute >= 1e12) return `${sign}$${(absolute / 1e12).toFixed(digits)}T`;
  if (absolute >= 1e9) return `${sign}$${(absolute / 1e9).toFixed(digits)}B`;
  if (absolute >= 1e6) return `${sign}$${(absolute / 1e6).toFixed(digits)}M`;
  return `${sign}$${absolute.toLocaleString()}`;
};

/**
 * change() returns null for two different reasons -- the data is missing, or
 * the data is present but no percentage between the two would mean anything.
 * Prose must not report those the same way: calling free cash flow
 * "unavailable" while both figures sit in the table above is simply false.
 */
function yoyDetail(
  label: string,
  current: number | null | undefined,
  prior: number | null | undefined,
  comparison?: string,
): string {
  const rate = change(current, prior);
  if (rate != null) {
    return `${label} ${direction(rate)} ${Math.abs(rate * 100).toFixed(1)}%${comparison ? ` versus ${comparison}` : ' year over year'}.`;
  }
  // Naming both amounts is the whole statement. No clause explaining why the
  // percentage is absent, because the reason varies -- a sign flip here, a
  // non-positive base there -- and a fixed one would be wrong half the time.
  if (finite(current) && finite(prior)) {
    return `${label} moved from ${money(prior)} to ${money(current)}${comparison ? ` versus ${comparison}` : ' year over year'}.`;
  }
  return `Comparable ${label.toLowerCase()} is unavailable.`;
}

/** Better or worse than the prior period, whether or not a rate is quotable. */
const yoyTone = (current: number | null | undefined, prior: number | null | undefined) =>
  finite(current) && finite(prior) && current >= prior ? 'positive' as const : 'caution' as const;

const comparisonLabel = (period: AnnualFinancial) => period.periodType === 'ttm'
  ? `prior-year TTM ending Q${period.fiscalQuarter} FY${period.fiscalYear}`
  : period.fiscalQuarter ? `Q${period.fiscalQuarter} FY${period.fiscalYear}` : `FY${period.fiscalYear}`;

export function buildStatementKpis(kind: StatementKind, annual: AnnualFinancial[]): StatementKpi[] {
  const periods = normalizeAnnual(annual);
  const latest = periods[0];
  const prior = latest?.fiscalQuarter
    ? periods.find((period) => period.fiscalYear === latest.fiscalYear - 1 && period.fiscalQuarter === latest.fiscalQuarter)
    : periods[1];
  if (!latest) return [];

  // A field that failed a consistency check keeps its filed value on the tile --
  // suppressing it would hide the thing a reader needs to see -- but it must not
  // also carry a growth badge. "+297.9%" rendered beside "+24.2%" claims the same
  // confidence for both, and only one of them was earned.
  const suspect = suspectFields(detectAnomalies(periods));
  const rate = (field: string, current: number | null | undefined, previous: number | null | undefined) =>
    suspect.has(field) ? null : change(current, previous);
  const note = (field: string, detail: string) =>
    suspect.has(field) ? `${detail} · flagged for review` : detail;

  if (kind === 'income') {
    return [
      { label: 'Revenue', value: latest.revenue, format: 'money', change: rate('revenue', latest.revenue, prior?.revenue), detail: note('revenue', latest.periodType === 'ttm' ? 'Latest four complete quarters' : latest.fiscalQuarter ? `Q${latest.fiscalQuarter} FY${latest.fiscalYear}` : `FY${latest.fiscalYear} filed`) },
      { label: 'Gross profit', value: latest.grossProfit, format: 'money', change: rate('grossProfit', latest.grossProfit, prior?.grossProfit), detail: 'Gross margin shown below' },
      { label: 'Operating income', value: latest.operatingIncome, format: 'money', change: rate('operatingIncome', latest.operatingIncome, prior?.operatingIncome), detail: note('operatingIncome', 'Core operating result') },
      { label: 'Net income', value: latest.netIncome, format: 'money', change: rate('netIncome', latest.netIncome, prior?.netIncome), detail: note('netIncome', 'Company-reported earnings') },
    ];
  }

  if (kind === 'balance') {
    const debt = totalDebt(latest);
    return [
      { label: 'Total assets', value: latest.totalAssets, format: 'money', change: rate('totalAssets', latest.totalAssets, prior?.totalAssets), detail: note('totalAssets', `At ${latest.periodEnd}`) },
      { label: 'Cash', value: latest.cash, format: 'money', change: rate('cash', latest.cash, prior?.cash), detail: note('cash', 'Cash and equivalents') },
      { label: 'Total debt', value: debt, format: 'money', change: prior ? change(debt, totalDebt(prior)) : null, detail: 'Short-term + long-term' },
      { label: 'Current ratio', value: ratio(latest.currentAssets, latest.currentLiabilities), format: 'ratio', detail: 'Current assets / liabilities' },
    ];
  }

  return [
    { label: 'Operating cash flow', value: latest.operatingCashFlow, format: 'money', change: change(latest.operatingCashFlow, prior?.operatingCashFlow), detail: 'Cash generated by operations' },
    { label: 'Capital expenditure', value: latest.capex, format: 'money', change: change(latest.capex, prior?.capex), detail: 'Investment in PP&E' },
    { label: 'Free cash flow', value: derivedFreeCashFlow(latest), format: 'money', change: prior ? change(derivedFreeCashFlow(latest), derivedFreeCashFlow(prior)) : null, detail: 'Operating cash flow − capex' },
    // Cash conversion is an earnings-quality read, and its denominator is the
    // field most often mis-selected. Rendering it off a net income that failed
    // its own check inverts the signal: GOOG showed 0.35x -- the profile of a
    // company manufacturing earnings -- purely because the denominator was
    // roughly four quarters instead of one.
    suspect.has('netIncome')
      ? { label: 'Cash conversion', value: null, format: 'ratio', detail: 'Withheld: net income did not pass a consistency check' }
      : { label: 'Cash conversion', value: ratio(latest.operatingCashFlow, latest.netIncome), format: 'ratio', detail: 'Operating cash flow / net income' },
  ];
}

export function buildStatementSignals(kind: StatementKind, annual: AnnualFinancial[]): StatementSignal[] {
  const periods = normalizeAnnual(annual);
  const latest = periods[0];
  const prior = latest?.fiscalQuarter
    ? periods.find((period) => period.fiscalYear === latest.fiscalYear - 1 && period.fiscalQuarter === latest.fiscalQuarter)
    : periods[1];
  if (!latest || !prior) return [];

  // Leads the panel when present. A reader who is about to draw a conclusion
  // from these figures should meet the caveat before the conclusions, not after.
  const notice = anomalyNotice(detectAnomalies(periods));
  const caveat: StatementSignal[] = notice
    ? [{ label: 'Consistency check', detail: notice, tone: 'caution' }]
    : [];

  if (kind === 'income') {
    const revenueGrowth = change(latest.revenue, prior.revenue);
    const netIncomeGrowth = change(latest.netIncome, prior.netIncome);
    const grossMarginMove = bpsChange(ratio(latest.grossProfit, latest.revenue), ratio(prior.grossProfit, prior.revenue));
    const operatingMarginMove = bpsChange(ratio(latest.operatingIncome, latest.revenue), ratio(prior.operatingIncome, prior.revenue));
    return [
      ...caveat,
      { label: 'Revenue movement', detail: yoyDetail('Revenue', latest.revenue, prior.revenue, comparisonLabel(prior)), tone: yoyTone(latest.revenue, prior.revenue) },
      { label: 'Gross-margin movement', detail: grossMarginMove == null ? 'Insufficient filed facts.' : `${grossMarginMove >= 0 ? '+' : ''}${grossMarginMove} basis points year over year.`, tone: grossMarginMove != null && grossMarginMove >= 0 ? 'positive' : 'caution' },
      { label: 'Operating leverage', detail: operatingMarginMove == null ? 'Insufficient filed facts.' : `Operating margin ${operatingMarginMove >= 0 ? 'expanded' : 'contracted'} ${Math.abs(operatingMarginMove)} basis points.`, tone: operatingMarginMove != null && operatingMarginMove >= 0 ? 'positive' : 'caution' },
      // Net income legitimately crosses zero, so a missing rate here is usually
      // a swing rather than a gap. Name the amounts instead of going quiet.
      { label: 'Earnings versus sales', detail: revenueGrowth != null && netIncomeGrowth != null
        ? `Net income ${netIncomeGrowth >= revenueGrowth ? 'grew faster than' : 'trailed'} revenue (${(netIncomeGrowth * 100).toFixed(1)}% vs ${(revenueGrowth * 100).toFixed(1)}%).`
        : finite(latest.netIncome) && finite(prior.netIncome) && finite(latest.revenue) && finite(prior.revenue)
          ? `Net income moved from ${money(prior.netIncome)} to ${money(latest.netIncome)} while revenue moved from ${money(prior.revenue)} to ${money(latest.revenue)}.`
          : 'Comparable growth is unavailable.', tone: 'neutral' },
    ];
  }

  if (kind === 'balance') {
    const debt = totalDebt(latest);
    const priorDebt = totalDebt(prior);
    const netDebt = debt != null && latest.cash != null ? debt - latest.cash : null;
    const priorNetDebt = priorDebt != null && prior.cash != null ? priorDebt - prior.cash : null;
    const currentRatio = ratio(latest.currentAssets, latest.currentLiabilities);
    const debtGrowth = change(debt, priorDebt);
    const assetGrowth = change(latest.totalAssets, prior.totalAssets);
    return [
      ...caveat,
      { label: 'Liquidity coverage', detail: currentRatio == null ? 'Current assets or liabilities are unavailable.' : `Current assets cover ${currentRatio.toFixed(2)}× current liabilities.`, tone: currentRatio != null && currentRatio >= 1 ? 'positive' : 'caution' },
      { label: 'Net debt', detail: netDebt == null ? 'Debt or cash is unavailable.' : `${netDebt >= 0 ? 'Net debt' : 'Net cash'} of ${Math.abs(netDebt / 1e9).toFixed(1)}B.`, tone: 'neutral' },
      { label: 'Net-debt movement', detail: netDebt == null || priorNetDebt == null ? 'Comparable net debt is unavailable.' : `Net debt ${netDebt <= priorNetDebt ? 'improved' : 'increased'} by ${Math.abs(netDebt - priorNetDebt) / 1e9 < 0.05 ? '<0.1' : (Math.abs(netDebt - priorNetDebt) / 1e9).toFixed(1)}B.`, tone: netDebt != null && priorNetDebt != null && netDebt <= priorNetDebt ? 'positive' : 'caution' },
      { label: 'Debt versus asset growth', detail: debtGrowth != null && assetGrowth != null
        ? `Debt changed ${(debtGrowth * 100).toFixed(1)}%; assets changed ${(assetGrowth * 100).toFixed(1)}%.`
        : finite(debt) && finite(priorDebt) && finite(latest.totalAssets) && finite(prior.totalAssets)
          ? `Debt moved from ${money(priorDebt)} to ${money(debt)}; assets moved from ${money(prior.totalAssets)} to ${money(latest.totalAssets)}.`
          : 'Comparable values are unavailable.', tone: 'neutral' },
    ];
  }

  const conversion = ratio(latest.operatingCashFlow, latest.netIncome);
  const priorConversion = ratio(prior.operatingCashFlow, prior.netIncome);
  const latestFcf = derivedFreeCashFlow(latest);
  const priorFcf = derivedFreeCashFlow(prior);
  const capexIntensity = ratio(latest.capex, latest.revenue);
  const netIncomeSuspect = suspectFields(detectAnomalies(periods)).has('netIncome');
  return [
    ...caveat,
    { label: 'Free-cash-flow movement', detail: yoyDetail('Free cash flow', latestFcf, priorFcf), tone: yoyTone(latestFcf, priorFcf) },
    // Same reasoning as the tile: a conversion ratio read off a net income that
    // failed its check reports the opposite of the truth, and reports it calmly.
    netIncomeSuspect
      ? { label: 'Cash conversion', detail: 'Withheld: net income did not pass a consistency check for this period.', tone: 'caution' as const }
      : { label: 'Cash conversion', detail: conversion == null ? 'Operating cash flow or net income is unavailable.' : `Operating cash flow equals ${conversion.toFixed(2)}× net income.`, tone: conversion != null && conversion >= 1 ? 'positive' : 'caution' },
    { label: 'Conversion trend', detail: conversion == null || priorConversion == null ? 'Comparable conversion is unavailable.' : `Cash conversion ${conversion >= priorConversion ? 'improved' : 'weakened'} from ${priorConversion.toFixed(2)}×.`, tone: conversion != null && priorConversion != null && conversion >= priorConversion ? 'positive' : 'caution' },
    { label: 'Capital intensity', detail: capexIntensity == null ? 'Capex or revenue is unavailable.' : `Capital expenditure was ${(capexIntensity * 100).toFixed(1)}% of revenue.`, tone: 'neutral' },
  ];
}
