import type { LiveRegulatoryEvent } from '@/services/api/market-calendar-api';
import { calendarDayInTimeZone } from '@/lib/calendarDate';

export type PDUFAMode = 'upcoming' | 'all' | 'history';

/**
 * A PDUFA goal date is a US calendar date. A UTC "today" rolls over at 8pm ET,
 * which would file the current day's pending decisions under History for the
 * rest of the evening — exactly when people look for them.
 */
export const todayInNewYork = calendarDayInTimeZone;

/** Whole days from one ISO day to another, immune to DST because both ends sit at midday UTC. */
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

export const countdown = (days: number) =>
  days === 0 ? 'today'
    : days === 1 ? 'tomorrow'
      : days > 0 ? `in ${days} days`
        : days === -1 ? 'yesterday'
          : `${Math.abs(days)} days ago`;

export const formatEventDate = (eventDate: string, approximate: boolean) =>
  new Date(`${eventDate}T12:00:00`).toLocaleDateString(
    undefined,
    approximate ? { month: 'short', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' },
  );

/**
 * Only sponsor-announced target dates can be upcoming. A completed Drugs@FDA
 * action is history by definition, so it must never be presented as a decision
 * still to come — even on the day it was published.
 */
export const isUpcomingTarget = (item: LiveRegulatoryEvent, today: string) =>
  item.sourceType !== 'official_action'
  && !/decision announced|decided|approved|rejected|withdrawn|complete response/i.test(item.status)
  && item.eventDate >= today;

export function selectPdufaEvents(
  items: LiveRegulatoryEvent[],
  { mode, search, today }: { mode: PDUFAMode; search: string; today: string },
): LiveRegulatoryEvent[] {
  const needle = search.trim().toLowerCase();
  return items
    .filter((item) => {
      const upcoming = isUpcomingTarget(item, today);
      const inMode = mode === 'all' || (mode === 'upcoming' ? upcoming : !upcoming);
      const haystack = `${item.ticker ?? ''} ${item.company} ${item.drug} ${item.indication} ${item.applicationNumber} ${item.status}`;
      return inMode && (!needle || haystack.toLowerCase().includes(needle));
    })
    // Upcoming reads soonest-first; history reads most-recent-first.
    .sort((a, b) => (mode === 'history' ? b.eventDate.localeCompare(a.eventDate) : a.eventDate.localeCompare(b.eventDate)));
}
