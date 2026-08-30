import { describe, expect, it } from 'vitest';
import { estimateProjectManagementSavings, SAVINGS_LIMITS } from './projectManagementSavings';

describe('estimateProjectManagementSavings', () => {
  it('compares fees against the same base project budget', () => {
    const result = estimateProjectManagementSavings({ baseBudget: 200_000, gcMarkupPercent: 20, projectManagementPercent: 8 });
    expect(result.traditionalGcTotal).toBe(240_000);
    expect(result.projectManagementTotal).toBe(216_000);
    expect(result.potentialDifference).toBe(24_000);
    expect(result.potentialDifferencePercent).toBe(10);
  });

  it('reports a negative difference when the PM assumption is higher', () => {
    const result = estimateProjectManagementSavings({ baseBudget: 100_000, gcMarkupPercent: 5, projectManagementPercent: 10 });
    expect(result.potentialDifference).toBe(-5_000);
  });

  it('clamps unsafe, extreme, and non-finite inputs', () => {
    const result = estimateProjectManagementSavings({ baseBudget: Number.NaN, gcMarkupPercent: 200, projectManagementPercent: -4 });
    expect(result.baseBudget).toBe(SAVINGS_LIMITS.budget.min);
    expect(result.gcMarkupPercent).toBe(SAVINGS_LIMITS.rate.max);
    expect(result.projectManagementPercent).toBe(SAVINGS_LIMITS.rate.min);
    expect(Object.values(result).every(Number.isFinite)).toBe(true);
  });
});
