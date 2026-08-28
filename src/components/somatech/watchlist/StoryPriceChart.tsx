import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2, MousePointer2 } from 'lucide-react';
import type { CompanyStorySnapshot, StoryDirection } from '../story/types';
import { buildStoryMarkers, findMarkerForEvent, type StoryPricePoint } from './storyPriceMath';

interface PriceHistoryResponse { ticker: string; series: StoryPricePoint[]; adjusted: boolean; provider: string; asOf?: string; as_of?: string; cacheHit: boolean; stale?: boolean; warning?: string }

interface StoryPriceChartProps {
  ticker: string;
  snapshots: CompanyStorySnapshot[];
  selectedEventId?: string | null;
  onSelectEvent?: (eventId: string) => void;
}

const DIRECTION_FILL: Record<StoryDirection, string> = {
  positive: '#10b981',
  negative: '#ef4444',
  mixed: '#f59e0b',
  neutral: '#94a3b8',
};

const DIRECTION_DOT: Record<StoryDirection, string> = {
  positive: 'bg-emerald-500',
  negative: 'bg-red-500',
  mixed: 'bg-amber-500',
  neutral: 'bg-slate-400',
};

export default function StoryPriceChart({ ticker, snapshots, selectedEventId, onSelectEvent }: StoryPriceChartProps) {
  const query = useQuery({
    queryKey: ['story-price-history', ticker],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<PriceHistoryResponse>('stock-analysis', { body: { ticker, operation: 'price-history' } });
      if (error) throw error;
      if (!data || !Array.isArray(data.series)) throw new Error('Price history returned no usable series');
      return data;
    },
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });

  const markerSet = useMemo(
    () => buildStoryMarkers(query.data?.series ?? [], snapshots),
    [query.data, snapshots],
  );

  const selectedMarker = findMarkerForEvent(markerSet.markers, selectedEventId);

  // Everything the chart could not place, said plainly rather than dropped. A story
  // with six events that plots two should explain the other four.
  const unplotted = [
    markerSet.undated.length ? `${markerSet.undated.length} undated` : null,
    markerSet.beforeWindow.length ? `${markerSet.beforeWindow.length} before this window` : null,
    markerSet.afterWindow.length ? `${markerSet.afterWindow.length} after the last close` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Price + Story</CardTitle>
        <CardDescription>Daily closes with points of interest aligned to the first trading session on or after disclosure.</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading cached price history…</div>
        ) : query.error || !query.data ? (
          <div className="flex h-48 items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground"><AlertCircle className="h-4 w-4" />Price history is temporarily unavailable; the saved story remains available.</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={query.data.series} margin={{ top: 18, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="date" minTickGap={45} tick={{ fontSize: 10 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={56} tickFormatter={(value: number) => `$${value.toFixed(0)}`} />
                <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Close']} labelFormatter={(label) => String(label)} />
                <Line type="monotone" dataKey="close" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                {markerSet.markers.map((marker) => {
                  const isSelected = selectedMarker?.key === marker.key;
                  // One dot per session. Events from a single filing share a disclosure
                  // date, so per-event dots would land on the same pixel and hide each other.
                  const radius = (marker.events.length > 1 ? 7 : 5) + (isSelected ? 3 : 0);
                  return (
                    <ReferenceDot
                      key={marker.key}
                      x={marker.point.date}
                      y={marker.point.close}
                      r={radius}
                      fill={DIRECTION_FILL[marker.direction]}
                      stroke={isSelected ? 'hsl(var(--foreground))' : 'white'}
                      strokeWidth={isSelected ? 3 : 1}
                      className={onSelectEvent ? 'cursor-pointer' : undefined}
                      onClick={() => onSelectEvent?.(marker.events[0].id)}
                      label={marker.events.length > 1
                        ? { value: String(marker.events.length), position: 'top', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }
                        : undefined}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>{query.data.provider} · through {query.data.asOf ?? query.data.as_of ?? 'unknown'}</span>
              <span>{query.data.adjusted ? 'Adjusted closes' : 'Raw closes; split/dividend adjustment unavailable'}</span>
              <span>
                {markerSet.plottedEventCount} event{markerSet.plottedEventCount === 1 ? '' : 's'} plotted
                {markerSet.markers.length > 0 && ` across ${markerSet.markers.length} session${markerSet.markers.length === 1 ? '' : 's'}`}
              </span>
              {unplotted && <span className="text-amber-600 dark:text-amber-400">Not shown: {unplotted}</span>}
              {markerSet.markers.length > 0 && <span className="flex items-center gap-1"><MousePointer2 className="h-3 w-3" />Select an entry to inspect its evidence</span>}
            </div>
            {query.data.stale && (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground" role="status">
                {query.data.warning ?? 'Showing cached price history while the provider refresh is unavailable.'}
              </p>
            )}

            {markerSet.markers.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {markerSet.markers.map((marker) => (
                  <div
                    key={`${marker.key}:legend`}
                    className={`rounded-lg border p-3 text-xs transition-colors ${selectedMarker?.key === marker.key ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <p className="text-muted-foreground">
                      Plotted {marker.point.date} at ${marker.point.close.toFixed(2)}
                      {marker.events.length > 1 && ` · ${marker.events.length} events from this filing`}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {marker.events.map((event) => (
                        <button
                          type="button"
                          key={event.id}
                          onClick={() => onSelectEvent?.(event.id)}
                          className={`flex w-full items-start gap-2 rounded p-1 text-left transition-colors hover:bg-muted/40 ${selectedEventId === event.id ? 'bg-primary/10' : ''}`}
                        >
                          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DIRECTION_DOT[event.direction]}`} />
                          <span className="min-w-0">
                            <span className="font-medium">{event.headline}</span>
                            {event.disclosureDate && <span className="block text-muted-foreground">Disclosed {event.disclosureDate.slice(0, 10)}</span>}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {unplotted && (
              <details className="mt-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">Why some points of interest are not on the chart</summary>
                <ul className="mt-2 space-y-1 pl-4">
                  {markerSet.undated.map((event) => <li key={event.id}>· {event.headline} — the filing supplied no disclosure date.</li>)}
                  {markerSet.beforeWindow.map((event) => <li key={event.id}>· {event.headline} — disclosed {event.disclosureDate?.slice(0, 10)}, before the available price window.</li>)}
                  {markerSet.afterWindow.map((event) => <li key={event.id}>· {event.headline} — disclosed {event.disclosureDate?.slice(0, 10)}, after the last cached close.</li>)}
                </ul>
              </details>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
