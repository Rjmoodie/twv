import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StockData, DCFScenarios, InvestmentThesis } from "./types";
import { calculateDCF } from "./utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildCompanyStory } from "./story/storyEngine";
import type { TrackingMode } from "./story/types";

interface WatchlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticker: string;
  stockData: StockData | null;
  dcfScenarios: DCFScenarios;
  investmentThesis: InvestmentThesis;
}

const WatchlistDialog = ({ open, onOpenChange, ticker, stockData, dcfScenarios, investmentThesis }: WatchlistDialogProps) => {
  const [selectedScenario, setSelectedScenario] = useState<'low' | 'base' | 'high'>('base');
  const [notes, setNotes] = useState('');
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('story');
  const [invalidation, setInvalidation] = useState('');
  const [saving, setSaving] = useState(false);

  const saveToWatchlist = async () => {
    if (!stockData) {
      toast.error('No stock data available');
      return;
    }

    setSaving(true);
    try {
      const dcfResult = calculateDCF(dcfScenarios[selectedScenario], stockData);
      
      // Combine investment thesis into notes
      const thesisNotes = [];
      if (investmentThesis.moat.trim()) {
        thesisNotes.push(`Economic Moat: ${investmentThesis.moat.trim()}`);
      }
      if (investmentThesis.risks.trim()) {
        thesisNotes.push(`Key Risks: ${investmentThesis.risks.trim()}`);
      }
      if (investmentThesis.opportunities.trim()) {
        thesisNotes.push(`Growth Opportunities: ${investmentThesis.opportunities.trim()}`);
      }
      if (notes.trim()) {
        thesisNotes.push(`Additional Notes: ${notes.trim()}`);
      }
      
      const combinedNotes = thesisNotes.join('\n\n');
      const story = trackingMode === 'price' ? null : buildCompanyStory(stockData);
      
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (authError || !userId) throw new Error('Sign in to save and track a company');
      const watchlistPayload = {
          user_id: userId,
          ticker: stockData.symbol,
          company_name: stockData.companyName || `${stockData.symbol} Corporation`,
          current_price: stockData.price,
          dcf_scenario: selectedScenario,
          // null when the DCF could not be computed — persist null rather than
          // coercing to 0, which would read as a real $0 valuation on the watchlist.
          dcf_intrinsic_value: dcfResult.intrinsicValue,
          dcf_upside_percentage: dcfResult.upside,
          recommendation: stockData.recommendation,
          score: stockData.score,
          market_cap: stockData.marketCap,
          pe_ratio: stockData.pe,
          notes: combinedNotes || null,
          tracking_mode: trackingMode,
          thesis_summary: trackingMode === 'thesis' ? combinedNotes || null : null,
          thesis_invalidation: trackingMode === 'thesis' ? invalidation.trim() || null : null,
          story_summary: story?.summary ?? null,
          story_updated_at: story?.generatedAt ?? null,
          updated_at: new Date().toISOString(),
      };

      // Legacy installations may contain duplicate ticker rows. Update the
      // newest match instead of relying on a uniqueness constraint that could
      // make the migration fail on existing user data.
      const { data: existing, error: lookupError } = await supabase.from('watchlist')
        .select('id').eq('user_id', userId).eq('ticker', stockData.symbol).order('added_at', { ascending: false }).limit(1).maybeSingle();
      if (lookupError) throw lookupError;
      const write = existing
        ? await supabase.from('watchlist').update(watchlistPayload).eq('id', existing.id).eq('user_id', userId).select('id').single()
        : await supabase.from('watchlist').insert(watchlistPayload).select('id').single();
      if (write.error || !write.data) throw write.error ?? new Error('Watchlist save returned no record');

      let storySaved = trackingMode === 'price';
      if (story) {
        const { error: storyError } = await supabase.from('watchlist_story_snapshots').upsert({
          watchlist_id: write.data.id, user_id: userId, ticker: stockData.symbol,
          reporting_period: story.reportingPeriod, source_as_of: story.sourceAsOf,
          analysis_version: story.schemaVersion, summary: story.summary, payload: story,
        }, { onConflict: 'watchlist_id,source_as_of,analysis_version', ignoreDuplicates: true });
        if (storyError) console.error('Story baseline save failed:', storyError);
        storySaved = !storyError;
      }

      toast.success(storySaved
        ? `${ticker} saved${trackingMode === 'price' ? '' : ' with story tracking'}`
        : `${ticker} saved, but its story baseline could not be stored. Retry after the database update.`);
      onOpenChange(false);
      setNotes('');
      setSelectedScenario('base');
      setTrackingMode('story');
      setInvalidation('');
    } catch (error) {
      console.error('Error saving to watchlist:', error);
      toast.error('Failed to save to watchlist');
    } finally {
      setSaving(false);
    }
  };

  const getDCFPreview = (scenario: 'low' | 'base' | 'high') => {
    if (!stockData) return null;
    return calculateDCF(dcfScenarios[scenario], stockData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save {ticker} to Watchlist</DialogTitle>
          <DialogDescription>
            Choose which DCF scenario you want to track for {ticker}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <Label className="text-base font-medium">Select DCF Scenario</Label>
            <RadioGroup
              value={selectedScenario}
              onValueChange={(value) => setSelectedScenario(value as 'low' | 'base' | 'high')}
              className="mt-3"
            >
              {(['low', 'base', 'high'] as const).map((scenario) => {
                const dcfPreview = getDCFPreview(scenario);
                return (
                  <div key={scenario} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <RadioGroupItem value={scenario} id={scenario} />
                    <div className="flex-1">
                      <Label htmlFor={scenario} className="font-medium capitalize cursor-pointer">
                        {scenario} Case
                      </Label>
                      {dcfPreview && dcfPreview.intrinsicValue != null ? (
                        <div className="text-sm text-muted-foreground mt-1">
                          DCF: ${dcfPreview.intrinsicValue.toFixed(2)}
                          {dcfPreview.upside != null && (
                            <>
                              {' • '}
                              <span className={dcfPreview.upside > 0 ? 'text-accent' : 'text-destructive'}>
                                {dcfPreview.upside > 0 ? '+' : ''}{dcfPreview.upside.toFixed(1)}%
                              </span>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground mt-1">
                          DCF: not available for this ticker
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-base font-medium">Monitoring</Label>
            <RadioGroup value={trackingMode} onValueChange={(value) => setTrackingMode(value as TrackingMode)} className="mt-3">
              <div className="flex items-start gap-3 rounded-lg border p-3"><RadioGroupItem value="price" id="track-price" className="mt-0.5" /><Label htmlFor="track-price" className="cursor-pointer"><span className="block font-medium">Price only</span><span className="text-xs font-normal text-muted-foreground">Save valuation and refreshable quotes.</span></Label></div>
              <div className="flex items-start gap-3 rounded-lg border p-3"><RadioGroupItem value="story" id="track-story" className="mt-0.5" /><Label htmlFor="track-story" className="cursor-pointer"><span className="block font-medium">Track story</span><span className="text-xs font-normal text-muted-foreground">Preserve this baseline and monitor financial changes, catalysts and macro exposures.</span></Label></div>
              <div className="flex items-start gap-3 rounded-lg border p-3"><RadioGroupItem value="thesis" id="track-thesis" className="mt-0.5" /><Label htmlFor="track-thesis" className="cursor-pointer"><span className="block font-medium">Track thesis</span><span className="text-xs font-normal text-muted-foreground">Track the story plus your thesis and invalidation conditions.</span></Label></div>
            </RadioGroup>
          </div>

          {trackingMode === 'thesis' && <div>
            <Label htmlFor="invalidation">What would invalidate the thesis?</Label>
            <Textarea id="invalidation" placeholder="Define observable conditions, not a price move alone…" value={invalidation} onChange={(event) => setInvalidation(event.target.value)} className="mt-2" rows={2} maxLength={2000} />
          </div>}

          <div>
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Investment thesis will be automatically included from your analysis
            </p>
            <Textarea
              id="notes"
              placeholder="Add any additional notes or comments..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>

          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={saveToWatchlist}
              disabled={saving}
              className="flex-1"
            >
              {saving ? 'Saving...' : 'Save to Watchlist'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WatchlistDialog;
