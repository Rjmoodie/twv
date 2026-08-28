import { describe, it, expect } from 'vitest';
import { calculateCashFlow } from './cashFlowEngine';
import { calculateRunway } from './calculationUtils';
import type { CashFlowInputs } from '../types';

const base: CashFlowInputs = {
  startingCash: 100000,
  monthlyRevenue: 10000,
  revenueGrowthRate: 0,
  timeframe: 12,
  fixedExpenses: [{ name: 'Rent', amount: 3000 }],
  variableExpenses: [{ name: 'COGS', amount: 2000, isPercentage: false }],
  accountsReceivableDays: 0,
  accountsPayableDays: 0,
  taxRate: 25,
  loanAmount: 0,
  interestRate: 0,
  loanTermMonths: 0,
  equityRaised: 0,
  equityRaiseMonth: 0,
  hasSeasonality: false,
  seasonalityMultiplier: 1,
} as CashFlowInputs;

const baseScenario = (overrides: Partial<CashFlowInputs> = {}) =>
  calculateCashFlow({ ...base, ...overrides }).scenarios.base;

describe('cash-flow engine', () => {
  it('does not collect the same revenue twice under AR terms', () => {
    // 60-day terms: month 1 and 2 collect nothing, month 3 collects month 1.
    const s = baseScenario({ accountsReceivableDays: 60 });
    const p = s.monthlyProjections;

    expect(p[0].inflows).toBe(0);
    expect(p[1].inflows).toBe(0);
    expect(p[2].inflows).toBe(10000);

    // Over 12 months only 10 months of revenue can have been collected.
    const collected = p.reduce((sum, m) => sum + m.inflows, 0);
    expect(collected).toBe(10 * 10000);
  });

  it('taxes profit, not revenue — a loss-making month pays no tax', () => {
    // Expenses far exceed revenue: taxable profit is negative.
    const s = baseScenario({
      monthlyRevenue: 5000,
      fixedExpenses: [{ name: 'Burn', amount: 20000 }],
      variableExpenses: [],
    });
    const m = s.monthlyProjections[0];

    // outflow is expenses only; no tax charged on a loss
    expect(m.outflows).toBe(20000);
  });

  it('charges tax only on the profit that remains', () => {
    const s = baseScenario();            // 10k rev, 5k expense, 25% tax
    const m = s.monthlyProjections[0];
    expect(m.outflows).toBe(5000 + 0.25 * 5000);
  });

  it('does not call an equity raise a break-even month', () => {
    // Structurally unprofitable, but a big raise lands in month 3.
    const s = baseScenario({
      monthlyRevenue: 1000,
      fixedExpenses: [{ name: 'Burn', amount: 20000 }],
      variableExpenses: [],
      equityRaised: 500000,
      equityRaiseMonth: 3,
    });

    expect(s.monthlyProjections[2].netFlow).toBeGreaterThan(0);  // cash did rise
    expect(s.breakEvenMonth).toBe(0);                            // but not operating break-even
  });

  it('stops debt service once the loan term ends', () => {
    const withLoan = baseScenario({ loanAmount: 12000, interestRate: 0, loanTermMonths: 6 });
    const p = withLoan.monthlyProjections;

    const duringTerm = p[0].outflows;
    const afterTerm  = p[11].outflows;
    expect(duringTerm).toBeGreaterThan(afterTerm);
    expect(afterTerm).toBe(5000 + 0.25 * 5000);   // expenses + tax only, no payment
  });
});

describe('calculateRunway', () => {
  it('returns Infinity when cash never depletes', () => {
    const projections = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, netFlow: 500 }));
    expect(calculateRunway(projections, 10000)).toBe(Infinity);
  });

  it('returns the month cash first goes to zero', () => {
    const projections = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, netFlow: -1000 }));
    expect(calculateRunway(projections, 2500)).toBe(3);
  });
});
