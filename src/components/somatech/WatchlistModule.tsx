import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WatchlistHeader } from "./watchlist/WatchlistHeader";
import { WatchlistCard } from "./watchlist/WatchlistCard";
import { WatchlistEmptyState } from "./watchlist/WatchlistEmptyState";
import { WatchlistLoading } from "./watchlist/WatchlistLoading";
import { useWatchlistOperations } from "./watchlist/useWatchlistOperations";
import { useAuth } from "./AuthProvider";
import { useNavigation } from "@/contexts/NavigationContext";
import { modules } from "./constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, Sparkles, RefreshCw, Database } from "lucide-react";
import { mapStockAnalysisResponse, type StockAnalysisResponse } from "./stock-analysis/stockAnalysisMapper";
import StoryTimelineDialog from './watchlist/StoryTimelineDialog';
import type { WatchlistItem } from './watchlist/useWatchlistOperations';
import { buildCompanyStory } from './story/storyEngine';
import { compareByValuationGap, valuationGap, valuationGapDirection, valuationGapLabel, valuationGapText, watchlistSummary } from './watchlist/watchlistMetrics';

const module = modules.find(m => m.id === "watchlist");

type RecommendationFilter = "all" | "bullish" | "neutral" | "bearish";
type SortOption = "recent" | "upside" | "score";
type ViewMode = "grid" | "list";

