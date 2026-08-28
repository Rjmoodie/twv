import { describe, expect, it } from 'vitest';
import { buildRoadmap, detectAutoCompletions } from './roadmapService';
import type { FinancialProfile, UserMilestone } from './coachService';

/**
 * The bug these pin down: financial_profiles shipped its snapshot columns with
 * DEFAULT 0, so a brand-new row was indistinguishable from a user who had
 * genuinely stated "zero debt". detectAutoCompletions then persisted the
 * resulting completions, and resolveState trusted the stored row forever — so
 * entering real debt afterwards never undid them.
 */

/** A row as it exists before the user has entered anything. */
const emptyProfile: FinancialProfile = { snapshot_completed: false };

/** The same row as the old DEFAULT 0 schema produced it. */
const defaultedProfile: FinancialProfile = {
  snapshot_completed: false,
  high_interest_debt: 0,
  low_interest_debt: 0,
  liquid_savings: 0,
  employer_match_pct: 0,
};

const statedProfile: FinancialProfile = {
  snapshot_completed: true,
  monthly_take_home: 5000,
  monthly_expenses: 3000,
  high_interest_debt: 0,
  low_interest_debt: 0,
  liquid_savings: 20_000,
};

const milestone = (over: Partial<UserMilestone>): UserMilestone => ({
  id: 'row',
  user_id: 'u1',
  milestone_id: 'p1-kill-highcost-debt',
  status: 'complete',
  completed_at: null,
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

const DEBT_IDS = ['p1-kill-highcost-debt', 'p2-midcost-debt', 'p4-debt-clear'];

describe('detectAutoCompletions', () => {
  it('infers nothing from a profile with no snapshot', () => {
    expect(detectAutoCompletions(emptyProfile, [])).toEqual([]);
  });

  it('infers nothing from column defaults — the corrupting case', () => {
    expect(detectAutoCompletions(defaultedProfile, [])).toEqual([]);
  });

  it('still completes from stated numbers once the snapshot exists', () => {
    const ids = detectAutoCompletions(statedProfile, []);
    expect(ids).toContain('p1-kill-highcost-debt');
    expect(ids).toContain('p4-debt-clear');
  });

  it('never overwrites a milestone the user skipped', () => {
    const ids = detectAutoCompletions(statedProfile, [
      milestone({ status: 'skipped', source: 'user' }),
    ]);
    expect(ids).not.toContain('p1-kill-highcost-debt');
  });

  it('never overwrites one the user marked in progress', () => {
    const ids = detectAutoCompletions(statedProfile, [
      milestone({ status: 'in_progress', source: 'user' }),
    ]);
    expect(ids).not.toContain('p1-kill-highcost-debt');
  });

  it('treats a legacy row with no source as a user decision', () => {
    const legacy = milestone({ status: 'skipped' });
    delete (legacy as Partial<UserMilestone>).source;
    expect(detectAutoCompletions(statedProfile, [legacy])).not.toContain('p1-kill-highcost-debt');
  });
});

describe('journey-supplied numbers', () => {
  /** What mapJourneyToProfile writes: income and expenses, nothing else. */
  const fromJourney: FinancialProfile = {
    snapshot_completed: false,
    monthly_take_home: 3200,
    monthly_expenses: 3945,
  };

  it('uses them even though the snapshot form was never submitted', () => {
    const roadmap = buildRoadmap(fromJourney, []);
    expect(roadmap.weeklyCapacity).not.toBeNull();
  });

  it('still refuses to infer debt milestones from columns nobody filled', () => {
    // The whole point of the NULL migration: absent is not zero.
    const ids = detectAutoCompletions(fromJourney, []);
    for (const id of DEBT_IDS) expect(ids).not.toContain(id);
  });

  it('handles a deficit without producing week estimates', () => {
    // Expenses exceed take-home, so there is no capacity to schedule against.
    const roadmap = buildRoadmap(fromJourney, []);
    expect(roadmap.weeklyCapacity!).toBeLessThan(0);
    const estimated = roadmap.phases
      .flatMap((p) => p.milestones)
      .filter((m) => m.estimatedWeeks != null);
    expect(estimated).toEqual([]);
  });
});

describe('buildRoadmap', () => {
  it('marks nothing complete on an untouched profile', () => {
    const roadmap = buildRoadmap(defaultedProfile, []);
    const complete = roadmap.phases
      .flatMap((p) => p.milestones)
      .filter((m) => m.state === 'complete');
    expect(complete).toEqual([]);
  });

  it('does not unlock a later phase before the first is done', () => {
    const roadmap = buildRoadmap(defaultedProfile, []);
    const phase4 = roadmap.phases.find((p) => p.id === 4);
    expect(phase4?.isUnlocked).toBe(false);
  });

  it('re-derives an auto row when the profile no longer supports it', () => {
    // The permanence bug: debt was auto-completed, then real debt was entered.
    const withDebt: FinancialProfile = { ...statedProfile, high_interest_debt: 18_000 };
    const roadmap = buildRoadmap(withDebt, [
      milestone({ status: 'complete', source: 'auto' }),
    ]);
    const m = roadmap.phases
      .flatMap((p) => p.milestones)
      .find((x) => x.id === 'p1-kill-highcost-debt');
    expect(m?.state).not.toBe('complete');
  });

  it('leaves a user-completed milestone alone even against the profile', () => {
    const withDebt: FinancialProfile = { ...statedProfile, high_interest_debt: 18_000 };
    const roadmap = buildRoadmap(withDebt, [
      milestone({ status: 'complete', source: 'user' }),
    ]);
    const m = roadmap.phases
      .flatMap((p) => p.milestones)
      .find((x) => x.id === 'p1-kill-highcost-debt');
    expect(m?.state).toBe('complete');
  });

  it('gives the two debt tiers independent predicates', () => {
    // p2-midcost-debt used to share p1's `high_interest_debt === 0`, so clearing
    // >20% debt silently cleared the 8–20% milestone too.
    const roadmap = buildRoadmap(statedProfile, []);
    const byId = new Map(
      roadmap.phases.flatMap((p) => p.milestones).map((m) => [m.id, m])
    );
    expect(byId.get('p1-kill-highcost-debt')?.state).toBe('complete');
    expect(byId.get('p2-midcost-debt')?.state).not.toBe('complete');
  });

  it('never reports a locked phase as complete to the coach', () => {
    const roadmap = buildRoadmap(defaultedProfile, []);
    const phase = roadmap.phases.find((p) => p.id === roadmap.currentPhaseId)!;
    if (phase.completedCount < phase.totalCount) {
      expect(roadmap.summaryText).not.toContain('Phase complete.');
    }
  });

  it('keeps week estimates meaningful at a very high savings rate', () => {
    const highEarner: FinancialProfile = {
      ...statedProfile,
      monthly_take_home: 60_000,
      monthly_expenses: 4_000,
    };
    const roadmap = buildRoadmap(highEarner, []);
    const emergency = roadmap.phases
      .flatMap((p) => p.milestones)
      .find((m) => m.id === 'p1-emergency-3mo');
    // Unbounded scaling collapsed every estimate to the 1-week floor.
    if (emergency?.estimatedWeeks) {
      expect(emergency.estimatedWeeks[1]).toBeGreaterThan(1);
    }
  });
});

describe('the debt milestones as a set', () => {
  it('none of them complete from an untouched profile', () => {
    const ids = detectAutoCompletions(defaultedProfile, []);
    for (const id of DEBT_IDS) expect(ids).not.toContain(id);
  });
});
