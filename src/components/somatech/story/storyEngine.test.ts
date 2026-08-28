import { describe, expect, it } from 'vitest';
import type { StockData } from '../types';
import { buildCompanyStory } from './storyEngine';

const stock = (overrides: Partial<StockData> = {}): StockData => ({
  symbol: 'TEST', companyName: 'Test Corp', price: 10, secCik: '0000123456', sector: 'Technology',
  dataSources: {
    fundamentals: { provider: 'SEC', asOf: '2025-12-31', fetchedAt: '2026-02-01T00:00:00Z' },
    quote: { provider: 'Quote', asOf: '2026-02-01', fetchedAt: '2026-02-01T00:00:00Z', freshness: 'daily' },
    chart: { provider: 'Chart' }, quoteCacheHit: false, fundamentalsCacheHit: false,
  },
  annualFinancials: [
    { fiscalYear: 2025, periodEnd: '2025-12-31', periodType: 'annual', revenue: 120, grossProfit: 60, operatingIncome: 30, netIncome: 20, operatingCashFlow: 32, capex: 7, freeCashFlow: 25, totalAssets: 100, currentAssets: 50, currentLiabilities: 20, longTermDebt: 10, shortTermDebt: 1, shareholderEquity: 60, cash: 15, sharesOutstanding: 10, provenance: { revenue: { concept: 'Revenue', accession: '0000123456-26-000001', filed: '2026-02-01', form: '10-K', classification: 'filed' } } },
    { fiscalYear: 2024, periodEnd: '2024-12-31', periodType: 'annual', revenue: 100, grossProfit: 40, operatingIncome: 20, netIncome: 15, operatingCashFlow: 25, capex: 5, freeCashFlow: 20, totalAssets: 90, currentAssets: 45, currentLiabilities: 18, longTermDebt: 12, shortTermDebt: 1, shareholderEquity: 50, cash: 12, sharesOutstanding: 10 },
  ],
  ...overrides,
});

