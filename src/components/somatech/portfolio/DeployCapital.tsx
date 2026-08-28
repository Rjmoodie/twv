import { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePortfolio } from '@/contexts/PortfolioContext'
import { upsertHolding } from '@/services/portfolio/portfolioService'
import { isUniverseStale, loadScoredUniverse, scoreUniverse } from '@/services/research/universeScorer'
import { generateDeploymentPlan, type BuyRecommendation } from '@/services/portfolio/recommendationEngine'
import { BUCKET_LABELS, type Portfolio, type GoalType, type AssetBucket } from '@/types/portfolio'
import { Sparkles, TrendingUp, RefreshCw, CheckCircle2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatUSD } from './portfolioUtils'

interface Props {
  portfolio: Portfolio
  /** Actual cash the broker reports, when a brokerage is linked. */
  availableCash?: number | null
}

type Phase = 'idle' | 'checking' | 'scoring' | 'ready' | 'executing'

const PRIORITY_STYLE = {
  high:   'border-destructive/20 bg-destructive/10 dark:bg-destructive/10/20 dark:border-destructive/20',
  medium: 'border-orange-200 bg-warning/10 dark:bg-warning/15/20 dark:border-orange-800',
  low:    'border-border bg-muted/20',
}
const PRIORITY_BADGE = {
  high:   'border-destructive/20 text-destructive dark:text-destructive',
  medium: 'border-orange-300 text-warning dark:text-warning',
  low:    'border-muted-foreground/30 text-muted-foreground',
}

