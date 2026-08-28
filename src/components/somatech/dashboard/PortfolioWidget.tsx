import { usePortfolio } from '@/contexts/PortfolioContext'
import { useNavigation } from '@/contexts/NavigationContext'
import { getHoldingMarketValue, isBrokerSourced } from '@/services/portfolio/portfolioService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, AlertTriangle, TrendingUp, ArrowRight, PieChart } from 'lucide-react'

export default function PortfolioWidget() {
  const { portfolios, active, drifts, loading, error, refresh } = usePortfolio()
  const { navigateToModule } = useNavigation()

  if (loading) return null

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-card p-5" role="alert">
        <p className="text-sm font-semibold">Your portfolio could not be loaded</p>
        <p className="mt-1 text-xs text-muted-foreground">No setup or holdings assumptions are being made while portfolio data is unavailable.</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => void refresh()}>Try again</Button>
      </div>
    )
  }

  // ── No portfolio yet ──────────────────────────────────────────────────────────
  if (portfolios.length === 0) {
    return (
      <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover-lift">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/20">
          <PieChart className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="heading-tight font-semibold text-base">Set up your portfolio</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tell the system your goal and horizon. Every month it will tell you exactly what to buy and how much.
          </p>
        </div>
        <Button onClick={() => navigateToModule('portfolio')} className="shrink-0">
          Get started
          <ArrowRight className="w-4 h-4 ml-1.5" />
        </Button>
      </div>
    )
  }

  if (!active) return null

  // The plan holds what you intend to own; the broker holds what you actually
  // own. Summing both gave the dashboard a number the portfolio tab contradicted.
  const holdings      = active.holdings ?? []
  const held          = holdings.filter(isBrokerSourced)
  const plannedOnly   = holdings.length - held.length
  const hasBrokerData = held.length > 0
  const valued        = hasBrokerData ? held : holdings
  const totalValue    = valued.reduce((s, h) => s + getHoldingMarketValue(h), 0)
  const holdingCount  = valued.length
  const criticalCount = drifts.filter((d) => d.drift_severity === 'critical').length
  const hasHoldings   = holdingCount > 0

  return (
    <div
      className="rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-primary/3 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover-lift"
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/20">
        <Sparkles className="w-5 h-5 text-primary" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="heading-tight font-semibold text-sm">{active.name}</p>
          <Badge variant="secondary" className="text-xs">{active.goal.replace(/_/g, ' ')}</Badge>
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertTriangle className="w-3 h-3" />
              {criticalCount} bucket{criticalCount > 1 ? 's' : ''} off-target
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {hasHoldings ? (
            <>
              <span>
                {hasBrokerData ? 'Held' : 'Planned'}{' '}
                <strong className="font-mono tabular-nums text-foreground">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
              </span>
              <span>{holdingCount} position{holdingCount !== 1 ? 's' : ''}</span>
              {hasBrokerData && plannedOnly > 0 && (
                <span className="text-warning">{plannedOnly} planned, not held</span>
              )}
            </>
          ) : (
            <span>No holdings recorded yet</span>
          )}
          <span>{active.horizon_years}yr horizon · Risk {active.risk_tolerance}/5</span>
        </div>
      </div>

      {/* CTA */}
      <Button
        size="sm"
        variant={criticalCount > 0 ? 'default' : 'outline'}
        className="shrink-0"
        onClick={() => navigateToModule('portfolio')}
      >
        <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
        {criticalCount > 0 ? 'Rebalance now' : 'Deploy capital'}
      </Button>
    </div>
  )
}
