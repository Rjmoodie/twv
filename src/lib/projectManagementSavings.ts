export const SAVINGS_LIMITS = {
  budget: { min: 25_000, max: 10_000_000 },
  rate: { min: 0, max: 40 },
} as const;

const finiteOr = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export interface SavingsAssumptions {
  baseBudget: number;
  gcMarkupPercent: number;
  projectManagementPercent: number;
}

export interface SavingsEstimate extends SavingsAssumptions {
  gcDeliveryCost: number;
  projectManagementCost: number;
  traditionalGcTotal: number;
  projectManagementTotal: number;
  potentialDifference: number;
  potentialDifferencePercent: number;
}

/**
 * Illustrative delivery-model comparison, not a quote. Both models intentionally
 * begin with the same base trade/material budget so the only compared variable
 * is the user-selected oversight/markup assumption.
 */
export function estimateProjectManagementSavings(input: SavingsAssumptions): SavingsEstimate {
  const baseBudget = clamp(finiteOr(input.baseBudget, SAVINGS_LIMITS.budget.min), SAVINGS_LIMITS.budget.min, SAVINGS_LIMITS.budget.max);
  const gcMarkupPercent = clamp(finiteOr(input.gcMarkupPercent, 0), SAVINGS_LIMITS.rate.min, SAVINGS_LIMITS.rate.max);
  const projectManagementPercent = clamp(finiteOr(input.projectManagementPercent, 0), SAVINGS_LIMITS.rate.min, SAVINGS_LIMITS.rate.max);
  const gcDeliveryCost = baseBudget * gcMarkupPercent / 100;
  const projectManagementCost = baseBudget * projectManagementPercent / 100;
  const traditionalGcTotal = baseBudget + gcDeliveryCost;
  const projectManagementTotal = baseBudget + projectManagementCost;
  const potentialDifference = gcDeliveryCost - projectManagementCost;

  return {
    baseBudget,
    gcMarkupPercent,
    projectManagementPercent,
    gcDeliveryCost,
    projectManagementCost,
    traditionalGcTotal,
    projectManagementTotal,
    potentialDifference,
    potentialDifferencePercent: traditionalGcTotal > 0 ? potentialDifference / traditionalGcTotal * 100 : 0,
  };
}
