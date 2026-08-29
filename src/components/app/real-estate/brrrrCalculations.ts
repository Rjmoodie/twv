export interface BRRRRInputs {
  // Buy Phase
  purchasePrice: number;
  downPaymentPercent: number;
  closingCosts: number;
  acquisitionFees: number;
  holdingCosts: number;
  
  // Rehab Phase
  renovationBudget: number;
  contingencyPercent: number;
  rehabDuration: number;
  rehabFinancingRate: number;
  
  // Rent Phase
  monthlyRent: number;
  vacancyRate: number;
  propertyManagement: number;
  insurance: number;
  propertyTax: number;
  maintenance: number;
  
  // Refinance Phase
  arv: number;
  refinanceLTV: number;
  newLoanRate: number;
  newLoanTerm: number;
  refinanceCosts: number;
}

export interface BRRRRResults {
  // Buy Phase Results
  totalAcquisitionCost: number;
  initialCashNeeded: number;
  
  // Rehab Phase Results
  totalRehabCost: number;
  totalHoldingCost: number;
  preStabilizationInvestment: number;
  
  // Rent Phase Results
  effectiveMonthlyRent: number;
  monthlyOperatingExpenses: number;
  netOperatingIncome: number;
  preRefinanceCashFlow: number;
  preRefinanceROI: number;
  
  // Refinance Phase Results
  maxRefinanceLoan: number;
  cashOutAmount: number;
  newMonthlyPayment: number;
  postRefinanceCashFlow: number;
  postRefinanceROI: number;
  remainingEquity: number;
  
  // Summary Metrics
  totalInvestment: number;
  equityCreated: number;
  capitalRecycled: number;
  rentToValueRatio: number;
}

