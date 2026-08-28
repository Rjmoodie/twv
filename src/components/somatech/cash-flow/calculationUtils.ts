import { CashFlowInputs } from "../types";

/**
 * Calculate revenue for a specific month considering growth and seasonality
 */
export const calculateMonthlyRevenue = (inputs: CashFlowInputs, month: number): number => {
  let revenue = inputs.monthlyRevenue;

  if (inputs.revenueGrowthRate > 0) {
    revenue = inputs.monthlyRevenue * Math.pow(1 + inputs.revenueGrowthRate / 100, month - 1);
  }

  if (inputs.hasSeasonality && inputs.seasonalityMultiplier) {
    const monthMod = ((month - 1) % 12 + 12) % 12;
    const normalizedMultiplier = Math.max(0.1, inputs.seasonalityMultiplier);

    if (monthMod >= 9) {
      revenue *= normalizedMultiplier;
    } else if (monthMod <= 2) {
      revenue /= normalizedMultiplier;
    }
  }

  return revenue;
};

export const calculateLoanPayment = (inputs: CashFlowInputs): number => {
  if (!inputs.loanAmount || !inputs.loanTermMonths) {
    return 0;
  }

  if (inputs.interestRate === 0) {
    return inputs.loanAmount / inputs.loanTermMonths;
  }

  const monthlyRate = inputs.interestRate / 100 / 12;
  const numPayments = inputs.loanTermMonths;
  const payment = inputs.loanAmount *
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);

  return payment;
};

/**
 * Calculate how many months until cash runs out
 */
/**
 * Months until cash is exhausted.
 *
 * Returns `Infinity` when the balance never goes negative across the projection.
 * Previously this returned 0 for that case, which every numeric consumer read as
 * "zero months left" — the runway pill rendered the label "Infinite" in critical
 * red because `0 <= 3`.
 */
export const calculateRunway = (projections: any[], startingCash: number): number => {
  let cash = startingCash;

  for (const month of projections) {
    cash += month.netFlow;
    if (cash <= 0) return month.month;
  }

  return Infinity;
};