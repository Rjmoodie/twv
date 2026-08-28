import { CashFlowInputs } from "../types";

export interface CashFlowAlert {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CashFlowMilestone {
  month: number;
  description: string;
  type: 'positive' | 'warning';
}

/**
 * Generate alerts based on cash flow projections
 */
export const generateAlerts = (projections: any[], inputs: CashFlowInputs): CashFlowAlert[] => {
  const alerts: CashFlowAlert[] = [];

  // Check for cash runway warnings
  const finalCash = projections[projections.length - 1]?.cashBalance || 0;
  if (finalCash < 0) {
    alerts.push({
      title: "Cash Depletion Risk",
      description: `Your business may run out of cash during the projection period. Consider reducing expenses or increasing revenue.`,
      severity: 'high'
    });
  }

  // Check for consistently negative cash flow
  const negativeFlowMonths = projections.filter(month => month.netFlow < 0).length;
  if (negativeFlowMonths > projections.length * 0.6) {
    alerts.push({
      title: "Persistent Negative Cash Flow",
      description: `${negativeFlowMonths} out of ${projections.length} months show negative cash flow. Review your business model.`,
      severity: 'high'
    });
  }

  // Check for low cash warnings
  const lowCashMonths = projections.filter(month => month.cashBalance < inputs.startingCash * 0.2).length;
  if (lowCashMonths > 0) {
    alerts.push({
      title: "Low Cash Periods",
      description: `Cash balance drops below 20% of starting amount in ${lowCashMonths} months. Consider maintaining higher reserves.`,
      severity: 'medium'
    });
  }

  return alerts;
};

/**
 * Generate key milestones from projections
 */
export const generateKeyMilestones = (projections: any[], breakEvenMonth: number): CashFlowMilestone[] => {
  const milestones: CashFlowMilestone[] = [];

  if (breakEvenMonth > 0) {
    milestones.push({
      month: breakEvenMonth,
      description: "Break-even achieved",
      type: 'positive'
    });
  }

  // Find first cash low point
  const minCashMonth = projections.reduce((min, month, index) => 
    month.cashBalance < projections[min].cashBalance ? index : min, 0
  );

  if (projections[minCashMonth].cashBalance < 0) {
    milestones.push({
      month: minCashMonth + 1,
      description: "Cash depletion point",
      type: 'warning'
    });
  }

  return milestones;
};