describe('buildCompanyStory', () => {
  it('creates period-aware calculated events without claiming a cause', () => {
    const result = buildCompanyStory(stock(), '2026-02-02T00:00:00Z');
    expect(result.summary).toContain('Revenue increased 20.0%');
    expect(result.events[0].classification).toBe('calculated');
    expect(result.events[0].detail).toContain('management narrative is still required');
    expect(result.events[0].evidence[0].sourceUrl).toContain('/Archives/edgar/data/123456/');
  });

  it('formats large filed monetary values for people while retaining the exact amount', () => {
    const input = stock();
    input.annualFinancials![0].revenue = 109_417_000_000;
    input.annualFinancials![1].revenue = 94_036_000_000;
    const event = buildCompanyStory(input).events.find((item) => item.category === 'revenue')!;
    expect(event.evidence[0].value).toBe('$109.4B');
    expect(event.evidence[0].exactValue).toBe('$109,417,000,000.00');
    expect(event.evidence[1].value).toBe('$94.0B');
  });

  it('expresses margin movement in readable percentage points', () => {
    expect(buildCompanyStory(stock()).events.find((item) => item.category === 'margin')?.headline)
      .toBe('Gross margin expanded 10.0 percentage points');
  });

  it('does not manufacture change events from zero or incomplete comparatives', () => {
    const input = stock();
    input.annualFinancials![1].revenue = 0;
    input.annualFinancials![1].grossProfit = null;
    input.annualFinancials![1].freeCashFlow = null;
    expect(buildCompanyStory(input).events).toHaveLength(0);
  });

  it('states a swing rather than a percentage when a metric crosses zero', () => {
    // GOOG Q2 2026: free cash flow went from +$5.3B to -$5.9B, which the ratio
    // renders as "declined 210.5%" -- a magnitude that cannot be read.
    const input = stock();
    input.annualFinancials![0].freeCashFlow = -5_900_000_000;
    input.annualFinancials![1].freeCashFlow = 5_300_000_000;
    const event = buildCompanyStory(input).events.find((item) => item.category === 'cash-flow')!;
    expect(event.headline).toBe('Free cash flow swung from $5.3B to -$5.9B');
    expect(event.headline).not.toContain('%');
    // The ratio still carries a usable sign, so severity is unaffected.
    expect(event.direction).toBe('negative');
    expect(event.change).toBe('weakening');
  });

  it('keeps the percentage when both periods sit on the same side of zero', () => {
    const input = stock();
    input.annualFinancials![0].freeCashFlow = -12;
    input.annualFinancials![1].freeCashFlow = -10;
    const event = buildCompanyStory(input).events.find((item) => item.category === 'cash-flow')!;
    expect(event.headline).toBe('Free cash flow declined 20.0%');
    expect(event.direction).toBe('negative');
  });

  it('names the two components a free-cash-flow move is made of', () => {
    // GOOG Q2 FY2026: FCF turned negative while operating cash flow rose 40.8%,
    // because capex doubled. Without the decomposition the card reads as though
    // the business stopped generating cash.
    const input = stock({ quarterlyFinancials: [
      { fiscalYear: 2026, fiscalQuarter: 2, periodEnd: '2026-06-30', periodType: 'quarter', revenue: 119_800_000_000,
        grossProfit: null, operatingIncome: 40_800_000_000, netIncome: 28_000_000_000,
        operatingCashFlow: 39_100_000_000, capex: 44_900_000_000, freeCashFlow: -5_800_000_000,
        totalAssets: null, currentAssets: null, currentLiabilities: null, longTermDebt: null,
        shortTermDebt: null, shareholderEquity: null, cash: null, sharesOutstanding: null },
      { fiscalYear: 2025, fiscalQuarter: 2, periodEnd: '2025-06-30', periodType: 'quarter', revenue: 96_400_000_000,
        grossProfit: null, operatingIncome: 31_300_000_000, netIncome: 28_200_000_000,
        operatingCashFlow: 27_800_000_000, capex: 22_400_000_000, freeCashFlow: 5_400_000_000,
        totalAssets: null, currentAssets: null, currentLiabilities: null, longTermDebt: null,
        shortTermDebt: null, shareholderEquity: null, cash: null, sharesOutstanding: null },
    ] });
    const event = buildCompanyStory(input).events.find((item) => item.category === 'cash-flow')!;

    expect(event.headline).toBe('Free cash flow swung from $5.4B to -$5.8B');
    expect(event.detail).toContain('Operating cash flow rose 40.6% to $39.1B');
    expect(event.detail).toContain('capital expenditure rose 100.4% to $44.9B');
    // The arithmetic is filed; the reason for it is not, and must not appear.
    expect(event.detail).toContain('management narrative is still required');
    expect(event.evidence.map((item) => item.label)).toContain('Operating cash flow, current');
  });

  it('falls back to the plain headline when a component is unavailable', () => {
    const input = stock({ quarterlyFinancials: [
      { fiscalYear: 2026, fiscalQuarter: 2, periodEnd: '2026-06-30', periodType: 'quarter', revenue: 120, grossProfit: 50,
        operatingIncome: 20, netIncome: 15, operatingCashFlow: null, capex: null, freeCashFlow: -10,
        totalAssets: null, currentAssets: null, currentLiabilities: null, longTermDebt: null,
        shortTermDebt: null, shareholderEquity: null, cash: null, sharesOutstanding: null },
      { fiscalYear: 2025, fiscalQuarter: 2, periodEnd: '2025-06-30', periodType: 'quarter', revenue: 100, grossProfit: 40,
        operatingIncome: 15, netIncome: 12, operatingCashFlow: null, capex: null, freeCashFlow: 20,
        totalAssets: null, currentAssets: null, currentLiabilities: null, longTermDebt: null,
        shortTermDebt: null, shareholderEquity: null, cash: null, sharesOutstanding: null },
    ] });
    const event = buildCompanyStory(input).events.find((item) => item.category === 'cash-flow')!;
    expect(event.headline).toContain('swung from');
    expect(event.detail).not.toContain('Operating cash flow');
  });

  it('labels profile catalysts as typical rather than confirmed', () => {
    const result = buildCompanyStory(stock());
    expect(result.catalysts.some((item) => item.id === 'product-cycle')).toBe(true);
    expect(result.catalysts.every((item) => item.status === 'typical' && item.classification === 'typical')).toBe(true);
  });

  it('prefers the same fiscal quarter from the prior year over a seasonal sequential comparison', () => {
    const input = stock({ quarterlyFinancials: [
      { fiscalYear: 2026, fiscalQuarter: 2, periodEnd: '2026-06-30', periodType: 'quarter', revenue: 75, grossProfit: 30, operatingIncome: 12, netIncome: 9, operatingCashFlow: 14, capex: 4, freeCashFlow: 10, totalAssets: null, currentAssets: null, currentLiabilities: null, longTermDebt: null, shortTermDebt: null, shareholderEquity: null, cash: null, sharesOutstanding: null },
      { fiscalYear: 2026, fiscalQuarter: 1, periodEnd: '2026-03-31', periodType: 'quarter', revenue: 200, grossProfit: 80, operatingIncome: 30, netIncome: 20, operatingCashFlow: 20, capex: 5, freeCashFlow: 15, totalAssets: null, currentAssets: null, currentLiabilities: null, longTermDebt: null, shortTermDebt: null, shareholderEquity: null, cash: null, sharesOutstanding: null },
      { fiscalYear: 2025, fiscalQuarter: 2, periodEnd: '2025-06-30', periodType: 'quarter', revenue: 50, grossProfit: 20, operatingIncome: 8, netIncome: 6, operatingCashFlow: 10, capex: 3, freeCashFlow: 7, totalAssets: null, currentAssets: null, currentLiabilities: null, longTermDebt: null, shortTermDebt: null, shareholderEquity: null, cash: null, sharesOutstanding: null },
    ] });
    const result = buildCompanyStory(input);
    expect(result.reportingPeriod).toBe('2026-06-30');
    expect(result.events[0].headline).toContain('50.0%');
  });
});
