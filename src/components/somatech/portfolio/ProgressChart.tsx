import { useMemo } from 'react'
import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { ProjectionPath } from '@/lib/investmentGoalEngine'
import type { PortfolioValuePoint } from '@/services/portfolio/valueHistoryService'

/**
 * Actual portfolio value against the projection it was measured against.
 *
 * One hue carries the portfolio — solid for what happened, dashed for the
 * median plan, shaded for the plausible range — so the eye reads them as one
 * quantity in three states rather than three competing series. Deposits and the
 * target sit outside that hue because they are reference frames, not outcomes.
 */

const ACTUAL = 'hsl(221 83% 53%)'      // --primary
const TARGET = 'hsl(168 100% 36%)'     // --accent, only on the labelled target line
const NEUTRAL = 'hsl(220 9% 46%)'      // muted ink for the deposits floor

interface Row {
  date: string
  actual?: number | null
  p50?: number | null
  band?: [number, number] | null
  deposits?: number | null
}

const money = (value: number) =>
  value >= 1000
    ? `$${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`
    : `$${value.toFixed(0)}`

const fullMoney = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export default function ProgressChart({
  history,
  baseline,
}: {
  history: PortfolioValuePoint[]
  baseline: ProjectionPath | null
}) {
  const rows = useMemo<Row[]>(() => {
    const byDate = new Map<string, Row>()

    // The projection is monthly; actuals are daily. Both are keyed by date so a
    // sparse series simply leaves gaps, which connectNulls then bridges.
    for (const point of baseline?.points ?? []) {
      byDate.set(point.date, {
        date: point.date,
        p50: point.p50,
        band: [point.p10, point.p90],
        deposits: point.contributionsOnly,
      })
    }
    for (const point of history) {
      const existing = byDate.get(point.as_of_date)
      if (existing) existing.actual = point.total_value
      else byDate.set(point.as_of_date, { date: point.as_of_date, actual: point.total_value })
    }

    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [history, baseline])

  if (!baseline || rows.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Connect an investment goal to chart your progress against it.
      </div>
    )
  }

  const actualCount = rows.filter(row => row.actual != null).length
  const lastActual = [...rows].reverse().find(row => row.actual != null)

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            minTickGap={48}
            tickFormatter={(value: string) =>
              new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={money}
            // Recharts will not expand the domain for an off-scale
            // ReferenceLine, so a target above the data simply vanishes — the
            // one value the chart exists to aim at.
            domain={[0, (dataMax: number) => Math.max(dataMax, baseline.targetAmount) * 1.08]}
          />

          {/* Plausible range first, so the lines sit on top of it. */}
          <Area
            dataKey="band"
            name="Plausible range"
            stroke="none"
            fill={ACTUAL}
            fillOpacity={0.10}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            dataKey="deposits"
            name="Deposits only"
            stroke={NEUTRAL}
            strokeWidth={1.5}
            strokeDasharray="2 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            dataKey="p50"
            name="Plan"
            stroke={ACTUAL}
            strokeOpacity={0.55}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            dataKey="actual"
            name="Actual"
            stroke={ACTUAL}
            strokeWidth={2.5}
            // Recharts draws nothing for a one-point line, so a new account
            // would show an empty legend entry. Dots carry it until there is a
            // line to draw.
            dot={actualCount <= 3 ? { r: 4, fill: ACTUAL, stroke: 'hsl(var(--card))', strokeWidth: 2 } : false}
            connectNulls
            isAnimationActive={false}
          />

          <ReferenceLine
            y={baseline.targetAmount}
            stroke={TARGET}
            strokeDasharray="4 4"
            strokeWidth={2}
            label={{
              value: `Target ${fullMoney(baseline.targetAmount)}`,
              position: 'insideTopRight',
              fill: 'hsl(var(--foreground))',
              fontSize: 11,
            }}
          />

          <Tooltip
            cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(value: string) =>
              new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            formatter={(value: unknown, name: string) => {
              if (Array.isArray(value)) return [`${fullMoney(value[0])} – ${fullMoney(value[1])}`, name]
              return [fullMoney(Number(value)), name]
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            iconType="plainline"
            wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {!lastActual && (
        <p className="text-center text-xs text-muted-foreground">
          Your plan is shown above. Actual value is recorded from your first brokerage sync onward.
        </p>
      )}
    </div>
  )
}
