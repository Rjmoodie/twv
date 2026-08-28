import type { FinancialStatementPeriod, StockData } from "../types";

export type PeerMetricKey = "pe" | "evEbitda" | "ps" | "pFcf" | "pb";
export type MetricObservation = {
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  numeratorLabel: string;
  denominatorLabel: string;
  formula: string;
  basis: "ttm" | "latest-balance";
  quoteAsOf: string | null;
  fundamentalsAsOf: string | null;
  source: string;
  currency: string | null;
  unavailableReason?: string;
};
export type PeerMetrics = Record<PeerMetricKey, MetricObservation>;

const finitePositive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const finiteNonNegative = (value: unknown): value is number => finite(value) && value >= 0;

function quarterIndex(period: FinancialStatementPeriod) {
  return typeof period.fiscalYear === "number" && typeof period.fiscalQuarter === "number"
    ? period.fiscalYear * 4 + period.fiscalQuarter : null;
}

function latestFourComplete(stock: StockData) {
  const periods = (stock.quarterlyFinancials ?? []).filter((period) => period.periodType === "quarter").slice(0, 4);
  if (periods.length !== 4) return null;
  const consecutive = periods.every((period, index) => index === periods.length - 1 || (
    quarterIndex(period) != null && quarterIndex(periods[index + 1]) != null && quarterIndex(period)! - quarterIndex(periods[index + 1])! === 1
  ));
  return consecutive ? periods : null;
}

const sumMetric = (periods: FinancialStatementPeriod[] | null, key: "revenue" | "netIncome" | "freeCashFlow") =>
  periods && periods.every((period) => finite(period[key])) ? periods.reduce((sum, period) => sum + period[key]!, 0) : null;

function observation(args: Omit<MetricObservation, "value">): MetricObservation {
  const value = finitePositive(args.numerator) && finitePositive(args.denominator) ? args.numerator / args.denominator : null;
  const defaultReason = !finitePositive(args.numerator)
    ? `${args.numeratorLabel} is zero, negative, incomplete, or unavailable`
    : `${args.denominatorLabel} is zero, negative, incomplete, or unavailable`;
  return {
    ...args,
    value,
    unavailableReason: value == null ? args.unavailableReason ?? defaultReason : undefined,
  };
}

