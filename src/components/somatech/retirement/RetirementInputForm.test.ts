import { describe, expect, it } from 'vitest';
import { isRetirementFormValid } from './retirementValidation';

const valid = {
  currentAge: '35', retirementAge: '65', lifeExpectancy: '90',
  currentSavings: '100000', monthlyContribution: '12000', retirementSpending: '60000',
  otherIncome: '', expectedReturn: 7,
};

describe('isRetirementFormValid', () => {
  it('accepts a complete plan and optional blank other income', () => {
    expect(isRetirementFormValid(valid)).toBe(true);
  });

  it('does not treat blank required amounts as zero', () => {
    expect(isRetirementFormValid({ ...valid, currentSavings: '' })).toBe(false);
    expect(isRetirementFormValid({ ...valid, retirementSpending: '  ' })).toBe(false);
  });

  it('rejects fractional ages and invalid optional income', () => {
    expect(isRetirementFormValid({ ...valid, currentAge: '35.5' })).toBe(false);
    expect(isRetirementFormValid({ ...valid, otherIncome: '-1' })).toBe(false);
    expect(isRetirementFormValid({ ...valid, otherIncome: 'not-a-number' })).toBe(false);
  });
});
