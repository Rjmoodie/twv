import { describe, expect, it } from 'vitest';
import { getJourney } from '@/components/somatech/journey/journeyConfig';
import { analyzeJourney, projectDebt } from './journeyMetrics';

describe('journey metrics', () => {
  it('handles a zero-interest debt without NaN or Infinity', () => {
    expect(projectDebt(1_500.5, 0, 500)).toEqual({
      months: 4,
      interestPaid: 0,
      minimumProgressPayment: 0.01,
    });
  });

  it('does not call payment share a lender DTI', () => {
    const analysis = analyzeJourney(getJourney('debt-freedom')!, {
      totalDebt: 10_000, monthlyPayment: 500, interestRate: 12, monthlyIncome: 4_000,
    });
    expect(analysis.metrics.find(metric => metric.id === 'take-home-payment-share')?.label)
      .toBe('Payment share of take-home');
  });

  it('counts only debt payment above existing minimums as a new surplus commitment', () => {
    const analysis = analyzeJourney(getJourney('debt-freedom')!, {
      totalDebt: 10_000, currentMinimumPayment: 275, monthlyPayment: 500,
      interestRate: 12, monthlyIncome: 4_000,
    });
    expect(analysis.monthlyCommitment).toBe(225);
    expect(analysis.metrics.find(metric => metric.id === 'additional-payoff-commitment')?.numericValue).toBe(225);
  });

  it('uses net burn after revenue for business runway', () => {
    const analysis = analyzeJourney(getJourney('business-owner')!, {
      monthlyRevenue: 9_000, monthlyExpenses: 8_000, targetOwnerSalary: 2_000, cashReserves: 12_000,
    });
    expect(analysis.metrics.find(metric => metric.id === 'business-runway')?.numericValue).toBe(12);
    expect(analysis.metrics.find(metric => metric.id === 'required-revenue')?.numericValue).toBe(10_000);
  });
});
