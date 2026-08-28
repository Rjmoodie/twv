import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, Label as RechartsLabel,
} from 'recharts';
import { ChevronDown, ChevronUp, Brain, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { MonthlyCashFlow, computeCashFlow, EXPENSE_CATEGORIES, UsePersonalFinanceReturn } from '@/hooks/usePersonalFinance';
import MonthlyExpenseForm from './MonthlyExpenseForm';
import { cn } from '@/lib/utils';

const _currFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmt  = (n: number) => _currFmt.format(n);
const fmtK = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return fmt(n);
};


export default function CashFlowSection({ cashFlows, isDemo, isPlaidConnected, saveCashFlow, onAskCoach }: {
  cashFlows: MonthlyCashFlow[];
  isDemo: boolean;
  isPlaidConnected: boolean;
  saveCashFlow: UsePersonalFinanceReturn['saveCashFlow'];
  onAskCoach?: (prompt: string) => void;
}) {
  // Auto-open when the user has no cash flow data yet — no point hiding the entry form
  const [showForm, setShowForm] = useState(() => cashFlows.length === 0);

  const latest      = cashFlows[cashFlows.length - 1];
  const prev        = cashFlows[cashFlows.length - 2] ?? null;
  const latestStats = latest ? computeCashFlow(latest) : null;
  const prevStats   = prev   ? computeCashFlow(prev)   : null;

  // Bar chart data — income vs expenses per month
  const barData = useMemo(() => cashFlows.map(cf => {
    const { totalIncome, totalExpenses, surplus } = computeCashFlow(cf);
    return { month: format(parseISO(cf.flow_month), 'MMM yy'), income: totalIncome, expenses: totalExpenses, surplus };
  }), [cashFlows]);

  // Donut data — latest month's expense breakdown
  const donutData = useMemo(() => {
    if (!latest) return [];
    return EXPENSE_CATEGORIES
      .map(({ key, label, color }) => ({ name: label, value: latest[key] as number, color }))
      .filter(d => d.value > 0);
  }, [latest]);

  // Top spend callout — sorted once, not on every render
  const topSpend = useMemo(() => {
    if (!latestStats || donutData.length === 0) return null;
    const top     = [...donutData].sort((a, b) => b.value - a.value)[0];
    const pct     = Math.round((top.value / latestStats.totalExpenses) * 100);
    const prevCat = prev ? EXPENSE_CATEGORIES.find(c => c.label === top.name) : null;
    const prevVal = prevCat ? (prev![prevCat.key] as number) : null;
    return { ...top, pct, delta: prevVal !== null ? top.value - prevVal : null };
  }, [donutData, latestStats, prev]);

  // Category trend — last 6 months per category (top 4 by latest spend)
  const trendData = useMemo(() => {
    const topCats = [...EXPENSE_CATEGORIES]
      .sort((a, b) => ((latest?.[b.key] as number) ?? 0) - ((latest?.[a.key] as number) ?? 0))
      .slice(0, 4);

    return cashFlows.slice(-6).map(cf => {
      const row: Record<string, number | string> = { month: format(parseISO(cf.flow_month), 'MMM yy') };
      topCats.forEach(({ key, label }) => { row[label] = cf[key] as number; });
      return row;
    });
  }, [cashFlows, latest]);

  const topCatColors = useMemo(() =>
    [...EXPENSE_CATEGORIES]
      .sort((a, b) => ((latest?.[b.key] as number) ?? 0) - ((latest?.[a.key] as number) ?? 0))
      .slice(0, 4),
    [latest]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Income */}
        {(() => {
          const val   = latestStats?.totalIncome  ?? 0;
          const delta = prevStats ? val - prevStats.totalIncome : null;
          const prompt = latestStats ? `My monthly income is ${fmt(val)}. How should I be growing this?` : null;
          return (
            <Card className="app-card">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Monthly Income</p>
                <p className="text-2xl font-bold mt-1 text-accent">{fmt(val)}</p>
                {delta !== null && delta !== 0 && (
                  <p className={cn('flex items-center gap-0.5 text-xs mt-1', delta > 0 ? 'text-accent' : 'text-destructive')}>
                    {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {fmt(Math.abs(delta))} vs last mo
                  </p>
                )}
                {onAskCoach && !isDemo && prompt && (
                  <button onClick={() => onAskCoach(prompt)} className="flex items-center gap-1 text-[10px] text-primary mt-1.5 hover:underline">
                    <Brain className="h-2.5 w-2.5" /> Ask Coach
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Expenses */}
        {(() => {
          const val   = latestStats?.totalExpenses ?? 0;
          const delta = prevStats ? val - prevStats.totalExpenses : null;
          return (
            <Card className="app-card">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Monthly Expenses</p>
                <p className="text-2xl font-bold mt-1 text-destructive">{fmt(val)}</p>
                {delta !== null && delta !== 0 && (
                  <p className={cn('flex items-center gap-0.5 text-xs mt-1', delta > 0 ? 'text-destructive' : 'text-accent')}>
                    {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {fmt(Math.abs(delta))} vs last mo
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Surplus */}
        {(() => {
          const val    = latestStats?.surplus ?? 0;
          const delta  = prevStats ? val - prevStats.surplus : null;
          const isPos  = val >= 0;
          const prompt = latestStats
            ? `My monthly surplus is ${fmt(val)}. How should I allocate this between debt payoff, emergency fund, and investments?`
            : null;
          // Contextual framing: months to 6-month emergency fund at current surplus rate
          const emgMonths = latestStats && val > 0
            ? (latestStats.totalExpenses * 6 / val).toFixed(0)
            : null;
          return (
            <Card className="app-card">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Monthly Surplus</p>
                <p className={cn('text-2xl font-bold mt-1', isPos ? 'text-accent' : 'text-destructive')}>{fmt(val)}</p>
                {delta !== null && delta !== 0 && (
                  <p className={cn('flex items-center gap-0.5 text-xs mt-0.5', delta > 0 ? 'text-accent' : 'text-destructive')}>
                    {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {fmt(Math.abs(delta))} vs last mo
                  </p>
                )}
                {emgMonths && (
                  <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                    6-mo fund reachable in ~{emgMonths} mo
                  </p>
                )}
                {onAskCoach && !isDemo && prompt && (
                  <button onClick={() => onAskCoach(prompt)} className="flex items-center gap-1 text-[10px] text-primary mt-1 hover:underline">
                    <Brain className="h-2.5 w-2.5" /> Ask Coach
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Savings Rate */}
        {(() => {
          const rate   = latestStats?.savingsRate ?? 0;
          const deltaR = prevStats ? rate - prevStats.savingsRate : null;
          const isGood = rate >= 20;
          const prompt = latestStats
            ? `My savings rate is ${rate.toFixed(1)}%. ${rate < 20 ? 'I\'m below the 20% target.' : 'I\'m above 20%.'} What should I do with my surplus to build wealth fastest?`
            : null;
          // Cap bar at 30% for visual range
          const barPct     = Math.min(100, (rate / 30) * 100);
          const targetPct  = (20 / 30) * 100;
          return (
            <Card className="app-card">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Savings Rate</p>
                <p className={cn('text-2xl font-bold mt-1', isGood ? 'text-accent' : 'text-warning')}>
                  {rate.toFixed(1)}%
                </p>
                {/* Progress bar 0→30% with target marker at 20% */}
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden relative">
                  <div
                    className={cn('absolute top-0 bottom-0 w-px', isGood ? 'bg-emerald-900/30' : 'bg-foreground/30')}
                    style={{ left: `${targetPct}%` }}
                  />
                  <div
                    className={cn('h-full rounded-full transition-all', isGood ? 'bg-emerald-500' : 'bg-amber-400')}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-muted-foreground">
                    {isGood ? '✓ Above 20% target' : `${(20 - rate).toFixed(1)}% below target`}
                  </p>
                  {deltaR !== null && Math.abs(deltaR) > 0.1 && (
                    <p className={cn('text-[10px]', deltaR > 0 ? 'text-accent' : 'text-destructive')}>
                      {deltaR > 0 ? '↑' : '↓'}{Math.abs(deltaR).toFixed(1)}%
                    </p>
                  )}
                </div>
                {onAskCoach && !isDemo && prompt && (
                  <button onClick={() => onAskCoach(prompt)} className="flex items-center gap-1 text-[10px] text-primary mt-1 hover:underline">
                    <Brain className="h-2.5 w-2.5" /> Ask Coach
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* Top spend callout */}
      {topSpend && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-border/40 bg-muted/20 px-4 py-3 text-sm">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: topSpend.color }} />
          <span className="text-foreground font-medium">{topSpend.name}</span>
          <span className="text-muted-foreground">is your biggest expense —</span>
          <span className="font-semibold">{fmt(topSpend.value)}</span>
          <span className="text-muted-foreground">({topSpend.pct}%)</span>
          {topSpend.delta !== null && Math.abs(topSpend.delta) > 10 && (
            <span className={cn('text-xs shrink-0 ml-auto', topSpend.delta > 0 ? 'text-destructive' : 'text-accent')}>
              {topSpend.delta > 0 ? '↑' : '↓'} {fmt(Math.abs(topSpend.delta))} vs last mo
            </span>
          )}
        </div>
      )}

      {/* Income vs Expenses bar chart */}
      <Card className="app-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            Income vs Expenses
            {isPlaidConnected
              ? <Badge variant="default" className="text-xs gap-1">Plaid</Badge>
              : isDemo && <Badge variant="secondary" className="text-xs">Demo data</Badge>}
          </CardTitle>
          <CardDescription>Monthly cash flow — trailing {cashFlows.length} months</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} width={56} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="income"   name="Income"   fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Donut + Category list */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="app-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Expense Breakdown</CardTitle>
            <CardDescription>Latest month — {latest ? format(parseISO(latest.flow_month), 'MMMM yyyy') : '—'}</CardDescription>
          </CardHeader>
          <CardContent>
            {donutData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No expense data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                    {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    <RechartsLabel
                      content={({ viewBox }) => {
                        const { cx, cy } = viewBox as { cx: number; cy: number };
                        return (
                          <g>
                            <text x={cx} y={cy - 7} textAnchor="middle" dominantBaseline="central"
                              style={{ fontSize: 15, fontWeight: 700, fill: 'hsl(var(--foreground))' }}>
                              {fmtK(latestStats?.totalExpenses ?? 0)}
                            </text>
                            <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="central"
                              style={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}>
                              total spent
                            </text>
                          </g>
                        );
                      }}
                    />
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="app-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Category Detail</CardTitle>
            <CardDescription className="text-xs">% of budget · vs last month</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 max-h-[230px] overflow-y-auto pr-1">
            {[...donutData].sort((a, b) => b.value - a.value).map((cat) => {
              const pct      = latestStats ? Math.round((cat.value / latestStats.totalExpenses) * 100) : 0;
              const catDef   = EXPENSE_CATEGORIES.find(c => c.label === cat.name);
              const prevVal  = catDef && prev ? prev[catDef.key] as number : null;
              const delta    = prevVal !== null ? cat.value - prevVal : null;
              return (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-muted-foreground truncate">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {delta !== null && Math.abs(delta) > 5 && (
                        <span className={cn('text-[10px]', delta > 0 ? 'text-destructive' : 'text-accent')}>
                          {delta > 0 ? '↑' : '↓'}{fmt(Math.abs(delta))}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                      <span className="font-medium w-14 text-right tabular-nums">{fmt(cat.value)}</span>
                    </div>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden ml-4">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Category trends */}
      {trendData.length > 1 && topCatColors.length > 0 && (
        <Card className="app-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Category Trends</CardTitle>
            <CardDescription>Top 4 spending categories month-over-month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} width={56} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {topCatColors.map(({ label, color }) => (
                  <Line key={label} type="monotone" dataKey={label} stroke={color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Monthly expense entry */}
      <Card className="app-card">
        <CardHeader className="cursor-pointer pb-3" onClick={() => setShowForm(f => !f)}>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              {isPlaidConnected ? 'Log Expenses Manually' : 'Log This Month\'s Expenses'}
            </span>
            {showForm
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </CardTitle>
          <CardDescription>
            {isPlaidConnected
              ? 'Add items like Rent, Netflix, Groceries — we map them to categories automatically.'
              : 'Enter your income and each expense item. We categorise them automatically for the charts.'}
          </CardDescription>
        </CardHeader>
        {showForm && (
          <CardContent>
            <MonthlyExpenseForm onSave={async (data) => { await saveCashFlow(data); setShowForm(false); }} />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