export default function DeployCapital({ portfolio, availableCash }: Props) {
  const { drifts, refresh } = usePortfolio()
  // Prefer what the broker says is actually available; the goal's monthly
  // contribution is the fallback when no brokerage is linked.

  const [phase, setPhase]                   = useState<Phase>('idle')
  const [scoringProgress, setScoringProgress] = useState<{ done: number; total: number } | null>(null)
  const [recommendations, setRecommendations] = useState<BuyRecommendation[]>([])
  const [unallocated, setUnallocated]         = useState(0)
  const [coveragePct, setCoveragePct]         = useState(0)
  const [executed, setExecuted]               = useState<Set<string>>(new Set())
  const [expanded, setExpanded]               = useState<Set<string>>(new Set())
  const [error, setError]                     = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
  }, [])

  // Deployable cash has exactly one source: the linked brokerage. There is no
  // manual entry, so a plan can never be built against money that is not
  // actually in the account.
  const capital = availableCash != null && availableCash > 0 ? availableCash : 0
  const brokerLinked = availableCash != null

  const toggleExpand = (ticker: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker); else next.add(ticker)
      return next
    })

  const generate = useCallback(async () => {
    if (capital <= 0) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setPhase('checking')
    setError(null)
    setRecommendations([])
    setExecuted(new Set())

    try {
      // Load existing scored results or trigger universe scoring
      const stale = await isUniverseStale(portfolio.id)
      let scored = await loadScoredUniverse(portfolio.id)

      if (stale || scored.length === 0) {
        setPhase('scoring')
        setScoringProgress({ done: 0, total: 0 })
        scored = await scoreUniverse(
          portfolio.id,
          portfolio.goal as GoalType,
          portfolio.horizon_years,
          (done, total) => setScoringProgress({ done, total }),
          abortRef.current.signal,
        )
      }

      const plan = generateDeploymentPlan(portfolio, capital, scored, drifts)
      setRecommendations(plan.recommendations)
      setUnallocated(plan.unallocated_usd)
      setCoveragePct(plan.coverage_pct)
      setPhase('ready')
    } catch (cause) {
      if ((cause as Error).name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'The deployment plan could not be generated.')
      setPhase('idle')
    } finally {
      setScoringProgress(null)
    }
  }, [capital, portfolio, drifts])

  async function recordOne(rec: BuyRecommendation, showToast = true): Promise<boolean> {
    try {
      await upsertHolding(portfolio.id, {
        ticker:        rec.ticker,
        company_name:  rec.company_name,
        bucket:        rec.bucket,
        shares:        rec.shares ?? undefined,
        cost_basis:    rec.current_price ?? undefined,
        current_price: rec.current_price ?? undefined,
        market_value:  rec.amount_usd,
      })
      setExecuted((prev) => new Set([...prev, rec.ticker]))
      if (showToast) toast({ title: 'Position recorded', description: `${rec.ticker} — $${rec.amount_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` })
      return true
    } catch (e: unknown) {
      if (showToast) toast({ title: 'Could not record position', description: (e as Error).message, variant: 'destructive' })
      return false
    }
  }

  async function recordAll() {
    setPhase('executing')
    let recorded = 0
    let failed = 0
    const remaining = recommendations.filter((rec) => !executed.has(rec.ticker))
    for (const rec of remaining) {
      if (await recordOne(rec, false)) recorded += 1
      else failed += 1
    }
    await refresh()
    setPhase('ready')
    toast({
      title: failed ? 'Some positions were not recorded' : 'Positions recorded',
      description: `${recorded} updated${failed ? `; ${failed} failed. You can retry those individually.` : '.'}`,
      variant: failed ? 'destructive' : 'default',
    })
  }

  const allExecuted = recommendations.length > 0 && recommendations.every((r) => executed.has(r.ticker))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Monthly Capital Deployment</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enter your available funds. The system scores {BUCKET_LABELS['US_EQUITY_LARGE']} and other
              buckets against your <strong>{portfolio.goal.replace(/_/g, ' ')}</strong> policy, then proposes
              candidates and position sizes for your review.
            </p>
          </div>
          {error && (
            <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              The plan could not be generated. {error}
            </div>
          )}
        </div>
      </div>

      {/* Deployable cash — sourced solely from the linked brokerage */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Cash available to deploy</p>
              {brokerLinked ? (
                <>
                  <p className="text-2xl font-bold tabular-nums">{formatUSD(capital)}</p>
                  <p className="text-xs text-muted-foreground">Held at your linked brokerage. Sync to refresh.</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-muted-foreground">—</p>
                  <p className="text-xs text-muted-foreground">Connect a brokerage on the Brokerage tab to read your cash balance.</p>
                </>
              )}
            </div>
            <Button
              size="lg"
              onClick={generate}
              disabled={capital <= 0 || phase === 'scoring' || phase === 'executing'}
              title={!brokerLinked ? 'Connect a brokerage to deploy cash' : capital <= 0 ? 'No cash available at your brokerage' : undefined}
              className="shrink-0"
            >
              {phase === 'scoring' ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Scoring universe…</>
              ) : phase === 'checking' ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Checking…</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />Generate plan</>
              )}
            </Button>
          </div>

          {/* Scoring progress */}
          {phase === 'scoring' && scoringProgress && (
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Scoring {portfolio.goal.replace(/_/g, ' ')} universe…</span>
                <span>{scoringProgress.done}/{scoringProgress.total || '?'}</span>
              </div>
              {scoringProgress.total > 0 && (
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(scoringProgress.done / scoringProgress.total) * 100}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                This only runs once per month — results are cached.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan output */}
      {/* Stays mounted through 'executing' so the in-flight state can actually
          render. Gating on 'ready' alone unmounted the whole plan the moment
          Record all was pressed, so the progress label and disabled states
          below were unreachable and the list vanished mid-write. */}
      {(phase === 'ready' || phase === 'executing') && recommendations.length > 0 && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-semibold">{recommendations.length} positions recommended</span>
              <span className="text-muted-foreground">
                ${(capital - unallocated).toLocaleString(undefined, { maximumFractionDigits: 0 })} of
                ${capital.toLocaleString(undefined, { maximumFractionDigits: 0 })} allocated
                ({coveragePct.toFixed(0)}%)
              </span>
              {unallocated > 50 && (
                <span className="text-muted-foreground">
                  ${unallocated.toLocaleString(undefined, { maximumFractionDigits: 0 })} undeployed — hold as cash
                </span>
              )}
            </div>
            {!allExecuted && (
              <Button
                onClick={recordAll}
                disabled={phase === 'executing'}
                className="shrink-0"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                {phase === 'executing' ? 'Recording positions…' : 'Record all'}
              </Button>
            )}
            {allExecuted && (
              <div className="flex items-center gap-2 text-sm text-accent font-medium">
                <CheckCircle2 className="w-4 h-4" />
                All positions recorded
              </div>
            )}
          </div>

          {/* Recommendation cards */}
          <div className="space-y-2">
            {recommendations.map((rec) => {
              const isExecuted = executed.has(rec.ticker)
              const isExpanded = expanded.has(rec.ticker)
              return (
                <div
                  key={rec.ticker}
                  className={`rounded-lg border transition-all ${PRIORITY_STYLE[rec.priority]} ${isExecuted ? 'opacity-60' : ''}`}
                >
                  {/* Main row */}
                  <div className="p-4 flex items-center gap-3">
                    <button
                      className="flex-1 text-left flex items-center gap-3 min-w-0"
                      onClick={() => toggleExpand(rec.ticker)}
                    >
                      {/* Priority indicator */}
                      <div className={`shrink-0 w-1.5 h-10 rounded-full ${rec.priority === 'high' ? 'bg-destructive/100' : rec.priority === 'medium' ? 'bg-orange-400' : 'bg-muted-foreground/30'}`} />

                      {/* Ticker + company */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base">{rec.ticker}</span>
                          <span className="text-sm text-muted-foreground truncate">{rec.company_name}</span>
                          <Badge variant="outline" className={`text-xs ${PRIORITY_BADGE[rec.priority]}`}>
                          {rec.priority === 'high' ? 'Largest allocation gap' : rec.priority === 'medium' ? 'Moderate allocation gap' : 'Optional'}
                          </Badge>
                          {rec.is_existing && (
                            <Badge variant="secondary" className="text-xs">Adding to position</Badge>
                          )}
                          {isExecuted && (
                            <Badge className="text-xs bg-emerald-100 text-accent dark:bg-emerald-900/30 dark:text-accent border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 mr-1" />Recorded
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                          <span>{BUCKET_LABELS[rec.bucket as AssetBucket]}</span>
                          <span>Score <strong className="text-foreground">{rec.composite_score.toFixed(1)}</strong>/10</span>
                          <span>Alignment <strong className="text-foreground">{rec.goal_alignment_pct}%</strong></span>
                          {rec.dcf_upside_pct != null && (
                            <span className={rec.dcf_upside_pct > 0 ? 'text-accent' : 'text-destructive'}>
                              DCF {rec.dcf_upside_pct > 0 ? '+' : ''}{(rec.dcf_upside_pct * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                    </button>

                    {/* Amount + execute */}
                    <div className="shrink-0 text-right space-y-1">
                      <p className="text-lg font-bold tabular-nums">
                        ${rec.amount_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      {rec.shares != null && rec.current_price != null && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          ~{rec.shares.toFixed(2)} sh @ ${rec.current_price.toFixed(2)}
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant={isExecuted ? 'ghost' : 'outline'}
                        disabled={isExecuted || phase === 'executing'}
                        onClick={() => void recordOne(rec)}
                        className="h-7 text-xs w-full"
                      >
                        {isExecuted ? <><CheckCircle2 className="w-3 h-3 mr-1" />Done</> : 'Record position'}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded rationale */}
                  {isExpanded && (
                    <div className="border-t px-4 pb-3 pt-2.5 space-y-2">
                      <p className="text-xs text-muted-foreground leading-relaxed">{rec.rationale}</p>
                      {rec.current_price != null && (
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">Current price</p>
                            <p className="font-semibold">${rec.current_price.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Amount</p>
                            <p className="font-semibold">${rec.amount_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Shares</p>
                            <p className="font-semibold">{rec.shares?.toFixed(2) ?? '—'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 rounded border border-muted p-3 text-xs text-muted-foreground">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Candidates are generated from available SEC EDGAR fundamentals and may omit funds, bonds, cash products, taxes, fees, and data that is stale or unavailable.
            This records a position in SomaTech; it does not place a brokerage order. Review suitability before acting.
          </div>
        </div>
      )}

      {phase === 'ready' && recommendations.length === 0 && (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No recommendations generated. Your portfolio may already be well-allocated, or the universe
          scored below your conviction threshold. Try lowering filters or adding more capital.
        </div>
      )}
    </div>
  )
}
