export interface CompanyNewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceDomain: string | null;
  summary: string;
  imageUrl: string | null;
  publishedAt: string;
  sentimentScore: number | null;
  sentimentLabel: string | null;
  relevanceScore: number | null;
  topics: string[];
}

const string = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const finite = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const safeHttpUrl = (value: unknown): string | null => {
  try {
    const url = new URL(string(value));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch { return null; }
};

export function alphaVantageNewsTimestamp(value: unknown): string | null {
  const raw = string(value);
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
  const parsed = new Date(iso);
  return Number.isFinite(parsed.getTime())
    && parsed.toISOString().slice(0, 19) === iso.slice(0, 19) ? iso : null;
}

export function normalizeCompanyNews(payload: unknown, ticker: string, limit = 12): CompanyNewsItem[] {
  const feed = (payload as { feed?: unknown[] })?.feed;
  if (!Array.isArray(feed)) return [];
  const symbol = ticker.toUpperCase();
  const seen = new Set<string>();
  return feed.flatMap(raw => {
    const row = raw as Record<string, unknown>;
    const title = string(row.title);
    const url = safeHttpUrl(row.url);
    const publishedAt = alphaVantageNewsTimestamp(row.time_published);
    if (!title || !url || !publishedAt || seen.has(url)) return [];
    const tickerSentiment = Array.isArray(row.ticker_sentiment)
      ? row.ticker_sentiment.find(value => string((value as Record<string, unknown>).ticker).toUpperCase() === symbol) as Record<string, unknown> | undefined
      : undefined;
    if (!tickerSentiment) return [];
    seen.add(url);
    const topics = Array.isArray(row.topics)
      ? row.topics.map(value => string((value as Record<string, unknown>).topic)).filter(Boolean).slice(0, 4)
      : [];
    return [{
      id: `${symbol}:${publishedAt}:${url}`,
      title: title.slice(0, 300),
      url,
      source: string(row.source) || string(row.source_domain) || 'News source',
      sourceDomain: string(row.source_domain) || null,
      summary: string(row.summary).slice(0, 1_000),
      imageUrl: safeHttpUrl(row.banner_image),
      publishedAt,
      sentimentScore: finite(tickerSentiment.ticker_sentiment_score) ?? finite(row.overall_sentiment_score),
      sentimentLabel: string(tickerSentiment.ticker_sentiment_label) || string(row.overall_sentiment_label) || null,
      relevanceScore: finite(tickerSentiment.relevance_score),
      topics,
    }];
  }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, Math.min(Math.max(limit, 1), 50));
}
