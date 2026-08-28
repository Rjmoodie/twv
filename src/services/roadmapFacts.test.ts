import { describe, expect, it } from 'vitest';
import {
  EMPTY_FACTS,
  buildRoadmapFacts,
  evidenceFor,
  reconcileContribution,
  type RoadmapFacts,
} from './roadmapFacts';
import type { PortfolioHolding } from '@/types/portfolio';
import type { InvestmentGoalRecord } from './investmentGoalService';

/**
 * getHoldingMarketValue prefers shares x current_price over market_value, so the
 * fixture drives all three from one number — a holding whose fields disagree
 * would test the fixture rather than the code.
 */
const holding = (
  { value = 1000, ...over }: Partial<PortfolioHolding> & { value?: number }
): PortfolioHolding => ({
  id: crypto.randomUUID(),
  portfolio_id: 'p1',
  ticker: 'VTI',
  bucket: 'US_EQUITY_LARGE',
  shares: value,
  current_price: 1,
  market_value: value,
  source: 'schwab',
  added_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const goal = (over: Partial<InvestmentGoalRecord> = {}): InvestmentGoalRecord =>
  ({
    id: 'g1',
    user_id: 'u1',
    target_amount: 100_000,
    target_date: '2036-01-01',
    horizon_years: 10,
    current_balance: 5_000,
    monthly_contribution: 1_000,
    risk_profile: 'moderate',
    annual_contribution_growth_pct: 0,
    inflation_pct: 0,
    projection: {} as never,
    assumption_version: 'v1',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }) as InvestmentGoalRecord;

describe('buildRoadmapFacts', () => {
  it('returns empty-shaped facts for an account with nothing in it', () => {
    const facts = buildRoadmapFacts({ holdings: [], brokerageConnected: false, goal: null });
    expect(facts).toEqual(EMPTY_FACTS);
  });

  it('excludes cash from positions and concentration', () => {
    const facts = buildRoadmapFacts({
      holdings: [
        holding({ ticker: 'VTI', value: 1000 }),
        holding({ ticker: 'CASH', bucket: 'CASH', value: 9000 }),
      ],
      brokerageConnected: true,
      goal: null,
    });
    expect(facts.brokerHoldingsCount).toBe(1);
    expect(facts.investedValueUsd).toBe(1000);
    // Cash would otherwise be 90% and dominate every concentration reading.
    expect(facts.largestPositionPct).toBe(100);
  });

  it('separates broker-confirmed positions from plan-only ones', () => {
    const facts = buildRoadmapFacts({
      holdings: [
        holding({ ticker: 'VTI', source: 'schwab' }),
        holding({ ticker: 'AAPL', source: 'manual' }),
        holding({ ticker: 'MSFT', source: undefined }),
      ],
      brokerageConnected: true,
      goal: null,
    });
    expect(facts.brokerHoldingsCount).toBe(1);
    expect(facts.plannedOnlyHoldingsCount).toBe(2);
  });

  it('computes concentration as a share of invested value', () => {
    const facts = buildRoadmapFacts({
      holdings: [
        holding({ ticker: 'A', value: 750 }),
        holding({ ticker: 'B', value: 250 }),
      ],
      brokerageConnected: true,
      goal: null,
    });
    expect(facts.largestPositionPct).toBeCloseTo(75, 5);
  });

  it('does not divide by zero when every position is worthless', () => {
    const facts = buildRoadmapFacts({
      holdings: [holding({ value: 0 })],
      brokerageConnected: true,
      goal: null,
    });
    expect(facts.investedValueUsd).toBeNull();
    expect(facts.largestPositionPct).toBeNull();
  });

  it('coerces goal numerics, which arrive as strings from PostgREST', () => {
    const facts = buildRoadmapFacts({
      holdings: [],
      brokerageConnected: false,
      goal: goal({ target_amount: '100000' as never, monthly_contribution: '1000' as never }),
    });
    expect(facts.goal?.targetAmountUsd).toBe(100_000);
    expect(facts.goal?.monthlyContributionUsd).toBe(1_000);
  });

  it('survives a null holdings array', () => {
    const facts = buildRoadmapFacts({
      holdings: null as never,
      brokerageConnected: false,
      goal: null,
    });
    expect(facts.brokerHoldingsCount).toBe(0);
  });
});

describe('evidenceFor', () => {
  const withBroker: RoadmapFacts = {
    ...EMPTY_FACTS,
    brokerageConnected: true,
    brokerHoldingsCount: 12,
    investedValueUsd: 48_000,
    largestPositionPct: 3.2,
  };

  it('returns nothing without facts', () => {
    expect(evidenceFor('p3-taxable', null)).toBeNull();
  });

  it('returns nothing for a milestone it has no view of', () => {
    expect(evidenceFor('p0-stop-debt', withBroker)).toBeNull();
  });

  it('never asserts an account is taxable — it asks', () => {
    const e = evidenceFor('p3-taxable', withBroker)!;
    expect(e.offersCompletion).toBe(true);
    expect(e.statement).toMatch(/if that account is taxable/i);
  });

  it('stays silent about a brokerage holding nothing', () => {
    expect(evidenceFor('p3-taxable', { ...withBroker, brokerHoldingsCount: 0 })).toBeNull();
  });

  it('flags concentration above the 5% guideline without offering completion', () => {
    const e = evidenceFor('p3-portfolio-audit', { ...withBroker, largestPositionPct: 22.4 })!;
    expect(e.tone).toBe('contradicts');
    expect(e.offersCompletion).toBe(false);
    expect(e.statement).toContain('22.4%');
  });

  it('supports the audit when nothing breaches 5%', () => {
    const e = evidenceFor('p3-portfolio-audit', withBroker)!;
    expect(e.tone).toBe('supports');
    expect(e.offersCompletion).toBe(true);
  });

  it('reports the goal without claiming the milestone is done', () => {
    const e = evidenceFor('p3-goal-savings', {
      ...withBroker,
      goal: { targetAmountUsd: 100_000, monthlyContributionUsd: 1_000, horizonYears: 10 },
    })!;
    expect(e.offersCompletion).toBe(false);
    expect(e.statement).toContain('$100,000');
  });

  it('singularises a one-year horizon', () => {
    const e = evidenceFor('p5-retire-date', {
      ...withBroker,
      goal: { targetAmountUsd: 1, monthlyContributionUsd: 1, horizonYears: 1 },
    })!;
    expect(e.statement).toContain('1 year');
    expect(e.statement).not.toContain('1 years');
  });
});

describe('reconcileContribution', () => {
  const facts = (monthly: number): RoadmapFacts => ({
    ...EMPTY_FACTS,
    goal: { targetAmountUsd: 100_000, monthlyContributionUsd: monthly, horizonYears: 10 },
  });

  it('is null without a goal to reconcile against', () => {
    expect(reconcileContribution(1_000, EMPTY_FACTS)).toBeNull();
  });

  it('is null without a snapshot capacity', () => {
    expect(reconcileContribution(null, facts(1_000))).toBeNull();
  });

  it('does not divide by a zero capacity', () => {
    expect(reconcileContribution(0, facts(1_000))).toBeNull();
    expect(reconcileContribution(-500, facts(1_000))).toBeNull();
  });

  it('calls near-equal numbers aligned', () => {
    expect(reconcileContribution(1_000, facts(1_050))?.status).toBe('aligned');
  });

  it('flags a goal that outruns the snapshot', () => {
    const check = reconcileContribution(1_000, facts(2_500))!;
    expect(check.status).toBe('goal_exceeds_capacity');
    expect(check.differenceUsd).toBe(1_500);
  });

  it('flags capacity the goal leaves unassigned', () => {
    const check = reconcileContribution(3_000, facts(1_000))!;
    expect(check.status).toBe('capacity_unused');
    expect(check.differenceUsd).toBe(-2_000);
  });
});
