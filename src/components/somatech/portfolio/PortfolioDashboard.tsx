import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getHoldingMarketValue } from '@/services/portfolio/portfolioService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePortfolio } from '@/contexts/PortfolioContext'
import { GOAL_LABELS, BUCKET_LABELS, type AssetBucket } from '@/types/portfolio'
import { formatUSD } from './portfolioUtils'
import {
  Target,
  TrendingUp,
  AlertTriangle,
  FlaskConical,
  Scale,
  Link2,
  Layers,
  RefreshCw,
  Database,
  PlusCircle,
} from 'lucide-react'
import AllocationChart from './AllocationChart'
import HoldingsTable from './HoldingsTable'
import PositionReconciliation from './PositionReconciliation'
import ProgressSection from './ProgressSection'
import ResearchQueue from './ResearchQueue'
import RebalancingQueue from './RebalancingQueue'
import DeployCapital from './DeployCapital'
import BrokerageConnect from './BrokerageConnect'
import ExecutionLog from './ExecutionLog'
import { getLatestCashSnapshot, getPrimarySchwabConnection, syncSchwabConnection, type BrokerageCashSnapshot, type SchwabConnection } from '@/services/brokerage/schwabService'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import { mapStockAnalysisResponse, type StockAnalysisResponse } from '@/components/somatech/stock-analysis/stockAnalysisMapper'
import { projectInvestmentGoal } from '@/lib/investmentGoalEngine'
import type { InvestmentGoalRecord } from '@/services/investmentGoalService'

type ActiveTab = 'deploy' | 'overview' | 'holdings' | 'research' | 'rebalance' | 'brokerage'

interface PortfolioDashboardProps {
  /** Rendered in the header's action row so it does not need a row of its own. */
  onNewPortfolio?: () => void
  investmentGoal?: InvestmentGoalRecord | null
}

const TAB_KEYS: ActiveTab[] = ['deploy', 'overview', 'holdings', 'rebalance', 'research', 'brokerage']

