import { CashFlowInputs, CashFlowReport, CashFlowScenario } from "../types";
import { calculateMonthlyRevenue, calculateLoanPayment, calculateRunway } from "./calculationUtils";
import { getScenarioAdjustments, applyScenarioAdjustments } from "./scenarioUtils";
import { generateAlerts, generateKeyMilestones } from "./alertsUtils";

export const calculateCashFlow = (inputs: CashFlowInputs): CashFlowReport => {
  // Create three scenarios with different assumptions
  const scenarios = {
    conservative: calculateScenario(inputs, 'conservative'),
    base: calculateScenario(inputs, 'base'),
    optimistic: calculateScenario(inputs, 'optimistic')
  };

  return {
    inputs,
    scenarios,
    generatedAt: new Date().toISOString()
  };
};

const calculateScenario = (inputs: CashFlowInputs, scenarioType: 'conservative' | 'base' | 'optimistic'): CashFlowScenario => {
  // Adjust assumptions based on scenario type
  const adjustments = getScenarioAdjustments(scenarioType);
  const adjustedInputs = applyScenarioAdjustments(inputs, adjustments);

  const monthlyProjections = [];
  let currentCash = inputs.startingCash;
  let totalInflows = 0;
  let totalOutflows = 0;
  let breakEvenMonth = 0;
  let hasHitBreakeven = false;

  // Receivable / payable lag in whole months. Cash for a given month's activity
  // arrives (or leaves) this many months later.
  const arDelay = Math.max(0, Math.floor(inputs.accountsReceivableDays / 30));
  const apDelay = Math.max(0, Math.floor(inputs.accountsPayableDays / 30));

  /** Accrued operating expense for a given month, at that month's revenue. */
  const expensesForMonth = (m: number): number => {
    if (m < 1) return 0;
    const revenue = calculateMonthlyRevenue(adjustedInputs, m);
    const fixed = adjustedInputs.fixedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const variable = adjustedInputs.variableExpenses.reduce(
      (sum, exp) => sum + (exp.isPercentage ? (revenue * exp.amount / 100) : exp.amount),
      0,
    );
    return fixed + variable;
  };

  for (let month = 1; month <= inputs.timeframe; month++) {
    // Accrual figures for this month
    const monthlyRevenue = calculateMonthlyRevenue(adjustedInputs, month);
    const accruedExpenses = expensesForMonth(month);

    // Cash actually collected this month = revenue accrued `arDelay` months ago.
    // Shift the series; do not also pay month 1 up front — doing both credited
    // month 1's revenue twice (once immediately, once again after the lag).
    const collectedMonth = month - arDelay;
    const actualRevenueReceived = collectedMonth >= 1
      ? calculateMonthlyRevenue(adjustedInputs, collectedMonth)
      : 0;

    // Same shift for payables.
    const actualExpensesPaid = expensesForMonth(month - apDelay);

    // Debt service only while the loan is outstanding — a projection longer
    // than the term was still paying a retired loan.
    const loanPayment = (inputs.loanTermMonths && month <= inputs.loanTermMonths)
      ? calculateLoanPayment(inputs)
      : 0;

    // Tax is levied on profit, not revenue. Charging it on turnover made a
    // loss-making company pay tax and systematically understated runway for
    // exactly the pre-profit businesses most likely to use this tool.
    const taxableProfit = monthlyRevenue - accruedExpenses - loanPayment;
    const taxPayment = taxableProfit > 0 ? taxableProfit * (inputs.taxRate / 100) : 0;

    // Financing events
    const equityInflow = (inputs.equityRaised > 0 && month === inputs.equityRaiseMonth) ? inputs.equityRaised : 0;
    const loanInflow = (month === 1 && inputs.loanAmount > 0) ? inputs.loanAmount : 0;

    const operatingInflows = actualRevenueReceived;
    const monthlyInflows = operatingInflows + equityInflow + loanInflow;
    const monthlyOutflows = actualExpensesPaid + loanPayment + taxPayment;
    const netFlow = monthlyInflows - monthlyOutflows;

    currentCash += netFlow;
    totalInflows += monthlyInflows;
    totalOutflows += monthlyOutflows;

    // Break-even is an OPERATING milestone. Counting a financing inflow meant
    // the equity-raise month trivially "broke even" on someone else's money.
    const operatingNetFlow = operatingInflows - monthlyOutflows;
    if (!hasHitBreakeven && operatingNetFlow > 0) {
      breakEvenMonth = month;
      hasHitBreakeven = true;
    }

    monthlyProjections.push({
      month,
      inflows: monthlyInflows,
      outflows: monthlyOutflows,
      netFlow,
      cashBalance: currentCash,
      revenue: monthlyRevenue,
      expenses: actualExpensesPaid + loanPayment + taxPayment
    });
  }

  // Calculate runway (months until cash runs out)
  const runway = calculateRunway(monthlyProjections, inputs.startingCash);

  // Calculate average monthly cash flow
  const avgMonthlyCashFlow = monthlyProjections.reduce((sum, month) => sum + month.netFlow, 0) / monthlyProjections.length;

  // Generate alerts and milestones
  const alerts = generateAlerts(monthlyProjections, inputs);
  const keyMilestones = generateKeyMilestones(monthlyProjections, breakEvenMonth);

  return {
    monthlyProjections,
    totalInflows,
    totalOutflows,
    endingCash: currentCash,
    avgMonthlyCashFlow,
    runway,
    breakEvenMonth,
    alerts,
    keyMilestones
  };
};
