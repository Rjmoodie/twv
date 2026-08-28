import { describe, expect, it } from 'vitest';
import type { CompanyStorySnapshot, StoryEvent, Catalyst } from '../story/types';
import {
  deriveInvalidationSignals,
  latestSnapshot,
  pendingReviewSnapshot,
  summarizeReviews,
  type ReviewableItem,
  type ReviewableSnapshot,
  type ThesisReview,
} from './thesisReview';

const event = (overrides: Partial<StoryEvent> = {}): StoryEvent => ({
  id: 'e1', category: 'revenue', headline: 'Revenue grew', detail: 'detail', direction: 'positive',
  change: 'strengthening', classification: 'company-reported', confidence: 'high',
  disclosureDate: '2026-02-01', reportingPeriod: '2025-12-31', evidence: [], watchNext: 'watch next',
  ...overrides,
});

const catalyst = (overrides: Partial<Catalyst> = {}): Catalyst => ({
  id: 'c1', title: 'Product cycle', rationale: 'why', status: 'typical', direction: 'mixed',
  horizon: 'medium', classification: 'typical', confidence: 'medium', signals: [], invalidation: 'no adoption',
  ...overrides,
});

const snapshot = (overrides: Partial<CompanyStorySnapshot> = {}): CompanyStorySnapshot => ({
  schemaVersion: 'story-v2', ticker: 'TEST', companyName: 'Test Co', generatedAt: '2026-02-01T00:00:00Z',
  sourceAsOf: '2026-02-01T00:00:00Z', reportingPeriod: '2025-12-31', summary: 'summary',
  events: [], catalysts: [], macroExposures: [], limitations: [],
  ...overrides,
});

const row = (id: string, sourceAsOf: string, payload = snapshot()): ReviewableSnapshot => ({
  id, source_as_of: sourceAsOf, snapshot: payload,
});

const thesisItem = (overrides: Partial<ReviewableItem> = {}): ReviewableItem => ({
  tracking_mode: 'thesis',
  thesis_summary: 'Margins expand as the platform scales',
  thesis_invalidation: 'Gross margin falls below 40% for two consecutive quarters',
  ...overrides,
});

const review = (overrides: Partial<ThesisReview> = {}): ThesisReview => ({
  id: 'r1', watchlist_id: 'w1', snapshot_id: 's1', verdict: 'holds', note: null,
  thesis_invalidation_at_review: 'condition', created_at: '2026-02-02T00:00:00Z',
  ...overrides,
});

describe('invalidation signals', () => {
  it('puts contradicting evidence ahead of supporting evidence so the adverse case is met first', () => {
    const signals = deriveInvalidationSignals(snapshot({
      events: [
        event({ id: 'good', direction: 'positive', change: 'strengthening' }),
        event({ id: 'bad', direction: 'negative', change: 'reversed' }),
      ],
    }));
    expect(signals.map((signal) => signal.id)).toEqual(['event:bad', 'event:good']);
    expect(signals[0].weight).toBe('contradicts');
  });

  it('treats an invalidated catalyst as contradicting and a delayed one as merely weakening', () => {
    const signals = deriveInvalidationSignals(snapshot({
      catalysts: [catalyst({ id: 'late', status: 'delayed' }), catalyst({ id: 'dead', status: 'invalidated' })],
    }));
    expect(signals.map((signal) => [signal.id, signal.weight])).toEqual([
      ['catalyst:dead', 'contradicts'],
      ['catalyst:late', 'weakens'],
    ]);
  });

  it('ignores unchanged events and typical catalysts rather than padding the list with non-evidence', () => {
    const signals = deriveInvalidationSignals(snapshot({
      events: [event({ direction: 'neutral', change: 'unchanged' })],
      catalysts: [catalyst({ status: 'typical' })],
    }));
    expect(signals).toEqual([]);
  });

  it('survives a snapshot whose arrays are absent rather than throwing on a legacy payload', () => {
    const legacy = { ...snapshot(), events: undefined, catalysts: undefined } as unknown as CompanyStorySnapshot;
    expect(deriveInvalidationSignals(legacy)).toEqual([]);
  });
});

