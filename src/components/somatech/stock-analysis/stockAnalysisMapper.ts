import type { StockData } from "../types";

export interface StockAnalysisResponse {
  ticker: string;
  cik: string;
  companyName: string;
  fundamentals: {
    annual: NonNullable<StockData["annualFinancials"]>;
    quarterly?: NonNullable<StockData["quarterlyFinancials"]>;
    profile?: {
      sic?: string | null; sicDescription?: string | null;
      exchange: string | null; currency?: string | null; sector: string | null; industry: string | null; description: string | null;
      address: string | null; fiscalYearEnd: string | null; latestQuarter: string | null;
      marketCapitalization: number | null; ebitda: number | null; trailingPE: number | null;
      forwardPE: number | null; pegRatio: number | null; bookValuePerShare: number | null;
      dividendPerShare: number | null; dividendYield: number | null; epsTTM: number | null;
      revenueTTM: number | null; profitMarginTTM: number | null; operatingMarginTTM: number | null;
      returnOnAssetsTTM: number | null; returnOnEquityTTM: number | null;
      quarterlyEarningsGrowthYOY: number | null; quarterlyRevenueGrowthYOY: number | null;
      analystTargetPrice: number | null; priceToSalesTTM: number | null; priceToBook: number | null;
      evToRevenue: number | null; evToEbitda: number | null; beta: number | null;
      week52High: number | null; week52Low: number | null; ma50: number | null; ma200: number | null;
      sharesOutstanding: number | null; dividendDate: string | null; exDividendDate: string | null;
      overviewAvailable: boolean; fetchedAt: string;
    };
  };
  quote: {
    price: number;
    open: number | null;
    high: number | null;
    low: number | null;
    volume: number | null;
    latestTradingDay: string | null;
    previousClose: number | null;
    change: number | null;
    changePercent: number | null;
    fetchedAt: string;
  };
  cache: { quoteHit: boolean; fundamentalsHit: boolean; quoteStale?: boolean; fundamentalsStale?: boolean };
  sources: {
    fundamentals: { provider: string; asOf: string | null; fetchedAt?: string; stale?: boolean };
    quote: { provider: string; asOf: string | null; fetchedAt: string; freshness: string; stale?: boolean };
    chart: { provider: string };
  };
}

const ratio = (numerator: number | null | undefined, denominator: number | null | undefined) =>
  numerator != null && Number.isFinite(numerator) && denominator != null && Number.isFinite(denominator) && denominator > 0
    ? numerator / denominator
    : undefined;

const positive = (value: number | null | undefined) =>
  value != null && Number.isFinite(value) && value > 0 ? value : undefined;

