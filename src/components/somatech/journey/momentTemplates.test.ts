import { describe, expect, it } from 'vitest';
import { projectInvestmentGoal } from '@/lib/investmentGoalEngine';
import { generateMomentContent } from './momentTemplates';

describe('investor journey moment', () => {
  const answers = {
    investmentGoal: 1_000_000,
    currentSavings: 10_000,
    monthlyContribution: 1_500,
    investmentHorizonYears: 20,
    riskTolerance: 'moderate',
  };

  it('uses the canonical projection without promising a goal date', () => {
    const projection = projectInvestmentGoal({
      targetAmount: answers.investmentGoal,
      currentBalance: answers.currentSavings,
      monthlyContribution: answers.monthlyContribution,
      horizonYears: answers.investmentHorizonYears,
      riskProfile: 'moderate',
    });
    const moment = generateMomentContent({ journeyId: 'investor-starter', answers, startedAt: 0 });

    expect(moment.timelineLabel).toBe('20-year goal horizon');
    expect(moment.subheadline).toContain(`${projection.expectedGoalProbabilityPct.toFixed(0)}% modeled likelihood`);
    expect(moment.subheadline).not.toContain('On track to reach');
  });

  it('does not expose an invalid projection for corrupt legacy answers', () => {
    const moment = generateMomentContent({
      journeyId: 'investor-starter',
      answers: { ...answers, investmentGoal: 0 },
      startedAt: 0,
    });

    expect(moment.timelineLabel).toBeNull();
    expect(moment.subheadline).toBe('Committed to consistent monthly contributions.');
  });
});

describe('journey moment calculation consistency', () => {
  it('uses the selected home deposit target instead of a hidden 20% assumption', () => {
    const moment = generateMomentContent({
      journeyId: 'home-buying',
      answers: {
        targetHomePrice: 400_000,
        depositPercent: 10,
        currentSavings: 20_000,
        monthlySavings: 1_000,
        monthlyIncome: 8_000,
        mortgageRate: 6.5,
      },
      startedAt: 0,
    });

    expect(moment.timelineLabel).toBe('20 months to deposit');
    expect(moment.subheadline).toContain('selected deposit target');
  });

  it('shares the canonical zero-interest payoff result', () => {
    const moment = generateMomentContent({
      journeyId: 'debt-freedom',
      answers: {
        totalDebt: 1_500,
        currentMinimumPayment: 250,
        monthlyPayment: 500,
        interestRate: 0,
        monthlyIncome: 4_000,
      },
      startedAt: 0,
    });

    expect(moment.timelineLabel).toBe('3 months to go');
  });
});
