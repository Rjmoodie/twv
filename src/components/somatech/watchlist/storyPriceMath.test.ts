import { describe, expect, it } from 'vitest';
import type { CompanyStorySnapshot, StoryEvent } from '../story/types';
import {
  alignDisclosureToTradingSession,
  buildStoryMarkers,
  classifyDisclosure,
  findMarkerForEvent,
  type StoryPricePoint,
} from './storyPriceMath';

const series: StoryPricePoint[] = [
  { date: '2026-08-21', close: 100, volume: 10 },
  { date: '2026-08-24', close: 102, volume: 12 },
  { date: '2026-08-25', close: 101, volume: null },
];

const event = (overrides: Partial<StoryEvent> = {}): StoryEvent => ({
  id: 'revenue:2026-06-30', category: 'revenue', headline: 'Revenue increased 16.4%', detail: 'detail',
  direction: 'positive', change: 'strengthening', classification: 'calculated', confidence: 'high',
  disclosureDate: '2026-08-24', reportingPeriod: '2026-06-30', evidence: [], watchNext: 'watch',
  ...overrides,
});

const snapshot = (sourceAsOf: string, events: StoryEvent[]): CompanyStorySnapshot => ({
  schemaVersion: 'story-v2', ticker: 'TEST', companyName: 'Test Co', generatedAt: sourceAsOf,
  sourceAsOf, reportingPeriod: '2026-06-30', summary: 'summary',
  events, catalysts: [], macroExposures: [], limitations: [],
});

describe('alignDisclosureToTradingSession', () => {
  it('keeps a trading-day disclosure on that session', () => expect(alignDisclosureToTradingSession(series, '2026-08-24')?.date).toBe('2026-08-24'));
  it('moves a weekend disclosure to the next available session', () => expect(alignDisclosureToTradingSession(series, '2026-08-22')?.date).toBe('2026-08-24'));
  it('does not misplace events outside the available price range', () => {
    expect(alignDisclosureToTradingSession(series, '2026-08-20')).toBeNull();
    expect(alignDisclosureToTradingSession(series, '2026-08-26')).toBeNull();
  });
  it('rejects ambiguous dates', () => expect(alignDisclosureToTradingSession(series, 'next quarter')).toBeNull());
});

describe('classifyDisclosure', () => {
  it('separates before-window from after-window so each can be explained differently', () => {
    expect(classifyDisclosure(series, '2026-08-20').status).toBe('before-window');
    expect(classifyDisclosure(series, '2026-08-26').status).toBe('after-window');
  });

  it('treats a missing date as undated rather than as out of range', () => {
    expect(classifyDisclosure(series, null).status).toBe('undated');
    expect(classifyDisclosure(series, '').status).toBe('undated');
  });

  it('rejects dates that pass a shape check but are not real days', () => {
    expect(classifyDisclosure(series, '2026-13-01').status).toBe('undated');
    expect(classifyDisclosure(series, '2026-02-30').status).toBe('undated');
  });

  it('accepts a full timestamp by reading its calendar day', () => {
    const result = classifyDisclosure(series, '2026-08-24T21:30:00Z');
    expect(result.status === 'aligned' && result.point.date).toBe('2026-08-24');
  });

  it('places events correctly even when the series arrives unsorted', () => {
    const shuffled = [series[2], series[0], series[1]];
    const result = classifyDisclosure(shuffled, '2026-08-22');
    expect(result.status === 'aligned' && result.point.date).toBe('2026-08-24');
    expect(classifyDisclosure(shuffled, '2026-08-20').status).toBe('before-window');
  });
});

