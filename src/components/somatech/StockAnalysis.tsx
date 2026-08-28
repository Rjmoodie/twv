import StockInputSection from "./stock-analysis/StockInputSection";
import StockAnalysisContent from "./stock-analysis/StockAnalysisContent";
import FinancialDisclaimer from "./FinancialDisclaimer";
import PublishResearchDialog from "./stock-analysis/PublishResearchDialog";

interface StockAnalysisProps {
  globalTicker?: string;
  setGlobalTicker: (ticker: string) => void;
  onRequestAuth?: () => void;
}

const StockAnalysis = ({ globalTicker, setGlobalTicker, onRequestAuth }: StockAnalysisProps) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      <StockInputSection
        globalTicker={globalTicker}
        setGlobalTicker={setGlobalTicker}
      />
      <StockAnalysisContent globalTicker={globalTicker} />
      <div className="flex justify-end"><PublishResearchDialog onRequestAuth={onRequestAuth} /></div>
      <FinancialDisclaimer compact variant="research" />
    </div>
  );
};

export default StockAnalysis;
