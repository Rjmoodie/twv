import { describe, expect, it } from 'vitest';
import { buildAnalyticalRatios, buildQualityChecks } from './financialStatementQuality';
import type { AnnualFinancial } from './financialStatementAnalytics';

const period: AnnualFinancial = {
  fiscalYear: 2025, periodEnd: '2025-12-31', revenue: 1000, grossProfit: 400,
  operatingIncome: 200, pretaxIncome: 180, incomeTaxExpense: 36, netIncome: 144,
  operatingCashFlow: 190, capex: 50, freeCashFlow: 1, totalAssets: 2000,
  totalLiabilities: 1200, currentAssets: 600, currentLiabilities: 300,
  longTermDebt: 200, shortTermDebt: 50, shareholderEquity: 800, cash: 100,
  sharesOutstanding: 10,
};

describe('financial statement quality', () => {
  it('reconciles accounting identities and derived free cash flow', () => {
    const checks = buildQualityChecks([period]);
    expect(checks.find(check => check.label === 'Accounting equation')?.status).toBe('pass');
    expect(checks.find(check => check.label === 'Free cash flow')?.status).toBe('pass');
  });

  it('warns instead of hiding an accounting mismatch', () => {
    expect(buildQualityChecks([{ ...period, totalLiabilities: 100 }])
      .find(check => check.label === 'Accounting equation')?.status).toBe('warning');
  });

  it('keeps ratios unavailable when required inputs are missing', () => {
    expect(buildAnalyticalRatios({ ...period, pretaxIncome: null }).roicEndingCapital).toBeNull();
    expect(buildAnalyticalRatios(period).grossMargin).toBeCloseTo(0.4);
  });
});

describe('derived inputs cannot verify themselves', () => {
  const withProvenance = (overrides: Record<string, unknown>) => ([{
    fiscalYear: 2025, periodEnd: '2025-12-31', periodType: 'annual',
    revenue: 1000, grossProfit: 400, operatingIncome: 200, netIncome: 150,
    operatingCashFlow: 250, capex: 50, freeCashFlow: 200,
    totalAssets: 2000, currentAssets: 800, currentLiabilities: 400,
    longTermDebt: 300, shortTermDebt: 100, shareholderEquity: 900,
    cash: 200, sharesOutstanding: 100, totalLiabilities: 1100,
    ...overrides,
  }] as unknown as Parameters<typeof buildQualityChecks>[0]);

  it('declines to run the accounting equation when total liabilities came from it', () => {
    const checks = buildQualityChecks(withProvenance({
      provenance: { totalLiabilities: { classification: 'derived', formula: 'liabilitiesAndStockholdersEquity - totalEquityIncludingNCI' } },
    }));
    const check = checks.find((c) => c.label === 'Accounting equation');
    expect(check?.status).toBe('unavailable');
    expect(check?.detail).toContain('cannot independently verify');
  });

  it('still runs it when total liabilities was filed', () => {
    const checks = buildQualityChecks(withProvenance({
      provenance: { totalLiabilities: { classification: 'filed', concept: 'Liabilities' } },
    }));
    expect(checks.find((c) => c.label === 'Accounting equation')?.status).toBe('pass');
  });
});
