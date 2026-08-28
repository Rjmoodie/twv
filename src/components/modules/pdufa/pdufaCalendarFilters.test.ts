import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LiveRegulatoryEvent } from '@/services/api/market-calendar-api';
import { countdown, daysBetween, isUpcomingTarget, selectPdufaEvents, todayInNewYork } from './pdufaCalendarFilters';

const event = (overrides: Partial<LiveRegulatoryEvent>): LiveRegulatoryEvent => ({
  id: 'x',
  ticker: null,
  company: 'Sponsor Inc.',
  drug: 'Drug',
  indication: 'Indication',
  eventDate: '2026-09-01',
  eventType: 'PDUFA target date',
  status: 'Scheduled target',
  applicationNumber: '',
  sourceUrl: 'https://example.com',
  confidence: 90,
  sourceType: 'issuer_compiled',
  datePrecision: 'day',
  ...overrides,
});

describe('todayInNewYork', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps the US calendar day after UTC has already rolled over', () => {
    // 03:30 UTC on the 26th is still 23:30 ET on the 25th. A UTC-derived today
    // dropped that day's pending decisions out of the upcoming view.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T03:30:00Z'));
    expect(todayInNewYork()).toBe('2026-08-25');
  });
});

describe('isUpcomingTarget', () => {
  it("treats today's target date as upcoming", () => {
    expect(isUpcomingTarget(event({ eventDate: '2026-08-25' }), '2026-08-25')).toBe(true);
  });

  it('never treats a completed FDA action as upcoming', () => {
    expect(isUpcomingTarget(event({ eventDate: '2026-12-01', sourceType: 'official_action' }), '2026-08-25')).toBe(false);
  });

  it('does not present an already-decided target as upcoming', () => {
    expect(isUpcomingTarget(event({ eventDate: '2026-12-01', status: 'Decision announced' }), '2026-08-25')).toBe(false);
  });
});

describe('selectPdufaEvents', () => {
  const items = [
    event({ id: 'future-far', eventDate: '2026-12-01', ticker: 'AAAA' }),
    event({ id: 'future-near', eventDate: '2026-08-27', ticker: 'BBBB' }),
    event({ id: 'past-target', eventDate: '2026-07-01', ticker: 'CCCC' }),
    event({ id: 'action', eventDate: '2026-08-20', sourceType: 'official_action', applicationNumber: 'NDA 012345', status: 'Approval' }),
  ];
  const today = '2026-08-25';

  it('shows only future target dates, soonest first', () => {
    expect(selectPdufaEvents(items, { mode: 'upcoming', search: '', today }).map((item) => item.id))
      .toEqual(['future-near', 'future-far']);
  });

  it('shows completed actions and elapsed targets most-recent-first', () => {
    expect(selectPdufaEvents(items, { mode: 'history', search: '', today }).map((item) => item.id))
      .toEqual(['action', 'past-target']);
  });

  it('keeps every event in All mode', () => {
    expect(selectPdufaEvents(items, { mode: 'all', search: '', today })).toHaveLength(items.length);
  });

  it('searches by ticker as well as application number', () => {
    expect(selectPdufaEvents(items, { mode: 'all', search: 'bbbb', today }).map((item) => item.id)).toEqual(['future-near']);
    expect(selectPdufaEvents(items, { mode: 'all', search: 'nda 012345', today }).map((item) => item.id)).toEqual(['action']);
  });
});

describe('daysBetween and countdown', () => {
  it('counts whole days across a DST boundary', () => {
    expect(daysBetween('2026-10-30', '2026-11-06')).toBe(7);
  });

  it('reads naturally in both directions', () => {
    expect(countdown(0)).toBe('today');
    expect(countdown(1)).toBe('tomorrow');
    expect(countdown(12)).toBe('in 12 days');
    expect(countdown(-1)).toBe('yesterday');
    expect(countdown(-4)).toBe('4 days ago');
  });
});
