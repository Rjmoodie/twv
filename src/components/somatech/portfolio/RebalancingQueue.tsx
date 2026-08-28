import { useMemo, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getHoldingMarketValue } from '@/services/portfolio/portfolioService'
import { Badge } from '@/components/ui/badge'
import { usePortfolio } from '@/contexts/PortfolioContext'
import { BUCKET_LABELS, type AssetBucket } from '@/types/portfolio'
import type { ResearchResult } from '@/types/portfolio'
import { formatUSD } from './portfolioUtils'
import {
  buildRebalancingPlan,
  rebalanceSummary,
  type RebalancingRecommendation,
  type RebalanceAction,
} from '@/services/portfolio/rebalancingEngine'
import { TrendingUp, TrendingDown, Minus, RefreshCw, FlaskConical } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

const ACTION_STYLE: Record<RebalanceAction, { label: string; color: string; icon: React.ReactNode }> = {
  BUY:    { label: 'Buy',    color: 'text-accent bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-accent dark:border-emerald-800', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  TRIM:   { label: 'Trim',   color: 'text-destructive bg-destructive/10 border-destructive/20 dark:bg-destructive/10/30 dark:text-destructive dark:border-destructive/20',                       icon: <TrendingDown className="w-3.5 h-3.5" /> },
  HOLD:   { label: 'Hold',   color: 'text-muted-foreground bg-muted border-border',                                                                            icon: <Minus className="w-3.5 h-3.5" /> },
  REVIEW: { label: 'Review', color: 'text-warning bg-warning/10 border-warning/20 dark:bg-warning/15/30 dark:text-warning dark:border-warning/20',             icon: <RefreshCw className="w-3.5 h-3.5" /> },
}

const SEVERITY_DOT: Record<string, string> = {
  critical:  'bg-destructive/100',
  moderate:  'bg-warning/100',
  minor:     'bg-yellow-400',
  on_target: 'bg-emerald-500',
}

export default function RebalancingQueue() {
  const { active, drifts } = usePortfolio()
  const [researchByBucket, setResearchByBucket] = useState<Map<string, ResearchResult[]>>(new Map())
  const [researchError, setResearchError] = useState(false)

  const totalValue = useMemo(
    () => (active?.holdings ?? []).reduce((s, h) => s + getHoldingMarketValue(h), 0),
    [active?.holdings],
  )

  const plan = useMemo(
    () => active ? buildRebalancingPlan(active, drifts, totalValue) : [],
    [active, drifts, totalValue],
  )

  const summary = useMemo(() => rebalanceSummary(plan), [plan])

  // Load saved research results for this portfolio and index by bucket
  useEffect(() => {
    if (!active?.id) return
    supabase
      .from('research_results')
      .select('bucket, composite_score, passes_filters, raw_result')
      .eq('portfolio_id', active.id)
      .eq('passes_filters', true)
      .order('composite_score', { ascending: false })
      .then(({ data, error }) => {
        // Research is supplementary context for the plan, so a failure must not
        // blank the tab -- but swallowing it silently left no way to tell
        // "no research yet" apart from "the query broke".
        if (error) {
          console.error('Could not load research context for rebalancing:', error)
          setResearchError(true)
          return
        }
        setResearchError(false)
        if (!data) return
        const map = new Map<string, ResearchResult[]>()
        for (const row of data) {
          const r = row.raw_result as unknown as ResearchResult
          if (!r) continue
          const bucket = row.bucket ?? r.bucket
          if (!map.has(bucket)) map.set(bucket, [])
          map.get(bucket)!.push(r)
        }
        setResearchByBucket(map)
      })
  }, [active?.id])

  if (!active) return null

  const hasHoldings = (active.holdings ?? []).length > 0
  const hasAllocations = drifts.length > 0

  if (!hasAllocations) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        No allocation targets set. Complete the portfolio setup wizard to enable rebalancing analysis.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Buy Actions" value={summary.buyCount} color="text-accent" />
        <SummaryCard label="Trim Actions" value={summary.trimCount} color="text-destructive" />
        <SummaryCard label="Hold" value={summary.holdCount} color="text-muted-foreground" />
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Capital to Deploy</p>
            <p className="text-xl font-bold text-accent">
              {summary.totalToBuy != null ? formatUSD(summary.totalToBuy) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {researchError && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
          Research context could not be loaded, so buy candidates below are ranked on drift alone.
        </div>
      )}

      {/* No holdings notice */}
      {!hasHoldings && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-3 text-xs text-blue-800 dark:text-blue-300">
          No holdings recorded yet — drift is computed against targets only. Add positions in the Holdings tab for actual vs. target analysis.
        </div>
      )}

      {/* Rebalancing action list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Prioritized Actions
            <span className="ml-2 font-normal text-muted-foreground">
              — threshold ±{active.rebalance_threshold_pct ?? 5}%
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {plan.map((rec) => (
              <RebalanceRow
                key={rec.bucket}
                rec={rec}
                candidates={researchByBucket.get(rec.bucket) ?? []}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function RebalanceRow({ rec, candidates }: { rec: RebalancingRecommendation; candidates: ResearchResult[] }) {
  const style = ACTION_STYLE[rec.action]
  const bucketLabel = BUCKET_LABELS[rec.bucket as AssetBucket] ?? rec.bucket
  const topCandidates = candidates.slice(0, 3)

  return (
    <div className="px-4 py-3 hover:bg-muted/20 transition-colors space-y-2">
      <div className="flex items-start gap-3">
        {/* Severity dot */}
        <div className="mt-1 shrink-0">
          <span className={`inline-block w-2 h-2 rounded-full ${SEVERITY_DOT[rec.drift_severity]}`} />
        </div>

        {/* Action badge */}
        <div className={`flex items-center gap-1 shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${style.color}`}>
          {style.icon}
          {style.label}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{bucketLabel}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {rec.actual_pct.toFixed(1)}% → {rec.target_pct.toFixed(0)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{rec.rationale}</p>
        </div>

        {/* Gap USD */}
        {rec.gap_usd != null && rec.action !== 'HOLD' && (
          <div className="shrink-0 text-right">
            <span className={`text-sm font-semibold tabular-nums ${rec.action === 'BUY' ? 'text-accent' : 'text-destructive'}`}>
              {rec.action === 'BUY' ? '+' : '-'}{formatUSD(Math.abs(rec.gap_usd))}
            </span>
          </div>
        )}
      </div>

      {/* Research candidates for BUY actions */}
      {rec.action === 'BUY' && topCandidates.length > 0 && (
        <div className="ml-8 flex items-center gap-2 flex-wrap">
          <FlaskConical className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">Top scored:</span>
          {topCandidates.map((c) => (
            <div key={c.ticker} className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
              <span className="font-semibold">{c.ticker}</span>
              <span className={`font-bold ${c.composite_score >= 7 ? 'text-accent' : c.composite_score >= 5 ? 'text-yellow-600' : 'text-destructive'}`}>
                {c.composite_score.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
