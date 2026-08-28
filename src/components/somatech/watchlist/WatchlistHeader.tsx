import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Plus, LayoutGrid, Rows3, Filter } from "lucide-react";
import { valuationGapDirection, valuationGapLabel, valuationGapText } from './watchlistMetrics';

type RecommendationFilter = "all" | "bullish" | "neutral" | "bearish";
type SortOption = "recent" | "upside" | "score";
type ViewMode = "grid" | "list";

interface WatchlistSummary {
  total: number;
  averageUpside: number | null;
  valuedCount: number;
  positiveCount: number;
  highConviction: number;
}

interface WatchlistHeaderProps {
  onAddStock: () => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  recommendationFilter: RecommendationFilter;
  onFilterChange: (value: RecommendationFilter) => void;
  sortOption: SortOption;
  onSortChange: (value: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (value: ViewMode) => void;
  summary: WatchlistSummary;
}

const WatchlistHeader = ({
  onAddStock,
  searchTerm,
  onSearchTermChange,
  recommendationFilter,
  onFilterChange,
  sortOption,
  onSortChange,
  viewMode,
  onViewModeChange,
  summary,
}: WatchlistHeaderProps) => {
  return (
    <Card className="glass-card mb-6">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <Filter className="h-5 w-5 text-primary" />
              Intelligent Watchlist
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Curate and prioritise your high-conviction ideas in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onAddStock}
            >
              <Plus className="h-4 w-4" />
              Add from analysis
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Search tickers or companies"
              className="md:max-w-sm"
            />
            <ToggleGroup
              type="single"
              value={recommendationFilter}
              onValueChange={(value) => value && onFilterChange(value as RecommendationFilter)}
              className="flex flex-wrap gap-1"
            >
              <ToggleGroupItem value="all" className="rounded-full px-4 py-2 text-xs">All</ToggleGroupItem>
              <ToggleGroupItem value="bullish" className="rounded-full px-4 py-2 text-xs">Bullish</ToggleGroupItem>
              <ToggleGroupItem value="neutral" className="rounded-full px-4 py-2 text-xs">Neutral</ToggleGroupItem>
              <ToggleGroupItem value="bearish" className="rounded-full px-4 py-2 text-xs">Bearish</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
            <ToggleGroup
              type="single"
              value={sortOption}
              onValueChange={(value) => value && onSortChange(value as SortOption)}
              className="flex gap-1"
            >
              <ToggleGroupItem value="recent" className="rounded-full px-3 py-2 text-xs">Recent</ToggleGroupItem>
              <ToggleGroupItem value="upside" className="rounded-full px-3 py-2 text-xs">Upside</ToggleGroupItem>
              <ToggleGroupItem value="score" className="rounded-full px-3 py-2 text-xs">Score</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => value && onViewModeChange(value as ViewMode)}
              className="flex gap-1"
            >
              <ToggleGroupItem value="grid" className="rounded-full px-3 py-2 text-xs">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" className="rounded-full px-3 py-2 text-xs">
                <Rows3 className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Badge variant="secondary" className="rounded-full px-3 py-1 font-medium">
            {summary.total} active ideas
          </Badge>
          <span>{valuationGapLabel(summary.averageUpside, true)}: <span className={valuationGapDirection(summary.averageUpside) === 'up' ? 'text-accent' : valuationGapDirection(summary.averageUpside) === 'down' ? 'text-destructive' : ''}>{valuationGapText(summary.averageUpside)}</span>{summary.valuedCount < summary.total && <span> · {summary.valuedCount}/{summary.total} valued</span>}</span>
          <span>High conviction: {summary.highConviction}</span>
          <span>Bullish setups: {summary.positiveCount}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export { WatchlistHeader };
