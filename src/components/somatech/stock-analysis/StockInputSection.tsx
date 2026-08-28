import { useStockData } from "./StockDataProvider";
import StockTickerInput from "../StockTickerInput";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface StockInputSectionProps {
  globalTicker?: string;
  setGlobalTicker: (ticker: string) => void;
}

const StockInputSection = ({ globalTicker, setGlobalTicker }: StockInputSectionProps) => {
  const { analyzeStock, clearAnalysis, loading, stockData } = useStockData();
  const needsMetricRefresh = Boolean(
    stockData && !stockData.dataSources?.fundamentals.provider.includes("Alpha Vantage Overview")
  );

  return (
    <div>
      <StockTickerInput 
        globalTicker={globalTicker}
        setGlobalTicker={setGlobalTicker}
        onAnalyze={analyzeStock}
        loading={loading}
      />
      {stockData && (
        <div className={`mt-3 flex items-center justify-between rounded-lg border px-3 py-2 ${needsMetricRefresh ? "border-amber-500/40 bg-amber-500/10" : "border-border/60 bg-muted/30"}`}>
          <div>
            <p className="text-xs text-muted-foreground">
              Showing saved analysis for <span className="font-mono font-medium text-foreground">{stockData.symbol}</span>
            </p>
            {needsMetricRefresh && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">This saved result predates the expanded metric set. Select Analyze to refresh it; it will not be cleared automatically.</p>}
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={clearAnalysis} disabled={loading} className="shrink-0">
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />Clear analysis
          </Button>
        </div>
      )}
    </div>
  );
};

export default StockInputSection;
