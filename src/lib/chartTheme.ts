// Shared chart theme — import these into every recharts component for visual consistency.

export const CHART_COLORS = {
  primary:    "hsl(var(--primary))",
  success:    "hsl(var(--chart-1))",  // emerald: growth, inflows, positive
  warning:    "hsl(var(--chart-3))",  // amber: conservative, outflows
  neutral:    "hsl(var(--muted-foreground))",
  muted:      "hsl(var(--muted))",
  foreground: "hsl(var(--foreground))",
  secondary:  "hsl(var(--secondary-foreground))",
  chart1:     "hsl(var(--chart-1))",
  chart2:     "hsl(var(--chart-2))",
  chart3:     "hsl(var(--chart-3))",
  chart4:     "hsl(var(--chart-4))",
  chart5:     "hsl(var(--chart-5))",
} as const;

export const GRID_PROPS = {
  strokeDasharray: "3 3",
  stroke: "hsl(var(--border))",
  vertical: false,
} as const;

export const AXIS_PROPS = {
  tick: {
    fontSize: 11,
    fill: "hsl(var(--muted-foreground))",
  },
  tickLine: false,
  axisLine: false,
} as const;

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    fontSize: "12px",
    color: "hsl(var(--popover-foreground))",
    boxShadow:
      "0 1px 2px hsl(224 30% 12% / 0.06), 0 16px 40px hsl(224 30% 12% / 0.14)",
  },
  labelStyle: {
    fontWeight: 700,
    marginBottom: 6,
    color: "hsl(var(--foreground))",
  },
} as const;

export const ANIMATION_DURATION = 650;

export const formatChartCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 0,
  }).format(value);

export const formatChartPercent = (value: number): string =>
  `${value.toFixed(1)}%`;
