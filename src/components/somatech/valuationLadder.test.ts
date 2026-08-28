import { describe, expect, it } from 'vitest';
import type { FinancialStatementPeriod } from './types';
import { valueCompany, type ValuationInputs } from './valuationLadder';

const period = (overrides: Partial<FinancialStatementPeriod> = {}): FinancialStatementPeriod => ({
  fiscalYear: 2025, periodEnd: '2025-12-31', periodType: 'annual',
  revenue: 1000, grossProfit: 400, operatingIncome: 200, netIncome: 150,
  operatingCashFlow: 250, capex: 50, freeCashFlow: 200,
  totalAssets: 2000, currentAssets: 800, currentLiabilities: 400,
  longTermDebt: 300, shortTermDebt: 100, shareholderEquity: 1000,
  cash: 200, sharesOutstanding: 100, depreciationAmortization: 100,
  ...overrides,
});

const inputs = (annual: FinancialStatementPeriod[], overrides: Partial<ValuationInputs> = {}): ValuationInputs => ({
  annual, price: 10, sharesOutstanding: 100, ...overrides,
});

describe('rung selection', () => {
  it('uses a discounted cash flow when free cash flow is positive', () => {
    const result = valueCompany(inputs([period()]));
    expect(result.selected?.method).toBe('dcf-fcf');
    expect(result.selected?.confidence).toBe('high');
    expect(result.skipped).toEqual([]);
  });

  it('falls to EV/EBITDA when capex sinks free cash flow but EBITDA holds up', () => {
    // The Intel shape: positive operating cash flow, capex exceeding it, D&A large.
    const capexHeavy = period({ operatingCashFlow: 250, capex: 400, freeCashFlow: -150, operatingIncome: -50, depreciationAmortization: 300 });
    const result = valueCompany(inputs([capexHeavy]));

    expect(result.selected?.method).toBe('ev-ebitda');
    expect(result.skipped.map((entry) => entry.method)).toEqual(['dcf-fcf']);
    expect(result.skipped[0].reason).toContain('Discounting requires positive cash flow');
  });

  it('falls to gross profit when the operating line is loss-making', () => {
    const operatingLoss = period({ freeCashFlow: -100, operatingIncome: -80, depreciationAmortization: 20, grossProfit: 300 });
    const result = valueCompany(inputs([operatingLoss]));
    expect(result.selected?.method).toBe('ev-gross-profit');
    expect(result.skipped.map((entry) => entry.method)).toEqual(['dcf-fcf', 'ev-ebitda', 'ev-ebit']);
  });

  it('falls to revenue when even gross profit is negative', () => {
    const grossLoss = period({ freeCashFlow: -100, operatingIncome: -300, depreciationAmortization: 20, grossProfit: -50, revenue: 1000 });
    expect(valueCompany(inputs([grossLoss])).selected?.method).toBe('ev-sales');
  });

  it('falls to book value when the income statement is unusable throughout', () => {
    const preRevenue = period({
      revenue: 0, grossProfit: null, operatingIncome: -200, netIncome: -200,
      freeCashFlow: -180, depreciationAmortization: 5, shareholderEquity: 900,
    });
    const result = valueCompany(inputs([preRevenue]));
    expect(result.selected?.method).toBe('price-book');
    expect(result.selected?.confidence).toBe('low');
  });

  it('declines to value a company with nothing on either statement', () => {
    const empty = period({
      revenue: null, grossProfit: null, operatingIncome: null, netIncome: null,
      operatingCashFlow: null, capex: null, freeCashFlow: null,
      shareholderEquity: null, depreciationAmortization: null,
    });
    const result = valueCompany(inputs([empty]));
    expect(result.selected).toBeNull();
    expect(result.unvaluableReason).toContain('No filed figure');
  });
});

