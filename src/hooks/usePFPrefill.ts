/**
 * usePFPrefill
 *
 * Maps Personal Finance data to tool-specific pre-fill values.
 * Called at the top of each planning tool component to seed initial form state.
 *
 * Edge cases:
 *  - isDemo → returns empty object (never pre-fill from demo data)
 *  - isLoading → returns empty object (data not ready)
 *  - No snapshots → omits snapshot-derived fields
 *  - No cash flows → omits cash flow-derived fields
 *  - Negative surplus → omits contribution suggestion (would confuse user)
 *  - Zero savings + investments → omits currentSavings (shows blank, not $0)
 *  - Single month of cash flow → still works, no smoothing
 */

import { useMemo } from 'react';
import { usePersonalFinance, computeNetWorth, computeCashFlow } from '@/hooks/usePersonalFinance';

// ── Retirement Planning pre-fill ──────────────────────────────────────────────

export interface RetirementPrefill {
  currentSavings?:      number; // savings + investments from latest snapshot
  monthlyContribution?: number; // annualized 50% of avg monthly surplus (legacy field name)
  retirementSpending?:  number; // annualized current expenses
}

export function useRetirementPrefill(): RetirementPrefill {
  const { snapshots, cashFlows, isDemo, isLoading } = usePersonalFinance();

  return useMemo((): RetirementPrefill => {
    if (isDemo || isLoading) return {};

    const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const recent = cashFlows.slice(-3); // last 3 months for smoothing

    const result: RetirementPrefill = {};

    // Savings + investments (not checking — that's operational cash, not long-term savings)
    if (latest) {
      const pool = latest.savings + latest.investments;
      if (pool > 0) result.currentSavings = Math.round(pool);
    }

    if (recent.length > 0) {
      const avgSurplus  = recent.reduce((sum, cf) => sum + computeCashFlow(cf).surplus, 0) / recent.length;
      const avgExpenses = recent.reduce((sum, cf) => sum + computeCashFlow(cf).totalExpenses, 0) / recent.length;

      // Only suggest a contribution if there's a positive surplus
      // Use 50% — conservative so user consciously increases it
      if (avgSurplus > 0) result.monthlyContribution = Math.round(avgSurplus * 0.5 * 12);

      // Current spending as a proxy for retirement spending need
      if (avgExpenses > 0) result.retirementSpending = Math.round(avgExpenses * 12);
    }

    return result;
  }, [snapshots, cashFlows, isDemo, isLoading]);
}

// ── Business Valuation pre-fill ───────────────────────────────────────────────

export interface BusinessValuationPrefill {
  monthlyRevenue?:  number; // from side_income if business-owner journey completed
  monthlyExpenses?: number; // avg monthly expenses from cash flow
}

export function useBusinessValuationPrefill(): BusinessValuationPrefill {
  const { cashFlows, isDemo, isLoading } = usePersonalFinance();

  return useMemo((): BusinessValuationPrefill => {
    if (isDemo || isLoading || cashFlows.length === 0) return {};

    const recent = cashFlows.slice(-3);
    const result: BusinessValuationPrefill = {};

    // Side income averaged over last 3 months as proxy for business revenue
    const avgSide = recent.reduce((sum, cf) => sum + cf.side_income + cf.other_income, 0) / recent.length;
    if (avgSide > 0) result.monthlyRevenue = Math.round(avgSide);

    // Average monthly expenses
    const avgExp = recent.reduce((sum, cf) => sum + computeCashFlow(cf).totalExpenses, 0) / recent.length;
    if (avgExp > 0) result.monthlyExpenses = Math.round(avgExp);

    return result;
  }, [cashFlows, isDemo, isLoading]);
}
