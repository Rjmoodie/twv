import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, BarChart2, Bookmark, Sparkles, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthProvider";
import { useNavigation } from "@/contexts/NavigationContext";
import { useActionGuard } from "@/contexts/ActionGuardContext";
import { toast } from "@/hooks/use-toast";

interface StockTickerInputProps {
  globalTicker?: string;
  setGlobalTicker?: (ticker: string) => void;
  onAnalyze: () => void;
  loading?: boolean;
}

const StockTickerInput = ({ globalTicker, setGlobalTicker, onAnalyze, loading }: StockTickerInputProps) => {
  const { user } = useAuth();
  const { navigateToModule } = useNavigation();
  const { guardAction } = useActionGuard();
  const [watchlisted, setWatchlisted] = useState(false);
  const [watchlistSaving, setWatchlistSaving] = useState(false);

  const handleTickerChange = (value: string) => {
    if (setGlobalTicker && typeof setGlobalTicker === 'function') {
      setGlobalTicker(value.toUpperCase());
      setWatchlisted(false);
    }
  };

  const handleAnalyze = () => {
    if (!globalTicker || !globalTicker.trim()) return;
    onAnalyze();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  const saveToWatchlist = async (ticker: string) => {
    if (!user) return;
    setWatchlistSaving(true);
    const { error } = await supabase.from('watchlist').upsert(
      { user_id: user.id, ticker: ticker.toUpperCase(), dcf_scenario: 'base', tracking_mode: 'price' },
      { onConflict: 'user_id,ticker' }
    );
    setWatchlistSaving(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setWatchlisted(true);
    toast({ title: `${ticker.toUpperCase()} added to watchlist` });
  };

  const handleAddToWatchlist = () => {
    const ticker = globalTicker?.trim();
    if (!ticker) return;
    guardAction({
      requiresAuth: true,
      pendingAction: {
        type: 'add_watchlist',
        payload: { ticker },
        returnTo: 'stock-analysis',
        message: `Sign in to add ${ticker.toUpperCase()} to your watchlist.`,
      },
      authMessage: `Sign in to add ${ticker.toUpperCase()} to your watchlist. Your analysis will be ready when you return.`,
      onAllowed: () => saveToWatchlist(ticker),
    });
  };

  const hasTicker = !!globalTicker?.trim();

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <BarChart2 className="h-5 w-5 text-primary" />
          Stock Analysis
        </CardTitle>
        <CardDescription>
          Enter a ticker symbol for fundamental and technical analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Input
            placeholder="Ticker symbol — AAPL, MSFT, TSLA…"
            value={globalTicker || ""}
            onChange={(e) => handleTickerChange(e.target.value)}
            onKeyDown={handleKeyPress}
            className="h-10 font-mono uppercase flex-1"
            disabled={loading}
          />
          <Button
            onClick={handleAnalyze}
            disabled={loading || !globalTicker?.trim()}
            className="h-10 w-full sm:w-auto sm:px-6"
          >
            <Search className="h-4 w-4 mr-2 shrink-0" />
            {loading ? "Loading…" : "Analyze"}
          </Button>
        </div>

        {/* Quick-action row — appears once a ticker is entered */}
        {hasTicker && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-xs text-muted-foreground">Quick actions:</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={watchlistSaving || watchlisted}
              onClick={handleAddToWatchlist}
            >
              {watchlisted
                ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1 text-accent" />Watchlisted</>
                : <><Bookmark className="w-3.5 h-3.5 mr-1" />Add to watchlist</>}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => guardAction({
                requiresAuth: true,
                pendingAction: { type: 'navigate_module', payload: { module: 'portfolio' }, returnTo: 'portfolio' },
                authMessage: 'Sign in to build and manage your investment portfolio.',
                onAllowed: () => navigateToModule('portfolio'),
              })}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Score in portfolio
            </Button>
          </div>
        )}

        {!hasTicker && (
          <div className="flex items-center gap-6 text-xs text-muted-foreground border-t pt-4">
            <span>Provider market data</span>
            <span>SEC-filed fundamentals</span>
            <span>Scenario valuation</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StockTickerInput;
