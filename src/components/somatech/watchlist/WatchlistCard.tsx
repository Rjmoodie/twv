import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, TrendingUp, TrendingDown, PlusCircle, BookOpen } from "lucide-react";
import { useHaptics } from "@/hooks/useHaptics";
import AddToPortfolioDialog from "@/components/somatech/portfolio/AddToPortfolioDialog";
import type { WatchlistItem } from './useWatchlistOperations';
import { valuationGap, valuationGapDirection, valuationGapLabel, valuationGapText } from './watchlistMetrics';

interface WatchlistCardProps {
  item: WatchlistItem;
  onRemove: () => void;
  onOpenStory: () => void;
  isOwned?: boolean;
}

/**
 * Individual watchlist item card component
 */
export const WatchlistCard = ({ item, onRemove, onOpenStory, isOwned = false }: WatchlistCardProps) => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const haptics = useHaptics()
  const dcfGap = valuationGap(item);
  const dcfDirection = valuationGapDirection(dcfGap);

  const formatCurrency = (value: number | null) => {
    if (value == null || !Number.isFinite(value)) return 'N/A';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${value.toLocaleString()}`;
  };

  const getScenarioBadgeColor = (scenario: string | null | undefined) => {
    if (!scenario) return 'bg-muted text-muted-foreground';
    switch (scenario.toLowerCase()) {
      case 'high': return 'bg-accent/10 text-accent';
      case 'base': return 'bg-primary/10 text-primary';
      case 'low':  return 'bg-gold/10 text-gold';
      default:     return 'bg-muted text-muted-foreground';
    }
  };

  const getRecommendationColor = (recommendation: string | null | undefined) => {
    if (!recommendation) return 'text-muted-foreground';
    switch (recommendation.toLowerCase()) {
      case 'strong buy':
      case 'buy':
        return 'text-accent';
      case 'hold':
        return 'text-warning';
      case 'sell':
      case 'strong sell':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className="relative hover-lift">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h3 className="text-base md:text-lg font-semibold truncate">{item.ticker}</h3>{isOwned && <Badge className="bg-accent/10 text-accent">Owned</Badge>}</div>
            <p className="text-xs md:text-sm text-muted-foreground truncate">{item.company_name}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <Button variant="ghost" size="sm" onClick={onOpenStory} className="text-primary hover:text-primary/80" title="Open story timeline"><BookOpen className="h-3 w-3 md:h-4 md:w-4" /></Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { haptics.tap(); setDialogOpen(true); }}
              disabled={isOwned}
              className="text-primary hover:text-primary/80"
              title={isOwned ? 'Already in your portfolio' : 'Add to portfolio'}
            >
              <PlusCircle className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { haptics.warning(); onRemove(); }}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 md:space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-lg md:text-2xl font-bold font-mono tabular-nums">{item.current_price != null ? `$${item.current_price.toFixed(2)}` : 'N/A'}</span>
          <Badge className={`${getScenarioBadgeColor(item.dcf_scenario)} text-xs`}>
            {item.dcf_scenario?.toUpperCase() || 'N/A'}
          </Badge>
        </div>

        {item.tracking_mode !== 'price' && <button type="button" onClick={onOpenStory} className="w-full rounded-lg border bg-muted/30 p-3 text-left hover:bg-muted/50"><div className="flex items-center gap-2"><BookOpen className="h-3.5 w-3.5 text-primary" /><span className="text-xs font-medium">Latest story</span>{item.story_updated_at && (!item.story_last_viewed_at || Date.parse(item.story_updated_at) > Date.parse(item.story_last_viewed_at)) && <Badge className="ml-auto h-5">New</Badge>}</div><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.story_summary || 'Baseline pending'}</p></button>}

        <div className="grid grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm">
          <div>
            <p className="text-muted-foreground">Market Cap</p>
            <p className="font-medium truncate">{formatCurrency(item.market_cap)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">P/E Ratio</p>
            <p className="font-medium">{item.pe_ratio?.toFixed(1) || 'N/A'}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm text-muted-foreground">DCF Value</span>
            <span className="font-mono font-medium tabular-nums text-sm md:text-base">{item.dcf_intrinsic_value != null ? `$${item.dcf_intrinsic_value.toFixed(2)}` : 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm text-muted-foreground">{valuationGapLabel(dcfGap)}</span>
            <div className="flex items-center space-x-1">
              {dcfDirection === 'up' && <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-accent" />}
              {dcfDirection === 'down' && <TrendingDown className="h-3 w-3 md:h-4 md:w-4 text-destructive" />}
              <span className={`font-mono font-medium tabular-nums text-sm md:text-base ${
                dcfDirection === 'up' ? 'text-accent' : dcfDirection === 'down' ? 'text-destructive' : 'text-muted-foreground'
              }`}>
                {valuationGapText(dcfGap)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className={`font-semibold text-xs md:text-sm ${getRecommendationColor(item.recommendation)}`}>
            {item.recommendation || 'N/A'}
          </span>
          <span className="font-mono tabular-nums text-xs md:text-sm text-muted-foreground">
            {item.score != null ? `${item.score}/100` : 'N/A'}
          </span>
        </div>

        {item.notes && (
          <div className="pt-2 border-t">
            <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{item.notes}</p>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Added: {new Date(item.added_at).toLocaleDateString()}
        </div>
      </CardContent>

      <AddToPortfolioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        ticker={item.ticker}
        companyName={item.company_name ?? item.ticker}
        currentPrice={item.current_price ?? 0}
        marketCap={item.market_cap ?? 0}
        dcfUpsidePct={dcfGap != null ? dcfGap / 100 : undefined}
      />
    </Card>
  );
};
