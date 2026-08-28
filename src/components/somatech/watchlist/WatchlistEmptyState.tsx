import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

interface WatchlistEmptyStateProps {
  onAnalyzeStocks: () => void;
}

/**
 * Empty state component for when watchlist has no items
 */
export const WatchlistEmptyState = ({ onAnalyzeStocks }: WatchlistEmptyStateProps) => {
  return (
    <div className="text-center py-14 space-y-5">
      <div className="w-14 h-14 bg-muted rounded-lg border border-border flex items-center justify-center mx-auto">
        <Star className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold text-foreground">
          Your watchlist is empty
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Track stocks with DCF analysis, price targets, and ratings. Start by analyzing a ticker.
        </p>
      </div>

      <button
        onClick={onAnalyzeStocks}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
      >
        <Star className="h-4 w-4" />
        Analyze your first stock
      </button>

      <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto pt-4 border-t border-border">
        {[
          { label: "Intrinsic Value", abbr: "DCF" },
          { label: "Upside/Downside", abbr: "%" },
          { label: "Score & Rating", abbr: "★" },
        ].map(({ label, abbr }) => (
          <div key={label} className="text-center">
            <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center mx-auto mb-1.5">
              <span className="text-muted-foreground font-medium text-xs">{abbr}</span>
            </div>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};