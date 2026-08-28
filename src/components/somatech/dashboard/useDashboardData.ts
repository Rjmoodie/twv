import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MarketData } from './mockData';

const quoteSymbols = { sp500: 'SPY', nasdaq: 'QQQ', dow: 'DIA', vix: 'VIXY' } as const;
type MarketKey = keyof typeof quoteSymbols;
const MARKET_CACHE_MS = 5 * 60 * 1000;
let marketCache: { data: MarketData; expiresAt: number; storedAt: number } | null = null;
let marketRequest: Promise<MarketData> | null = null;

export function parseDashboardQuote(data: unknown): { price: number; change: number | null } | null {
  if (!data || typeof data !== 'object') return null;
  const quote = (data as Record<string, unknown>)['Global Quote'];
  if (!quote || typeof quote !== 'object') return null;
  const fields = quote as Record<string, unknown>;
  const price = Number(fields['05. price']);
  const change = Number.parseFloat(String(fields['10. change percent'] ?? '').replace('%', ''));
  return Number.isFinite(price) && price > 0
    ? { price, change: Number.isFinite(change) ? change : null }
    : null;
}

async function fetchMarketData(): Promise<MarketData> {
  if (marketRequest) return marketRequest;
  marketRequest = (async () => {
    const symbols = Object.values(quoteSymbols);
    const { data, error } = await supabase.functions.invoke('fetch-alpha-vantage', {
      body: { function: 'GLOBAL_QUOTE', symbols },
    });
    if (error) throw error;
    const response = data && typeof data === 'object'
      ? data as {
          quotes?: Record<string, unknown>;
          quoteMeta?: Record<string, { asOf?: string | null; stale?: boolean }>;
          warning?: string;
        }
      : {};
    const payloads = 'quotes' in response
      ? response.quotes ?? {}
      : {};
    const entries = Object.entries(quoteSymbols).map(([key, symbol]) =>
      [key as MarketKey, parseDashboardQuote(payloads[symbol])] as const);
    const quotes = Object.fromEntries(entries) as Record<MarketKey, ReturnType<typeof parseDashboardQuote>>;
    if (!Object.values(quotes).some(Boolean)) throw new Error('No current quotes were available');
    const metaEntries = Object.entries(quoteSymbols).map(([key, symbol]) => [key, response.quoteMeta?.[symbol]] as const);
    const quoteMeta = Object.fromEntries(metaEntries) as Record<MarketKey, { asOf?: string | null; stale?: boolean } | undefined>;
    const observedTimes = Object.values(quoteMeta).flatMap((meta) => {
      const time = meta?.asOf ? Date.parse(meta.asOf) : NaN;
      return Number.isFinite(time) ? [time] : [];
    });
    return {
      sp500: quotes.sp500?.price ?? null,
      nasdaq: quotes.nasdaq?.price ?? null,
      dow: quotes.dow?.price ?? null,
      vix: quotes.vix?.price ?? null,
      change: {
        sp500: quotes.sp500?.change ?? null,
        nasdaq: quotes.nasdaq?.change ?? null,
        dow: quotes.dow?.change ?? null,
        vix: quotes.vix?.change ?? null,
      },
      updatedAt: observedTimes.length > 0 ? new Date(Math.min(...observedTimes)).toISOString() : undefined,
      asOf: {
        sp500: quoteMeta.sp500?.asOf ?? null,
        nasdaq: quoteMeta.nasdaq?.asOf ?? null,
        dow: quoteMeta.dow?.asOf ?? null,
        vix: quoteMeta.vix?.asOf ?? null,
      },
      stale: {
        sp500: Boolean(quoteMeta.sp500?.stale),
        nasdaq: Boolean(quoteMeta.nasdaq?.stale),
        dow: Boolean(quoteMeta.dow?.stale),
        vix: Boolean(quoteMeta.vix?.stale),
      },
      warning: response.warning,
    };
  })().finally(() => { marketRequest = null; });
  return marketRequest;
}

export function useDashboardData() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      if (!force && marketCache && marketCache.expiresAt > Date.now()) {
        setMarketData(marketCache.data);
        setWarning(marketCache.data.warning ?? null);
      } else {
        const data = await fetchMarketData();
        marketCache = { data, expiresAt: Date.now() + MARKET_CACHE_MS, storedAt: Date.now() };
        setMarketData(data);
        setWarning(data.warning ?? null);
      }
    } catch {
      const cachedAge = marketCache ? Date.now() - marketCache.storedAt : Number.POSITIVE_INFINITY;
      if (marketCache && cachedAge <= 24 * 60 * 60 * 1000) {
        setMarketData(marketCache.data);
        setWarning('Market refresh failed. Showing the last observed quotes with their original timestamps.');
      } else {
        setMarketData(null);
        setError('Live market context is temporarily unavailable.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { marketData, loading, error, warning, refresh: () => load(true) };
}
