import type { FinancialEvent } from '@/services/financialCalendarService';

export type CalendarSourceFilter = 'all' | 'earnings' | 'pdufa' | 'macro' | 'personal' | 'relevant';
export type CalendarStatusFilter = 'all' | 'upcoming' | 'completed';

interface CalendarFilterOptions {
  source: CalendarSourceFilter;
  status: CalendarStatusFilter;
  search: string;
  today: string;
}

export function filterCalendarEvents(
  events: FinancialEvent[],
  { source, status, search, today }: CalendarFilterOptions,
): FinancialEvent[] {
  const query = search.trim().toLocaleLowerCase();

  return events.filter((event) => {
    const isMarketEvent = event.event_type === 'earnings' || event.event_type === 'pdufa' || event.event_type === 'macro';
    const sourceMatches = source === 'all'
      || event.event_type === source
      || (source === 'relevant' && event.metadata.relevant === true)
      || (source === 'personal' && !isMarketEvent);
    const marketComplete = isMarketEvent && (event.event_date < today || /decision announced|decided|approved|rejected|withdrawn|complete response/i.test(String(event.metadata.status ?? '')));
    const completed = event.is_completed || marketComplete;
    const statusMatches = status === 'all' || (status === 'completed' ? completed : !completed && event.event_date >= today);
    const searchableText = `${event.title} ${event.description ?? ''}`.toLocaleLowerCase();

    return sourceMatches && statusMatches && (!query || searchableText.includes(query));
  });
}
