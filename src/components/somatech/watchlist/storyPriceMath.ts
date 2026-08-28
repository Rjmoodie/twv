import type { CompanyStorySnapshot, StoryDirection, StoryEvent } from '../story/types';

export interface StoryPricePoint { date: string; close: number; volume: number | null }

/** Rejects impossible dates that a bare shape check would wave through (2026-13-45, 2026-02-30). */
function isCalendarDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

export type DisclosureAlignment =
  | { status: 'aligned'; point: StoryPricePoint }
  | { status: 'before-window' }
  | { status: 'after-window' }
  | { status: 'undated' };

/**
 * Places a disclosure on the price series, and says why when it cannot.
 *
 * The distinction matters for what the reader is told. An event that predates the
 * available price window is not the same as an event with no disclosure date at
 * all, and neither is the same as no event — but all three used to collapse into
 * a silent null, so a story with six events could render two dots and explain
 * nothing about the other four.
 *
 * Order-independent: it does not assume the caller sorted the series, because a
 * series that arrives out of order would otherwise fail the range check and drop
 * every marker without a word.
 */
export function classifyDisclosure(series: StoryPricePoint[], disclosureDate: string | null | undefined): DisclosureAlignment {
  if (!disclosureDate) return { status: 'undated' };
  const day = disclosureDate.slice(0, 10);
  if (!isCalendarDay(day)) return { status: 'undated' };
  if (!series.length) return { status: 'after-window' };

  let earliest = series[0];
  let latest = series[0];
  let firstOnOrAfter: StoryPricePoint | null = null;
  for (const point of series) {
    if (point.date < earliest.date) earliest = point;
    if (point.date > latest.date) latest = point;
    // Do not pin an out-of-range event to a chart boundary; that would falsely
    // imply it happened on the first or last visible trading session.
    if (point.date >= day && (!firstOnOrAfter || point.date < firstOnOrAfter.date)) firstOnOrAfter = point;
  }

  if (day < earliest.date) return { status: 'before-window' };
  if (day > latest.date) return { status: 'after-window' };
  return firstOnOrAfter ? { status: 'aligned', point: firstOnOrAfter } : { status: 'after-window' };
}

/** Back-compatible thin wrapper: the aligned point, or null for every other outcome. */
export function alignDisclosureToTradingSession(series: StoryPricePoint[], disclosureDate: string): StoryPricePoint | null {
  const result = classifyDisclosure(series, disclosureDate);
  return result.status === 'aligned' ? result.point : null;
}

export interface StoryMarker {
  /** The plotted trading session. One marker per session, however many events share it. */
  key: string;
  point: StoryPricePoint;
  events: StoryEvent[];
  /** Aggregate of the events sharing this session. */
  direction: StoryDirection;
}

export interface StoryMarkerSet {
  markers: StoryMarker[];
  /** Events whose filing supplied no disclosure date — real, but unplaceable. */
  undated: StoryEvent[];
  /** Dated events older than the available price window. */
  beforeWindow: StoryEvent[];
  /** Dated events newer than the last close, e.g. a filing landing after the cache refreshed. */
  afterWindow: StoryEvent[];
  /** Distinct events represented across all markers. */
  plottedEventCount: number;
}

/**
 * Aggregate direction for events sharing one session.
 *
 * A filing that grew revenue while compressing margin is genuinely mixed, and
 * colouring that session green because the first event happened to be positive
 * would misreport it.
 */
function aggregateDirection(events: StoryEvent[]): StoryDirection {
  const positive = events.some((event) => event.direction === 'positive');
  const negative = events.some((event) => event.direction === 'negative');
  if (positive && negative) return 'mixed';
  if (positive) return 'positive';
  if (negative) return 'negative';
  return events.some((event) => event.direction === 'mixed') ? 'mixed' : 'neutral';
}

/**
 * Builds the plottable markers for a set of story chapters.
 *
 * Two behaviours worth stating, because both were previously wrong:
 *
 * 1. Every event derived from one filing carries that filing's date, so events
 *    from the same 10-Q always resolve to the same session at the same close.
 *    Rendering one dot per event stacked them on a single pixel: the footer
 *    counted four, the eye saw one, and only the topmost was clickable. Markers
 *    are therefore grouped by session, and the group carries its events.
 *
 * 2. The same event id recurs across chapters as figures are revised. The newest
 *    chapter's version wins — previously the oldest did, because the dedupe map
 *    overwrote in iteration order and callers pass newest-first.
 */
export function buildStoryMarkers(series: StoryPricePoint[], snapshots: CompanyStorySnapshot[]): StoryMarkerSet {
  // Newest chapter first, independent of how the caller ordered them.
  const ordered = [...snapshots].sort((a, b) => (b.sourceAsOf ?? '').localeCompare(a.sourceAsOf ?? ''));

  const newestVersion = new Map<string, StoryEvent>();
  for (const snapshot of ordered) {
    for (const event of snapshot.events ?? []) {
      if (!newestVersion.has(event.id)) newestVersion.set(event.id, event);
    }
  }

  const bySession = new Map<string, { point: StoryPricePoint; events: StoryEvent[] }>();
  const undated: StoryEvent[] = [];
  const beforeWindow: StoryEvent[] = [];
  const afterWindow: StoryEvent[] = [];

  for (const event of newestVersion.values()) {
    const alignment = classifyDisclosure(series, event.disclosureDate);
    if (alignment.status === 'undated') { undated.push(event); continue; }
    if (alignment.status === 'before-window') { beforeWindow.push(event); continue; }
    if (alignment.status === 'after-window') { afterWindow.push(event); continue; }

    const existing = bySession.get(alignment.point.date);
    if (existing) existing.events.push(event);
    else bySession.set(alignment.point.date, { point: alignment.point, events: [event] });
  }

  const markers = [...bySession.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { point, events }]) => ({ key, point, events, direction: aggregateDirection(events) }));

  return {
    markers,
    undated,
    beforeWindow,
    afterWindow,
    plottedEventCount: markers.reduce((sum, marker) => sum + marker.events.length, 0),
  };
}

/** The marker holding a given event, for driving selection from the legend or the story panel. */
export function findMarkerForEvent(markers: StoryMarker[], eventId: string | null | undefined): StoryMarker | null {
  if (!eventId) return null;
  return markers.find((marker) => marker.events.some((event) => event.id === eventId)) ?? null;
}