export default function PortfolioDashboard({ investmentGoal, onNewPortfolio }: PortfolioDashboardProps) {
  const { active, drifts, portfolios, setActive, refresh } = usePortfolio()
  // The chosen tab lives in the URL so a refresh, a bookmark or a shared link
  // all land where the user actually was. Previously only 'brokerage' was
  // honoured on load, and nothing wrote the tab back.
  const [tab, setTab] = useState<ActiveTab>(() => {
    const requested = new URLSearchParams(window.location.search).get('portfolio_tab')
    return TAB_KEYS.includes(requested as ActiveTab) ? (requested as ActiveTab) : 'deploy'
  })

  const selectTab = (next: ActiveTab) => {
    setTab(next)
    const params = new URLSearchParams(window.location.search)
    params.set('portfolio_tab', next)
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`)
  }
  const [brokerageConn, setBrokerageConn] = useState<SchwabConnection | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [quotesRefreshedAt, setQuotesRefreshedAt] = useState<Date | null>(null)
  const [quoteProgress, setQuoteProgress] = useState<{ done: number; total: number } | null>(null)
  const [cashSnapshot, setCashSnapshot] = useState<BrokerageCashSnapshot | null>(null)

  useEffect(() => {
    if (!active?.id) { setBrokerageConn(null); return }
    let cancelled = false
    void getPrimarySchwabConnection(active.id).then(connection => {
      if (!cancelled) setBrokerageConn(connection)
    }).catch(() => { if (!cancelled) setBrokerageConn(null) })
    void getLatestCashSnapshot(active.id).then(snapshot => {
      if (!cancelled) setCashSnapshot(snapshot)
    }).catch(() => { if (!cancelled) setCashSnapshot(null) })
    return () => { cancelled = true }
  }, [active?.id])

  const totalValue = (active?.holdings ?? []).reduce((s, h) => s + getHoldingMarketValue(h), 0)
  // Cash is a holding row so it reaches allocation math, but it is not a
  // position: counting it made an unfunded account read "1 of 30" and would
  // exhaust the cap a slot early.
  const investedHoldings = (active?.holdings ?? []).filter(h => h.bucket !== 'CASH')
  const brokerCash = cashSnapshot?.cash_balance ?? null
  const isUnfunded = investedHoldings.length === 0
  const goalProjection = useMemo(() => {
    if (!active?.investment_goal_id) return null
    const savedGoal = investmentGoal?.id === active.investment_goal_id ? investmentGoal : null
    const targetAmount = savedGoal?.target_amount ?? active.target_amount
    const monthlyContribution = savedGoal?.monthly_contribution ?? active.monthly_contribution
    const horizonYears = savedGoal?.horizon_years ?? active.horizon_years
    if (!targetAmount || monthlyContribution == null) return null
    const riskProfile = savedGoal?.risk_profile ?? (active.risk_tolerance <= 2 ? 'conservative' : active.risk_tolerance >= 4 ? 'growth' : 'moderate')
    return projectInvestmentGoal({
      targetAmount,
      currentBalance: totalValue > 0 ? totalValue : (active.initial_capital ?? 0),
      monthlyContribution,
      horizonYears,
      riskProfile,
      annualContributionGrowthPct: savedGoal?.annual_contribution_growth_pct,
      inflationPct: savedGoal?.inflation_pct,
    })
  }, [active, investmentGoal, totalValue])

  if (!active) return null
  const criticalDrifts = drifts.filter((d) => d.drift_severity === 'critical')
  const needsRebalance = criticalDrifts.length > 0

  // Quotes were fetched one holding at a time, so a 20-position portfolio meant
  // 20 serial round-trips behind a bare spinner. Run a small pool instead --
  // bounded because stock-analysis fans out to a rate-limited provider -- and
  // report progress while it works.
  const QUOTE_CONCURRENCY = 4

  const refreshHoldingQuotes = async () => {
    const holdings = (active.holdings ?? []).filter(holding => holding.source !== 'schwab')
    setRefreshing(true)
    // A broker-linked portfolio takes its truth from the broker, so the
    // per-holding quote fan-out below is only the unlinked fallback path.
    const schwab = brokerageConn ?? await getPrimarySchwabConnection(active.id).catch(() => null)
    if (schwab) {
      try {
        const result = await syncSchwabConnection(schwab.id)
        await refresh()
        setBrokerageConn(await getPrimarySchwabConnection(active.id))
        setQuotesRefreshedAt(new Date(result.provider_data_as_of))
        toast({ title: 'Schwab portfolio refreshed', description: `${result.positions} positions checked; reconciliation ${result.reconciliation_status}.` })
      } catch (cause) {
        toast({ title: 'Schwab refresh did not complete', description: cause instanceof Error ? cause.message : 'Existing portfolio values were preserved.', variant: 'destructive' })
      } finally { setRefreshing(false) }
      return
    }
    if (!holdings.length) { setRefreshing(false); return }
    setQuoteProgress({ done: 0, total: holdings.length })
    let updated = 0
    const failures: string[] = []

    const refreshOne = async (holding: (typeof holdings)[number]) => {
      try {
        const { data, error } = await supabase.functions.invoke('stock-analysis', { body: { ticker: holding.ticker } })
        if (error || !data) { failures.push(holding.ticker); return }
        const live = mapStockAnalysisResponse(data as StockAnalysisResponse)
        const { error: updateError } = await supabase.from('portfolio_holdings').update({ current_price: live.price, market_value: holding.shares != null ? holding.shares * live.price : holding.market_value }).eq('id', holding.id)
        if (updateError) failures.push(holding.ticker); else updated++
      } catch {
        failures.push(holding.ticker)
      } finally {
        setQuoteProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev))
      }
    }

    const queue = [...holdings]
    await Promise.all(
      Array.from({ length: Math.min(QUOTE_CONCURRENCY, queue.length) }, async () => {
        for (let next = queue.shift(); next; next = queue.shift()) await refreshOne(next)
      }),
    )

    await refresh()
    setQuotesRefreshedAt(new Date())
    setQuoteProgress(null)
    setRefreshing(false)
    toast({ title: failures.length ? 'Portfolio partially refreshed' : 'Portfolio refreshed', description: `${updated} holding${updated === 1 ? '' : 's'} updated.${failures.length ? ` Could not refresh: ${failures.join(', ')}.` : ''}`, variant: failures.length ? 'destructive' : 'default' })
  }

  const tabs: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: 'deploy',     label: 'Deploy',      icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'overview',   label: 'Overview',    icon: <Target className="w-4 h-4" /> },
    { key: 'holdings',   label: 'Holdings',    icon: <Layers className="w-4 h-4" /> },
    { key: 'rebalance',  label: 'Rebalance',   icon: <Scale className="w-4 h-4" /> },
    { key: 'research',   label: 'Research',    icon: <FlaskConical className="w-4 h-4" /> },
    { key: 'brokerage',  label: 'Brokerage',   icon: <Link2 className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{active.name}</h1>
            <Badge>{GOAL_LABELS[active.goal]}</Badge>
            {active.is_default && <Badge variant="secondary">Default</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {active.horizon_years}yr horizon · Risk {active.risk_tolerance}/5 tolerance · {active.risk_capacity}/5 capacity
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNewPortfolio && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onNewPortfolio}>
              <PlusCircle className="h-3.5 w-3.5" />New portfolio
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-2" onClick={refreshHoldingQuotes} disabled={refreshing || (!(active.holdings ?? []).length && !brokerageConn)}><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />{brokerageConn ? 'Sync Schwab' : quoteProgress ? `Refreshing ${quoteProgress.done}/${quoteProgress.total}` : 'Refresh prices'}</Button>
        {portfolios.length > 1 && <Select value={active.id} onValueChange={setActive}>
            <SelectTrigger className="w-[200px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {portfolios.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border bg-card/60 px-3 py-2 text-xs text-muted-foreground"><Database className="h-3.5 w-3.5 text-primary" />{brokerageConn ? 'Schwab is the primary source for positions, cash, cost basis and private valuation. ' : 'No primary broker is connected; manual holdings use server-cached market quotes. '}{quotesRefreshedAt ? `Last refreshed ${quotesRefreshedAt.toLocaleTimeString()}.` : brokerageConn ? (brokerageConn.provider_data_as_of ? `Schwab as of ${new Date(brokerageConn.provider_data_as_of).toLocaleString()}.` : 'Initial sync pending.') : ''}</div>

      {goalProjection && (
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Badge variant="secondary">Connected investment goal</Badge>
              <h2 className="mt-3 text-xl font-semibold">{goalProjection.expectedGoalProbabilityPct.toFixed(0)}% modeled likelihood of reaching ${goalProjection.inputs.targetAmount.toLocaleString()}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Based on the current balance, ${goalProjection.inputs.monthlyContribution.toLocaleString()}/month contribution, {goalProjection.inputs.horizonYears}-year horizon, and the latest saved risk policy.</p>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-3 text-right">
              <div><p className="text-xs text-muted-foreground">Required monthly</p><p className="font-semibold">${Math.ceil(goalProjection.requiredMonthlyContribution).toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Expected value</p><p className="font-semibold">${Math.round(goalProjection.scenarios[1].endingBalance).toLocaleString()}</p></div>
            </div>
          </div>
          <p className="mt-4 border-t border-primary/15 pt-3 text-xs text-muted-foreground">Illustrative projection using the saved assumption set—not a guarantee. Contributions, fees, taxes, inflation, and market outcomes can materially change results.</p>
        </section>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Portfolio Value</p>
            <p className="text-xl font-bold">{totalValue > 0 ? formatUSD(totalValue) : '—'}</p>
            {brokerCash != null && <p className="text-xs text-muted-foreground">{formatUSD(brokerCash)} cash at broker</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Positions</p>
            <p className="text-xl font-bold">{investedHoldings.length}</p>
            <p className="text-xs text-muted-foreground">of {active.max_positions} max</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Buckets On-Target</p>
            <p className="text-xl font-bold">
              {drifts.filter((d) => d.drift_severity === 'on_target').length}
              <span className="text-sm text-muted-foreground font-normal"> / {drifts.length}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Min Conviction Score</p>
            <p className="text-xl font-bold">{active.min_conviction_score}/10</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs — scrollable on narrow screens */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-0.5 border-b min-w-max">
          {tabs.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => selectTab(key)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                tab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* Rebalance alert */}
      {needsRebalance && !isUnfunded && (
        <button
          onClick={() => selectTab('rebalance')}
          className="w-full text-left flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 dark:bg-warning/15/20 dark:border-warning/20 p-3 hover:bg-warning/10 dark:hover:bg-amber-950/40 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
          <p className="text-sm text-warning dark:text-warning">
            <strong>{criticalDrifts.length} bucket{criticalDrifts.length > 1 ? 's' : ''}</strong> are critically off-target.{' '}
            <span className="underline underline-offset-2">View rebalancing plan →</span>
          </p>
        </button>
      )}

      {/* Onboarding guidance sits inside the content area, below the
          navigation, so the tabs stay reachable without scrolling. */}
      {isUnfunded && (
        <section className="rounded-2xl border bg-gradient-to-br from-card to-primary/5 p-5">
          <div className="max-w-2xl"><Badge variant="secondary">Portfolio setup</Badge><h2 className="mt-3 text-xl font-semibold">Turn your policy into an investable plan</h2><p className="mt-1 text-sm text-muted-foreground">{brokerCash != null && brokerCash > 0 ? `Your broker reports ${formatUSD(brokerCash)} in cash and no positions yet. Choose the next step that matches how you invest.` : 'This portfolio has allocation rules but no holdings yet. Choose the next step that matches how you invest.'}</p></div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <button onClick={() => selectTab('deploy')} className="rounded-xl border bg-background/70 p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"><TrendingUp className="h-5 w-5 text-primary" /><p className="mt-3 font-medium">Deploy new capital</p><p className="mt-1 text-xs text-muted-foreground">Generate a goal-aware monthly allocation plan.</p></button>
            <button onClick={() => selectTab('research')} className="rounded-xl border bg-background/70 p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"><FlaskConical className="h-5 w-5 text-primary" /><p className="mt-3 font-medium">Research candidates</p><p className="mt-1 text-xs text-muted-foreground">Score saved ideas against your investment policy.</p></button>
            <button onClick={() => selectTab('brokerage')} className="rounded-xl border bg-background/70 p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"><Link2 className="h-5 w-5 text-primary" /><p className="mt-3 font-medium">Connect brokerage</p><p className="mt-1 text-xs text-muted-foreground">Import positions and keep market values current.</p></button>
          </div>
        </section>
      )}

      {/* Tab content */}
      {tab === 'deploy'   && <DeployCapital portfolio={active} availableCash={brokerCash} />}
      {tab === 'overview' && (
        <div className="space-y-6">
          <ProgressSection investmentGoal={investmentGoal ?? null} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AllocationChart drifts={drifts} totalValue={totalValue} />
          <DriftTable drifts={drifts} totalValue={totalValue} initialCapital={active.initial_capital} />
        </div>
        </div>
      )}
      {tab === 'holdings'  && (
        <div className="space-y-6">
          <PositionReconciliation onDeploy={() => selectTab('deploy')} />
          <HoldingsTable portfolio={active} />
        </div>
      )}
      {tab === 'rebalance' && <RebalancingQueue />}
      {tab === 'research'  && <ResearchQueue portfolio={active} />}
      {tab === 'brokerage' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <BrokerageConnect
            portfolioId={active.id}
            onConnectionChange={(c) => {
              // BrokerageConnect reports on mount as well as after a sync, so
              // refresh only when the connection or its data actually moved.
              const changed = c?.id !== brokerageConn?.id
                || c?.provider_data_as_of !== brokerageConn?.provider_data_as_of
              setBrokerageConn(c)
              if (c && changed) void refresh()
            }}
          />
          <ExecutionLog
            portfolioId={active.id}
            connection={brokerageConn}
            onRefreshNeeded={refresh}
          />
        </div>
      )}
    </div>
  )
}

// ─── Drift table (inline sub-component) ──────────────────────────────────────

function DriftTable({
  drifts,
  totalValue,
  initialCapital,
}: {
  drifts: ReturnType<typeof usePortfolio>['drifts']
  totalValue: number
  initialCapital?: number
}) {
  const capital = totalValue > 0 ? totalValue : (initialCapital ?? 0)

  const severityColor: Record<string, string> = {
    on_target: 'text-accent',
    minor:     'text-yellow-600',
    moderate:  'text-warning',
    critical:  'text-destructive',
  }

  const severityLabel: Record<string, string> = {
    on_target: 'On target',
    minor:     'Minor drift',
    moderate:  'Moderate',
    critical:  'Critical',
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Allocation Drift</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left px-4 py-2">Bucket</th>
              <th className="text-right px-4 py-2">Target</th>
              <th className="text-right px-4 py-2">Actual</th>
              <th className="text-right px-4 py-2">Gap $</th>
              <th className="text-right px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {drifts.map((d) => {
              const gapAmt = capital > 0
                ? ((d.target_pct - d.actual_pct) / 100) * capital
                : null
              return (
                <tr key={d.bucket} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium text-xs">{BUCKET_LABELS[d.bucket as AssetBucket]}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{d.target_pct.toFixed(0)}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{d.actual_pct.toFixed(1)}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                    {gapAmt != null && gapAmt !== 0 ? (
                      <span className={gapAmt > 0 ? 'text-accent' : 'text-destructive'}>
                        {gapAmt > 0 ? '+' : ''}{formatUSD(gapAmt)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className={`px-4 py-2.5 text-right text-xs font-medium ${severityColor[d.drift_severity]}`}>
                    {severityLabel[d.drift_severity]}
                  </td>
                </tr>
              )
            })}
            {drifts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No holdings yet — add positions to see drift analysis.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
