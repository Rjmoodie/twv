import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BUCKET_LABELS, type AssetBucket } from '@/types/portfolio'
import { type AllocationDrift } from '@/services/portfolio/portfolioService'
import { SEVERITY_COLOR, formatUSD } from './portfolioUtils'

const BUCKET_COLORS: Partial<Record<AssetBucket, string>> = {
  US_EQUITY_LARGE:                 'bg-blue-500',
  US_EQUITY_SMALL:                 'bg-blue-300',
  INTL_EQUITY_DEVELOPED:           'bg-violet-500',
  INTL_EQUITY_EMERGING:            'bg-violet-300',
  FIXED_INCOME_INVESTMENT_GRADE:   'bg-emerald-500',
  FIXED_INCOME_HIGH_YIELD:         'bg-emerald-300',
  REAL_ASSETS:                     'bg-warning/100',
  ALTERNATIVES:                    'bg-orange-400',
  CASH:                            'bg-slate-400',
}

interface Props {
  drifts: AllocationDrift[]
  totalValue: number
}

export default function AllocationChart({ drifts, totalValue }: Props) {
  const hasHoldings = totalValue > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Allocation Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Target allocation bar */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Target</p>
          <div className="flex h-5 w-full rounded overflow-hidden gap-px">
            {drifts.map((d) => (
              d.target_pct > 0 && (
                <div
                  key={d.bucket}
                  className={`${BUCKET_COLORS[d.bucket as AssetBucket] ?? 'bg-slate-400'} opacity-80`}
                  style={{ width: `${d.target_pct}%` }}
                  title={`${BUCKET_LABELS[d.bucket as AssetBucket]}: ${d.target_pct}%`}
                />
              )
            ))}
          </div>
        </div>

        {/* Actual allocation bar */}
        {hasHoldings && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Actual</p>
            <div className="flex h-5 w-full rounded overflow-hidden gap-px">
              {drifts.map((d) => (
                d.actual_pct > 0 && (
                  <div
                    key={d.bucket}
                    className={`${BUCKET_COLORS[d.bucket as AssetBucket] ?? 'bg-slate-400'}`}
                    style={{ width: `${d.actual_pct}%` }}
                    title={`${BUCKET_LABELS[d.bucket as AssetBucket]}: ${d.actual_pct.toFixed(1)}%`}
                  />
                )
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
          {drifts.filter((d) => d.target_pct > 0).map((d) => (
            <div key={d.bucket} className="flex items-center gap-2 text-xs">
              <div className={`w-2.5 h-2.5 rounded-sm shrink-0 ${BUCKET_COLORS[d.bucket as AssetBucket] ?? 'bg-slate-400'}`} />
              <span className="text-muted-foreground truncate">{BUCKET_LABELS[d.bucket as AssetBucket]}</span>
              <span className="ml-auto font-medium tabular-nums">{d.target_pct}%</span>
            </div>
          ))}
        </div>

        {!hasHoldings && (
          <p className="text-xs text-center text-muted-foreground py-2 border-t mt-2">
            Add holdings to see actual vs. target comparison.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
