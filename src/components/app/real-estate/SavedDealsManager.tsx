import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { SavedDeal } from "./brrrrCalculations";
import { formatCurrency, formatPercentage } from "./realEstateUtils";
import { DealComparison } from "./DealComparison";
import { cn } from "@/lib/utils";

interface SavedDealsManagerProps {
  savedDeals: SavedDeal[];
  onLoadDeal: (deal: SavedDeal) => void;
  onSwitchToCalculator?: () => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function roiLabel(roi: number): { label: string; cls: string } {
  if (roi >= 15) return { label: "Excellent",    cls: "text-accent" };
  if (roi >= 10) return { label: "Good",         cls: "text-primary" };
  if (roi >= 5)  return { label: "Fair",         cls: "text-warning" };
  return             { label: "Below target",  cls: "text-destructive" };
}

export const SavedDealsManager = ({
  savedDeals,
  onLoadDeal,
  onSwitchToCalculator,
  isLoading = false,
  error = null,
  onRetry,
}: SavedDealsManagerProps) => {
  if (isLoading) {
    return <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading saved deals…</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-10 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
        <p className="mt-3 text-sm font-semibold">Saved deals could not be loaded</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">Your saved data has not been removed. Check your connection and try again.</p>
        {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Saved deals</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {savedDeals.length > 0 ? `${savedDeals.length} deal${savedDeals.length > 1 ? 's' : ''} saved` : "No deals saved yet"}
          </p>
        </div>
        {savedDeals.length > 0 && <DealComparison savedDeals={savedDeals} />}
      </div>

      {savedDeals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 px-5 py-10 text-center space-y-3">
          <p className="text-sm font-medium text-foreground">No deals saved yet</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Run a BRRRR analysis and save the deal to compare investments side by side.
          </p>
          <Button variant="outline" size="sm" onClick={onSwitchToCalculator} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Open BRRRR calculator
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedDeals.map((deal) => {
            const { label, cls } = roiLabel(deal.results.postRefinanceROI);
            return (
              <button
                key={deal.id}
                onClick={() => onLoadDeal(deal)}
                className="group text-left rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3 hover-lift hover:border-border transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{deal.deal_name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(deal.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <span className={cn("text-xs font-semibold shrink-0", cls)}>{label}</span>
                </div>

                <div className="space-y-2 border-t border-border/40 pt-3">
                  {[
                    { label: "Purchase",    value: formatCurrency(deal.inputs.purchasePrice) },
                    { label: "Investment",  value: formatCurrency(deal.results.totalInvestment) },
                    { label: "ROI",         value: formatPercentage(deal.results.postRefinanceROI), cls },
                    { label: "Cash flow",   value: `${formatCurrency(deal.results.postRefinanceCashFlow)}/mo`,
                      cls: deal.results.postRefinanceCashFlow >= 0 ? "text-accent" : "text-destructive" },
                  ].map(({ label: l, value, cls: c }) => (
                    <div key={l} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{l}</span>
                      <span className={cn("text-xs font-semibold tabular-nums font-mono", c)}>{value}</span>
                    </div>
                  ))}
                </div>

                {deal.notes && (
                  <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-2 truncate">
                    {deal.notes}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
