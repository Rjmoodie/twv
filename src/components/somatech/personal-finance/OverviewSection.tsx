import React, { useState, useMemo, useId } from 'react';
import HelpTooltip from '@/components/somatech/guide/HelpTooltip';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Plus, ChevronDown, ChevronUp, Brain } from 'lucide-react';
import { format, startOfMonth, parseISO, differenceInMonths } from 'date-fns';
import { NetWorthSnapshot, computeNetWorth, UsePersonalFinanceReturn } from '@/hooks/usePersonalFinance';
import { cn } from '@/lib/utils';

const _currFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmt = (n: number) => _currFmt.format(n);
const fmtK = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  return fmt(n);
};

function safeFormatMonth(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    return isNaN(d.getTime()) ? dateStr : format(d, 'MMM yy');
  } catch {
    return dateStr;
  }
}

function NetWorthForm({ onSave }: { onSave: (data: Omit<NetWorthSnapshot, 'id'>) => Promise<void> }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Omit<NetWorthSnapshot, 'id'>>(() => ({
    snapshot_month: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    checking: 0, savings: 0, investments: 0, real_estate: 0, other_assets: 0,
    credit_cards: 0, student_loans: 0, mortgage: 0, car_loans: 0, other_liabilities: 0,
    notes: null,
  }));
  const [saving, setSaving] = useState(false);

  const n = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      toast({ title: 'Saved', description: 'Net worth snapshot recorded.' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save.', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const fieldClass = 'h-9 text-sm font-mono';

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">Assets</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            ['checking', 'Checking'],
            ['savings', 'Savings'],
            ['investments', 'Investments'],
            ['real_estate', 'Real Estate'],
            ['other_assets', 'Other Assets'],
          ].map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input className={fieldClass} type="number" min="0" placeholder="0" value={form[key as keyof typeof form] || ''} onChange={n(key as keyof typeof form)} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-destructive">Liabilities</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            ['credit_cards', 'Credit Cards'],
            ['student_loans', 'Student Loans'],
            ['mortgage', 'Mortgage'],
            ['car_loans', 'Car Loans'],
            ['other_liabilities', 'Other'],
          ].map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input className={fieldClass} type="number" min="0" placeholder="0" value={form[key as keyof typeof form] || ''} onChange={n(key as keyof typeof form)} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <div className="text-sm text-muted-foreground">
          Net Worth Preview: <span className="font-semibold text-foreground">{fmt(computeNetWorth(form as NetWorthSnapshot).netWorth)}</span>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
          {saving ? 'Saving…' : 'Save Snapshot'}
        </Button>
      </div>
    </div>
  );
}

