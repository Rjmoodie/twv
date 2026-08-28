import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, MapPin, Calendar, Landmark, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import type { StockData } from "./types";

interface CompanySnapshotProps {
  ticker: string;
  stockData?: StockData | null;
}

const CompanySnapshot = ({ ticker, stockData }: CompanySnapshotProps) => {
  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${value.toLocaleString()}`;
  };

  const formatPercent = (value: number) => {
    if (!isFinite(value) || isNaN(value)) return 'N/A';
    const formatted = Math.abs(value).toFixed(2);
    return value >= 0 ? `+${formatted}%` : `-${formatted}%`;
  };

  const companyData = {
    name: stockData?.companyName || ticker,
    sector: stockData?.sector || "Not supplied by current sources",
    industry: stockData?.industry || "Not supplied by current sources",
    marketCap: stockData?.marketCap != null ? formatCurrency(stockData.marketCap) : "N/A",
    exchange: stockData?.exchange || "Exchange unavailable",
    description: stockData?.description || "No description available",
    week52High: stockData?.week52High != null ? `$${stockData.week52High.toFixed(2)}` : "N/A",
    week52Low: stockData?.week52Low != null ? `$${stockData.week52Low.toFixed(2)}` : "N/A",
    currentPrice: stockData?.price != null ? `$${stockData.price.toFixed(2)}` : "N/A",
    priceChange: stockData?.priceChangePercent != null ? formatPercent(stockData.priceChangePercent) : "N/A",
    peRatio: stockData?.pe != null ? `${stockData.pe.toFixed(1)}x` : "N/A",
    dividendYield: stockData?.dividendYield != null ? `${(stockData.dividendYield * 100).toFixed(2)}%` : "N/A",
    ma50: stockData?.technicals?.ma50 ? `$${stockData.technicals.ma50.toFixed(2)}` : "N/A",
    ma200: stockData?.technicals?.ma200 ? `$${stockData.technicals.ma200.toFixed(2)}` : "N/A",
    beta: stockData?.beta != null ? stockData.beta.toFixed(2) : "N/A",
    volume: stockData?.volume != null ? stockData.volume.toLocaleString() : "N/A",
    open: stockData?.open != null ? `$${stockData.open.toFixed(2)}` : "N/A",
    dayRange: stockData?.low != null && stockData?.high != null ? `$${stockData.low.toFixed(2)} – $${stockData.high.toFixed(2)}` : "N/A",
    previousClose: stockData?.previousClose != null ? `$${stockData.previousClose.toFixed(2)}` : "N/A",
    headquarters: stockData?.headquarters || "Not reported",
    fiscalYearEnd: stockData?.fiscalYearEnd || "Not reported",
    latestQuarter: stockData?.latestQuarter || "Not reported",
  };
  const priceChangeKnown = companyData.priceChange !== 'N/A';
  const priceChangeUp = companyData.priceChange.startsWith('+');

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Building2 className="h-5 w-5 text-primary" />
          {ticker} — Company Overview
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Core company information and market performance metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Company Identity */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Company Identity</h4>
            <div className="space-y-3">
              <div>
                <div className="text-lg font-semibold">{companyData.name}</div>
                <div className="text-sm text-muted-foreground">{ticker} • {companyData.exchange}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Sector & Industry</div>
                <div className="text-sm text-muted-foreground">{companyData.sector} • {companyData.industry}</div>
              </div>
              <div>
                <div className="text-sm font-medium">Market Cap</div>
                <div className="text-sm text-muted-foreground">{companyData.marketCap}</div>
              </div>
            </div>
          </div>

          {/* Company Details */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Company Details</h4>
            <div className="space-y-3">
              <div className="flex items-start space-x-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Business address</div>
                  <div className="text-sm text-muted-foreground">{companyData.headquarters}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Fiscal year end</div>
                  <div className="text-sm text-muted-foreground">{companyData.fiscalYearEnd}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Latest reported quarter</div>
                  <div className="text-sm text-muted-foreground">{companyData.latestQuarter}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Market Performance */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Market Performance</span>
            </h4>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg border border-border">
                <div className="text-sm font-medium text-muted-foreground mb-2">Latest Daily Close</div>
                <div className="flex items-center space-x-3">
                  <span className="text-2xl font-bold text-foreground">{companyData.currentPrice}</span>
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-sm font-medium ${
                    !priceChangeKnown
                      ? 'bg-muted text-muted-foreground'
                      : priceChangeUp
                        ? 'bg-accent/10 text-accent dark:bg-accent/10 dark:text-accent'
                        : 'bg-destructive/10 text-destructive dark:bg-destructive/10 dark:text-destructive'
                  }`}>
                    {!priceChangeKnown ? (
                      <Minus className="h-3 w-3" />
                    ) : priceChangeUp ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span>{companyData.priceChange}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm font-medium text-muted-foreground mb-2">52-Week Range</div>
                <div className="text-sm text-foreground">{companyData.week52Low} - {companyData.week52High}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground mb-1">50-Day MA</div>
                  <div className="text-sm font-semibold text-foreground">{companyData.ma50}</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground mb-1">200-Day MA</div>
                  <div className="text-sm font-semibold text-foreground">{companyData.ma200}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Open</div>
                  <div className="text-sm font-semibold text-foreground">{companyData.open}</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Day Range</div>
                  <div className="text-sm font-semibold text-foreground">{companyData.dayRange}</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Prior Close</div>
                  <div className="text-sm font-semibold text-foreground">{companyData.previousClose}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground mb-1">P/E Ratio</div>
                  <div className="text-sm font-semibold text-foreground">{companyData.peRatio}</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Dividend Yield</div>
                  <div className="text-sm font-semibold text-foreground">{companyData.dividendYield}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Beta</div>
                  <div className="text-sm font-semibold text-foreground">{companyData.beta}</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Daily Volume</div>
                  <div className="text-sm font-semibold text-foreground">{companyData.volume}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {stockData?.description && (
          <div className="mt-6 border-t pt-4">
            <p className="text-sm font-medium">Business description</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{stockData.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanySnapshot;
