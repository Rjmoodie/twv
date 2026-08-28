import * as React from "react"
import { Suspense } from "react"
import { cn } from "@/lib/utils"
import { lazyWithRetry } from "@/lib/lazyWithRetry"

// Lazy load Recharts components to reduce initial bundle size
const RechartsPrimitive = lazyWithRetry(() => import("recharts"))

const Chart = React.forwardRef<
  React.ElementRef<typeof RechartsPrimitive.ResponsiveContainer>,
  React.ComponentPropsWithoutRef<typeof RechartsPrimitive.ResponsiveContainer>
>(({ className, ...props }, ref) => (
  <Suspense fallback={<div className="w-full h-[300px] bg-muted animate-pulse rounded-lg" />}>
    <RechartsPrimitive.ResponsiveContainer
      ref={ref}
      className={cn("h-[300px] w-full", className)}
      {...props}
    />
  </Suspense>
))
Chart.displayName = "Chart"

const ChartTooltip = React.forwardRef<
  React.ElementRef<typeof RechartsPrimitive.Tooltip>,
  React.ComponentPropsWithoutRef<typeof RechartsPrimitive.Tooltip>
>(({ className, ...props }, ref) => (
  <Suspense fallback={null}>
    <RechartsPrimitive.Tooltip
        ref={ref}
      className={cn("rounded-lg border bg-background p-2 shadow-sm", className)}
        {...props}
    />
  </Suspense>
))
ChartTooltip.displayName = "ChartTooltip"

const ChartLegend = React.forwardRef<
  React.ElementRef<typeof RechartsPrimitive.Legend>,
  React.ComponentPropsWithoutRef<typeof RechartsPrimitive.Legend>
>(({ className, ...props }, ref) => (
  <Suspense fallback={null}>
    <RechartsPrimitive.Legend
        ref={ref}
      className={cn("mt-4 flex justify-center", className)}
      {...props}
    />
  </Suspense>
))
ChartLegend.displayName = "ChartLegend"

const ChartLine = React.forwardRef<
  React.ElementRef<typeof RechartsPrimitive.Line>,
  React.ComponentPropsWithoutRef<typeof RechartsPrimitive.Line>
>(({ className, ...props }, ref) => (
  <Suspense fallback={null}>
    <RechartsPrimitive.Line
      ref={ref}
      className={cn("stroke-primary", className)}
      {...props}
    />
  </Suspense>
))
ChartLine.displayName = "ChartLine"

const ChartArea = React.forwardRef<
  React.ElementRef<typeof RechartsPrimitive.Area>,
  React.ComponentPropsWithoutRef<typeof RechartsPrimitive.Area>
>(({ className, ...props }, ref) => (
  <Suspense fallback={null}>
    <RechartsPrimitive.Area
      ref={ref}
      className={cn("fill-primary/20 stroke-primary", className)}
      {...props}
    />
  </Suspense>
))
ChartArea.displayName = "ChartArea"

const ChartBar = React.forwardRef<
  React.ElementRef<typeof RechartsPrimitive.Bar>,
  React.ComponentPropsWithoutRef<typeof RechartsPrimitive.Bar>
>(({ className, ...props }, ref) => (
  <Suspense fallback={null}>
    <RechartsPrimitive.Bar
      ref={ref}
      className={cn("fill-primary", className)}
      {...props}
    />
  </Suspense>
))
ChartBar.displayName = "ChartBar"

const ChartXAxis = React.forwardRef<
  React.ElementRef<typeof RechartsPrimitive.XAxis>,
  React.ComponentPropsWithoutRef<typeof RechartsPrimitive.XAxis>
>(({ className, ...props }, ref) => (
  <Suspense fallback={null}>
    <RechartsPrimitive.XAxis
      ref={ref}
      className={cn("text-muted-foreground text-xs", className)}
      {...props}
    />
  </Suspense>
))
ChartXAxis.displayName = "ChartXAxis"

const ChartYAxis = React.forwardRef<
  React.ElementRef<typeof RechartsPrimitive.YAxis>,
  React.ComponentPropsWithoutRef<typeof RechartsPrimitive.YAxis>
>(({ className, ...props }, ref) => (
  <Suspense fallback={null}>
    <RechartsPrimitive.YAxis
        ref={ref}
      className={cn("text-muted-foreground text-xs", className)}
      {...props}
    />
  </Suspense>
))
ChartYAxis.displayName = "ChartYAxis"

const ChartCartesianGrid = React.forwardRef<
  React.ElementRef<typeof RechartsPrimitive.CartesianGrid>,
  React.ComponentPropsWithoutRef<typeof RechartsPrimitive.CartesianGrid>
>(({ className, ...props }, ref) => (
  <Suspense fallback={null}>
    <RechartsPrimitive.CartesianGrid
      ref={ref}
      className={cn("stroke-muted", className)}
      {...props}
    />
  </Suspense>
))
ChartCartesianGrid.displayName = "ChartCartesianGrid"

const ChartPie = React.forwardRef<
  React.ElementRef<typeof RechartsPrimitive.Pie>,
  React.ComponentPropsWithoutRef<typeof RechartsPrimitive.Pie>
>(({ className, ...props }, ref) => (
  <Suspense fallback={null}>
    <RechartsPrimitive.Pie
      ref={ref}
      className={cn("fill-primary", className)}
      {...props}
    />
  </Suspense>
))
ChartPie.displayName = "ChartPie"

const ChartCell = React.forwardRef<
  React.ElementRef<typeof RechartsPrimitive.Cell>,
  React.ComponentPropsWithoutRef<typeof RechartsPrimitive.Cell>
>(({ className, ...props }, ref) => (
  <Suspense fallback={null}>
    <RechartsPrimitive.Cell
      ref={ref}
      className={cn("fill-primary", className)}
      {...props}
    />
  </Suspense>
))
ChartCell.displayName = "ChartCell"

export {
  Chart,
  ChartTooltip,
  ChartLegend,
  ChartLine,
  ChartArea,
  ChartBar,
  ChartXAxis,
  ChartYAxis,
  ChartCartesianGrid,
  ChartPie,
  ChartCell,
}
