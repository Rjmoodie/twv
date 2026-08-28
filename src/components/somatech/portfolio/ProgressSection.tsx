import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { usePortfolio } from '@/contexts/PortfolioContext'
import type { InvestmentGoalRecord } from '@/services/investmentGoalService'
import {
  baselineFor, buildProgressInsight, getPortfolioValueHistory,
  type PortfolioValuePoint,
} from '@/services/portfolio/valueHistoryService'
import ProgressChart from './ProgressChart'
import { formatUSD } from './portfolioUtils'
import { AlertTriangle, LineChart, TrendingDown, TrendingUp } from 'lucide-react'

/** 'YYYY-MM-DD' parses as UTC midnight, which renders as the day before in
 *  any negative offset. Anchoring at noon keeps the calendar date intact. */
const localDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`)

const BAND_COPY = {
  below: { label: 'Behind plan', tone: 'bg-destructive/10 text-destructive' },
  within: { label: 'On plan', tone: 'bg-accent/10 text-accent' },
  above: { label: 'Ahead of plan', tone: 'bg-accent/10 text-accent' },
} as const

function Stat({ label, value, hint, tone }: {
  label: string; value: string; hint?: string; tone?: string
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone ?? ''}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export default function ProgressSection({ investmentGoal }: { investmentGoal: InvestmentGoalRecord | null }) {
  const { active } = usePortfolio()
  const [history, setHistory] = useState<PortfolioValuePoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!active?.id) { setHistory([]); setLoading(false); return }
    setLoading(true)
    void getPortfolioValueHistory(active.id)
      .then(rows => { if (!cancelled) setHistory(rows) })
      .catch(() => { if (!cancelled) setHistory([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [active?.id])

  const baseline = useMemo(
    () => (investmentGoal ? baselineFor(investmentGoal) : null),
    [investmentGoal],
  )
  const insight = useMemo(
    () => buildProgressInsight(history, baseline),
    [history, baseline],
  )

  if (!investmentGoal) return null

  const { comparison, latest, observedDays, growthVsContributionsUsd, changeSinceStartUsd,
        startingBalanceMismatch, targetProgressPct } = insight
  const band = comparison ? BAND_COPY[comparison.band] : null
  const ahead = (comparison?.varianceUsd ?? 0) >= 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <LineChart className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Actual vs plan</CardTitle>
          {band && !startingBalanceMismatch && <Badge variant="secondary" className={band.tone}>{band.label}</Badge>}
          {startingBalanceMismatch && (
            <Badge variant="secondary" className="bg-warning/15 text-warning">Baseline needs review</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Measured against the projection from your goal as set on{' '}
          {new Date(investmentGoal.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
          {' '}— not recomputed from today, so drift is visible.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : (
          <ProgressChart history={history} baseline={baseline} />
        )}

        {startingBalanceMismatch && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="text-xs">
              <p className="font-medium">Your plan starts from a balance your broker never reported.</p>
              <p className="mt-0.5 text-muted-foreground">
                The goal was set with {formatUSD(startingBalanceMismatch.planned)} as the starting balance,
                but the first synced value was {formatUSD(startingBalanceMismatch.observed)}. Most of the gap
                below is that {formatUSD(Math.abs(startingBalanceMismatch.differenceUsd))} difference, not
                performance. Update the goal's starting balance to measure progress against something real.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Actual value"
            value={latest ? formatUSD(latest.total_value) : '—'}
            hint={latest ? `as of ${localDate(latest.as_of_date).toLocaleDateString()}` : 'awaiting first sync'}
          />
          <Stat
            label="Plan expected"
            value={comparison ? formatUSD(comparison.expected) : '—'}
            hint={comparison ? `month ${comparison.month} of plan` : undefined}
          />
          <Stat
            label={ahead ? 'Ahead by' : 'Behind by'}
            value={comparison ? formatUSD(Math.abs(comparison.varianceUsd)) : '—'}
            hint={comparison ? `${comparison.variancePct >= 0 ? '+' : ''}${comparison.variancePct.toFixed(1)}% vs plan` : undefined}
            tone={comparison ? (ahead ? 'text-accent' : 'text-destructive') : undefined}
          />
          {growthVsContributionsUsd != null ? (
            <Stat
              label="Growth beyond deposits"
              value={formatUSD(growthVsContributionsUsd)}
              hint="value above what contributions alone would give"
              tone={growthVsContributionsUsd < 0 ? 'text-destructive' : undefined}
            />
          ) : (
            <Stat
              label="Progress to target"
              value={targetProgressPct != null ? `${targetProgressPct.toFixed(1)}%` : '—'}
              hint={`of ${formatUSD(Number(investmentGoal.target_amount))}`}
            />
          )}
        </div>

        {observedDays > 1 && changeSinceStartUsd != null && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {changeSinceStartUsd >= 0
              ? <TrendingUp className="h-3.5 w-3.5 text-accent" />
              : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
            {formatUSD(Math.abs(changeSinceStartUsd))} {changeSinceStartUsd >= 0 ? 'gained' : 'lost'} across{' '}
            {observedDays} recorded day{observedDays === 1 ? '' : 's'} of history.
          </p>
        )}
        {observedDays <= 1 && (
          <p className="text-xs text-muted-foreground">
            History builds one point per day from your broker syncs. Comparisons sharpen as it accumulates.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