const WatchlistModule = () => {
  const { user } = useAuth();
  const { navigateToModule: setActiveModule } = useNavigation();
  const { data: watchlistItems = [], isLoading, error, refetch } = useWatchlistOperations(user?.id);
  const [searchTerm, setSearchTerm] = useState("");
  const [recommendationFilter, setRecommendationFilter] = useState<RecommendationFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [refreshing, setRefreshing] = useState(false);
  const [quotesRefreshedAt, setQuotesRefreshedAt] = useState<Date | null>(null);
  const [storyItem, setStoryItem] = useState<WatchlistItem | null>(null);
  const [ownedTickers, setOwnedTickers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) { setOwnedTickers(new Set()); return; }
    let cancelled = false;
    void (supabase as any).from('portfolio_holdings').select('ticker,source').then(({ data }: any) => {
      if (!cancelled) setOwnedTickers(new Set((data ?? []).map((row: any) => String(row.ticker).toUpperCase())));
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const openStory = (item: WatchlistItem) => {
    setStoryItem(item);
    if (!user?.id || item.tracking_mode === 'price') return;
    void supabase.from('watchlist').update({ story_last_viewed_at: new Date().toISOString() }).eq('id', item.id).eq('user_id', user.id);
  };

  const handleAddStock = () => {
    setActiveModule('stock-analysis');
  };

  const summary = useMemo(
    () => watchlistSummary(Array.isArray(watchlistItems) ? watchlistItems : []),
    [watchlistItems],
  );

  const filteredItems = useMemo(() => {
    if (!Array.isArray(watchlistItems)) return [];
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return watchlistItems
      .filter(item => {
        if (!item) return false;
        if (normalizedSearch) {
          const matches =
            item.ticker.toLowerCase().includes(normalizedSearch) ||
            (item.company_name ?? '').toLowerCase().includes(normalizedSearch);
          if (!matches) return false;
        }

        if (recommendationFilter === "all") return true;
        const rec = (item.recommendation || "").toLowerCase();

        if (recommendationFilter === "bullish") {
          return rec.includes("buy") || rec.includes("outperform") || rec.includes("strong");
        }
        if (recommendationFilter === "neutral") {
          return rec.includes("hold") || rec.includes("neutral") || rec.includes("watch");
        }
        if (recommendationFilter === "bearish") {
          return rec.includes("sell") || rec.includes("underperform") || rec.includes("reduce");
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOption === "recent") {
          return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
        }
        if (sortOption === "upside") {
          return compareByValuationGap(a, b);
        }
        if (sortOption === "score") {
          return (b.score || 0) - (a.score || 0);
        }
        return 0;
      });
  }, [watchlistItems, searchTerm, recommendationFilter, sortOption]);

  const handleRemoveStock = async (id: string) => {
    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in to modify your watchlist.",
        variant: "destructive",
      });
      return;
    }

    const { error: deleteError } = await supabase
      .from('watchlist')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      toast({
        title: "Unable to remove",
        description: deleteError.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Removed from watchlist",
      description: "The symbol has been removed from your saved ideas.",
    });

    refetch();
  };

  const refreshQuotes = async () => {
    if (!user?.id || !watchlistItems.length) return;
    setRefreshing(true);
    let updated = 0;
    const failures: string[] = [];
    for (const item of watchlistItems) {
      const { data, error: invokeError } = await supabase.functions.invoke('stock-analysis', { body: { ticker: item.ticker } });
      if (invokeError || !data) { failures.push(item.ticker); continue; }
      try {
        const live = mapStockAnalysisResponse(data as StockAnalysisResponse);
        const upside = item.dcf_intrinsic_value != null && item.dcf_intrinsic_value > 0 && live.price > 0 ? ((item.dcf_intrinsic_value - live.price) / live.price) * 100 : null;
        const story = item.tracking_mode !== 'price' ? buildCompanyStory(live) : null;
        const { error: updateError } = await supabase.from('watchlist').update({ current_price: live.price, company_name: live.companyName, market_cap: live.marketCap, pe_ratio: live.pe, dcf_upside_percentage: upside }).eq('id', item.id).eq('user_id', user.id);
        if (updateError) { failures.push(item.ticker); continue; }
        if (item.tracking_mode !== 'price') {
          const { data: savedStory, error: storyError } = await supabase.from('watchlist_story_snapshots').upsert({
            watchlist_id: item.id, user_id: user.id, ticker: item.ticker,
            reporting_period: story.reportingPeriod, source_as_of: story.sourceAsOf,
            analysis_version: story.schemaVersion, summary: story.summary, payload: story,
          }, { onConflict: 'watchlist_id,source_as_of,analysis_version', ignoreDuplicates: true }).select('id');
          if (storyError) { failures.push(`${item.ticker} story`); continue; }
          if (savedStory?.length) {
            const { error: storyStatusError } = await supabase.from('watchlist').update({ story_summary: story.summary, story_updated_at: story.generatedAt }).eq('id', item.id).eq('user_id', user.id);
            if (storyStatusError) { failures.push(`${item.ticker} story status`); continue; }
          }
        }
        updated++;
      } catch { failures.push(item.ticker); }
    }
    await refetch();
    setQuotesRefreshedAt(new Date());
    setRefreshing(false);
    toast({ title: failures.length ? 'Watchlist partially refreshed' : 'Watchlist refreshed', description: `${updated} quote${updated === 1 ? '' : 's'} updated from the server cache.${failures.length ? ` Could not refresh: ${failures.join(', ')}.` : ''}`, variant: failures.length ? 'destructive' : 'default' });
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": module?.name,
    "description": module?.seo?.description,
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "All",
    "publisher": {
      "@type": "Organization",
      "name": "SomaTech"
    }
  };
  void jsonLd;

  if (isLoading) {
    return <WatchlistLoading />;
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-destructive/10 rounded-xl flex items-center justify-center mx-auto mb-4">
          <span className="text-destructive font-bold text-lg">!</span>
        </div>
        <h3 className="text-lg font-medium mb-2 text-foreground">
          Unable to Load Watchlist
        </h3>
        <p className="text-muted-foreground mb-4">{error.message || 'Failed to load your watchlist. Please try again.'}</p>
        <button
          onClick={() => refetch()}
          className="btn-premium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <>
      <WatchlistHeader
        onAddStock={handleAddStock}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        recommendationFilter={recommendationFilter}
        onFilterChange={setRecommendationFilter}
        sortOption={sortOption}
        onSortChange={setSortOption}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        summary={summary}
      />

      <div className="flex flex-col gap-3 rounded-2xl border bg-card/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm"><Database className="h-4 w-4 text-primary" /><div><p className="font-medium">Saved research with refreshable market quotes</p><p className="text-xs text-muted-foreground">SEC EDGAR fundamentals · Alpha Vantage daily quote{quotesRefreshedAt ? ` · Refreshed ${quotesRefreshedAt.toLocaleTimeString()}` : ''}</p></div></div>
        <Button variant="outline" size="sm" className="gap-2" onClick={refreshQuotes} disabled={refreshing || !watchlistItems.length}><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Refreshing…' : 'Refresh quotes'}</Button>
      </div>

      {/* Portfolio bridge — visible when watchlist has items */}
      {Array.isArray(watchlistItems) && watchlistItems.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span>
              <strong>{watchlistItems.length} stock{watchlistItems.length !== 1 ? 's' : ''}</strong> on your watchlist —
              score them against your portfolio goal and get a monthly buy plan.
            </span>
          </div>
          <Button size="sm" variant="default" className="shrink-0" onClick={() => setActiveModule('portfolio')}>
            Score in portfolio
          </Button>
        </div>
      )}

      <Card className="border-dashed border-muted/60 bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Portfolio pulse</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <div className="rounded-xl bg-background/80 p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Total tracked ideas</p>
            <p className="text-2xl font-semibold">{summary.total}</p>
          </div>
          <div className="rounded-xl bg-background/80 p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{valuationGapLabel(summary.averageUpside, true)}</p>
            <div className="flex items-center gap-2">
              {valuationGapDirection(summary.averageUpside) === 'up' && <TrendingUp className="h-4 w-4 text-accent" />}
              {valuationGapDirection(summary.averageUpside) === 'down' && <TrendingDown className="h-4 w-4 text-destructive" />}
              <p className={`text-2xl font-semibold ${valuationGapDirection(summary.averageUpside) === 'up' ? 'text-accent' : valuationGapDirection(summary.averageUpside) === 'down' ? 'text-destructive' : 'text-muted-foreground'}`}>
                {valuationGapText(summary.averageUpside)}
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-background/80 p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Bullish setups</p>
            <p className="text-2xl font-semibold">{summary.positiveCount}</p>
          </div>
          <div className="rounded-xl bg-background/80 p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">High conviction (&gt;=80 score)</p>
            <p className="text-2xl font-semibold">{summary.highConviction}</p>
          </div>
        </CardContent>
      </Card>

      <div>
        {Array.isArray(watchlistItems) && watchlistItems.length === 0 ? (
          <WatchlistEmptyState onAnalyzeStocks={handleAddStock} />
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-muted/60 p-6 text-center text-sm text-muted-foreground">
            No symbols match your filters. Try adjusting your view or resetting search criteria.
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {filteredItems.map((item) => (
              <WatchlistCard
                key={item.id}
                item={item}
                isOwned={ownedTickers.has(item.ticker.toUpperCase())}
                onRemove={() => handleRemoveStock(item.id)}
                onOpenStory={() => openStory(item)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              const gap = valuationGap(item);
              const direction = valuationGapDirection(gap);
              return (
              <div
                key={`${item.id}-list`}
                className="rounded-2xl border border-border/40 bg-card/80 p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{item.ticker}</h3>
                      <Badge variant="secondary">{item.dcf_scenario?.toUpperCase() || 'N/A'}</Badge>
                      <Badge variant="outline">{item.tracking_mode === 'price' ? 'Price only' : item.tracking_mode === 'thesis' ? 'Thesis tracking' : 'Story tracking'}</Badge>
                      {ownedTickers.has(item.ticker.toUpperCase()) && <Badge className="bg-accent/10 text-accent">Owned</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.company_name ?? item.ticker}</p>
                  </div>
                  <div className="grid gap-3 text-sm md:grid-cols-4 flex-1">
                    <div>
                      <p className="text-xs text-muted-foreground">Price</p>
                      <p className="font-semibold">{item.current_price != null ? `$${item.current_price.toFixed(2)}` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">DCF value</p>
                      <p className="font-semibold">{item.dcf_intrinsic_value != null ? `$${item.dcf_intrinsic_value.toFixed(2)}` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{valuationGapLabel(gap)}</p>
                      <p className={`font-semibold ${direction === 'up' ? 'text-accent' : direction === 'down' ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {valuationGapText(gap)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Score</p>
                      <p className="font-semibold">{item.score != null ? `${item.score}/100` : 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openStory(item)}>Open story</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveStock(item.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
      <StoryTimelineDialog item={storyItem} open={Boolean(storyItem)} onOpenChange={(open) => { if (!open) setStoryItem(null); }} />
    </>
  );
};

export default WatchlistModule;
