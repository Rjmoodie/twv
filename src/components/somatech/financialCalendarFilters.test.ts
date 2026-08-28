import { describe, expect, it } from 'vitest';
import type { EventType, FinancialEvent } from '@/services/financialCalendarService';
import { filterCalendarEvents } from './financialCalendarFilters';

function event(
  id: string,
  eventType: EventType,
  date: string,
  overrides: Partial<FinancialEvent> = {},
): FinancialEvent {
  return {
    id,
    user_id: 'user-1',
    title: id,
    description: null,
    event_date: date,
    event_type: eventType,
    journey_id: null,
    category: eventType === 'earnings' || eventType === 'pdufa' || eventType === 'macro' ? 'market' : 'general',
    is_completed: false,
    completed_at: null,
    color: null,
    metadata: {},
    created_at: '2026-08-25T00:00:00Z',
    updated_at: '2026-08-25T00:00:00Z',
    ...overrides,
  };
}

const events = [
  event('NVDA earnings', 'earnings', '2026-08-26', { description: 'After market close' }),
  event('FDA decision', 'pdufa', '2026-08-27', { description: 'Somatide approval action' }),
  event('CPI release', 'macro', '2026-09-11', { description: 'BLS · 8:30 AM ET · High impact' }),
  event('Pay mortgage', 'bill', '2026-08-28'),
  event('Old reminder', 'custom', '2026-08-20'),
  event('Finished goal', 'savings_target', '2026-08-24', { is_completed: true }),
];

describe('filterCalendarEvents', () => {
  it('keeps earnings, FDA and macro sources independently filterable', () => {
    expect(filterCalendarEvents(events, { source: 'earnings', status: 'all', search: '', today: '2026-08-25' }).map(({ id }) => id)).toEqual(['NVDA earnings']);
    expect(filterCalendarEvents(events, { source: 'pdufa', status: 'all', search: '', today: '2026-08-25' }).map(({ id }) => id)).toEqual(['FDA decision']);
    expect(filterCalendarEvents(events, { source: 'macro', status: 'all', search: '', today: '2026-08-25' }).map(({ id }) => id)).toEqual(['CPI release']);
  });

  it('defines personal events as everything outside market feeds', () => {
    expect(filterCalendarEvents(events, { source: 'personal', status: 'all', search: '', today: '2026-08-25' }).map(({ id }) => id)).toEqual([
      'Pay mortgage', 'Old reminder', 'Finished goal',
    ]);
  });

  it('shows only incomplete, non-past events for upcoming', () => {
    expect(filterCalendarEvents(events, { source: 'all', status: 'upcoming', search: '', today: '2026-08-25' }).map(({ id }) => id)).toEqual([
      'NVDA earnings', 'FDA decision', 'CPI release', 'Pay mortgage',
    ]);
  });

  it('searches titles and descriptions without case sensitivity', () => {
    expect(filterCalendarEvents(events, { source: 'all', status: 'all', search: 'SOMATIDE', today: '2026-08-25' }).map(({ id }) => id)).toEqual(['FDA decision']);
  });

  it('can focus on holdings and watchlist relevance', () => {
    const marked = events.map((item) => item.id === 'NVDA earnings' ? { ...item, metadata: { relevant: true } } : item);
    expect(filterCalendarEvents(marked, { source: 'relevant', status: 'all', search: '', today: '2026-08-25' }).map(({ id }) => id)).toEqual(['NVDA earnings']);
  });

  it('treats elapsed market events and decided regulatory targets as completed', () => {
    const decided = event('Decision done', 'pdufa', '2026-09-01', { metadata: { status: 'Decision announced' } });
    expect(filterCalendarEvents([...events, decided], { source: 'all', status: 'completed', search: '', today: '2026-08-25' }).map(({ id }) => id)).toEqual([
      'Finished goal', 'Decision done',
    ]);
  });
});