describe('picking the chapter to grade', () => {
  it('finds the newest snapshot even when the list arrives unsorted', () => {
    const found = latestSnapshot([row('a', '2026-01-01'), row('c', '2026-03-01'), row('b', '2026-02-01')]);
    expect(found?.id).toBe('c');
  });

  it('breaks identical timestamps deterministically instead of depending on array order', () => {
    const forward = latestSnapshot([row('a', '2026-01-01'), row('b', '2026-01-01')]);
    const reverse = latestSnapshot([row('b', '2026-01-01'), row('a', '2026-01-01')]);
    expect(forward?.id).toBe(reverse?.id);
  });

  it('returns null for an empty history', () => {
    expect(latestSnapshot([])).toBeNull();
  });
});

describe('when a review is owed', () => {
  it('asks for a verdict on the newest ungraded snapshot', () => {
    const pending = pendingReviewSnapshot(thesisItem(), [row('s1', '2026-01-01'), row('s2', '2026-02-01')], []);
    expect(pending?.id).toBe('s2');
  });

  it('stops asking once that snapshot has been graded', () => {
    const snapshots = [row('s1', '2026-01-01'), row('s2', '2026-02-01')];
    expect(pendingReviewSnapshot(thesisItem(), snapshots, [review({ snapshot_id: 's2' })])).toBeNull();
  });

  it('asks again when a newer snapshot arrives after an earlier verdict', () => {
    const snapshots = [row('s1', '2026-01-01'), row('s2', '2026-02-01'), row('s3', '2026-03-01')];
    expect(pendingReviewSnapshot(thesisItem(), snapshots, [review({ snapshot_id: 's2' })])?.id).toBe('s3');
  });

  it('does not chase an older ungraded chapter the user has already been overtaken by', () => {
    const snapshots = [row('s1', '2026-01-01'), row('s2', '2026-02-01')];
    expect(pendingReviewSnapshot(thesisItem(), snapshots, [review({ snapshot_id: 's2' })])).toBeNull();
  });

  it('stays silent for price- and story-tracked items, which never stated a condition', () => {
    const snapshots = [row('s1', '2026-01-01')];
    expect(pendingReviewSnapshot(thesisItem({ tracking_mode: 'price' }), snapshots, [])).toBeNull();
    expect(pendingReviewSnapshot(thesisItem({ tracking_mode: 'story' }), snapshots, [])).toBeNull();
  });

  it('stays silent when the invalidation condition is missing or only whitespace', () => {
    const snapshots = [row('s1', '2026-01-01')];
    expect(pendingReviewSnapshot(thesisItem({ thesis_invalidation: null }), snapshots, [])).toBeNull();
    expect(pendingReviewSnapshot(thesisItem({ thesis_invalidation: '   ' }), snapshots, [])).toBeNull();
  });

  it('stays silent with no snapshots and with no item at all', () => {
    expect(pendingReviewSnapshot(thesisItem(), [], [])).toBeNull();
    expect(pendingReviewSnapshot(null, [row('s1', '2026-01-01')], [])).toBeNull();
  });
});

describe('track record', () => {
  it('excludes admitted-unclear reviews from the hold rate so honesty is not penalised', () => {
    const record = summarizeReviews([
      review({ id: '1', verdict: 'holds' }),
      review({ id: '2', verdict: 'invalidated' }),
      review({ id: '3', verdict: 'unclear' }),
    ]);
    expect(record.total).toBe(3);
    expect(record.unclear).toBe(1);
    expect(record.holdRate).toBe(50);
  });

  it('reports no hold rate rather than zero when every review was unclear', () => {
    const record = summarizeReviews([review({ verdict: 'unclear' })]);
    expect(record.holdRate).toBeNull();
  });

  it('reports the most recent verdict regardless of the order reviews arrive in', () => {
    const record = summarizeReviews([
      review({ id: '1', verdict: 'holds', created_at: '2026-01-01T00:00:00Z' }),
      review({ id: '2', verdict: 'invalidated', created_at: '2026-03-01T00:00:00Z' }),
      review({ id: '3', verdict: 'holds', created_at: '2026-02-01T00:00:00Z' }),
    ]);
    expect(record.lastVerdict).toBe('invalidated');
    expect(record.lastReviewedAt).toBe('2026-03-01T00:00:00Z');
  });

  it('returns an empty record for no reviews', () => {
    expect(summarizeReviews([])).toMatchObject({ total: 0, holdRate: null, lastVerdict: null });
  });
});