export default function OverviewSection({ snapshots, cashFlows, isDemo, isPlaidConnected, saveSnapshot, onAskCoach }: {
  snapshots: ReturnType<typeof import('@/hooks/usePersonalFinance').usePersonalFinance>['snapshots'];
  cashFlows:  ReturnType<typeof import('@/hooks/usePersonalFinance').usePersonalFinance>['cashFlows'];
  isDemo: boolean;
  isPlaidConnected: boolean;
  saveSnapshot: UsePersonalFinanceReturn['saveSnapshot'];
  onAskCoach?: (prompt: string) => void;
}) {
  const [showForm, setShowForm] = useState(() => snapshots.length === 0);
  // Unique gradient ID — avoids SVG namespace collision if component mounts multiple times
  const gradId = useId();

  const latest     = snapshots[snapshots.length - 1];
  const prev       = snapshots[snapshots.length - 2];
  const latestFlow = cashFlows[cashFlows.length - 1];

  // Memoised so computeNetWorth isn't re-run on every render and isn't duplicated
  // between the summary stats and the chart data builder below.
  const chartData = useMemo(() =>
    snapshots.flatMap(s => {
      try {
        const { netWorth, totalAssets, totalLiabilities } = computeNetWorth(s);
        return [{ month: safeFormatMonth(s.snapshot_month), netWorth, assets: totalAssets, liabilities: totalLiabilities }];
      } catch { return []; }
    }), [snapshots]);

  // Re-use the already-computed value from chartData rather than calling computeNetWorth again
  const latestComputed = chartData[chartData.length - 1] ?? null;
  const prevComputed   = chartData[chartData.length - 2] ?? null;

  const totalAssets      = latestComputed?.assets      ?? 0;
  const totalLiabilities = latestComputed?.liabilities ?? 0;
  const netWorth         = latestComputed?.netWorth    ?? 0;

  const prevNetWorth = prevComputed?.netWorth ?? null;
  const momChange    = prevNetWorth != null ? netWorth - prevNetWorth : null;

  // Actual date gap between the two most recent snapshots
  const monthGap = prev && latest
    ? differenceInMonths(parseISO(latest.snapshot_month), parseISO(prev.snapshot_month))
    : null;
  const momLabel = monthGap === 1
    ? 'vs last month'
    : monthGap != null && monthGap > 1
      ? `vs ${monthGap}mo ago`
      : null;

  // Suppress % when baseline was negative — percentage is misleading across zero-crossing
  const momPct = prevNetWorth != null && prevNetWorth > 0
    ? (momChange! / prevNetWorth) * 100
    : null;

  // Explicit trend direction — avoids TrendingUp for a $0 change
  const trendDir = momChange == null ? null : momChange > 0 ? 'up' : momChange < 0 ? 'down' : 'flat';

  const liquidAssets = latest ? latest.checking + latest.savings : 0;
  const monthlyExpenses = latestFlow
    ? latestFlow.housing + latestFlow.food + latestFlow.transport + latestFlow.healthcare +
      latestFlow.entertainment + latestFlow.subscriptions + latestFlow.clothing +
      latestFlow.education + latestFlow.travel + latestFlow.other_expenses
    : 0;
  // Guard negative liquid assets (e.g., Plaid overdraft) — runway must be positive to be meaningful
  const cashRunway = monthlyExpenses > 0 && liquidAssets > 0 ? liquidAssets / monthlyExpenses : null;

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="app-card">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-0.5">
              Net Worth <HelpTooltip term="net_worth" />
            </p>
            <p className="text-2xl font-bold mt-1">{fmt(netWorth)}</p>
            {trendDir != null && momChange != null && (
              <div className={cn(
                'flex items-center gap-1 text-xs mt-1',
                trendDir === 'up' ? 'text-accent' : trendDir === 'down' ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {trendDir === 'up' && <TrendingUp className="h-3 w-3" />}
                {trendDir === 'down' && <TrendingDown className="h-3 w-3" />}
                {trendDir === 'flat' && <Minus className="h-3 w-3" />}
                {momChange > 0 ? '+' : ''}{fmt(momChange)}
                {momPct != null && ` (${momPct.toFixed(1)}%)`}
                {momLabel && <span className="text-muted-foreground ml-1">{momLabel}</span>}
              </div>
            )}
            {onAskCoach && !isDemo && (
              <button onClick={() => onAskCoach(`My net worth is ${fmt(netWorth)}${momChange != null ? `, ${momChange >= 0 ? 'up' : 'down'} ${fmt(Math.abs(momChange))} this month` : ''}. How should I be thinking about growing this?`)}
                className="flex items-center gap-1 text-[10px] text-primary mt-1.5 hover:underline">
                <Brain className="h-2.5 w-2.5" /> Ask Coach
              </button>
            )}
          </CardContent>
        </Card>

        <Card className="app-card">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Assets</p>
            <p className="text-2xl font-bold mt-1 text-accent">{fmt(totalAssets)}</p>
            <p className="text-xs text-muted-foreground mt-1">Liquid: {fmt(Math.max(0, liquidAssets))}</p>
          </CardContent>
        </Card>

        <Card className="app-card">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Liabilities</p>
            <p className="text-2xl font-bold mt-1 text-destructive">{fmt(totalLiabilities)}</p>
            <p className="text-xs text-muted-foreground mt-1">Debt ratio: {totalAssets > 0 ? ((totalLiabilities / totalAssets) * 100).toFixed(0) : 0}%</p>
          </CardContent>
        </Card>

        <Card className="app-card">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-0.5">
              Cash Runway <HelpTooltip term="cash_runway" />
            </p>
            <p className="text-2xl font-bold mt-1">
              {cashRunway != null ? `${cashRunway.toFixed(1)} mo` : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {cashRunway == null
                ? 'Log cash flow first'
                : cashRunway < 3
                  ? '⚠ Below 3-month target'
                  : '✓ Healthy cushion'}
            </p>
            {onAskCoach && !isDemo && cashRunway != null && (
              <button onClick={() => onAskCoach(`I have ${cashRunway.toFixed(1)} months of cash runway (${fmt(liquidAssets)} liquid). Should I prioritise building this to 6 months or start investing?`)}
                className="flex items-center gap-1 text-[10px] text-primary mt-1.5 hover:underline">
                <Brain className="h-2.5 w-2.5" /> Ask Coach
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trend chart */}
      <Card className="app-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            Net Worth Trend
            {isPlaidConnected
              ? <Badge variant="default" className="text-xs gap-1">Plaid</Badge>
              : isDemo && <Badge variant="secondary" className="text-xs">Demo data</Badge>}
          </CardTitle>
          <CardDescription>Month-over-month balance sheet trajectory</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length < 2 ? (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              {chartData.length === 0
                ? 'Log your first snapshot to see your trend.'
                : 'Log a second month to see your trend line.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} width={56} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }} />
                <Area type="monotone" dataKey="netWorth" stroke="#6366f1" strokeWidth={2} fill={`url(#${gradId})`} name="Net Worth" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Asset / liability breakdown */}
      {latest && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="app-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-accent">Assets Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {[
                ['Checking',    latest.checking,    '#10b981'],
                ['Savings',     latest.savings,     '#34d399'],
                ['Investments', latest.investments, '#6366f1'],
                ['Real Estate', latest.real_estate, '#8b5cf6'],
                ['Other',       latest.other_assets,'#a78bfa'],
              ].filter(([, v]) => (v as number) > 0).map(([label, value, color]) => {
                const pct = totalAssets > 0 ? Math.round(((value as number) / totalAssets) * 100) : 0;
                return (
                  <div key={label as string} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label as string}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{pct}%</span>
                        <span className="font-medium w-20 text-right tabular-nums">{fmt(value as number)}</span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color as string }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="app-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-destructive">Liabilities Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {[
                ['Credit Cards',  latest.credit_cards,      '#ef4444'],
                ['Student Loans', latest.student_loans,     '#f97316'],
                ['Mortgage',      latest.mortgage,          '#f59e0b'],
                ['Car Loans',     latest.car_loans,         '#eab308'],
                ['Other',         latest.other_liabilities, '#d97706'],
              ].filter(([, v]) => (v as number) > 0).map(([label, value, color]) => {
                const pct = totalLiabilities > 0 ? Math.round(((value as number) / totalLiabilities) * 100) : 0;
                return (
                  <div key={label as string} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label as string}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{pct}%</span>
                        <span className="font-medium w-20 text-right tabular-nums">{fmt(value as number)}</span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color as string }} />
                    </div>
                  </div>
                );
              })}
              {totalLiabilities === 0 && (
                <p className="text-xs text-muted-foreground">No liabilities recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Manual entry — primary when no Plaid, override when Plaid connected */}
      <Card className="app-card">
        <CardHeader
          className="cursor-pointer pb-3"
          onClick={() => setShowForm(f => !f)}
        >
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              {isPlaidConnected ? 'Override Balances Manually' : "Log This Month's Balances"}
            </span>
            {showForm ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </CardTitle>
          <CardDescription>
            {isPlaidConnected
              ? 'Plaid keeps this up to date automatically. Override a specific account if needed.'
              : `Enter your account balances for ${format(new Date(), 'MMMM yyyy')}`}
          </CardDescription>
        </CardHeader>
        {showForm && (
          <CardContent>
            <NetWorthForm onSave={async (data) => { await saveSnapshot(data); setShowForm(false); }} />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
