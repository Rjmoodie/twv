import { describe, expect, it } from "vitest";
import { mapStockAnalysisResponse, type StockAnalysisResponse } from "./stockAnalysisMapper";

const response: StockAnalysisResponse = {
  ticker: "TEST",
  cik: "0000000001",
  companyName: "Test Company",
  fundamentals: {
    annual: [{
      fiscalYear: 2025,
      periodEnd: "2025-12-31",
      revenue: 1_000,
      grossProfit: 400,
      operatingIncome: 200,
      netIncome: 100,
      operatingCashFlow: 150,
      capex: 50,
      freeCashFlow: 100,
      totalAssets: 2_000,
      currentAssets: 600,
      currentLiabilities: 300,
      longTermDebt: 200,
      shortTermDebt: 50,
      shareholderEquity: 500,
      cash: 150,
      sharesOutstanding: 50,
    }],
    profile: {
      exchange: "NASDAQ", sector: "Technology", industry: "Software", description: "Test description",
      address: "1 Test Way", fiscalYearEnd: "December", latestQuarter: "2025-09-30",
      marketCapitalization: 1_100, ebitda: 250, trailingPE: 11, forwardPE: 9, pegRatio: 1.2,
      bookValuePerShare: 10, dividendPerShare: 0.5, dividendYield: 0.025, epsTTM: 2,
      revenueTTM: 1_100, profitMarginTTM: 0.1, operatingMarginTTM: 0.2,
      returnOnAssetsTTM: 0.05, returnOnEquityTTM: 0.22, quarterlyEarningsGrowthYOY: 0.12,
      quarterlyRevenueGrowthYOY: 0.08, analystTargetPrice: 25, priceToSalesTTM: 1,
      priceToBook: 2.2, evToRevenue: 1.1, evToEbitda: 4.4, beta: 1.1,
      week52High: 24, week52Low: 12, ma50: 19, ma200: 17, sharesOutstanding: 55,
      dividendDate: "2026-09-01", exDividendDate: "2026-08-10", overviewAvailable: true,
      fetchedAt: "2026-08-24T03:00:00Z",
    },
  },
  quote: {
    price: 20,
    open: 19,
    high: 21,
    low: 18,
    volume: 1_000,
    latestTradingDay: "2026-08-21",
    previousClose: 19,
    change: 1,
    changePercent: 5.26,
    fetchedAt: "2026-08-24T03:00:00Z",
  },
  cache: { quoteHit: true, fundamentalsHit: true },
  sources: {
    fundamentals: { provider: "SEC EDGAR Company Facts", asOf: "2025-12-31" },
    quote: { provider: "Alpha Vantage Global Quote", asOf: "2026-08-21", fetchedAt: "2026-08-24T03:00:00Z", freshness: "not real-time" },
    chart: { provider: "TradingView" },
  },
};

describe("mapStockAnalysisResponse", () => {
  it("derives ratios deterministically from sourced facts", () => {
    const stock = mapStockAnalysisResponse(response);
    expect(stock.marketCap).toBe(1_100);
    expect(stock.eps).toBe(2);
    expect(stock.pe).toBe(10);
    expect(stock.pbv).toBe(2);
    expect(stock.roe).toBe(0.22);
    expect(stock.debtToEquity).toBe(0.5);
    expect(stock.currentRatio).toBe(2);
    expect(stock.ratios?.grossMargin).toBe(40);
    expect(stock.ratios?.operatingMargin).toBe(20);
    expect(stock.dataSources?.quoteCacheHit).toBe(true);
    expect(stock.exchange).toBe("NASDAQ");
    expect(stock.week52High).toBe(24);
    expect(stock.technicals?.ma200).toBe(17);
    expect(stock.evToEbitda).toBe(4.4);
  });

  it("refuses incomplete provider data instead of generating demo values", () => {
    expect(() => mapStockAnalysisResponse({
      ...response,
      fundamentals: { annual: [] },
    })).toThrow("usable quote and annual filing");
  });

  it("keeps unavailable ratios absent instead of turning them into zero", () => {
    const stock = mapStockAnalysisResponse({
      ...response,
      fundamentals: {
        annual: [{ ...response.fundamentals.annual[0], currentAssets: null, currentLiabilities: null, shareholderEquity: null, longTermDebt: null }],
      },
    });
    expect(stock.currentRatio).toBeUndefined();
    expect(stock.roe).toBeUndefined();
    expect(stock.pbv).toBeUndefined();
    expect(stock.debtToEquity).toBeUndefined();
    expect(stock.financials?.totalDebt).toBe("");
  });

  it("keeps an unavailable quote change unknown instead of fabricating a flat session", () => {
    const stock = mapStockAnalysisResponse({
      ...response,
      quote: { ...response.quote, change: null, changePercent: null },
    });
    expect(stock.change).toBeUndefined();
    expect(stock.changePercent).toBeUndefined();
    expect(stock.priceChangePercent).toBeUndefined();
  });
});
