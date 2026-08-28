import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarClock, ChevronLeft, ChevronRight, Database, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import CompanyStoryPanel from '../story/CompanyStoryPanel';
import type { CompanyStorySnapshot } from '../story/types';
import type { WatchlistItem } from './useWatchlistOperations';
import StoryPriceChart from './StoryPriceChart';
import ThesisReviewCard from './ThesisReviewCard';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface StoryTimelineDialogProps {
  item: WatchlistItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isStorySnapshot(value: unknown): value is CompanyStorySnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CompanyStorySnapshot>;
  return (candidate.schemaVersion === 'story-v1' || candidate.schemaVersion === 'story-v2') && typeof candidate.ticker === 'string'
    && Array.isArray(candidate.events) && Array.isArray(candidate.catalysts) && Array.isArray(candidate.macroExposures);
}

export default function StoryTimelineDialog({ item, open, onOpenChange }: StoryTimelineDialogProps) {
  const [enriching, setEnriching] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['watchlist-story', item?.id],
    enabled: open && Boolean(item?.id) && item?.tracking_mode !== 'price',
    queryFn: async () => {
      if (!item) return [];
      const { data, error } = await supabase.from('watchlist_story_snapshots')
        .select('id,source_as_of,summary,payload,created_at')
        .eq('watchlist_id', item.id)
        .order('source_as_of', { ascending: false });
      if (error) throw error;
      return (data ?? []).flatMap((row) => isStorySnapshot(row.payload)
        ? [{ ...row, snapshot: row.payload }]
        : []);
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) {
      setSelectedVersionId(null);
      setSelectedEventId(null);
    }
  }, [open, item?.id]);

  useEffect(() => {
    if (!selectedEventId) return;
    document.getElementById(`story-event-${selectedEventId.replace(/[^a-zA-Z0-9_-]/g, '-')}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedEventId, selectedVersionId]);

  const enrichStory = async () => {
    if (!item || enriching) return;
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ claims: number }>('company-story', { body: { ticker: item.ticker, watchlistId: item.id } });
      if (error) throw error;
      await query.refetch();
      toast.success(`Added ${data?.claims ?? 0} citation-verified filing insight${data?.claims === 1 ? '' : 's'}`);
    } catch (error) {
      console.error('Qualitative story refresh failed:', error);
      toast.error('The filing narrative could not be refreshed. Your saved baseline is unchanged.');
    } finally {
      setEnriching(false);
    }
  };

  const latest = query.data?.[0];
  const selectedIndex = useMemo(() => {
    if (!query.data?.length || !selectedVersionId) return 0;
    const index = query.data.findIndex((version) => version.id === selectedVersionId);
    return index >= 0 ? index : 0;
  }, [query.data, selectedVersionId]);
  const selected = query.data?.[selectedIndex] ?? latest;
  const selectVersion = (id: string) => {
    setSelectedVersionId(id);
    setSelectedEventId(null);
  };
  const selectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    const owner = query.data?.find((version) => version.snapshot.events.some((event) => event.id === eventId));
    if (owner) setSelectedVersionId(owner.id);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl xl:max-w-3xl">
        <SheetHeader className="shrink-0 border-b px-5 pb-4 pt-5 pr-12 sm:px-6 sm:pt-6">
          <div className="flex flex-wrap items-center gap-2"><SheetTitle className="text-xl">{item?.ticker} Story Timeline</SheetTitle>{item?.tracking_mode && <Badge variant="secondary">{item.tracking_mode} tracking</Badge>}{item?.tracking_mode !== 'price' && <Button size="sm" variant="outline" className="gap-1.5 sm:ml-auto" onClick={enrichStory} disabled={enriching}>{enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{enriching ? 'Reading filing…' : 'Refresh qualitative story'}</Button>}</div>
          <SheetDescription>Explore the company chapter by chapter. Saved evidence is versioned, so new snapshots append without rewriting prior history.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {item?.tracking_mode === 'price' ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">This company is currently tracked for price only. Re-save it from Stock Analysis and select Story or Thesis tracking to establish a baseline.</div>
        ) : query.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading saved story…</div>
        ) : query.error ? (
          <div className="rounded-xl border border-destructive/30 p-5 text-sm text-destructive">The saved story could not be loaded. Your watchlist entry and prior analysis remain unchanged.</div>
        ) : latest ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Database className="h-3 w-3" />{query.data?.length} saved version{query.data?.length === 1 ? '' : 's'}</span><span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />Latest source {new Date(latest.source_as_of).toLocaleDateString()}</span></div>
            <section className="rounded-xl border bg-gradient-to-r from-primary/5 via-background to-amber-500/5 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1"><p className="text-xs font-medium uppercase tracking-wide text-primary">Chapter {query.data!.length - selectedIndex} of {query.data!.length}</p><p className="mt-1 font-semibold">{new Date(selected!.source_as_of).toLocaleDateString()} · {selected!.summary}</p></div>
                <div className="flex gap-2"><Button variant="outline" size="sm" aria-label="Previous story chapter" disabled={selectedIndex >= query.data!.length - 1} onClick={() => selectVersion(query.data![selectedIndex + 1].id)}><ChevronLeft className="h-4 w-4" />Older</Button><Button variant="outline" size="sm" aria-label="Next story chapter" disabled={selectedIndex <= 0} onClick={() => selectVersion(query.data![selectedIndex - 1].id)}>Newer<ChevronRight className="h-4 w-4" /></Button></div>
              </div>
            </section>
            <ThesisReviewCard item={item!} snapshots={query.data ?? []} />
            <StoryPriceChart ticker={item!.ticker} snapshots={(query.data ?? []).map((version) => version.snapshot)} selectedEventId={selectedEventId} onSelectEvent={selectEvent} />
            <CompanyStoryPanel snapshot={selected!.snapshot} title={selectedIndex === 0 ? 'Latest Company Story' : 'Historical Company Story'} selectedEventId={selectedEventId} onSelectEvent={setSelectedEventId} />
            <section className="rounded-xl border p-4">
              <h3 className="flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4 text-primary" />Story history</h3>
              <div className="mt-3 space-y-2">{query.data?.map((version, index) => <button type="button" onClick={() => selectVersion(version.id)} key={version.id} className={`w-full border-l-2 p-3 pl-4 text-left transition-colors ${selected?.id === version.id ? 'border-primary bg-primary/5' : 'border-primary/30 hover:bg-muted/30'}`}><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{new Date(version.source_as_of).toLocaleDateString()}</span>{index === 0 && <Badge>Latest</Badge>}<Badge variant="outline">{version.snapshot.events.length} point{version.snapshot.events.length === 1 ? '' : 's'} of interest</Badge></div><p className="mt-1 text-sm text-muted-foreground">{version.summary}</p></button>)}</div>
            </section>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No valid story baseline is stored yet. Run Stock Analysis, then save this ticker with Story tracking enabled.</div>
        )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
