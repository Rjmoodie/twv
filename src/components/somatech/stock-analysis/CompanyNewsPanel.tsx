import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CompanyNewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  summary: string;
  publishedAt: string;
  sentimentScore: number | null;
  sentimentLabel: string | null;
  relevanceScore: number | null;
  topics: string[];
}

interface CompanyNewsResponse {
  articles: CompanyNewsItem[];
  provider: string;
  fetchedAt: string;
  stale: boolean;
  warning?: string;
}

const sentimentTone = (score: number | null) => {
  if (score == null || Math.abs(score) < 0.15) return 'outline' as const;
  return score > 0 ? 'secondary' as const : 'destructive' as const;
};

const relativeTime = (value: string): string => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? formatDistanceToNowStrict(date, { addSuffix: true })
    : 'publication time unavailable';
};

const localTime = (value: string): string => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'time unavailable';
};

export default function CompanyNewsPanel({ ticker }: { ticker: string }) {
  const [response, setResponse] = useState<CompanyNewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responseTicker, setResponseTicker] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const normalizedTicker = ticker.toUpperCase();
  const visibleResponse = responseTicker === normalizedTicker ? response : null;

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    const requestedTicker = ticker.toUpperCase();
    setLoading(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke<CompanyNewsResponse>('stock-analysis', {
      body: { ticker: requestedTicker, operation: 'news' },
    });
    if (sequence !== requestSequence.current) return;
    if (invokeError || !data) {
      setError('Company news is temporarily unavailable. The sourced financial analysis is unaffected.');
      setLoading(false);
      return;
    }
    setResponse(data);
    setResponseTicker(requestedTicker);
    setLoading(false);
  }, [ticker]);

  useEffect(() => {
    setResponse(null);
    setResponseTicker(null);
    setError(null);
    void load();
    const activeRequest = requestSequence.current;
    return () => {
      if (requestSequence.current === activeRequest) requestSequence.current = activeRequest + 1;
    };
  }, [load]);

  const articles = visibleResponse?.articles ?? [];
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Newspaper className="h-4 w-4 text-primary" />Latest {ticker} news</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Ticker-matched reporting shown beside the filed fundamentals—not used as a valuation input.</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !visibleResponse ? (
          <p className="text-sm text-muted-foreground">Loading current company coverage…</p>
        ) : error && !visibleResponse ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{error}</p>
        ) : articles.length === 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No recent ticker-matched articles were returned. This does not indicate that the company had no material developments.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {articles.slice(0, 8).map(article => (
              <article key={article.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <a href={article.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1.5 font-medium leading-snug hover:text-primary hover:underline">
                      <span>{article.title}</span><ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0" />
                    </a>
                    {article.summary && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{article.summary}</p>}
                  </div>
                  {article.sentimentLabel && <Badge variant={sentimentTone(article.sentimentScore)} className="w-fit shrink-0">{article.sentimentLabel.replace(/-/g, ' ')}</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{article.source}</span>
                  <span>{relativeTime(article.publishedAt)}</span>
                  {article.relevanceScore != null && <span>{Math.round(Math.min(Math.max(article.relevanceScore, 0), 1) * 100)}% ticker relevance</span>}
                  {article.topics.slice(0, 2).map(topic => <span key={topic}>{topic}</span>)}
                </div>
              </article>
            ))}
          </div>
        )}
        {error && visibleResponse && (
          <p className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground" role="status">
            Refresh failed; the previously loaded articles remain visible with their original timestamp.
          </p>
        )}
        {visibleResponse && (
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            Source: {visibleResponse.provider} · refreshed {localTime(visibleResponse.fetchedAt)}
            {visibleResponse.stale ? ` · ${visibleResponse.warning ?? 'cached result'}` : ''}. Sentiment labels are provider metadata, not SomaTech recommendations.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
