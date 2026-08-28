import { supabase } from '@/integrations/supabase/client';

export interface CalendarResponse<T> {
  items: T[];
  source: string;
  sourceUrl?: string;
  fetchedAt: string;
  cached: boolean;
  stale: boolean;
  warning?: string;
  health?: Record<string, unknown> | null;
}

export interface LiveEarningsEvent {
  symbol: string;
  name: string;
  reportDate: string;
  fiscalDateEnding: string;
  estimate: string;
  currency: string;
  time: string;
  sourceUrl: string;
}

export interface LiveRegulatoryEvent {
  id: string;
  ticker: string | null;
  company: string;
  drug: string;
  indication: string;
  eventDate: string;
  eventType: string;
  status: string;
  applicationNumber: string;
  sourceUrl: string;
  confidence: number;
  sourceType?: 'issuer_compiled' | 'official_action';
  /** 'approximate' means the source only committed to a month or quarter. */
  datePrecision?: 'day' | 'approximate';
}

export interface LiveMacroEvent {
  id: string;
  title: string;
  eventDate: string;
  time: string;
  timezone: 'America/New_York';
  agency: 'BLS' | 'BEA' | 'Federal Reserve';
  impact: 'high' | 'medium';
  sourceUrl: string;
  period?: string;
}

async function load<T>(kind: 'earnings' | 'pdufa' | 'macro', force = false): Promise<CalendarResponse<T>> {
  const { data, error } = await supabase.functions.invoke('market-calendar', { body: { kind, force } });
  if (error) throw new Error(error.message || 'Live calendar data is unavailable');
  if (!data || !Array.isArray(data.items)) throw new Error('The calendar service returned an invalid response');
  return data as CalendarResponse<T>;
}

export const marketCalendarAPI = {
  earnings: (force = false) => load<LiveEarningsEvent>('earnings', force),
  regulatory: (force = false) => load<LiveRegulatoryEvent>('pdufa', force),
  macro: (force = false) => load<LiveMacroEvent>('macro', force),
};
