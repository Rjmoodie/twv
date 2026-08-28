import type { FinancialProfile, UserMilestone, MilestoneStatus } from './coachService';
import { MILESTONES, PHASES } from '@/config/financialRoadmap';
import type { Milestone, PhaseDefinition } from '@/config/financialRoadmap';
import {
  evidenceFor,
  reconcileContribution,
  type ContributionCheck,
  type MilestoneEvidence,
  type RoadmapFacts,
} from './roadmapFacts';

// ── Output types ───────────────────────────────────────────────────────────────

export type MilestoneState = 'complete' | 'skipped' | 'in_progress' | 'locked' | 'available';

export interface RoadmapMilestone extends Milestone {
  state: MilestoneState;
  estimatedWeeks: [number, number] | null; // personalised; null if snapshot missing
  completedAt: string | null;
  notes: string | null;
  /**
   * What the rest of the app can see about this milestone. Never changes state
   * on its own — it is shown to the user, who decides.
   */
  evidence: MilestoneEvidence | null;
}

export interface RoadmapPhase extends PhaseDefinition {
  milestones: RoadmapMilestone[];
  isUnlocked: boolean;
  completedCount: number;
  totalCount: number;
}

export interface PersonalisedRoadmap {
  phases: RoadmapPhase[];
  currentPhaseId: number;
  currentMilestone: RoadmapMilestone | null;
  snapshotComplete: boolean;
  weeklyCapacity: number | null; // (take_home - expenses) / 4
  summaryText: string;           // one-line summary for the coach system prompt
  /** Snapshot capacity against the investment goal's monthly contribution. */
  contributionCheck: ContributionCheck | null;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Whether the profile carries enough stated fact to infer completion from.
 *
 * Before the snapshot exists the row is mostly column defaults, and every
 * `=== 0` predicate in the milestone config would read an untouched column as
 * "this debt is paid off". Skip conditions consult this only when they declare
 * `skipNeedsSnapshot`; the rest read intake answers, available much earlier.
 */
function canInferFromProfile(profile: FinancialProfile): boolean {
  if (profile.snapshot_completed === true) return true;
  // The journey writes real take-home and expenses into the profile without
  // completing the snapshot form (see mapJourneyToProfile). Since unset columns
  // became NULL rather than 0, a present value is self-identifying — so the flag
  // is no longer the only admissible evidence that a number was actually stated.
  return profile.monthly_take_home != null && profile.monthly_expenses != null;
}

function resolveState(
  milestone: Milestone,
  profile: FinancialProfile,
  saved: Map<string, UserMilestone>
): MilestoneState {
  const record = saved.get(milestone.id);
  // A person's decision stands. An inference does not: 'auto' rows fall through
  // to be re-derived below, so a completion drawn from a profile that has since
  // changed stops claiming to be true. Rows written before `source` existed have
  // no marker and are treated as decisions — the safe reading.
  if (record && record.source !== 'auto') return record.status as MilestoneState;

  const inferable = canInferFromProfile(profile);
  // A skip reading snapshot columns waits for the snapshot; one reading intake
  // answers (age, dependents) does not.
  if ((!milestone.skipNeedsSnapshot || inferable) && milestone.skipCondition?.(profile)) {
    return 'skipped';
  }
  if (inferable && milestone.completionCheck(profile)) return 'complete';
  return 'available'; // locked resolution happens in phase pass below
}

function estimateWeeks(
  milestone: Milestone,
  profile: FinancialProfile,
  weeklyCapacity: number | null
): [number, number] | null {
  if (!milestone.requiresSnapshot || weeklyCapacity === null) return null;
  if (weeklyCapacity <= 0) return null;
  // Guard: milestones that don't require savings have no typicalWeeks
  if (!milestone.typicalWeeks) return null;

  // Scale typical weeks by ratio: US median weekly savings ≈ $250
  const US_MEDIAN_WEEKLY = 250;
  // Bound the scale factor. Unbounded, a very high earner drives every estimate
  // to the 1-week floor below — "build a 6-month emergency fund: 1 week" — and a
  // near-zero saver pins every estimate to the 520-week cap, so neither end
  // carries information.
  const ratio = Math.min(20, Math.max(0.15, US_MEDIAN_WEEKLY / weeklyCapacity));
  const [min, max] = milestone.typicalWeeks;
  // Cap at 520 weeks (10 years) — beyond that, show as "10+ yrs" in UI rather than a huge number
  return [
    Math.min(520, Math.max(1, Math.round(min * ratio))),
    Math.min(520, Math.max(1, Math.round(max * ratio))),
  ];
}

// ── Main builder ───────────────────────────────────────────────────────────────

export function buildRoadmap(
  profile: FinancialProfile,
  savedMilestones: UserMilestone[],
  /** Live portfolio, brokerage, and goal data. Optional so callers that have
   *  none still get a roadmap rather than nothing. */
  facts: RoadmapFacts | null = null
): PersonalisedRoadmap {
  const saved = new Map(savedMilestones.map((m) => [m.milestone_id, m]));

  const snapshotComplete = profile.snapshot_completed ?? false;
  const weeklyCapacity =
    profile.monthly_take_home != null && profile.monthly_expenses != null
      ? (profile.monthly_take_home - profile.monthly_expenses) / 4.33
      : null;

  // Filter milestones: remove fork milestones whose condition isn't met
  const applicable = MILESTONES.filter(
    (m) => !m.isFork || m.forkCondition?.(profile) === true
  );

  // Build roadmap milestones with state — first pass (no locking yet)
  const withState: RoadmapMilestone[] = applicable.map((m) => ({
    ...m,
    state: resolveState(m, profile, saved),
    estimatedWeeks: estimateWeeks(m, profile, weeklyCapacity),
    completedAt: saved.get(m.id)?.completed_at ?? null,
    notes: saved.get(m.id)?.notes ?? null,
    evidence: evidenceFor(m.id, facts),
  }));

  // Second pass: lock milestones in phases whose prior phase isn't complete
  let priorPhaseComplete = true;

  for (const phase of PHASES) {
    const phaseMilestones = withState.filter((m) => m.phase === phase.id);
    if (!priorPhaseComplete) {
      for (const m of phaseMilestones) {
        if (m.state === 'available') m.state = 'locked';
      }
    }
    const phaseComplete = phaseMilestones.every(
      (m) => m.state === 'complete' || m.state === 'skipped'
    );
    priorPhaseComplete = phaseComplete;
  }

  // Build phase objects
  const phases: RoadmapPhase[] = PHASES.map((phase) => {
    const phaseMilestones = withState
      .filter((m) => m.phase === phase.id)
      .sort((a, b) => a.order - b.order);

    const completedCount = phaseMilestones.filter(
      (m) => m.state === 'complete' || m.state === 'skipped'
    ).length;

    // A phase with no applicable milestones is considered complete and transparent (skipped over)
    const isUnlocked = phaseMilestones.length === 0
      ? false
      : phaseMilestones.some((m) => m.state !== 'locked');

    return {
      ...phase,
      milestones: phaseMilestones,
      isUnlocked,
      completedCount,
      totalCount: phaseMilestones.length,
    };
  });

  // Determine current phase and active milestone.
  // If all phases are complete, show the final phase as "done" — the user has graduated.
  // phases array is guaranteed non-empty (PHASES config always has entries).
  const currentPhase =
    phases.find((p) => p.isUnlocked && p.completedCount < p.totalCount) ??
    phases.filter((p) => p.isUnlocked).at(-1) ??
    phases[phases.length - 1];

  const currentMilestone =
    currentPhase.milestones.find((m) => m.state === 'in_progress') ??
    currentPhase.milestones.find((m) => m.state === 'available') ??
    null;

  const summaryText = buildSummaryText(currentPhase, currentMilestone, weeklyCapacity, facts);

  return {
    phases,
    currentPhaseId: currentPhase.id,
    currentMilestone,
    snapshotComplete,
    weeklyCapacity: weeklyCapacity != null ? Math.round(weeklyCapacity) : null,
    summaryText,
    // weeklyCapacity is a weekly figure; the goal is stated monthly.
    contributionCheck: reconcileContribution(
      weeklyCapacity != null ? weeklyCapacity * 4.33 : null,
      facts,
    ),
  };
}

function buildSummaryText(
  phase: RoadmapPhase,
  milestone: RoadmapMilestone | null,
  weeklyCapacity: number | null,
  facts: RoadmapFacts | null
): string {
  const parts: string[] = [];
  parts.push(`Phase ${phase.id} – ${phase.title}: ${phase.subtitle}.`);
  if (milestone) {
    parts.push(`Current milestone: "${milestone.title}".`);
    if (milestone.estimatedWeeks) {
      const [min, max] = milestone.estimatedWeeks;
      parts.push(`Estimated ${min}–${max} weeks at current savings rate.`);
    }
  } else if (phase.completedCount >= phase.totalCount) {
    parts.push(`Phase complete.`);
  } else {
    // Nothing actionable but the phase is unfinished — the remainder is locked
    // behind an earlier phase. This string goes into the coach's system prompt,
    // so "Phase complete." here would have it advise against a false state.
    const remaining = phase.totalCount - phase.completedCount;
    parts.push(
      `${remaining} milestone${remaining === 1 ? '' : 's'} remaining, locked until earlier phases are complete.`
    );
  }
  if (weeklyCapacity != null) {
    parts.push(`Weekly savings capacity: $${Math.round(weeklyCapacity)}.`);
  }
  // The coach previously knew only the profile, so it would suggest opening a
  // brokerage to someone whose linked account it could already see.
  if (facts?.brokerageConnected) {
    parts.push(
      facts.brokerHoldingsCount > 0
        ? `Brokerage linked, holding ${facts.brokerHoldingsCount} position(s)` +
          (facts.investedValueUsd != null ? ` worth $${Math.round(facts.investedValueUsd)}.` : '.')
        : `Brokerage linked but holding no positions yet.`
    );
  }
  if (facts?.goal) {
    parts.push(
      `Investment goal: $${Math.round(facts.goal.targetAmountUsd)} in ${facts.goal.horizonYears} years ` +
      `at $${Math.round(facts.goal.monthlyContributionUsd)}/month.`
    );
  }
  return parts.join(' ');
}

// ── Auto-complete detector ─────────────────────────────────────────────────────

/**
 * Returns milestone IDs that should be auto-marked complete based on profile data,
 * but aren't yet recorded as complete in savedMilestones.
 */
export function detectAutoCompletions(
  profile: FinancialProfile,
  savedMilestones: UserMilestone[]
): string[] {
  // This is the write path, and a row written here outlives the data that
  // produced it. Nothing is inferred until the user has actually stated numbers.
  if (!canInferFromProfile(profile)) return [];

  const saved = new Map(savedMilestones.map((m) => [m.milestone_id, m]));
  const autoComplete: string[] = [];

  // Only check milestones that are actually applicable to this user (same filter as buildRoadmap)
  const applicable = MILESTONES.filter(
    (m) => !m.isFork || m.forkCondition?.(profile) === true
  );

  for (const milestone of applicable) {
    const existing = saved.get(milestone.id);
    // Anything a person set — complete, skipped, or in progress — is left alone.
    // Without this, a deliberate skip is silently overwritten on the next load.
    if (existing && existing.source !== 'auto') continue;
    if (existing?.status === 'complete') continue;
    if (milestone.completionCheck(profile)) {
      autoComplete.push(milestone.id);
    }
  }

  return autoComplete;
}
