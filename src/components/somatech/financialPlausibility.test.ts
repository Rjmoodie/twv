import { describe, expect, it } from 'vitest';
import { anomalyNotice, checkAgainstHistory, checkPeriod, detectAnomalies, suspectFields } from './financialPlausibility';
import type { AnnualFinancial } from './financialStatementAnalytics';

/** A coherent quarter: identity holds, nothing extreme. */
const quarter = (over: Partial<AnnualFinancial> = {}): AnnualFinancial => ({
  fiscalYear: 2026, fiscalQuarter: 2, periodEnd: '2026-06-30', periodType: 'quarter',
  revenue: 100_000_000_000, grossProfit: 58_000_000_000,
  operatingIncome: 34_000_000_000, netIncome: 28_000_000_000,
  operatingCashFlow: 39_000_000_000, capex: 22_000_000_000, freeCashFlow: 17_000_000_000,
  totalAssets: 600_000_000_000, totalLiabilities: 180_000_000_000, shareholderEquity: 420_000_000_000,
  currentAssets: 180_000_000_000, currentLiabilities: 80_000_000_000,
  longTermDebt: 20_000_000_000, shortTermDebt: 5_000_000_000,
  cash: 24_000_000_000, sharesOutstanding: 12_000_000_000,
  ...over,
} as AnnualFinancial);

const history = (count: number) => Array.from({ length: count }, (_, index) =>
  quarter({ fiscalYear: 2025, fiscalQuarter: ((index + 1) % 4) + 1, periodEnd: `2025-0${index + 1}-30` }));

describe('structural checks', () => {
  it('passes a coherent period', () => {
    expect(checkPeriod(quarter())).toEqual([]);
  });

  it('catches a balance sheet that does not balance', () => {
    // The GOOG Q2 FY2026 shape: assets far above what liabilities and equity fund.
    const broken = checkPeriod(quarter({ totalAssets: 922_000_000_000 }));
    expect(broken).toHaveLength(1);
    expect(broken[0]).toMatchObject({ field: 'totalAssets', severity: 'impossible' });
  });

  it('leaves the identity alone when noncontrolling interests explain the gap', () => {
    // shareholderEquity resolves to a parent-only concept, so a filer that
    // consolidates a subsidiary it does not wholly own is legitimately short by
    // the minority interest. At a 2% tolerance this fired on Tesla, Exxon and
    // Prologis across nearly every year they have filed -- see the corpus test.
    expect(checkPeriod(quarter({ totalAssets: 660_000_000_000 }))).toEqual([]);
  });

  it('still catches a gap too large for minority interests to explain', () => {
    // 35% of assets unaccounted for is not a consolidation artefact.
    expect(checkPeriod(quarter({ totalAssets: 922_000_000_000 }))
      .some((anomaly) => anomaly.field === 'totalAssets' && anomaly.severity === 'impossible')).toBe(true);
  });

  it('skips the identity entirely when a filer does not tag liabilities', () => {
    // Roughly a quarter of filers never tag `Liabilities`. That is a gap, and a
    // gap must never be reported as a violation.
    expect(checkPeriod(quarter({ totalLiabilities: null }))).toEqual([]);
  });

  it('catches net income far above operating income', () => {
    const flagged = checkPeriod(quarter({ netIncome: 112_200_000_000, operatingIncome: 40_800_000_000, revenue: 119_800_000_000 }));
    expect(flagged.map((anomaly) => anomaly.field)).toContain('netIncome');
  });

  it('does not flag a cash-rich company earning interest above its operating income', () => {
    // Small operations, large cash pile: net above operating is normal and the
    // excess is trivial against revenue.
    expect(checkPeriod(quarter({ revenue: 100_000_000_000, operatingIncome: 2_000_000_000, netIncome: 4_000_000_000 })))
      .toEqual([]);
  });

  it('does not flag a loss-making filer whose operating loss is larger still', () => {
    // netIncome - operatingIncome is large and positive here, but the company
    // lost money; requiring positive net income keeps biotech off the list.
    expect(checkPeriod(quarter({ revenue: 1_000_000_000, operatingIncome: -8_000_000_000, netIncome: -7_000_000_000 })))
      .toEqual([]);
  });

  it('catches impossible containment and signs', () => {
    expect(checkPeriod(quarter({ currentAssets: 700_000_000_000 })).some((a) => a.field === 'currentAssets')).toBe(true);
    expect(checkPeriod(quarter({ cash: 190_000_000_000 })).some((a) => a.field === 'cash')).toBe(true);
    expect(checkPeriod(quarter({ revenue: -1 })).some((a) => a.field === 'revenue')).toBe(true);
  });

  it('leaves legitimately negative equity and earnings alone', () => {
    // An accumulated deficit is a real balance sheet, not a parse failure.
    expect(checkPeriod(quarter({
      shareholderEquity: -50_000_000_000, totalLiabilities: 650_000_000_000, netIncome: -3_000_000_000,
    }))).toEqual([]);
  });
});

