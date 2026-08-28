import { useStockData } from "./StockDataProvider";
import CompanySnapshot from "../CompanySnapshot";
import FinancialStatements from "../FinancialStatements";
import TradingViewChart from "../TradingViewChart";
import BusinessBenchmarks from "../BusinessBenchmarks";
import DCFAnalysis from "../DCFAnalysis";
import PeerComps from "./PeerComps";
import InvestmentThesisGenerator from "../InvestmentThesisGenerator";
import ExportActions from "../ExportActions";
import ValuedMetricsSection from "../ValuedMetricsSection";
import DataSourceTag from "../DataSourceTag";
import { SOURCE_NAMES } from "@/lib/provenance";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Database, Clock3 } from "lucide-react";
import CompanyStoryPanel from "../story/CompanyStoryPanel";
import InstitutionalOwnershipCard from "./InstitutionalOwnershipCard";
import CompanyNewsPanel from "./CompanyNewsPanel";

interface StockAnalysisContentProps {
  globalTicker: string;
}

const StockAnalysisContent = ({ globalTicker }: StockAnalysisContentProps) => {
  const { 
    stockData, 
    dcfScenarios, 
    setDcfScenarios, 
    investmentThesis, 
    setInvestmentThesis 
  } = useStockData();

  if (!stockData) return null;
  const analyzedTicker = stockData.symbol || globalTicker;
  const sourceInfo = stockData.dataSources;
  const percent = (value: number | undefined) => value != null && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "Not reported";
  const multiple = (value: number | undefined) => value != null && Number.isFinite(value) ? `${value.toFixed(2)}x` : "Not reported";
  const money = (value: number | undefined) => value != null && Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value)
    : "Not reported";

  // Build companyMetrics object from stockData
  const companyMetrics: Record<string, string> = {
    "Market capitalization": money(stockData.marketCap),
    "Trailing P/E": multiple(stockData.pe),
    "Forward P/E": multiple(stockData.forwardPE),
    "Price / sales (TTM)": multiple(stockData.priceToSales),
    "Price / book": multiple(stockData.pbv),
    "EV / EBITDA": multiple(stockData.evToEbitda),
    "Return on equity (TTM)": percent(stockData.roe),
    "Return on assets (TTM)": percent(stockData.returnOnAssetsTTM),
    "Operating margin (TTM)": percent(stockData.operatingMarginTTM),
    "Profit margin (TTM)": percent(stockData.profitMarginTTM),
    "Revenue growth (YoY quarter)": percent(stockData.quarterlyRevenueGrowthYOY),
    "Earnings growth (YoY quarter)": percent(stockData.quarterlyEarningsGrowthYOY),
    "Debt / equity (latest FY)": multiple(stockData.debtToEquity),
    "Current ratio (latest FY)": multiple(stockData.currentRatio),
    "Dividend yield": percent(stockData.dividendYield),
    "Beta": stockData.beta != null ? stockData.beta.toFixed(2) : "Not reported",
  };

  // changePercent is optional. Deriving it once, guarded, avoids the previous
  // split where the colour test was unguarded (`undefined >= 0` → false → red)
  // while the printed number fell back to 0 — so a missing value rendered as
  // "+0.00%" in destructive red.
  const changePct = Number.isFinite(stockData.changePercent) ? stockData.changePercent as number : null;
  const changeUp = (changePct ?? 0) >= 0;
  const highlightMetrics = [
    {
      label: "Market capitalization",
      value: money(stockData.marketCap),
      helper: SOURCE_NAMES.marketVendor,
      kind: "market" as const,
    },
    {
      label: "Volatility",
      value: stockData.beta != null ? `${stockData.beta.toFixed(2)} β` : "—",
      helper: "Beta vs. S&P 500",
      kind: "market" as const,
    },
    {
      label: "Earnings yield",
      value: stockData.pe && stockData.pe > 0 ? `${(1 / stockData.pe * 100).toFixed(1)}%` : "—",
      helper: "Inverse of trailing P/E",
      kind: "model" as const,
    },
    {
      label: "Dividend yield",
      value: stockData.dividendYield != null ? `${(stockData.dividendYield * 100).toFixed(2)}%` : "—",
      helper: "Forward, annualised",
      kind: "market" as const,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
        {sourceInfo && (
          <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5" />
                <DataSourceTag kind="filed" note={sourceInfo.fundamentals.asOf ?? undefined} />
                {sourceInfo.fundamentals.provider} · filing {sourceInfo.fundamentals.asOf ?? "date unavailable"}
              </span>
              <span className="flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5" />
                <DataSourceTag kind="market" />
                {sourceInfo.quote.provider} · as of {sourceInfo.quote.asOf ?? sourceInfo.quote.fetchedAt}
                {sourceInfo.quoteCacheHit ? " · cached" : " · refreshed"}
              </span>
            </div>
            <p className="mt-2">
              {sourceInfo.quote.freshness}. Statements come from {SOURCE_NAMES.filingsFull} and update when the company files;
              the quote and trailing-market metrics come from {SOURCE_NAMES.marketVendor} and refresh independently.
              Chart data is provided by {sourceInfo.chart.provider}.
            </p>
          </div>
        )}
        <div className="rounded-2xl border border-border/60 bg-card">
          <div className="flex flex-col gap-4 p-4 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {/* Was "Intraday sentiment" with a Bullish/Bearish badge derived
                    from a single day's price change. One day's move is not
                    sentiment, and stating it that confidently is the kind of
                    overclaim that costs a reader's trust in every other number
                    on the page. Say what it actually is. */}
                <p className="text-xs text-muted-foreground">Last close</p>
                <h3 className="text-xl font-semibold text-foreground">{stockData.name || analyzedTicker}</h3>
              </div>
              {changePct != null && (
                <Badge variant="outline" className="w-fit gap-1.5 text-xs font-normal tabular-nums">
                  <span className={changeUp ? 'text-accent' : 'text-destructive'}>
                    {changeUp ? '▲' : '▼'} {changeUp ? '+' : ''}{changePct.toFixed(2)}%
                  </span>
                  <span className="text-muted-foreground">latest session</span>
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {highlightMetrics.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-border/40 bg-background/70 p-3 sm:p-4">
                  <p className="text-[10px] text-muted-foreground leading-tight">{metric.label}</p>
                  <p className="text-base sm:text-lg font-semibold text-foreground mt-0.5 tabular-nums">{metric.value}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[10px] leading-tight text-muted-foreground">
                    <DataSourceTag kind={metric.kind} />
                    <span className="truncate">{metric.helper}</span>
                  </p>
                </div>
              ))}
            </div>
            {/* Was a "Momentum score" bar computed as min(|changePercent| x 5, 100).
                Taking the absolute value meant a -10% day and a +10% day drew an
                identical bar, so the one thing a momentum indicator must convey
                — direction — was discarded. There is no momentum model behind
                this, only today's move, so show the 52-week position instead:
                a real, sourced range the number can be read against. */}
            {stockData.week52Low != null && stockData.week52High != null && stockData.week52High > stockData.week52Low && (
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    52-week range
                    <DataSourceTag kind="market" />
                  </span>
                  <span className="tabular-nums">
                    {money(stockData.week52Low)} – {money(stockData.week52High)}
                  </span>
                </div>
                <Progress
                  value={Math.min(Math.max(
                    ((stockData.price - stockData.week52Low) / (stockData.week52High - stockData.week52Low)) * 100,
                    0), 100)}
                  className="mt-2 h-1.5"
                />
                <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                  Last {money(stockData.price)}
                </p>
              </div>
            )}
          </div>
        </div>
        <CompanySnapshot ticker={analyzedTicker} stockData={stockData} />
        <CompanyNewsPanel ticker={analyzedTicker} />
        <InstitutionalOwnershipCard ticker={analyzedTicker} />
        <ValuedMetricsSection sector={stockData.sector || "Unknown"} companyMetrics={companyMetrics} />
        <FinancialStatements ticker={analyzedTicker} stockData={stockData} />
        <CompanyStoryPanel stockData={stockData} />
        <TradingViewChart ticker={analyzedTicker} />
        <BusinessBenchmarks ticker={analyzedTicker} stockData={stockData} />
        <DCFAnalysis
          ticker={analyzedTicker}
          dcfScenarios={dcfScenarios}
          setDcfScenarios={setDcfScenarios}
          stockData={stockData}
        />
        <PeerComps ticker={analyzedTicker} stockData={stockData} />
        <InvestmentThesisGenerator
          ticker={analyzedTicker}
          investmentThesis={investmentThesis}
          setInvestmentThesis={setInvestmentThesis}
        />
        <ExportActions
          ticker={analyzedTicker}
          stockData={stockData}
          dcfScenarios={dcfScenarios}
          investmentThesis={investmentThesis}
        />
    </div>
  );
};

export default StockAnalysisContent;
