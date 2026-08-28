import React, { useMemo } from "react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";

import { useTrades } from "../context/TradesProvider";
import { computeRoundTrips } from "../utils/computeRoundTrips";

type EquityCurvePoint = {
  date: string;
  cumulativePnL: number;
  tradePnL: number;
};

type AggregatedTicker = {
  ticker: string;
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
};

type StrategyBreakdown = {
  name: string;
  value: number;
};

const COLORS = ["#2563eb", "#10b981", "#f97316", "#8b5cf6", "#facc15", "#f43f5e", "#14b8a6"];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

const TradesDashboard: React.FC = () => {
  const { trades: rawOrders } = useTrades();
  // Pair individual filled orders into round-trip trades using FIFO
  const trades = useMemo(() => computeRoundTrips(rawOrders), [rawOrders]);

  const {
    summary,
    equityCurve,
    pnlByTicker,
    strategyBreakdown,
    recentTrades,
  } = useMemo(() => {
    if (!trades.length) {
      return {
        summary: {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          netPnL: 0,
          averagePnL: 0,
          winRate: 0,
          lossRate: 0,
          averageHoldMinutes: 0,
          bestTrade: undefined as undefined | { ticker: string; profitLoss: number },
          worstTrade: undefined as undefined | { ticker: string; profitLoss: number },
          profitFactor: 0,
        },
        equityCurve: [] as EquityCurvePoint[],
        pnlByTicker: [] as AggregatedTicker[],
        strategyBreakdown: [] as StrategyBreakdown[],
        recentTrades: [] as typeof trades,
      };
    }

    const sortedTrades = [...trades].sort(
      (a, b) => new Date(a.exitTime).getTime() - new Date(b.exitTime).getTime()
    );

    let cumulative = 0;
    const equityCurveData: EquityCurvePoint[] = sortedTrades.map((trade) => {
      cumulative += trade.profitLoss;
      return {
        date: trade.exitTime,
        cumulativePnL: Number(cumulative.toFixed(2)),
        tradePnL: Number(trade.profitLoss.toFixed(2)),
      };
    });

    let wins = 0;
    let losses = 0;
    let totalPositive = 0;
    let totalNegative = 0;
    let totalHoldMinutes = 0;
    let bestTrade = sortedTrades[0];
    let worstTrade = sortedTrades[0];

    const tickerAggregation = new Map<string, AggregatedTicker>();
    const strategyAggregation = new Map<string, number>();

    sortedTrades.forEach((trade) => {
      if (trade.profitLoss > 0) {
        wins += 1;
        totalPositive += trade.profitLoss;
      } else if (trade.profitLoss < 0) {
        losses += 1;
        totalNegative += trade.profitLoss;
      }

      if (!bestTrade || trade.profitLoss > bestTrade.profitLoss) {
        bestTrade = trade;
      }
      if (!worstTrade || trade.profitLoss < worstTrade.profitLoss) {
        worstTrade = trade;
      }

      const holdMinutes = Math.max(
        0,
        differenceInMinutes(parseISO(trade.exitTime), parseISO(trade.entryTime))
      );
      totalHoldMinutes += holdMinutes;

      const tickerEntry = tickerAggregation.get(trade.ticker) ?? {
        ticker: trade.ticker,
        pnl: 0,
        trades: 0,
        wins: 0,
        losses: 0,
      };

      tickerEntry.pnl += trade.profitLoss;
      tickerEntry.trades += 1;
      tickerEntry.wins += trade.profitLoss > 0 ? 1 : 0;
      tickerEntry.losses += trade.profitLoss < 0 ? 1 : 0;

      tickerAggregation.set(trade.ticker, tickerEntry);

      const strategyTotal = strategyAggregation.get(trade.strategy) ?? 0;
      strategyAggregation.set(trade.strategy, strategyTotal + 1);
    });

    const totalTrades = sortedTrades.length;
    const netPnL = sortedTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);
    const averagePnL = netPnL / totalTrades;
    const winRate = totalTrades ? (wins / totalTrades) * 100 : 0;
    const lossRate = totalTrades ? (losses / totalTrades) * 100 : 0;
    const averageHoldMinutes = totalTrades ? totalHoldMinutes / totalTrades : 0;
    const profitFactor = totalNegative !== 0 ? totalPositive / Math.abs(totalNegative) : 0;

    const pnlByTickerData = Array.from(tickerAggregation.values()).sort(
      (a, b) => b.pnl - a.pnl
    );

    const strategyBreakdownData: StrategyBreakdown[] = Array.from(strategyAggregation.entries()).map(
      ([name, value]) => ({ name, value })
    );

    const recentTradesData = [...sortedTrades]
      .sort((a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime())
      .slice(0, 8);

    return {
      summary: {
        totalTrades,
        winningTrades: wins,
        losingTrades: losses,
        netPnL,
        averagePnL,
        winRate,
        lossRate,
        averageHoldMinutes,
        bestTrade: bestTrade
          ? { ticker: bestTrade.ticker, profitLoss: bestTrade.profitLoss }
          : undefined,
        worstTrade: worstTrade
          ? { ticker: worstTrade.ticker, profitLoss: worstTrade.profitLoss }
          : undefined,
        profitFactor,
      },
      equityCurve: equityCurveData,
      pnlByTicker: pnlByTickerData,
      strategyBreakdown: strategyBreakdownData,
      recentTrades: recentTradesData,
    };
  }, [trades]);

  if (!trades.length) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Trades Dashboard</CardTitle>
          <CardDescription>
            Connect a broker to start streaming trades and unlock performance analytics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Once trades are synced, you&apos;ll see equity curves, strategy insights, and trade-level metrics here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Trades Dashboard</h2>
        <p className="text-muted-foreground">
          Monitor live trade performance, strategy allocation, and risk stats at a glance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total P&amp;L</CardDescription>
            <CardTitle className="text-3xl font-bold">
              {currencyFormatter.format(summary.netPnL)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Profit factor {summary.profitFactor.toFixed(2)} with {summary.winningTrades} winning trades.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Win Rate</CardDescription>
            <CardTitle className="text-3xl font-bold">
              {summary.winRate.toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {summary.winningTrades} winners · {summary.losingTrades} losers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg. Hold Time</CardDescription>
            <CardTitle className="text-3xl font-bold">
              {(summary.averageHoldMinutes / 60).toFixed(1)} hrs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Across {summary.totalTrades} total trades
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Best vs Worst</CardDescription>
            <CardTitle className="text-3xl font-bold">
              {summary.bestTrade
                ? currencyFormatter.format(summary.bestTrade.profitLoss)
                : currencyFormatter.format(0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <div className="flex flex-col gap-1">
              <span>
                Best: {summary.bestTrade?.ticker ?? "--"}
              </span>
              <span>
                Worst: {summary.worstTrade
                  ? `${summary.worstTrade.ticker} ${currencyFormatter.format(summary.worstTrade.profitLoss)}`
                  : "--"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Equity Curve</CardTitle>
            <CardDescription>Rolling cumulative P&amp;L by exit timestamp</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityCurve}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(parseISO(value), "MMM d")}
                  minTickGap={20}
                />
                <YAxis tickFormatter={(value) => currencyFormatter.format(value)} width={90} />
                <RechartsTooltip
                  formatter={(value: number) => currencyFormatter.format(value)}
                  labelFormatter={(value) => format(parseISO(value), "MMM d, yyyy HH:mm")}
                  contentStyle={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cumulativePnL"
                  name="Cumulative P&amp;L"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="tradePnL"
                  name="Trade P&amp;L"
                  stroke="#22c55e"
                  strokeDasharray="4 4"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Strategy Allocation</CardTitle>
            <CardDescription>Share of trades executed by playbook</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={strategyBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                >
                  {strategyBreakdown.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend layout="vertical" align="right" verticalAlign="middle" />
                <RechartsTooltip
                  formatter={(value: number, _name, payload) => {
                    const total = strategyBreakdown.reduce((sum, item) => sum + item.value, 0);
                    const percent = total ? (Number(value) / total) : 0;
                    return [
                      `${value} trades (${percentageFormatter.format(percent)})`,
                      payload?.payload?.name ?? "Strategy",
                    ];
                  }}
                  contentStyle={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>P&amp;L by Ticker</CardTitle>
            <CardDescription>Identify leaders and laggards by cumulative returns</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pnlByTicker}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="ticker" />
                <YAxis tickFormatter={(value) => currencyFormatter.format(value)} width={90} />
                <RechartsTooltip
                  formatter={(value: number) => currencyFormatter.format(value)}
                  contentStyle={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}
                />
                <Legend />
                <Bar dataKey="pnl" name="Net P&amp;L" radius={[6, 6, 0, 0]} fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Win / Loss Mix</CardTitle>
            <CardDescription>Trade distribution by outcome</CardDescription>
          </CardHeader>
          <CardContent className="flex h-72 flex-col justify-center gap-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Winning trades</span>
              <span className="font-semibold text-accent">
                {summary.winningTrades} ({summary.winRate.toFixed(1)}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.min(summary.winRate, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Losing trades</span>
              <span className="font-semibold text-rose-600">
                {summary.losingTrades} ({summary.lossRate.toFixed(1)}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-rose-500"
                style={{ width: `${Math.min(summary.lossRate, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Average trade P&amp;L {currencyFormatter.format(summary.averagePnL)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
          <CardDescription>Detailed ledger of the latest executions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="hidden lg:table-cell">Entry</TableHead>
                <TableHead className="hidden lg:table-cell">Exit</TableHead>
                <TableHead className="hidden md:table-cell text-right">Size</TableHead>
                <TableHead className="hidden md:table-cell text-right">Entry Px</TableHead>
                <TableHead className="hidden md:table-cell text-right">Exit Px</TableHead>
                <TableHead className="text-right">P&amp;L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTrades.map((trade) => {
                const isWinner = trade.profitLoss >= 0;
                return (
                  <TableRow key={trade.id}>
                    <TableCell className="font-medium">{trade.ticker}</TableCell>
                    <TableCell>
                      <Badge
                        variant={trade.position === "long" ? "default" : "secondary"}
                        className={trade.position === "long" ? "bg-emerald-500/10 text-accent" : "bg-slate-500/10 text-slate-600"}
                      >
                        {trade.position.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {format(parseISO(trade.entryTime), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {format(parseISO(trade.exitTime), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">{trade.size}</TableCell>
                    <TableCell className="hidden md:table-cell text-right">${trade.entryPrice.toFixed(2)}</TableCell>
                    <TableCell className="hidden md:table-cell text-right">${trade.exitPrice.toFixed(2)}</TableCell>
                    <TableCell className={`text-right font-semibold ${isWinner ? "text-accent" : "text-rose-600"}`}>
                      {currencyFormatter.format(trade.profitLoss)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableCaption>
              Showing the eight most recent trades. Sync additional history to expand analytics windows.
            </TableCaption>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TradesDashboard;
