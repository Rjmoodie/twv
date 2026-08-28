import { useMemo } from 'react';
import { Activity, CalendarClock, Database, Globe2, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { StockData } from '../types';
import { buildCompanyStory } from './storyEngine';
import type { CompanyStorySnapshot, StoryDirection } from './types';
import InsiderActivityTimeline from './InsiderActivityTimeline';

interface CompanyStoryPanelProps {
  stockData?: StockData;
  snapshot?: CompanyStorySnapshot;
  title?: string;
  selectedEventId?: string | null;
  onSelectEvent?: (eventId: string) => void;
}

const directionIcon = (direction: StoryDirection) => direction === 'positive'
  ? <TrendingUp className="h-4 w-4 text-emerald-500" />
  : direction === 'negative'
    ? <TrendingDown className="h-4 w-4 text-destructive" />
    : <Activity className="h-4 w-4 text-amber-500" />;

const readable = (value: string) => value.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const displayEvidenceValue = (value: string) => {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return value;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return Math.abs(numeric) >= 1_000_000
    ? new Intl.NumberFormat('en-US', { notation: 'compact', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(numeric)
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(numeric);
};

const evidenceTitle = (value: string, exactValue?: string) => {
  if (exactValue) return `Exact filed value: ${exactValue}`;
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return undefined;
  return `Exact filed value: ${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};

export default function CompanyStoryPanel({ stockData, snapshot, title = 'Company Story', selectedEventId, onSelectEvent }: CompanyStoryPanelProps) {
  const story = useMemo(() => snapshot ?? (stockData ? buildCompanyStory(stockData) : null), [snapshot, stockData]);
  if (!story) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />{title}</CardTitle>
            <CardDescription className="mt-1">What changed, what may matter next, and which evidence supports it.</CardDescription>
          </div>
          <Badge variant="outline" className="w-fit gap-1"><Database className="h-3 w-3" />SEC-derived baseline</Badge>
        </div>
        <p className="rounded-lg border bg-muted/30 p-3 text-sm">{story.summary}</p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="story">
          <TabsList className={`grid h-auto w-full ${story.narrativeClaims?.length ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <TabsTrigger value="story">Story</TabsTrigger>
            {story.narrativeClaims?.length ? <TabsTrigger value="why">Why</TabsTrigger> : null}
            <TabsTrigger value="catalysts">Catalysts</TabsTrigger>
            <TabsTrigger value="macro">Macro</TabsTrigger>
          </TabsList>
          <TabsContent value="story" className="mt-4 space-y-3">
            <InsiderActivityTimeline ticker={story.ticker} />
            {story.events.length ? story.events.map((event) => (
              <article
                key={event.id}
                id={`story-event-${event.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`}
                className={`rounded-xl border p-4 transition-all ${selectedEventId === event.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : onSelectEvent ? 'cursor-pointer hover:border-primary/50 hover:bg-muted/20' : ''}`}
                onClick={() => onSelectEvent?.(event.id)}
                onKeyDown={(keyEvent) => {
                  if (!onSelectEvent || (keyEvent.key !== 'Enter' && keyEvent.key !== ' ')) return;
                  keyEvent.preventDefault();
                  onSelectEvent(event.id);
                }}
                role={onSelectEvent ? 'button' : undefined}
                tabIndex={onSelectEvent ? 0 : undefined}
                aria-current={selectedEventId === event.id ? 'true' : undefined}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{directionIcon(event.direction)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold">{event.headline}</h4>
                      <Badge variant="secondary">{readable(event.change)}</Badge>
                      <Badge variant="outline">{readable(event.classification)}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{event.detail}</p>
                    <p className="mt-2 text-xs"><strong>Watch next:</strong> {event.watchNext}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />Period {event.reportingPeriod ?? 'unavailable'}</span>
                      {event.evidence.map((item, index) => item.sourceUrl ? (
                        <a key={`${item.label}-${index}`} href={item.sourceUrl} target="_blank" rel="noreferrer" title={evidenceTitle(item.value, item.exactValue)} className="text-primary underline-offset-2 hover:underline">
                          {item.label}: {displayEvidenceValue(item.value)} · {item.form ?? 'SEC filing'}
                        </a>
                      ) : <span key={`${item.label}-${index}`} title={evidenceTitle(item.value, item.exactValue)}>{item.label}: {displayEvidenceValue(item.value)}</span>)}
                    </div>
                  </div>
                </div>
              </article>
            )) : (
              <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Two comparable complete annual periods are required before a financial story change can be calculated.</div>
            )}
          </TabsContent>
          {story.narrativeClaims?.length ? <TabsContent value="why" className="mt-4 space-y-3">
            <div className="rounded-lg border bg-primary/5 p-3 text-xs text-muted-foreground">These explanations were extracted from the company’s MD&amp;A. Supporting excerpts are verified against the retrieved filing text before display.</div>
            {story.narrativeClaims.map((claim) => <article key={claim.id} className="rounded-xl border p-4"><div className="flex items-start gap-3"><div className="mt-0.5">{directionIcon(claim.direction)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{claim.headline}</h4><Badge variant="secondary">{readable(claim.classification)}</Badge><Badge variant="outline">{readable(claim.confidence)} confidence</Badge></div><p className="mt-2 text-sm text-muted-foreground">{claim.explanation}</p><blockquote className="mt-3 border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground">“{claim.excerpt}”</blockquote><div className="mt-3 flex flex-wrap gap-2 text-xs"><span><strong>Watch next:</strong> {claim.watchNext}</span><a href={claim.source.documentUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{claim.source.form} · filed {claim.source.filedAt} · {claim.source.section}</a></div></div></div></article>)}
          </TabsContent> : null}
          <TabsContent value="catalysts" className="mt-4 grid gap-3 lg:grid-cols-2">
            {story.catalysts.map((catalyst) => (
              <article key={catalyst.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-2"><h4 className="font-semibold">{catalyst.title}</h4><Badge variant="secondary">{readable(catalyst.status)}</Badge></div>
                <p className="mt-2 text-sm text-muted-foreground">{catalyst.rationale}</p>
                <p className="mt-3 text-xs"><strong>Confirmation signals:</strong> {catalyst.signals.join(' · ')}</p>
                <p className="mt-1 text-xs text-muted-foreground"><strong>Invalidation:</strong> {catalyst.invalidation}</p>
                <div className="mt-3 flex gap-2"><Badge variant="outline">{readable(catalyst.horizon)} term</Badge><Badge variant="outline">Typical, not confirmed</Badge></div>
              </article>
            ))}
          </TabsContent>
          <TabsContent value="macro" className="mt-4 space-y-3">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">These are structural exposure candidates. They are not claims that a macro factor caused the latest financial or price movement.</div>
            {story.macroExposures.map((exposure) => (
              <article key={exposure.id} className="flex gap-3 rounded-xl border p-4">
                <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{exposure.factor}</h4><Badge variant="outline">{readable(exposure.classification)}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{exposure.expectedRelationship}</p><p className="mt-2 text-xs"><strong>Relevant metrics:</strong> {exposure.relevantMetrics.join(' · ')}</p></div>
              </article>
            ))}
          </TabsContent>
        </Tabs>
        <div className="mt-4 border-t pt-3 text-[11px] text-muted-foreground">{story.limitations.join(' ')}</div>
      </CardContent>
    </Card>
  );
}
