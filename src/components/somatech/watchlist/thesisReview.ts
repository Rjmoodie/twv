/**
 * Thesis review — closing the loop between a stated thesis and what actually happened.
 *
 * A user saving a ticker with Thesis tracking writes down, in advance, what would
 * make them wrong (`watchlist.thesis_invalidation`). Story snapshots then accumulate
 * over time. Until now nothing ever compared the two: the prediction was recorded
 * and never graded, which makes the watchlist a store rather than a feedback loop.
 *
 * This module supplies the comparison step. It is deliberately pure — no Supabase,
 * no React — so the rules about when a review is owed, and what in a new snapshot
 * bears on the thesis, are testable in isolation.
 *
 * What it does NOT do: decide whether the thesis is actually broken. That judgement
 * is the user's, and recording it honestly is the entire point. This module only
 * surfaces the evidence and asks the question.
 */

import type { CompanyStorySnapshot } from '../story/types';

export type ThesisVerdict = 'holds' | 'invalidated' | 'unclear';

/** A recorded verdict. One per snapshot; see the thesis_reviews migration. */
export interface ThesisReview {
  id: string;
  watchlist_id: string;
  snapshot_id: string;
  verdict: ThesisVerdict;
  note: string | null;
  /** The invalidation condition as written at review time, copied so later edits cannot rewrite history. */
  thesis_invalidation_at_review: string | null;
  created_at: string;
}

/** The minimum a snapshot row needs to expose for this module to work with it. */
export interface ReviewableSnapshot {
  id: string;
  source_as_of: string;
  snapshot: CompanyStorySnapshot;
}

/** The minimum a watchlist row needs to expose. */
export interface ReviewableItem {
  tracking_mode: string | null;
  thesis_summary: string | null;
  thesis_invalidation: string | null;
}

export type SignalWeight = 'contradicts' | 'weakens' | 'supports';

export interface InvalidationSignal {
  id: string;
  headline: string;
  detail: string;
  weight: SignalWeight;
  origin: 'event' | 'catalyst';
}

const WEIGHT_ORDER: Record<SignalWeight, number> = {
  contradicts: 0,
  weakens: 1,
  supports: 2,
};

const hasText = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Pulls out of a snapshot the items that bear on whether a thesis still stands.
 *
 * Ordered most adverse first: a reader checking their own invalidation condition
 * should meet the contradicting evidence before the reassuring evidence, not have
 * to hunt for it underneath.
 */
export function deriveInvalidationSignals(snapshot: CompanyStorySnapshot): InvalidationSignal[] {
  const signals: InvalidationSignal[] = [];

  for (const event of snapshot.events ?? []) {
    let weight: SignalWeight | null = null;
    if (event.change === 'contradicted' || event.change === 'reversed') weight = 'contradicts';
    else if (event.change === 'weakening' || event.direction === 'negative') weight = 'weakens';
    else if (event.direction === 'positive' && (event.change === 'strengthening' || event.change === 'new')) weight = 'supports';
    if (!weight) continue;
    signals.push({
      id: `event:${event.id}`,
      headline: event.headline,
      detail: event.watchNext || event.detail,
      weight,
      origin: 'event',
    });
  }

  for (const catalyst of snapshot.catalysts ?? []) {
    let weight: SignalWeight | null = null;
    if (catalyst.status === 'invalidated') weight = 'contradicts';
    else if (catalyst.status === 'delayed') weight = 'weakens';
    else if (catalyst.status === 'realized') weight = 'supports';
    if (!weight) continue;
    signals.push({
      id: `catalyst:${catalyst.id}`,
      headline: catalyst.title,
      detail: catalyst.invalidation,
      weight,
      origin: 'catalyst',
    });
  }

  // Stable sort: adverse first, original order preserved within a weight.
  return signals
    .map((signal, index) => ({ signal, index }))
    .sort((a, b) => WEIGHT_ORDER[a.signal.weight] - WEIGHT_ORDER[b.signal.weight] || a.index - b.index)
    .map(({ signal }) => signal);
}

/**
 * The newest snapshot by `source_as_of`.
 *
 * Callers fetch ordered, but this must not depend on that: an unsorted or
 * equal-timestamped list would otherwise silently grade the wrong chapter.
 * Ties break on id so the choice is deterministic across renders.
 */
export function latestSnapshot(snapshots: ReviewableSnapshot[]): ReviewableSnapshot | null {
  let best: ReviewableSnapshot | null = null;
  for (const candidate of snapshots) {
    if (!best) {
      best = candidate;
      continue;
    }
    if (candidate.source_as_of > best.source_as_of) best = candidate;
    else if (candidate.source_as_of === best.source_as_of && candidate.id > best.id) best = candidate;
  }
  return best;
}

/**
 * The snapshot currently owed a verdict, or null when nothing is owed.
 *
 * A review is owed when the item is thesis-tracked with a written invalidation
 * condition, at least one snapshot exists, and the newest one has not been graded.
 * Older ungraded snapshots are deliberately not chased — asking someone to grade a
 * stale chapter they have already been overtaken by is noise, not reflection.
 */
export function pendingReviewSnapshot(
  item: ReviewableItem | null | undefined,
  snapshots: ReviewableSnapshot[],
  reviews: Pick<ThesisReview, 'snapshot_id'>[],
): ReviewableSnapshot | null {
  if (!item) return null;
  if (item.tracking_mode !== 'thesis') return null;
  if (!hasText(item.thesis_invalidation)) return null;

  const latest = latestSnapshot(snapshots);
  if (!latest) return null;

  const graded = new Set(reviews.map((review) => review.snapshot_id));
  return graded.has(latest.id) ? null : latest;
}

export interface ThesisTrackRecord {
  total: number;
  holds: number;
  invalidated: number;
  unclear: number;
  /** Share of decided reviews that held. Null when nothing has been decided yet. */
  holdRate: number | null;
  lastVerdict: ThesisVerdict | null;
  lastReviewedAt: string | null;
}

/**
 * A user's own record on this idea.
 *
 * `holdRate` excludes 'unclear' — counting an admitted non-answer as either a hit
 * or a miss would flatter or punish the user for the one honest option, which is
 * exactly the behaviour that stops people using it.
 */
export function summarizeReviews(reviews: ThesisReview[]): ThesisTrackRecord {
  const holds = reviews.filter((review) => review.verdict === 'holds').length;
  const invalidated = reviews.filter((review) => review.verdict === 'invalidated').length;
  const unclear = reviews.filter((review) => review.verdict === 'unclear').length;
  const decided = holds + invalidated;

  let last: ThesisReview | null = null;
  for (const review of reviews) {
    if (!last || review.created_at > last.created_at) last = review;
  }

  return {
    total: reviews.length,
    holds,
    invalidated,
    unclear,
    holdRate: decided > 0 ? (holds / decided) * 100 : null,
    lastVerdict: last?.verdict ?? null,
    lastReviewedAt: last?.created_at ?? null,
  };
}