export function metricsFromStock(stock: StockData): PeerMetrics {
  const quarters = latestFourComplete(stock);
  const ttmEnd = quarters?.[0]?.periodEnd ?? null;
  const latestBalance = (stock.quarterlyFinancials ?? []).find((period) => period.periodType === "quarter" && period.periodEnd)
    ?? stock.annualFinancials?.[0] ?? null;
  const marketCap = finitePositive(stock.marketCap) ? stock.marketCap : null;
  const ttmRevenue = sumMetric(quarters, "revenue");
  const ttmNetIncome = sumMetric(quarters, "netIncome");
  const ttmFcf = sumMetric(quarters, "freeCashFlow");
  const debtComplete = latestBalance && finiteNonNegative(latestBalance.longTermDebt) && finiteNonNegative(latestBalance.shortTermDebt);
  const totalDebt = debtComplete ? latestBalance!.longTermDebt! + latestBalance!.shortTermDebt! : null;
  const cash = latestBalance && finiteNonNegative(latestBalance.cash) ? latestBalance.cash : null;
  const enterpriseValue = marketCap != null && totalDebt != null && cash != null ? marketCap + totalDebt - cash : null;
  const ebitda = finitePositive(stock.ebitda) ? stock.ebitda : null;
  const quoteAsOf = stock.dataSources?.quote.asOf ?? stock.lastUpdated ?? null;
  const marketSource = stock.dataSources?.quote.provider ?? "Market-data provider";
  const filingSource = stock.dataSources?.fundamentals.provider ?? "SEC filing data";
  const common = { quoteAsOf, source: `${marketSource}; ${filingSource}`, currency: stock.currency ?? null };

  return {
    pe: observation({ ...common, numerator: marketCap, denominator: ttmNetIncome, numeratorLabel: "Market capitalization", denominatorLabel: "TTM net income", formula: "market capitalization / TTM net income", basis: "ttm", fundamentalsAsOf: ttmEnd, unavailableReason: quarters ? undefined : "Four consecutive quarters are unavailable" }),
    ps: observation({ ...common, numerator: marketCap, denominator: ttmRevenue, numeratorLabel: "Market capitalization", denominatorLabel: "TTM revenue", formula: "market capitalization / TTM revenue", basis: "ttm", fundamentalsAsOf: ttmEnd, unavailableReason: quarters ? undefined : "Four consecutive quarters are unavailable" }),
    pFcf: observation({ ...common, numerator: marketCap, denominator: ttmFcf, numeratorLabel: "Market capitalization", denominatorLabel: "TTM free cash flow", formula: "market capitalization / TTM free cash flow", basis: "ttm", fundamentalsAsOf: ttmEnd, unavailableReason: quarters ? undefined : "Four consecutive quarters are unavailable" }),
    pb: observation({ ...common, numerator: marketCap, denominator: latestBalance?.shareholderEquity ?? null, numeratorLabel: "Market capitalization", denominatorLabel: "Latest common shareholder equity", formula: "market capitalization / latest common shareholder equity", basis: "latest-balance", fundamentalsAsOf: latestBalance?.periodEnd ?? null }),
    evEbitda: observation({ ...common, numerator: enterpriseValue, denominator: ebitda, numeratorLabel: "Enterprise value (market cap + complete debt - cash)", denominatorLabel: "Provider TTM EBITDA", formula: "(market capitalization + total debt - cash) / TTM EBITDA", basis: "ttm", fundamentalsAsOf: stock.latestQuarter ?? latestBalance?.periodEnd ?? ttmEnd, unavailableReason: !debtComplete ? "Complete current and non-current debt are unavailable" : cash == null ? "Cash is unavailable" : undefined }),
  };
}

export function median(values: Array<number | null>): number | null {
  const clean = values.filter(finitePositive).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

const dateDistanceDays = (left: string | null, right: string | null) => {
  if (!left || !right) return null;
  const distance = Math.abs(Date.parse(left) - Date.parse(right)) / 86_400_000;
  return Number.isFinite(distance) ? distance : null;
};

export function comparabilityIssue(target: MetricObservation, peer: MetricObservation) {
  if (!finitePositive(target.value) || !finitePositive(peer.value)) return "Metric is not meaningful for both companies";
  if (target.basis !== peer.basis) return "Calculation bases differ";
  if (!target.currency || !peer.currency) return "Currency metadata is incomplete";
  if (target.currency !== peer.currency) return `Currency mismatch (${target.currency} vs ${peer.currency})`;
  const quoteDistance = dateDistanceDays(target.quoteAsOf, peer.quoteAsOf);
  const filingDistance = dateDistanceDays(target.fundamentalsAsOf, peer.fundamentalsAsOf);
  if (quoteDistance == null || filingDistance == null) return "Quote or filing date is incomplete";
  if (quoteDistance > 7) return "Quote dates differ by more than 7 days";
  if (filingDistance > 140) return "Reporting periods differ by more than 140 days";
  return null;
}

export function isComparableObservation(target: MetricObservation, peer: MetricObservation) {
  return comparabilityIssue(target, peer) == null;
}

export function comparisonLabel(value: number | null, peerMedian: number | null, usableCount: number) {
  if (!finitePositive(value) || !finitePositive(peerMedian)) return "Not meaningful";
  if (usableCount < 3) return "Need 3 comparable peers";
  const premium = ((value - peerMedian) / peerMedian) * 100;
  if (Math.abs(premium) < 5) return "In line with median";
  return `${premium > 0 ? "+" : ""}${premium.toFixed(0)}% vs median`;
}

export function isValidTicker(value: string) {
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(value.trim().toUpperCase());
}
