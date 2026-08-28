import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePortfolio } from '@/contexts/PortfolioContext'
import { deleteHolding, upsertHolding } from '@/services/portfolio/portfolioService'
import {
  RECONCILIATION_COPY,
  unreconciledPositions,
  type ReconciledPosition,
} from '@/services/portfolio/positionReconciliation'
import { toast } from '@/hooks/use-toast'
import { formatUSD } from './portfolioUtils'
import { AlertTriangle, ArrowRight, Check, ScaleIcon, TrendingUp } from 'lucide-react'

const STATE_STYLE: Record<ReconciledPosition['state'], string> = {
  reconciled: 'bg-accent/10 text-accent',
  planned_not_held: 'bg-primary/10 text-primary',
  held_not_planned: 'bg-warning/15 text-warning',
  quantity_variance: 'bg-warning/15 text-warning',
}

export default function PositionReconciliation({ onDeploy }: { onDeploy: () => void }) {
  const { active, refresh } = usePortfolio()
  const [working, setWorking] = useState<string | null>(null)

  const rows = useMemo(
    () => unreconciledPositions(active?.holdings ?? []),
    [active?.holdings],
  )

  if (!active) return null

  async function run(key: string, action: () => Promise<void>, success: string) {
    setWorking(key)
    try {
      await action()
      await refresh()
      toast({ title: success })
    } catch (cause) {
      toast({
        title: 'Could not update the plan',
        description: cause instanceof Error ? cause.message : 'Nothing was changed.',
        variant: 'destructive',
      })
    } finally {
      setWorking(null)
    }
  }

  const adoptIntoPlan = (row: ReconciledPosition) =>
    run(`${row.ticker}:adopt`, async () => {
      const actual = row.actual!
      await upsertHolding(active!.id, {
        ticker: row.ticker,
        company_name: actual.company_name ?? row.ticker,
        bucket: actual.bucket,
        shares: Number(actual.shares ?? 0),
        cost_basis: actual.cost_basis,
        current_price: actual.current_price,
        market_value: actual.market_value,
      })
    }, `${row.ticker} adopted into your plan`)

  const dropFromPlan = (row: ReconciledPosition) =>
    run(`${row.ticker}:drop`, async () => {
      await deleteHolding(active!.id, row.ticker)
    }, `${row.ticker} removed from your plan`)

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Check className="h-4 w-4 text-accent" />
          Your plan and your broker agree on every position.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ScaleIcon className="h-4 w-4 text-warning" />
          <CardTitle className="text-base">Plan vs broker</CardTitle>
          <Badge variant="secondary">{rows.length} to review</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          SomaTech holds what you intend to own; your broker holds what you actually own.
          These differ — each one is a decision, not an error.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(row => {
          const copy = RECONCILIATION_COPY[row.state]
          const busy = working?.startsWith(`${row.ticker}:`)
          return (
            <div key={row.ticker} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{row.ticker}</span>
                    {row.company_name && (
                      <span className="truncate text-xs text-muted-foreground">{row.company_name}</span>
                    )}
                    <Badge className={STATE_STYLE[row.state]} variant="secondary">{copy.label}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{copy.detail}</p>
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                    Plan: {row.plannedShares ?? '—'} · Broker: {row.actualShares ?? '—'}
                    {row.shareVariance != null && row.shareVariance !== 0 && (
                      <span className={row.shareVariance > 0 ? 'text-warning' : 'text-destructive'}>
                        {' '}({row.shareVariance > 0 ? '+' : ''}{row.shareVariance} vs plan)
                      </span>
                    )}
                    {row.actualValue != null && ` · ${formatUSD(row.actualValue)} at broker`}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {row.state === 'planned_not_held' && (
                    <>
                      <Button size="sm" onClick={onDeploy} disabled={busy} className="gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" />Deploy
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void dropFromPlan(row)} disabled={busy}>
                        Drop from plan
                      </Button>
                    </>
                  )}
                  {row.state === 'held_not_planned' && (
                    <Button size="sm" onClick={() => void adoptIntoPlan(row)} disabled={busy} className="gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5" />Adopt into plan
                    </Button>
                  )}
                  {row.state === 'quantity_variance' && (
                    <>
                      <Button size="sm" onClick={() => void adoptIntoPlan(row)} disabled={busy} className="gap-1.5">
                        <ArrowRight className="h-3.5 w-3.5" />Match broker
                      </Button>
                      <Button size="sm" variant="outline" onClick={onDeploy} disabled={busy}>
                        Close the gap
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        <p className="flex items-start gap-1.5 pt-1 text-[11px] text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          Actions here only change your plan. Nothing is ever sent to your broker.
        </p>
      </CardContent>
    </Card>
  )
}
