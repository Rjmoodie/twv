import { useMemo } from 'react'
import { usePersonalFinance, computeCashFlow } from '@/hooks/usePersonalFinance'
import { useBrokerageNetWorth } from '@/hooks/useBrokerageNetWorth'

/**
 * What the connected accounts already answer, in the shape the snapshot form asks.
 *
 * The form asks for seven numbers. Five of them are already known once a bank or
 * a brokerage is linked, and asking someone to type them by hand — while the
 * dashboard three clicks away displays the same figures — is the disconnection
 * the product kept being accused of.
 *
 * Nulls are meaningful: null is "no connected account answers this", which is
 * different from zero. Only the two genuinely unknowable fields — employer match
 * and HSA access — have no entry here at all.
 */
export interface ConnectedFinancials {
  /** Checking + savings. The form's "liquid savings" excludes investments. */
  liquidSavingsUsd: number | null
  /** Everything invested, including any directly linked brokerage. */
  investmentsUsd: number | null
  /** The directly linked brokerage alone, so it can be named. */
  brokerageUsd: number | null
  creditCardsUsd: number | null
  studentLoansUsd: number | null
  monthlyIncomeUsd: number | null
  monthlyExpensesUsd: number | null
  /** Month of the figures, 'YYYY-MM-DD'. */
  asOf: string | null
  /** Whether anything at all is connected. */
  hasAny: boolean
  loading: boolean
}

const positive = (value: number | null | undefined): number | null =>
  value != null && Number.isFinite(value) && value > 0 ? value : null

export function useConnectedFinancials(): ConnectedFinancials {
  const { snapshots, cashFlows, isDemo, isLoading } = usePersonalFinance()
  const { brokerage, loading: brokerageLoading } = useBrokerageNetWorth()

  return useMemo(() => {
    // Demo rows are illustrative. Pre-filling a form from them would put invented
    // numbers into the user's saved profile, which is worse than an empty form.
    const usable = isDemo ? [] : snapshots
    const latest = [...usable].sort(
      (a, b) => new Date(b.snapshot_month).getTime() - new Date(a.snapshot_month).getTime(),
    )[0]
    const flow = isDemo ? undefined : cashFlows[cashFlows.length - 1]
    const totals = flow ? computeCashFlow(flow) : null

    const brokerageUsd = positive(brokerage?.totalUsd)
    const snapshotInvestments = latest ? latest.investments : 0

    const result: ConnectedFinancials = {
      liquidSavingsUsd: latest ? positive(latest.checking + latest.savings) : null,
      // Plaid excludes accounts matched to a direct brokerage connection, so
      // these add rather than double-count.
      investmentsUsd: latest || brokerageUsd != null
        ? positive(snapshotInvestments + (brokerageUsd ?? 0))
        : null,
      brokerageUsd,
      creditCardsUsd: latest ? positive(latest.credit_cards) : null,
      studentLoansUsd: latest ? positive(latest.student_loans) : null,
      monthlyIncomeUsd: totals ? positive(totals.totalIncome) : null,
      monthlyExpensesUsd: totals ? positive(totals.totalExpenses) : null,
      asOf: latest?.snapshot_month ?? null,
      hasAny: false,
      loading: isLoading || brokerageLoading,
    }

    result.hasAny = [
      result.liquidSavingsUsd, result.investmentsUsd, result.creditCardsUsd,
      result.studentLoansUsd, result.monthlyIncomeUsd, result.monthlyExpensesUsd,
    ].some((v) => v != null)

    return result
  }, [snapshots, cashFlows, isDemo, isLoading, brokerage, brokerageLoading])
}
