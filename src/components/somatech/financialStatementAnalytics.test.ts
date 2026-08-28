import { describe, expect, it } from 'vitest';
import {
  buildStatementKpis,
  buildStatementSignals,
  buildTtmPeriod,
  change,
  derivedFreeCashFlow,
  normalizeAnnual,
  ratio,
  totalDebt,
  type AnnualFinancial,
} from './financialStatementAnalytics';

const annual: AnnualFinancial[] = [
  {
    fiscalYear: 2025, periodEnd: '2025-09-27', revenue: 416_161, grossProfit: 195_201,
    operatingIncome: 133_050, netIncome: 112_010, operatingCashFlow: 111_482,
    capex: 12_715, freeCashFlow: 98_767, totalAssets: 359_241, currentAssets: 147_957,
    currentLiabilities: 165_631, longTermDebt: 78_328, shortTermDebt: 12_350,
    shareholderEquity: 73_733, cash: 35_934, sharesOutstanding: 14_776,
  },
  {
    fiscalYear: 2024, periodEnd: '2024-09-28', revenue: 391_035, grossProfit: 180_683,
    operatingIncome: 123_216, netIncome: 93_736, operatingCashFlow: 118_254,
    capex: 9_447, freeCashFlow: 108_807, totalAssets: 364_980, currentAssets: 152_987,
    currentLiabilities: 176_392, longTermDebt: 85_750, shortTermDebt: 10_912,
    shareholderEquity: 56_950, cash: 29_943, sharesOutstanding: 15_116,
  },
];