export interface SavedDeal {
  id: string;
  deal_name: string;
  inputs: BRRRRInputs;
  results: BRRRRResults;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const validateBRRRRInputs = (inputs: BRRRRInputs): string[] => {
  const errors: string[] = [];
  const entries = Object.entries(inputs) as [keyof BRRRRInputs, number][];
  if (entries.some(([, value]) => !Number.isFinite(value))) errors.push('Every field must contain a valid number.');
  if (entries.some(([, value]) => value < 0)) errors.push('Costs, rates, terms, and values cannot be negative.');
  if (inputs.purchasePrice <= 0) errors.push('Purchase price must be greater than zero.');
  if (inputs.arv <= 0) errors.push('After-repair value must be greater than zero.');
  if (inputs.monthlyRent <= 0) errors.push('Monthly rent must be greater than zero.');
  if (inputs.rehabDuration <= 0 || inputs.newLoanTerm <= 0) errors.push('Loan and rehab terms must be greater than zero.');
  for (const [label, value] of [
    ['Down payment', inputs.downPaymentPercent],
    ['Contingency', inputs.contingencyPercent],
    ['Vacancy', inputs.vacancyRate],
    ['Refinance LTV', inputs.refinanceLTV],
  ] as const) {
    if (value < 0 || value > 100) errors.push(`${label} must be between 0% and 100%.`);
  }
  return [...new Set(errors)];
};

/**
 * Core BRRRR calculation engine
 */
/**
 * Standard amortising payment. Returns straight-line principal when the rate is
 * zero — the closed-form formula evaluates to 0/0 there and would otherwise
 * poison every downstream figure with NaN (0% seller-financed and promotional
 * loans are real inputs, not edge cases).
 */
const amortisedPayment = (principal: number, annualRatePct: number, months: number): number => {
  if (principal <= 0 || months <= 0) return 0;
  const r = (annualRatePct / 100) / 12;
  if (r === 0) return principal / months;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
};

/** Percentage guard — returns 0 rather than NaN/Infinity when the base is empty. */
const safePct = (numerator: number, denominator: number): number =>
  denominator > 0 ? (numerator / denominator) * 100 : 0;

export const calculateBRRRR = (inputs: BRRRRInputs): BRRRRResults => {
  // Buy Phase Calculations
  const downPaymentAmount = (inputs.purchasePrice * inputs.downPaymentPercent) / 100;
  const totalAcquisitionCost = inputs.purchasePrice + inputs.closingCosts + inputs.acquisitionFees;
  const initialCashNeeded = downPaymentAmount + inputs.closingCosts + inputs.acquisitionFees;
  
  // Rehab Phase Calculations
  const contingencyAmount = (inputs.renovationBudget * inputs.contingencyPercent) / 100;
  const totalRehabCost = inputs.renovationBudget + contingencyAmount;
  const totalHoldingCost = inputs.holdingCosts * inputs.rehabDuration;
  const preStabilizationInvestment = initialCashNeeded + totalRehabCost + totalHoldingCost;
  
  // Rent Phase Calculations
  const effectiveMonthlyRent = inputs.monthlyRent * (1 - inputs.vacancyRate / 100);
  const monthlyOperatingExpenses = inputs.propertyManagement + inputs.insurance + inputs.propertyTax + inputs.maintenance;
  const netOperatingIncome = effectiveMonthlyRent - monthlyOperatingExpenses;
  
  // Calculate existing loan payment (purchase loan)
  const loanAmount = inputs.purchasePrice - downPaymentAmount;
  const existingLoanPayment = amortisedPayment(loanAmount, inputs.rehabFinancingRate, 30 * 12);

  const preRefinanceCashFlow = netOperatingIncome - existingLoanPayment;
  const preRefinanceROI = safePct(preRefinanceCashFlow * 12, preStabilizationInvestment);

  // Refinance Phase Calculations
  const maxRefinanceLoan = (inputs.arv * inputs.refinanceLTV) / 100;
  const cashOutAmount = Math.max(0, maxRefinanceLoan - loanAmount - inputs.refinanceCosts);

  const newMonthlyPayment = amortisedPayment(maxRefinanceLoan, inputs.newLoanRate, inputs.newLoanTerm * 12);

  const postRefinanceCashFlow = netOperatingIncome - newMonthlyPayment;
  const remainingEquity = inputs.arv - maxRefinanceLoan;

  // Calculate final investment after cash-out
  const totalInvestment = Math.max(0, preStabilizationInvestment - cashOutAmount);

  // When the refinance returns every dollar of invested capital, return on
  // remaining capital is infinite — that is the BRRRR success condition, not a
  // failure. Reporting 0 here inverted the signal and ranked the best possible
  // outcome as the worst. Infinity sorts and compares correctly downstream;
  // formatPercentage renders it as ∞.
  const postRefinanceROI = totalInvestment > 0
    ? (postRefinanceCashFlow * 12) / totalInvestment * 100
    : postRefinanceCashFlow > 0 ? Infinity        // all capital out, still cash-flowing
    : postRefinanceCashFlow < 0 ? -Infinity       // all capital out but bleeding — not a win
    : 0;

  // Summary metrics
  // Equity created is the lift over ALL capital sunk to achieve it — purchase
  // price alone ignores the rehab spend, acquisition costs, and carry that
  // produced the ARV, overstating created equity by the full cost of the work.
  const equityCreated = inputs.arv - (
    inputs.purchasePrice + inputs.closingCosts + inputs.acquisitionFees +
    totalRehabCost + totalHoldingCost
  );
  const capitalRecycled = safePct(cashOutAmount, preStabilizationInvestment);
  const rentToValueRatio = safePct(inputs.monthlyRent * 12, inputs.arv);

  return {
    totalAcquisitionCost,
    initialCashNeeded,
    totalRehabCost,
    totalHoldingCost,
    preStabilizationInvestment,
    effectiveMonthlyRent,
    monthlyOperatingExpenses,
    netOperatingIncome,
    preRefinanceCashFlow,
    preRefinanceROI,
    maxRefinanceLoan,
    cashOutAmount,
    newMonthlyPayment,
    postRefinanceCashFlow,
    postRefinanceROI,
    remainingEquity,
    totalInvestment,
    equityCreated,
    capitalRecycled,
    rentToValueRatio
  };
};
