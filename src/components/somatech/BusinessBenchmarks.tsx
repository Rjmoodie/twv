import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StockData } from "./types";

interface BusinessBenchmarksProps { ticker: string; stockData?: StockData | null }

const pct = (value: number | null | undefined) =>
  value != null && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "Not reported";
const multiple = (value: number | null | undefined) =>
  value != null && Number.isFinite(value) ? `${value.toFixed(1)}x` : "Not reported";
const growth = (current: number | null | undefined, prior: number | null | undefined) =>
  current != null && prior != null && prior !== 0 ? current / prior - 1 : null;

export default function BusinessBenchmarks({ ticker, stockData }: BusinessBenchmarksProps) {
  const annual = stockData?.annualFinancials ?? [];
  const latest = annual[0];
  const prior = annual[1];
  const revenueGrowth = stockData?.quarterlyRevenueGrowthYOY ?? growth(latest?.revenue, prior?.revenue);
  const earningsGrowth = stockData?.quarterlyEarningsGrowthYOY ?? growth(latest?.netIncome, prior?.netIncome);
  const operatingMargin = stockData?.operatingMarginTTM ?? (
    latest?.operatingIncome != null && latest.revenue ? latest.operatingIncome / latest.revenue : null
  );
  const fcfMargin = latest?.freeCashFlow != null && latest.revenue ? latest.freeCashFlow / latest.revenue : null;
  const roe = stockData?.roe;

  let profile = "Insufficient data";
  let rationale = "A lifecycle label requires reported growth, profitability, and valuation data.";
  if (revenueGrowth != null && operatingMargin != null && stockData?.pe != null && roe != null) {
    if (revenueGrowth >= 0.15 && operatingMargin >= 0.1) {
      profile = "Growth compounder";
      rationale = "Revenue growth is at least 15% with a positive double-digit operating margin.";
    } else if (revenueGrowth < 0 && earningsGrowth != null && earningsGrowth < 0) {
      profile = "Contracting";
      rationale = "Both reported revenue and earnings growth are negative.";
    } else {
      profile = "Mature / mixed growth";
      rationale = "Growth and profitability are positive or mixed, but do not meet the transparent growth threshold.";
    }
  }

  const metrics = [
    ["Revenue growth", pct(revenueGrowth), stockData?.quarterlyRevenueGrowthYOY != null ? "YoY latest quarter" : "Latest FY vs prior FY"],
    ["Earnings growth", pct(earningsGrowth), stockData?.quarterlyEarningsGrowthYOY != null ? "YoY latest quarter" : "Latest FY vs prior FY"],
    ["Operating margin", pct(operatingMargin), stockData?.operatingMarginTTM != null ? "TTM" : "Latest FY"],
    ["Free-cash-flow margin", pct(fcfMargin), "Latest FY"],
    ["Return on equity", pct(roe), stockData?.returnOnAssetsTTM != null ? "TTM" : "Latest FY"],
    ["Trailing P/E", multiple(stockData?.pe), "Market metric"],
  ];

  return <Card>
    <CardHeader>
      <CardTitle>Business Quality & Lifecycle — {ticker}</CardTitle>
      <CardDescription>Reported company metrics with explicit periods. The classification is a rules-based research aid, not an AI prediction.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(([label, value, period]) => <div key={label} className="rounded-xl border bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{period}</p>
        </div>)}
      </div>
      <div className="rounded-xl border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">Rules-based profile</p><Badge variant="secondary">{profile}</Badge>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{rationale} This label is recomputed from the values above and does not use hard-coded peer examples.</p>
      </div>
    </CardContent>
  </Card>;
}