export function mapStockAnalysisResponse(payload: StockAnalysisResponse): StockData {
  const latest = payload.fundamentals.annual[0];
  const profile = payload.fundamentals.profile;
  if (!latest || !Number.isFinite(payload.quote.price) || payload.quote.price <= 0) {
    throw new Error("The provider response did not include a usable quote and annual filing");
  }

  const totalDebt = latest.longTermDebt != null && Number.isFinite(latest.longTermDebt) && latest.shortTermDebt != null && Number.isFinite(latest.shortTermDebt)
    ? latest.longTermDebt + latest.shortTermDebt
    : undefined;
  const shares = positive(profile?.sharesOutstanding) ?? positive(latest.sharesOutstanding);
  const derivedMarketCap = shares ? shares * payload.quote.price : undefined;
  const marketCap = derivedMarketCap ?? positive(profile?.marketCapitalization);
  const annualEps = ratio(latest.netIncome, latest.sharesOutstanding);
  const eps = positive(profile?.epsTTM) ?? annualEps;
  const pe = eps && eps > 0 ? payload.quote.price / eps : positive(profile?.trailingPE);
  const pbv = positive(profile?.bookValuePerShare)
    ? payload.quote.price / profile!.bookValuePerShare!
    : positive(profile?.priceToBook) ?? (marketCap ? ratio(marketCap, latest.shareholderEquity) : undefined);
  const priceToSales = marketCap && positive(profile?.revenueTTM)
    ? marketCap / profile!.revenueTTM!
    : positive(profile?.priceToSalesTTM);
  const dividendYield = positive(profile?.dividendPerShare)
    ? profile!.dividendPerShare! / payload.quote.price
    : profile?.dividendYield ?? undefined;
  const roe = profile?.returnOnEquityTTM ?? ratio(latest.netIncome, latest.shareholderEquity);
  const debtToEquity = ratio(totalDebt, latest.shareholderEquity);
  const currentRatio = ratio(latest.currentAssets, latest.currentLiabilities);
  const grossMarginRatio = ratio(latest.grossProfit, latest.revenue);
  const operatingMarginRatio = profile?.operatingMarginTTM ?? ratio(latest.operatingIncome, latest.revenue);

  return {
    secCik: payload.cik,
    symbol: payload.ticker,
    name: payload.companyName,
    companyName: payload.companyName,
    price: payload.quote.price,
    change: payload.quote.change ?? undefined,
    changePercent: payload.quote.changePercent ?? undefined,
    priceChange: payload.quote.change ?? undefined,
    priceChangePercent: payload.quote.changePercent ?? undefined,
    volume: payload.quote.volume ?? undefined,
    high: payload.quote.high ?? undefined,
    low: payload.quote.low ?? undefined,
    open: payload.quote.open ?? undefined,
    previousClose: payload.quote.previousClose ?? undefined,
    marketCap,
    pe,
    pbv,
    eps,
    roe,
    debtToEquity,
    currentRatio,
    exchange: profile?.exchange ?? undefined,
    currency: profile?.currency ?? undefined,
    sector: profile?.sector ?? undefined,
    industry: profile?.industry ?? undefined,
    // Filed with the SEC rather than assigned by a data vendor, and the input the
    // valuation ladder uses to decide which instruments are appropriate.
    sic: profile?.sic ?? undefined,
    sicDescription: profile?.sicDescription ?? undefined,
    description: profile?.description ?? undefined,
    headquarters: profile?.address ?? undefined,
    fiscalYearEnd: profile?.fiscalYearEnd ?? undefined,
    latestQuarter: profile?.latestQuarter ?? undefined,
    week52High: positive(profile?.week52High),
    week52Low: positive(profile?.week52Low),
    dividendYield,
    dividend: profile?.dividendPerShare ?? undefined,
    dividendPerShare: profile?.dividendPerShare ?? undefined,
    beta: profile?.beta ?? undefined,
    forwardPE: positive(profile?.forwardPE),
    pegRatio: positive(profile?.pegRatio),
    priceToSales,
    evToRevenue: positive(profile?.evToRevenue),
    evToEbitda: positive(profile?.evToEbitda),
    ebitda: positive(profile?.ebitda),
    revenueTTM: positive(profile?.revenueTTM),
    profitMarginTTM: profile?.profitMarginTTM ?? undefined,
    operatingMarginTTM: profile?.operatingMarginTTM ?? undefined,
    returnOnAssetsTTM: profile?.returnOnAssetsTTM ?? undefined,
    quarterlyEarningsGrowthYOY: profile?.quarterlyEarningsGrowthYOY ?? undefined,
    quarterlyRevenueGrowthYOY: profile?.quarterlyRevenueGrowthYOY ?? undefined,
    analystTargetPrice: positive(profile?.analystTargetPrice),
    dividendDate: profile?.dividendDate ?? undefined,
    exDividendDate: profile?.exDividendDate ?? undefined,
    technicals: profile ? {
      trend: profile.ma50 && profile.ma200 ? (profile.ma50 >= profile.ma200 ? "Above long-term trend" : "Below long-term trend") : "Unavailable",
      ma50: profile.ma50 ?? 0,
      ma200: profile.ma200 ?? 0,
      rsi: 0,
      macd: "Unavailable",
    } : undefined,
    ratios: {
      quickRatio: ratio(latest.cash, latest.currentLiabilities),
      assetTurnover: ratio(latest.revenue, latest.totalAssets),
      grossMargin: grossMarginRatio != null ? grossMarginRatio * 100 : undefined,
      operatingMargin: operatingMarginRatio != null ? operatingMarginRatio * 100 : undefined,
    },
    financials: {
      revenue: String(latest.revenue ?? ""),
      netIncome: String(latest.netIncome ?? ""),
      freeCashFlow: String(latest.freeCashFlow ?? ""),
      sharesOutstanding: String(shares ?? ""),
      totalAssets: String(latest.totalAssets ?? ""),
      totalDebt: String(totalDebt ?? ""),
      shareholderEquity: String(latest.shareholderEquity ?? ""),
    },
    annualFinancials: payload.fundamentals.annual,
    quarterlyFinancials: payload.fundamentals.quarterly ?? [],
    lastUpdated: payload.quote.fetchedAt,
    dataSources: {
      ...payload.sources,
      quoteCacheHit: payload.cache.quoteHit,
      fundamentalsCacheHit: payload.cache.fundamentalsHit,
    },
  };
}