describe('buildStoryMarkers', () => {
  it('groups events from one filing onto a single session instead of stacking dots invisibly', () => {
    const revenue = event({ id: 'revenue:2026-06-30' });
    const margin = event({ id: 'margin:2026-06-30', headline: 'Gross margin expanded 3.6 percentage points' });
    const result = buildStoryMarkers(series, [snapshot('2026-08-24T00:00:00Z', [revenue, margin])]);

    expect(result.markers).toHaveLength(1);
    expect(result.markers[0].events).toHaveLength(2);
    expect(result.plottedEventCount).toBe(2);
  });

  it('reports a filing that both grew and compressed as mixed rather than taking the first direction', () => {
    const good = event({ id: 'revenue:2026-06-30', direction: 'positive' });
    const bad = event({ id: 'margin:2026-06-30', direction: 'negative' });
    const result = buildStoryMarkers(series, [snapshot('2026-08-24T00:00:00Z', [good, bad])]);
    expect(result.markers[0].direction).toBe('mixed');
  });

  it('keeps the newest chapter version of a revised event, not the oldest', () => {
    const older = event({ headline: 'Revenue increased 15.0%' });
    const newer = event({ headline: 'Revenue increased 16.4%' });
    const result = buildStoryMarkers(series, [
      snapshot('2026-09-01T00:00:00Z', [newer]),
      snapshot('2026-08-01T00:00:00Z', [older]),
    ]);
    expect(result.markers[0].events[0].headline).toBe('Revenue increased 16.4%');
  });

  it('is not fooled by chapters passed oldest-first', () => {
    const older = event({ headline: 'Revenue increased 15.0%' });
    const newer = event({ headline: 'Revenue increased 16.4%' });
    const result = buildStoryMarkers(series, [
      snapshot('2026-08-01T00:00:00Z', [older]),
      snapshot('2026-09-01T00:00:00Z', [newer]),
    ]);
    expect(result.markers[0].events[0].headline).toBe('Revenue increased 16.4%');
  });

  it('accounts for every event it cannot plot instead of dropping it silently', () => {
    const result = buildStoryMarkers(series, [snapshot('2026-08-24T00:00:00Z', [
      event({ id: 'a', disclosureDate: '2026-08-24' }),
      event({ id: 'b', disclosureDate: null }),
      event({ id: 'c', disclosureDate: '2020-01-01' }),
      event({ id: 'd', disclosureDate: '2027-01-01' }),
    ])]);

    expect(result.plottedEventCount).toBe(1);
    expect(result.undated.map((entry) => entry.id)).toEqual(['b']);
    expect(result.beforeWindow.map((entry) => entry.id)).toEqual(['c']);
    expect(result.afterWindow.map((entry) => entry.id)).toEqual(['d']);
  });

  it('orders markers chronologically so the chart legend reads left to right', () => {
    const result = buildStoryMarkers(series, [snapshot('2026-08-25T00:00:00Z', [
      event({ id: 'late', disclosureDate: '2026-08-25' }),
      event({ id: 'early', disclosureDate: '2026-08-21' }),
    ])]);
    expect(result.markers.map((marker) => marker.key)).toEqual(['2026-08-21', '2026-08-25']);
  });

  it('returns an empty set for no snapshots and for an empty price series', () => {
    expect(buildStoryMarkers(series, []).markers).toEqual([]);
    const noPrices = buildStoryMarkers([], [snapshot('2026-08-24T00:00:00Z', [event()])]);
    expect(noPrices.markers).toEqual([]);
    expect(noPrices.afterWindow).toHaveLength(1);
  });

  it('tolerates a legacy chapter with no events array', () => {
    const legacy = { ...snapshot('2026-08-24T00:00:00Z', []), events: undefined } as unknown as CompanyStorySnapshot;
    expect(buildStoryMarkers(series, [legacy]).markers).toEqual([]);
  });
});

describe('findMarkerForEvent', () => {
  it('finds the session holding an event so selection can drive the chart', () => {
    const { markers } = buildStoryMarkers(series, [snapshot('2026-08-24T00:00:00Z', [
      event({ id: 'revenue:2026-06-30' }),
      event({ id: 'margin:2026-06-30' }),
    ])]);
    expect(findMarkerForEvent(markers, 'margin:2026-06-30')?.key).toBe('2026-08-24');
  });

  it('returns null for an unknown or absent event rather than guessing', () => {
    const { markers } = buildStoryMarkers(series, [snapshot('2026-08-24T00:00:00Z', [event()])]);
    expect(findMarkerForEvent(markers, 'nope')).toBeNull();
    expect(findMarkerForEvent(markers, null)).toBeNull();
  });
});