describe('normalisation across the cycle', () => {
  it('values a cyclical on its average, not on its trough year', () => {
    // Trough first, as the API orders newest-first.
    const trough = period({ fiscalYear: 2025, freeCashFlow: -50, operatingIncome: -100, depreciationAmortization: 300 });
    const mid = period({ fiscalYear: 2024, freeCashFlow: -20, operatingIncome: 100, depreciationAmortization: 300 });
    const peak = period({ fiscalYear: 2023, freeCashFlow: -10, operatingIncome: 500, depreciationAmortization: 300 });

    const result = valueCompany(inputs([trough, mid, peak]));
    expect(result.selected?.method).toBe('ev-ebitda');
    expect(result.selected?.yearsAveraged).toBe(3);

    // Average EBITDA is (200 + 400 + 800) / 3 = 466.67, not the trough's 200.
    const troughOnly = valueCompany(inputs([trough]));
    expect(result.selected!.valuePerShare).toBeGreaterThan(troughOnly.selected!.valuePerShare);
  });

  it('says so when only one year backs the figure, rather than implying an average', () => {
    const single = valueCompany(inputs([period({ freeCashFlow: -50, operatingIncome: 100, depreciationAmortization: 200 })]));
    expect(single.selected?.yearsAveraged).toBe(1);
    expect(single.selected?.basis).toContain('one year only');
  });

  it('does not average book value, which is a point-in-time balance', () => {
    const now = period({ fiscalYear: 2025, revenue: null, grossProfit: null, operatingIncome: null, freeCashFlow: null, depreciationAmortization: null, shareholderEquity: 1000 });
    const old = period({ fiscalYear: 2024, revenue: null, grossProfit: null, operatingIncome: null, freeCashFlow: null, depreciationAmortization: null, shareholderEquity: 200 });
    const result = valueCompany(inputs([now, old]));
    expect(result.selected?.method).toBe('price-book');
    expect(result.selected?.yearsAveraged).toBe(1);
    // 1.5 x 1000 / 100 shares = 15, using the latest balance sheet alone.
    expect(result.selected?.valuePerShare).toBeCloseTo(15, 5);
  });
});

describe('enterprise value arithmetic', () => {
  it('subtracts net debt, so a leveraged company is not valued as if debt-free', () => {
    const base = period({ freeCashFlow: -10, operatingIncome: 100, depreciationAmortization: 100, longTermDebt: 300, shortTermDebt: 100, cash: 200 });
    const geared = period({ ...base, longTermDebt: 1000 });

    const light = valueCompany(inputs([base])).selected!;
    const heavy = valueCompany(inputs([geared])).selected!;
    expect(heavy.valuePerShare).toBeLessThan(light.valuePerShare);

    // 8 x 200 EBITDA = 1600 EV, less (400 - 200) net debt = 1400, over 100 shares.
    expect(light.valuePerShare).toBeCloseTo(14, 5);
    expect(light.basis).toContain('net debt');
  });

  it('honours a caller-supplied multiple over the built-in assumption', () => {
    const annual = [period({ freeCashFlow: -10, operatingIncome: 100, depreciationAmortization: 100 })];
    const dflt = valueCompany(inputs(annual)).selected!;
    const peer = valueCompany(inputs(annual, { multiples: { 'ev-ebitda': 16 } })).selected!;
    expect(peer.multiple).toBe(16);
    expect(peer.valuePerShare).toBeGreaterThan(dflt.valuePerShare);
  });

  it('reports the assumed multiple so it cannot be mistaken for a measurement', () => {
    const result = valueCompany(inputs([period({ freeCashFlow: -10, operatingIncome: 100, depreciationAmortization: 100 })]));
    expect(result.selected?.multiple).toBe(8);
    expect(result.selected?.basis).toContain('8×');
  });
});

describe('corroboration and upside', () => {
  it('reports lower rungs that also produced a value, as a cross-check', () => {
    const result = valueCompany(inputs([period()]));
    expect(result.selected?.method).toBe('dcf-fcf');
    expect(result.corroborating.map((rung) => rung.method)).toEqual([
      'ev-ebitda', 'ev-ebit', 'ev-gross-profit', 'ev-sales', 'price-book',
    ]);
  });

  it('computes upside against the live price, and omits it when there is none', () => {
    const withPrice = valueCompany(inputs([period()], { price: 10 })).selected!;
    expect(withPrice.upsidePct).toBeCloseTo(((withPrice.valuePerShare - 10) / 10) * 100, 5);
    expect(valueCompany(inputs([period()], { price: null })).selected!.upsidePct).toBeNull();
  });

  it('refuses to value without a share count rather than returning a total', () => {
    const result = valueCompany(inputs([period()], { sharesOutstanding: 0 }));
    expect(result.selected).toBeNull();
    expect(result.unvaluableReason).toContain('Shares outstanding');
  });

  it('refuses to value with no filed history at all', () => {
    expect(valueCompany(inputs([])).unvaluableReason).toContain('No filed annual financials');
  });
});

