import { CashFlowInputs } from "../types";

export interface ScenarioAdjustments {
  revenueMultiplier: number;
  growthMultiplier: number;
  expenseMultiplier: number;
}

/**
 * Get adjustment factors for different scenarios
 */
export const getScenarioAdjustments = (scenarioType: 'conservative' | 'base' | 'optimistic'): ScenarioAdjustments => {
  switch (scenarioType) {
    case 'conservative':
      return {
        revenueMultiplier: 0.8,
        growthMultiplier: 0.5,
        expenseMultiplier: 1.2
      };
    case 'optimistic':
      return {
        revenueMultiplier: 1.2,
        growthMultiplier: 1.5,
        expenseMultiplier: 0.9
      };
    default: // base
      return {
        revenueMultiplier: 1,
        growthMultiplier: 1,
        expenseMultiplier: 1
      };
  }
};

/**
 * Apply scenario adjustments to inputs
 */
export const applyScenarioAdjustments = (
  inputs: CashFlowInputs, 
  adjustments: ScenarioAdjustments
): CashFlowInputs => {
  return {
    ...inputs,
    monthlyRevenue: inputs.monthlyRevenue * adjustments.revenueMultiplier,
    revenueGrowthRate: inputs.revenueGrowthRate * adjustments.growthMultiplier,
    fixedExpenses: inputs.fixedExpenses.map(exp => ({
      ...exp,
      amount: exp.amount * adjustments.expenseMultiplier
    })),
    variableExpenses: inputs.variableExpenses.map(exp => ({
      ...exp,
      amount: exp.amount * adjustments.expenseMultiplier
    }))
  };
};