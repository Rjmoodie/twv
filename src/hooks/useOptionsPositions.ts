import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/somatech/AuthProvider';

export interface OptionsPosition {
  symbol: string;
  ticker: string;
  expiry: string | null;
  optionType: 'Call' | 'Put' | null;
  strike: number | null;
  daysToExpiry: number | null;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPct: number;
}

export interface VolumeAlert {
  ticker: string;
  sentiment: 'Bullish' | 'Bearish';
  changePercent: number;
  volume: number;
}

const finiteNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'string'
    ? Number.parseFloat(value.replace('%', '').replaceAll(',', ''))
    : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function parseVolumeAlerts(value: unknown): VolumeAlert[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): VolumeAlert[] => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const changePercent = finiteNumber(record.changePercent);
    const volume = finiteNumber(record.volume);
    const ticker = typeof record.ticker === 'string' ? record.ticker.trim().toUpperCase() : '';
    if (!ticker || changePercent == null || volume == null || volume < 0) return [];
    return [{ ticker, changePercent, volume, sentiment: changePercent >= 0 ? 'Bullish' : 'Bearish' }];
  });
}

export function parseOptionsPositions(value: unknown): OptionsPosition[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): OptionsPosition[] => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const symbol = typeof record.symbol === 'string' ? record.symbol.trim() : '';
    const ticker = typeof record.ticker === 'string' ? record.ticker.trim().toUpperCase() : '';
    const numericKeys = ['qty', 'avgEntryPrice', 'currentPrice', 'marketValue', 'unrealizedPl', 'unrealizedPlPct'] as const;
    const numbers = Object.fromEntries(numericKeys.map((key) => [key, finiteNumber(record[key])])) as Record<typeof numericKeys[number], number | null>;
    if (!symbol || !ticker || numericKeys.some((key) => numbers[key] == null)) return [];
    const optionType = record.optionType === 'Call' || record.optionType === 'Put' ? record.optionType : null;
    const strike = record.strike == null ? null : finiteNumber(record.strike);
    const daysToExpiry = record.daysToExpiry == null ? null : finiteNumber(record.daysToExpiry);
    return [{
      symbol, ticker,
      expiry: typeof record.expiry === 'string' ? record.expiry : null,
      optionType,
      strike,
      daysToExpiry,
      qty: numbers.qty!, avgEntryPrice: numbers.avgEntryPrice!, currentPrice: numbers.currentPrice!,
      marketValue: numbers.marketValue!, unrealizedPl: numbers.unrealizedPl!, unrealizedPlPct: numbers.unrealizedPlPct!,
    }];
  });
}

export interface UseOptionsPositionsReturn {
  positions: OptionsPosition[];
  volumeAlerts: VolumeAlert[];
  connected: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useOptionsPositions(): UseOptionsPositionsReturn {
  const { user } = useAuth();
  const [positions, setPositions] = useState<OptionsPosition[]>([]);
  const [volumeAlerts, setVolumeAlerts] = useState<VolumeAlert[]>([]);
  const [connected, setConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!user) {
      setPositions([]);
      setVolumeAlerts([]);
      setConnected(false);
      setError(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const { data, error: fnErr } = await supabase.functions.invoke('fetch-options-positions', {
          body: {},
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (fnErr) throw new Error(fnErr.message);
        if (!cancelled) {
          setPositions(parseOptionsPositions(data?.positions));
          setVolumeAlerts(parseVolumeAlerts(data?.volumeAlerts));
          setConnected(data?.connected === true);
          if (typeof data?.error === 'string' && data.error) setError(data.error);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load options data');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, tick]);

  return { positions, volumeAlerts, connected, isLoading, error, refresh };
}