describe('classification changes which instruments apply', () => {
  const healthy = (overrides: Partial<FinancialStatementPeriod> = {}) => period({
    freeCashFlow: 200, operatingIncome: 200, depreciationAmortization: 100,
    grossProfit: 400, revenue: 1000, shareholderEquity: 1000, ...overrides,
  });

  it('leaves an unclassified company exactly as it was', () => {
    const annual = [healthy()];
    const before = valueCompany(inputs(annual));
    const after = valueCompany(inputs(annual, { businessClass: 'general' }));
    expect(before.selected).toEqual(after.selected);
    expect(before.corroborating).toEqual(after.corroborating);
    expect(before.businessClass).toBe('general');
    expect(before.sectorNote).toBeNull();
  });

  it('values a bank on book value even when every other instrument would compute', () => {
    // Without the classification this lands on DCF; enterprise value is a
    // category error for a lender, not merely a less precise answer.
    const result = valueCompany(inputs([healthy()], { businessClass: 'bank' }));
    expect(result.selected?.method).toBe('price-book');
    expect(result.sectorNote).toContain('borrowing is raw material');
  });

  it('never offers a bank an enterprise-value cross-check', () => {
    const result = valueCompany(inputs([healthy()], { businessClass: 'bank' }));
    const offered = [result.selected!, ...result.corroborating].map((r) => r.method);
    expect(offered.filter((m) => m.startsWith('ev-'))).toEqual([]);
    expect(offered).not.toContain('dcf-fcf');
  });

  it('applies the same constraint to insurers and other financial institutions', () => {
    for (const cls of ['insurer', 'financial-other'] as const) {
      const result = valueCompany(inputs([healthy()], { businessClass: cls }));
      expect(result.selected?.method).toBe('price-book');
      expect(result.corroborating).toEqual([]);
    }
  });

  it('skips discounted cash flow for a REIT and uses EBITDA instead', () => {
    const result = valueCompany(inputs([healthy()], { businessClass: 'reit' }));
    expect(result.selected?.method).toBe('ev-ebitda');
    expect(result.sectorNote).toContain('funds from operations');
    expect(result.corroborating.map((r) => r.method)).not.toContain('dcf-fcf');
  });

  it('falls through to book value for a REIT whose EBITDA is unusable', () => {
    const noEbitda = healthy({ operatingIncome: -500, depreciationAmortization: 10 });
    const result = valueCompany(inputs([noEbitda], { businessClass: 'reit' }));
    expect(result.selected?.method).toBe('price-book');
    expect(result.skipped.map((s) => s.method)).toEqual(['ev-ebitda']);
  });

  it('explains a bank it cannot value in terms of the instruments a bank may use', () => {
    const noEquity = healthy({ shareholderEquity: -50 });
    const result = valueCompany(inputs([noEquity], { businessClass: 'bank' }));
    expect(result.selected).toBeNull();
    expect(result.unvaluableReason).toContain('bank or credit institution');
    expect(result.unvaluableReason).toContain('Price / Book');
    // The generic message would wrongly imply nothing in the filing is usable,
    // when in fact the usable figures are simply the wrong ones for a bank.
    expect(result.unvaluableReason).not.toContain('No filed figure');
  });

  it('reports the classification back on every result, valuable or not', () => {
    expect(valueCompany(inputs([healthy()], { businessClass: 'reit' })).businessClass).toBe('reit');
    expect(valueCompany(inputs([], { businessClass: 'bank' })).businessClass).toBe('bank');
    expect(valueCompany(inputs([], { businessClass: 'bank' })).sectorNote).toContain('bank');
  });

  it('keeps the general ladder complete — no class silently loses a rung', () => {
    const result = valueCompany(inputs([healthy()], { businessClass: 'general' }));
    const all = [result.selected!, ...result.corroborating].map((r) => r.method);
    expect(all).toEqual(['dcf-fcf', 'ev-ebitda', 'ev-ebit', 'ev-gross-profit', 'ev-sales', 'price-book']);
  });
});
