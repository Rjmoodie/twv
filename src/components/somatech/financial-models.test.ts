import { describe, it, expect } from 'vitest';

import { calculateBusinessValuation } from './business-valuation/valuationEngine';
import { calculateRetirement } from './retirement/retirementUtils';
import { calculateBRRRR, validateBRRRRInputs } from './real-estate/brrrrCalculations';
import { calculateLoanPayment, calculateMonthlyRevenue } from './cash-flow/calculationUtils';

const defaultValuationMethods = {
  revenueMultiple: true,
  ebitdaMultiple: true,
  peMultiple: true,
  dcf: true,
};

describe('financial-model regressions', () => {
  it('keeps the optimistic scenario from compounding the multiplier three times', () => {
    const report = calculateBusinessValuation(
      {
        industry: 'technology',
        businessType: 'saas',
        currentRevenue: 10000000,
        grossMargin: 65,
        ebitdaMargin: 20,
        netMargin: 12,
        revenueGrowth: 15,
        exitTimeframe: 5,
        discountRate: 10,
        terminalGrowthRate: 3,
      },
      defaultValuationMethods,
    );

    expect(report.scenarios.base.totalValue).toBeGreaterThan(0);
    expect(report.scenarios.optimistic.totalValue).toBeGreaterThan(report.scenarios.base.totalValue);
    expect(report.scenarios.optimistic.totalValue / report.scenarios.base.totalValue).toBeLessThan(1.5);
  });

  it('keeps the retirement verdict aligned with the depletion simulation', () => {
    const result = calculateRetirement({
      currentAge: 35,
      retirementAge: 60,
      lifeExpectancy: 85,
      currentSavings: 500000,
      monthlyContribution: 6000,
      expectedReturn: 7,
      retirementSpending: 95000,
      inflationRate: 2.5,
      otherIncome: 15000,
    });

    expect(result.onTrack).toBe(true);
    expect(result.yearsWillLast).toBeGreaterThanOrEqual(25);
    expect(result.totalSavingsAtRetirement).toBeGreaterThan(0);
  });

  it('returns a finite payment for a zero-rate loan instead of NaN', () => {
    const payment = calculateLoanPayment({
      businessName: 'Test',
      industry: 'Tech',
      startingCash: 0,
      timeframe: 12,
      monthlyRevenue: 0,
      revenueGrowthRate: 0,
      hasSeasonality: false,
      seasonalityMultiplier: 1,
      accountsReceivableDays: 0,
      accountsPayableDays: 0,
      fixedExpenses: [],
      variableExpenses: [],
      taxRate: 0,
      loanAmount: 200000,
      interestRate: 0,
      loanTermMonths: 360,
      equityRaised: 0,
      equityRaiseMonth: 0,
    });

    expect(Number.isFinite(payment)).toBe(true);
    expect(payment).toBeCloseTo(5000 / 9, 5);   // 0% rate ⇒ straight-line principal
  });

  it('keeps seasonality from creating annual revenue out of thin air', () => {
    const base = calculateMonthlyRevenue(
      {
        businessName: 'Test',
        industry: 'Tech',
        startingCash: 0,
        timeframe: 12,
        monthlyRevenue: 1000,
        revenueGrowthRate: 0,
        hasSeasonality: true,
        seasonalityMultiplier: 1.3,
        accountsReceivableDays: 0,
        accountsPayableDays: 0,
        fixedExpenses: [],
        variableExpenses: [],
        taxRate: 0,
        loanAmount: 0,
        interestRate: 0,
        loanTermMonths: 0,
        equityRaised: 0,
        equityRaiseMonth: 0,
      },
      12,
    );

    const offSeason = calculateMonthlyRevenue(
      {
        businessName: 'Test',
        industry: 'Tech',
        startingCash: 0,
        timeframe: 12,
        monthlyRevenue: 1000,
        revenueGrowthRate: 0,
        hasSeasonality: true,
        seasonalityMultiplier: 1.3,
        accountsReceivableDays: 0,
        accountsPayableDays: 0,
        fixedExpenses: [],
        variableExpenses: [],
        taxRate: 0,
        loanAmount: 0,
        interestRate: 0,
        loanTermMonths: 0,
        equityRaised: 0,
        equityRaiseMonth: 0,
      },
      1,
    );

    expect(base).toBeGreaterThan(0);
    expect(offSeason).toBeLessThan(base);
  });

  it('does not report a best BRRRR outcome as the worst one', () => {
    const result = calculateBRRRR({
      purchasePrice: 150000,
      downPaymentPercent: 25,
      closingCosts: 5000,
      acquisitionFees: 3000,
      holdingCosts: 1200,
      renovationBudget: 30000,
      contingencyPercent: 10,
      rehabDuration: 3,
      rehabFinancingRate: 7,
      monthlyRent: 2500,
      vacancyRate: 5,
      propertyManagement: 250,
      insurance: 125,
      propertyTax: 225,
      maintenance: 200,
      arv: 240000,
      refinanceLTV: 75,
      newLoanRate: 6.5,
      newLoanTerm: 30,
      refinanceCosts: 4000,
    });

    expect(Number.isFinite(result.postRefinanceROI)).toBe(true);
    expect(result.postRefinanceROI).toBeGreaterThan(-100);
    expect(result.equityCreated).toBeGreaterThan(0);
  });

  // ── BRRRR regressions the case above cannot reach ────────────────────────
  //
  // The scenario above leaves capital in the deal, so totalInvestment > 0 and
  // the zero-capital branch never executes. These pin the actual defects.

  const brrrrBase = {
    purchasePrice: 150000,
    downPaymentPercent: 25,
    closingCosts: 5000,
    acquisitionFees: 3000,
    holdingCosts: 1200,
    renovationBudget: 30000,
    contingencyPercent: 10,
    rehabDuration: 3,
    rehabFinancingRate: 7,
    monthlyRent: 2500,
    vacancyRate: 5,
    propertyManagement: 250,
    insurance: 125,
    propertyTax: 225,
    maintenance: 200,
    arv: 240000,
    refinanceLTV: 75,
    newLoanRate: 6.5,
    newLoanTerm: 30,
    refinanceCosts: 4000,
  };

  it('reports an infinite ROI — not 0% — when the refinance returns all capital', () => {
    // High ARV pulls more cash out than was ever invested AND the rent still
    // covers the new debt service. That is the textbook BRRRR win; the old
    // guard returned 0 for exactly this case, ranking it as the worst deal.
    const result = calculateBRRRR({
      ...brrrrBase, arv: 400000, refinanceLTV: 80, monthlyRent: 4000,
    });

    expect(result.totalInvestment).toBe(0);
    expect(result.postRefinanceCashFlow).toBeGreaterThan(0);
    expect(result.postRefinanceROI).toBe(Infinity);
    // and it must rank above any finite deal
    const ordinary = calculateBRRRR(brrrrBase);
    expect(result.postRefinanceROI).toBeGreaterThan(ordinary.postRefinanceROI);
  });

  it('does not treat a fully-recycled but cash-flow-negative deal as a win', () => {
    // All capital returned, but the new payment exceeds NOI. Infinite *positive*
    // return would be wrong here — the deal bleeds every month.
    const result = calculateBRRRR({ ...brrrrBase, arv: 400000, refinanceLTV: 80 });

    expect(result.totalInvestment).toBe(0);
    expect(result.postRefinanceCashFlow).toBeLessThan(0);
    expect(result.postRefinanceROI).toBe(-Infinity);
  });

  it('does not return NaN anywhere on a 0% interest deal', () => {
    const result = calculateBRRRR({ ...brrrrBase, rehabFinancingRate: 0, newLoanRate: 0 });

    for (const [key, value] of Object.entries(result)) {
      expect(Number.isNaN(value), `${key} is NaN`).toBe(false);
    }
    expect(result.newMonthlyPayment).toBeGreaterThan(0);
  });

  it('accepts zero-percent financing but rejects impossible BRRRR assumptions', () => {
    expect(validateBRRRRInputs({ ...brrrrBase, rehabFinancingRate: 0, newLoanRate: 0 })).toEqual([]);
    expect(validateBRRRRInputs({ ...brrrrBase, purchasePrice: -1, vacancyRate: 120 })).toEqual(expect.arrayContaining([
      'Costs, rates, terms, and values cannot be negative.',
      'Purchase price must be greater than zero.',
      'Vacancy must be between 0% and 100%.',
    ]));
  });

  it('counts rehab and carry against equity created, not just purchase price', () => {
    const result = calculateBRRRR(brrrrBase);
    const grossSpread = brrrrBase.arv - brrrrBase.purchasePrice;

    // rehab (30k + 10% contingency), closing, fees and 3 months carry all
    // consumed real capital and must reduce the equity actually created
    expect(result.equityCreated).toBeLessThan(grossSpread);
    expect(result.equityCreated).toBeCloseTo(
      brrrrBase.arv - (150000 + 5000 + 3000 + 33000 + 3600), 2,
    );
  });

  it('never divides by zero on an empty deal', () => {
    const empty = calculateBRRRR({
      ...brrrrBase,
      purchasePrice: 0, downPaymentPercent: 0, closingCosts: 0, acquisitionFees: 0,
      holdingCosts: 0, renovationBudget: 0, arv: 0, monthlyRent: 0,
    });
    for (const [key, value] of Object.entries(empty)) {
      expect(Number.isNaN(value), `${key} is NaN`).toBe(false);
    }
  });
});