describe('historical checks', () => {
  it('catches a flow far above its own trailing median', () => {
    const flagged = checkAgainstHistory(quarter({ netIncome: 112_200_000_000 }), history(6));
    expect(flagged.some((anomaly) => anomaly.field === 'netIncome')).toBe(true);
  });

  it('stays quiet without enough history to form a median', () => {
    expect(checkAgainstHistory(quarter({ netIncome: 112_200_000_000 }), history(2))).toEqual([]);
  });

  it('does not flag ordinary growth', () => {
    expect(checkAgainstHistory(quarter({ revenue: 130_000_000_000 }), history(6))).toEqual([]);
  });

  it('catches total assets moving more than half in one period', () => {
    const flagged = checkAgainstHistory(quarter({ totalAssets: 922_000_000_000 }), history(6));
    expect(flagged.some((anomaly) => anomaly.field === 'totalAssets')).toBe(true);
  });

  it('leaves a large cash or debt step alone', () => {
    // A bond programme quadruples debt and more than doubles cash. Real, common,
    // and not something a jump threshold should be reporting.
    const raised = quarter({ cash: 55_900_000_000, longTermDebt: 95_000_000_000, shortTermDebt: 5_200_000_000,
      totalLiabilities: 255_000_000_000, shareholderEquity: 420_000_000_000, totalAssets: 675_000_000_000 });
    expect(checkAgainstHistory(raised, history(6)).map((a) => a.field)).not.toContain('cash');
  });

  it('survives a zero-valued history without dividing by it', () => {
    const zeroed = history(6).map((period) => ({ ...period, capex: 0 }));
    expect(() => checkAgainstHistory(quarter({ capex: 5_000_000_000 }), zeroed)).not.toThrow();
    expect(checkAgainstHistory(quarter({ capex: 5_000_000_000 }), zeroed).map((a) => a.field)).not.toContain('capex');
  });

  it('ignores missing values instead of treating them as zero', () => {
    const sparse = history(6).map((period) => ({ ...period, netIncome: null }));
    expect(checkAgainstHistory(quarter(), sparse).map((a) => a.field)).not.toContain('netIncome');
  });
});

describe('detectAnomalies', () => {
  it('returns nothing for a clean series', () => {
    expect(detectAnomalies([quarter(), ...history(6)])).toEqual([]);
  });

  it('excludes TTM rows, which are sums and would flag against quarters', () => {
    const ttm = quarter({ periodType: 'ttm', revenue: 400_000_000_000, netIncome: 112_000_000_000 });
    expect(detectAnomalies([ttm, quarter(), ...history(6)])).toEqual([]);
  });

  it('reports one problem per field and severity, not one per check', () => {
    // Total assets trips both the identity and the jump threshold.
    const anomalies = detectAnomalies([quarter({ totalAssets: 922_000_000_000 }), ...history(6)]);
    const assetAnomalies = anomalies.filter((anomaly) => anomaly.field === 'totalAssets');
    expect(assetAnomalies).toHaveLength(2);
    expect(assetAnomalies.map((a) => a.severity)).toEqual(['impossible', 'implausible']);
  });

  it('handles an empty series', () => {
    expect(detectAnomalies([])).toEqual([]);
  });
});

describe('consumers', () => {
  it('names the fields a caller must not derive from', () => {
    const anomalies = detectAnomalies([quarter({ netIncome: 112_200_000_000, operatingIncome: 40_800_000_000 }), ...history(6)]);
    expect(suspectFields(anomalies).has('netIncome')).toBe(true);
  });

  it('writes a notice that asks for verification rather than declaring an error', () => {
    const notice = anomalyNotice(detectAnomalies([quarter({ totalAssets: 922_000_000_000 }), ...history(6)]))!;
    expect(notice).toContain('totalAssets');
    expect(notice).toContain('verify against the filing');
    expect(notice).not.toContain('wrong');
  });

  it('has nothing to say about a clean period', () => {
    expect(anomalyNotice([])).toBeNull();
  });
});
