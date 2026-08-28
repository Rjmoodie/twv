import { derivedFreeCashFlow, normalizeAnnual, ratio, totalDebt, type AnnualFinancial } from './financialStatementAnalytics';

export type QualityStatus = 'pass' | 'warning' | 'unavailable';
export interface QualityCheck { label: string; status: QualityStatus; detail: string }

const finite = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b), 1) * 0.005;

export function buildQualityChecks(periodsInput: AnnualFinancial[]): QualityCheck[] {
  const periods = normalizeAnnual(periodsInput);
  const latest = periods[0];
  if (!latest) return [];
  const checks: QualityCheck[] = [];
  // A check is only worth anything if its inputs are independent of it. Total
  // liabilities is now recovered, for filers that tag no `Liabilities` concept,
  // as the balance-sheet total less equity — and the balance-sheet total IS total
  // assets. Testing assets against liabilities plus equity would then be testing
  // the identity against itself: it can only pass, and for a filer with
  // non-controlling interests it would compare a total-equity derivation against
  // parent-only equity and raise a warning about arithmetic that is correct.
  // Say it cannot be checked rather than report a verdict that means nothing.
  const liabilitiesDerived = latest.provenance?.totalLiabilities?.classification === 'derived';
  if (liabilitiesDerived) {
    checks.push({ label: 'Accounting equation', status: 'unavailable', detail: 'Total liabilities was derived from this identity, so it cannot independently verify it.' });
  } else if (finite(latest.totalAssets) && finite(latest.totalLiabilities) && finite(latest.shareholderEquity)) {
    const rhs = latest.totalLiabilities + latest.shareholderEquity;
    checks.push({ label: 'Accounting equation', status: close(latest.totalAssets, rhs) ? 'pass' : 'warning', detail: close(latest.totalAssets, rhs) ? 'Assets reconcile to liabilities plus equity.' : 'Assets do not reconcile within 0.5%.' });
  } else checks.push({ label: 'Accounting equation', status: 'unavailable', detail: 'Total liabilities, assets, or equity is unavailable.' });

  const fcf = derivedFreeCashFlow(latest);
  checks.push({ label: 'Free cash flow', status: fcf == null ? 'unavailable' : 'pass', detail: fcf == null ? 'Operating cash flow or capex is unavailable.' : 'Recalculated as operating cash flow less capex.' });

  // Still meaningful when gross profit is derived: `revenue - costOfRevenue`
  // cannot exceed revenue unless cost of revenue is negative, which would itself
  // be the taxonomy error worth catching.
  if (finite(latest.revenue) && finite(latest.grossProfit)) checks.push({ label: 'Gross-profit bounds', status: latest.grossProfit <= latest.revenue ? 'pass' : 'warning', detail: latest.grossProfit <= latest.revenue ? 'Gross profit does not exceed revenue.' : 'Gross profit exceeds revenue; inspect taxonomy.' });
  else checks.push({ label: 'Gross-profit bounds', status: 'unavailable', detail: 'Revenue or gross profit is unavailable.' });

  const debt = totalDebt(latest);
  checks.push({ label: 'Debt completeness', status: debt == null ? 'unavailable' : 'pass', detail: debt == null ? 'Both current and non-current debt are required.' : 'Includes current plus non-current debt.' });

  const quarterPeriods = periods.filter(period => period.fiscalQuarter != null);
  if (quarterPeriods.length >= 2) {
    const ordinal = (period: AnnualFinancial) => period.fiscalYear * 4 + (period.fiscalQuarter ?? 0);
    const consecutive = quarterPeriods.every((period, index) => index === 0 || ordinal(quarterPeriods[index - 1]) - ordinal(period) === 1);
    checks.push({ label: 'Period continuity', status: consecutive ? 'pass' : 'warning', detail: consecutive ? 'Fiscal quarters are consecutive.' : 'A fiscal quarter is missing or duplicated.' });
  }
  return checks;
}

export function buildAnalyticalRatios(period: AnnualFinancial) {
  const debt = totalDebt(period);
  const investedCapital = finite(debt) && finite(period.shareholderEquity) && finite(period.cash)
    ? debt + period.shareholderEquity - period.cash : null;
  const taxRate = ratio(period.incomeTaxExpense, period.pretaxIncome);
  const nopat = finite(period.operatingIncome) && taxRate != null ? period.operatingIncome * (1 - Math.min(Math.max(taxRate, 0), 1)) : null;
  return {
    grossMargin: ratio(period.grossProfit, period.revenue),
    operatingMargin: ratio(period.operatingIncome, period.revenue),
    netMargin: ratio(period.netIncome, period.revenue),
    fcfMargin: ratio(derivedFreeCashFlow(period), period.revenue),
    currentRatio: ratio(period.currentAssets, period.currentLiabilities),
    debtToCapital: debt != null && finite(period.shareholderEquity) ? ratio(debt, debt + period.shareholderEquity) : null,
    roicEndingCapital: nopat != null ? ratio(nopat, investedCapital) : null,
    cashConversion: ratio(period.operatingCashFlow, period.netIncome),
  };
}