describe('financial statement analytics', () => {
  it('uses null instead of inventing ratios when the denominator is unavailable', () => {
    expect(ratio(10, 0)).toBeNull();
    expect(ratio(10, -5)).toBeNull();
    expect(ratio(Number.POSITIVE_INFINITY, 10)).toBeNull();
    expect(ratio(null, 10)).toBeNull();
    expect(change(10, null)).toBeNull();
    expect(change(10, 0)).toBeNull();
    expect(change(10, -5)).toBeNull();
  });

  it('names both amounts rather than calling present data unavailable', () => {
    // The rate is null across a sign flip, but the figures are in the table --
    // reporting them as "unavailable" would be a false statement about the data.
    const swung = [
      { ...annual[0], operatingCashFlow: 24_000_000_000, capex: 29_900_000_000, freeCashFlow: -5_900_000_000 },
      { ...annual[1], operatingCashFlow: 20_300_000_000, capex: 15_000_000_000, freeCashFlow: 5_300_000_000 },
    ];
    const detail = buildStatementSignals('cashflow', swung)
      .find((signal) => signal.label === 'Free-cash-flow movement')?.detail;
    expect(detail).toContain('$5.3B');
    expect(detail).toContain('-$5.9B');
    expect(detail).not.toContain('unavailable');
  });

  it('still reports genuinely missing free cash flow as unavailable', () => {
    const missing = [
      { ...annual[0], operatingCashFlow: null, capex: null, freeCashFlow: null },
      { ...annual[1], operatingCashFlow: null, capex: null, freeCashFlow: null },
    ];
    expect(buildStatementSignals('cashflow', missing)
      .find((signal) => signal.label === 'Free-cash-flow movement')?.detail).toContain('unavailable');
  });

  it('names present revenue and zero-base debt instead of calling them unavailable', () => {
    const signFlip = [
      { ...annual[0], revenue: -50_000_000 },
      { ...annual[1], revenue: 800_000_000 },
    ];
    const revenue = buildStatementSignals('income', signFlip)
      .find((signal) => signal.label === 'Revenue movement')?.detail;
    expect(revenue).toContain('$800.0M');
    expect(revenue).toContain('-$50.0M');
    expect(revenue).not.toContain('unavailable');

    const debtFromZero = [
      { ...annual[0], longTermDebt: 10_000_000, shortTermDebt: 0 },
      { ...annual[1], longTermDebt: 0, shortTermDebt: 0 },
    ];
    const debt = buildStatementSignals('balance', debtFromZero)
      .find((signal) => signal.label === 'Debt versus asset growth')?.detail;
    expect(debt).toContain('Debt moved from $0 to $10.0M');
    expect(debt).not.toContain('unavailable');
  });

  it('reports no growth rate when the value crosses zero', () => {
    // Free cash flow of +$5.3B becoming -$5.9B is a swing, not a 211% decline.
    expect(change(-5_900, 5_300)).toBeNull();
    expect(change(0, 5_300)).toBe(-1);
    expect(change(5_300, 5_300)).toBe(0);
  });

  it('combines current and non-current debt without double-counting missing values', () => {
    expect(totalDebt(annual[0])).toBe(90_678);
    expect(totalDebt({ ...annual[0], longTermDebt: null, shortTermDebt: null })).toBeNull();
    expect(totalDebt({ ...annual[0], longTermDebt: null })).toBeNull();
    expect(totalDebt({ ...annual[0], shortTermDebt: null })).toBeNull();
  });

  it('sorts and de-duplicates periods before selecting latest and prior values', () => {
    const olderDuplicate = { ...annual[1], periodEnd: '2024-09-27', revenue: 1 };
    const normalized = normalizeAnnual([annual[1], annual[0], olderDuplicate]);
    expect(normalized.map(period => period.fiscalYear)).toEqual([2025, 2024]);
    expect(normalized[1].revenue).toBe(annual[1].revenue);
    expect(buildStatementKpis('income', [annual[1], annual[0]])[0].value).toBe(annual[0].revenue);
  });

  it('reconciles free cash flow from its filed components instead of trusting a payload total', () => {
    expect(derivedFreeCashFlow({ ...annual[0], freeCashFlow: 1 })).toBe(98_767);
    expect(derivedFreeCashFlow({ ...annual[0], capex: -12_715 })).toBeNull();
    expect(derivedFreeCashFlow({ ...annual[0], operatingCashFlow: null })).toBeNull();
    expect(buildStatementKpis('cashflow', [{ ...annual[0], freeCashFlow: 1 }, annual[1]])
      .find(kpi => kpi.label === 'Free cash flow')?.value).toBe(98_767);
  });

  it('does not show percentage growth when a profit or cash-flow base is zero or negative', () => {
    const lossYear = { ...annual[1], netIncome: -10, operatingCashFlow: -20, freeCashFlow: -30 };
    expect(buildStatementKpis('income', [annual[0], lossYear])
      .find(kpi => kpi.label === 'Net income')?.change).toBeNull();
    // No percentage is quoted off a negative base -- but both figures are
    // present, so they are named rather than reported as missing.
    const earnings = buildStatementSignals('income', [annual[0], lossYear])
      .find(signal => signal.label === 'Earnings versus sales')?.detail;
    expect(earnings).toContain('Net income moved from');
    expect(earnings).not.toContain('unavailable');
    expect(buildStatementSignals('cashflow', [annual[0], lossYear])
      .find(signal => signal.label === 'Conversion trend')?.detail).toContain('unavailable');
  });

  it('leaves a clean period entirely untouched by the consistency checks', () => {
    expect(buildStatementKpis('income', annual).find(kpi => kpi.label === 'Net income')?.change).not.toBeNull();
    expect(buildStatementSignals('income', annual).some(signal => signal.label === 'Consistency check')).toBe(false);
    expect(buildStatementKpis('cashflow', annual).find(kpi => kpi.label === 'Cash conversion')?.value).not.toBeNull();
  });

  it('withholds the growth badge and the derived ratio when net income fails its check', () => {
    // Net income far above operating income -- the GOOG Q2 FY2026 shape. The
    // filed value still shows; the percentage and the conversion ratio do not,
    // because both would assert a confidence the number has not earned.
    const suspect = [{ ...annual[0], netIncome: 400_000 }, annual[1]];

    const netIncomeKpi = buildStatementKpis('income', suspect).find(kpi => kpi.label === 'Net income')!;
    expect(netIncomeKpi.value).toBe(400_000);
    expect(netIncomeKpi.change).toBeNull();
    expect(netIncomeKpi.detail).toContain('flagged for review');

    const conversion = buildStatementKpis('cashflow', suspect).find(kpi => kpi.label === 'Cash conversion')!;
    expect(conversion.value).toBeNull();
    expect(conversion.detail).toContain('Withheld');

    // Revenue is untouched: one bad field must not silence the rest of the panel.
    expect(buildStatementKpis('income', suspect).find(kpi => kpi.label === 'Revenue')?.change).not.toBeNull();
  });

  it('leads the signals with the caveat so it is met before the conclusions', () => {
    const suspect = [{ ...annual[0], netIncome: 400_000 }, annual[1]];
    const signals = buildStatementSignals('cashflow', suspect);
    expect(signals[0].label).toBe('Consistency check');
    expect(signals[0].tone).toBe('caution');
    expect(signals.find(signal => signal.label === 'Cash conversion')?.detail).toContain('Withheld');
  });

  it('builds TTM only from four consecutive, complete fiscal quarters', () => {
    const quarters = [4, 3, 2, 1].map((fiscalQuarter, index) => ({
      ...annual[0], fiscalYear: 2026, fiscalQuarter, periodType: 'quarter' as const,
      periodEnd: `2026-0${9 - index}-30`, revenue: 100 + index, operatingCashFlow: 20,
      capex: 5, freeCashFlow: 999,
    }));
    const ttm = buildTtmPeriod(quarters);
    expect(ttm?.revenue).toBe(406);
    expect(ttm?.freeCashFlow).toBe(60);
    expect(ttm?.periodType).toBe('ttm');
    expect(buildTtmPeriod([quarters[0], quarters[2], quarters[3], { ...quarters[3], fiscalYear: 2025, fiscalQuarter: 4 }])).toBeNull();
    expect(buildTtmPeriod(quarters.map((period, index) => index === 2 ? { ...period, revenue: null } : period))?.revenue).toBeNull();
  });

  it('compares a quarter with the same prior-year quarter', () => {
    const latest = { ...annual[0], fiscalYear: 2026, fiscalQuarter: 2, periodType: 'quarter' as const, revenue: 120 };
    const sequential = { ...annual[0], fiscalYear: 2026, fiscalQuarter: 1, periodType: 'quarter' as const, revenue: 1 };
    const priorYear = { ...annual[0], fiscalYear: 2025, fiscalQuarter: 2, periodType: 'quarter' as const, revenue: 100 };
    expect(buildStatementKpis('income', [latest, sequential, priorYear])[0].change).toBeCloseTo(0.2);
    expect(buildStatementSignals('income', [latest, sequential, priorYear])[0].detail).toContain('Q2 FY2025');
  });

  it('builds filed and derived KPI sets for all three tabs', () => {
    const income = buildStatementKpis('income', annual);
    const balance = buildStatementKpis('balance', annual);
    const cashflow = buildStatementKpis('cashflow', annual);

    expect(income.find(kpi => kpi.label === 'Revenue')?.change).toBeCloseTo(0.0643, 3);
    expect(balance.find(kpi => kpi.label === 'Current ratio')?.value).toBeCloseTo(0.893, 3);
    expect(cashflow.find(kpi => kpi.label === 'Cash conversion')?.value).toBeCloseTo(0.995, 3);
  });

  it('describes changes deterministically from the supplied periods', () => {
    expect(buildStatementSignals('income', annual).map(signal => signal.detail).join(' ')).toContain('6.4% versus FY2024');
    expect(buildStatementSignals('balance', annual).map(signal => signal.detail).join(' ')).toContain('0.89× current liabilities');
    expect(buildStatementSignals('cashflow', annual).map(signal => signal.detail).join(' ')).toContain('decreased 9.2%');
  });
});
