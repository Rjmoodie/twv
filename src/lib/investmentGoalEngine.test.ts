import { describe, expect, it } from 'vitest';
import { projectBalance, projectInvestmentGoal, requiredMonthlyContribution, validateInvestmentGoal } from './investmentGoalEngine';

const millionGoal = {
  targetAmount: 1_000_000,
  currentBalance: 0,
  monthlyContribution: 1_000,
  horizonYears: 20,
  riskProfile: 'moderate' as const,
};

describe('investmentGoalEngine', () => {
  it('compounds both the starting balance and recurring contributions', () => {
    const result = projectBalance(100_000, 1_000, 10, 0.07);
    expect(result.endingBalance).toBeGreaterThan(100_000 + 120_000);
    expect(result.totalContributions).toBe(220_000);
  });

  it('solves the required contribution against the selected horizon', () => {
    const required = requiredMonthlyContribution(millionGoal, 0.065);
    expect(required).toBeGreaterThan(1_900);
    expect(required).toBeLessThan(2_200);
    expect(projectBalance(0, required, 20, 0.065).endingBalance).toBeCloseTo(1_000_000, 2);
  });

  it('returns stable scenario and probability outputs for identical inputs', () => {
    const first = projectInvestmentGoal(millionGoal);
    const second = projectInvestmentGoal(millionGoal);
    expect(first).toEqual(second);
    expect(first.percentile10).toBeLessThan(first.percentile50);
    expect(first.percentile50).toBeLessThan(first.percentile90);
    expect(first.expectedGoalProbabilityPct).toBeGreaterThanOrEqual(0);
    expect(first.expectedGoalProbabilityPct).toBeLessThanOrEqual(100);
  });

  it('rejects invalid goals and horizons', () => {
    expect(validateInvestmentGoal({ ...millionGoal, targetAmount: 0, horizonYears: 60 })).toEqual([
      'Enter a goal greater than zero.',
      'Choose a horizon from 1 to 50 years.',
    ]);
  });

  it('rejects unsupported risk and nonsensical optional assumptions', () => {
    expect(validateInvestmentGoal({
      ...millionGoal,
      riskProfile: 'speculative' as never,
      annualContributionGrowthPct: 101,
      inflationPct: Number.NaN,
    })).toEqual([
      'Choose a valid risk profile.',
      'Contribution growth must be between -99% and 100%.',
      'Inflation must be between -100% and 100%.',
    ]);
  });
});
