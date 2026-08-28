/**
 * TransactionAnalysis
 *
 * Full transaction explorer:
 *   1. Period selector (1M / 3M / 6M / All)
 *   2. Stacked bar chart — spending by category per month (or per week for 1M)
 *   3. Category filter chips — click to isolate a category
 *   4. Transaction list — date, merchant, amount, category badge
 *      Filtered by selected category + current period.
 */

import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { format, parseISO, startOfMonth, startOfWeek, getWeek } from 'date-fns';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTransactionHistory, TransactionPeriod } from '@/hooks/useTransactionHistory';
import type { PlaidTransaction } from '@/hooks/useTransactions';

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; color: string; hex: string }> = {
  food:           { label: 'Food',           color: 'bg-emerald-500',  hex: '#10b981' },
  transport:      { label: 'Transport',      color: 'bg-blue-500',     hex: '#3b82f6' },
  housing:        { label: 'Housing',        color: 'bg-warning/100',   hex: '#f97316' },
  healthcare:     { label: 'Healthcare',     color: 'bg-destructive/100',      hex: '#ef4444' },
  entertainment:  { label: 'Entertainment',  color: 'bg-purple-500',   hex: '#a855f7' },
  subscriptions:  { label: 'Subscriptions',  color: 'bg-violet-500',   hex: '#8b5cf6' },
  clothing:       { label: 'Clothing',       color: 'bg-rose-500',     hex: '#f43f5e' },
  travel:         { label: 'Travel',         color: 'bg-warning/100',    hex: '#f59e0b' },
  education:      { label: 'Education',      color: 'bg-teal-500',     hex: '#14b8a6' },
  other_expenses: { label: 'Other',          color: 'bg-slate-400',    hex: '#94a3b8' },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG);

// ── Formatters ─────────────────────────────────────────────────────────────────

const $n  = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const $d  = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// ── Period selector ────────────────────────────────────────────────────────────

const PERIODS: { value: TransactionPeriod; label: string }[] = [
  { value: '1M',  label: '1M'  },
  { value: '3M',  label: '3M'  },
  { value: '6M',  label: '6M'  },
  { value: 'ALL', label: 'All' },
];

function PeriodSelector({
  value, onChange,
}: { value: TransactionPeriod; onChange: (p: TransactionPeriod) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-muted/60 p-1 w-fit">
      {PERIODS.map(p => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            'rounded-lg px-3 py-2 text-xs font-medium transition-all min-h-[36px]',
            value === p.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ── Chart data builder ─────────────────────────────────────────────────────────

type ChartBucket = { label: string; [cat: string]: number | string };

function buildChartData(
  txns: PlaidTransaction[],
  period: TransactionPeriod,
  activeCategory: string | null,
): ChartBucket[] {
  // For 1M: bucket by week. For everything else: bucket by month.
  const byWeek = period === '1M';

  const buckets = new Map<string, ChartBucket>();

  for (const tx of txns) {
    if (!tx.category_key) continue;
    if (activeCategory && tx.category_key !== activeCategory) continue;

    const date = parseISO(tx.date);
    let key: string;
    let label: string;

    if (byWeek) {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      key   = format(weekStart, 'yyyy-MM-dd');
      label = `Wk ${getWeek(date, { weekStartsOn: 1 })}`;
    } else {
      const monthStart = startOfMonth(date);
      key   = format(monthStart, 'yyyy-MM');
      label = format(monthStart, 'MMM yy');
    }

    if (!buckets.has(key)) {
      const bucket: ChartBucket = { label };
      ALL_CATEGORIES.forEach(c => { bucket[c] = 0; });
      buckets.set(key, bucket);
    }

    const bucket = buckets.get(key)!;
    bucket[tx.category_key] = ((bucket[tx.category_key] as number) ?? 0) + tx.amount;
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, b]) => {
      // Round all numeric values
      const rounded: ChartBucket = { label: b.label };
      ALL_CATEGORIES.forEach(c => { rounded[c] = Math.round(b[c] as number); });
      return rounded;
    });
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const entries = payload
    .filter((p: any) => p.value > 0)
    .sort((a: any, b: any) => b.value - a.value);

  return (
    <div className="rounded-xl border border-border/50 bg-background/95 backdrop-blur-sm px-3 py-2.5 shadow-lg text-xs space-y-1 min-w-[140px]">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {entries.map((e: any) => (
        <div key={e.dataKey} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: e.fill }} />
            <span className="text-muted-foreground">{CATEGORY_CONFIG[e.dataKey]?.label ?? e.dataKey}</span>
          </div>
          <span className="font-medium tabular-nums">{$n(e.value)}</span>
        </div>
      ))}
      <div className="border-t border-border/40 pt-1 mt-1 flex justify-between">
        <span className="text-muted-foreground">Total</span>
        <span className="font-semibold tabular-nums">{$n(entries.reduce((s: number, e: any) => s + e.value, 0))}</span>
      </div>
    </div>
  );
}

// ── Transaction row ────────────────────────────────────────────────────────────

function TxRow({ tx }: { tx: PlaidTransaction }) {
  const cfg = tx.category_key ? CATEGORY_CONFIG[tx.category_key] : null;
  const name = tx.merchant_name ?? tx.name;

  return (
    <div className="flex items-center justify-between py-2.5 px-1 border-b border-border/30 last:border-0 gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-[11px] text-muted-foreground">
          {format(parseISO(tx.date), 'MMM d, yyyy')}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {cfg && (
          <span className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-md text-white hidden sm:inline',
            cfg.color
          )}>
            {cfg.label}
          </span>
        )}
        <span className="text-sm font-semibold tabular-nums">{$d(tx.amount)}</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TransactionAnalysis() {
  const [period,          setPeriod]          = useState<TransactionPeriod>('3M');
  const [activeCategory,  setActiveCategory]  = useState<string | null>(null);
  const [search,          setSearch]          = useState('');

  const { transactions, isLoading } = useTransactionHistory(period);

  // Categories that actually have data in this period
  const presentCategories = useMemo(() => {
    const seen = new Set<string>();
    transactions.forEach(tx => { if (tx.category_key) seen.add(tx.category_key); });
    return ALL_CATEGORIES.filter(c => seen.has(c));
  }, [transactions]);

  const chartData = useMemo(
    () => buildChartData(transactions, period, activeCategory),
    [transactions, period, activeCategory]
  );

  // Filtered list for the transaction table
  const filteredTxns = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter(tx => {
      if (activeCategory && tx.category_key !== activeCategory) return false;
      if (!q) return true;
      return (tx.merchant_name ?? tx.name).toLowerCase().includes(q);
    });
  }, [transactions, activeCategory, search]);

  // Summary stats
  const stats = useMemo(() => {
    const total = filteredTxns.reduce((s, tx) => s + tx.amount, 0);
    const byCategory = new Map<string, number>();
    filteredTxns.forEach(tx => {
      if (tx.category_key)
        byCategory.set(tx.category_key, (byCategory.get(tx.category_key) ?? 0) + tx.amount);
    });
    const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    return { total, topCategory };
  }, [filteredTxns]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Loading transactions…
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
        <SlidersHorizontal className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No transactions yet. Connect a bank and sync to see your spending analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold">
            {$n(stats.total)}{' '}
            <span className="text-xs font-normal text-muted-foreground">
              spent · {filteredTxns.length} transactions
            </span>
          </p>
          {stats.topCategory && (
            <p className="text-xs text-muted-foreground">
              Top category: {CATEGORY_CONFIG[stats.topCategory[0]]?.label} {$n(stats.topCategory[1])}
            </p>
          )}
        </div>
        <PeriodSelector value={period} onChange={p => { setPeriod(p); setActiveCategory(null); }} />
      </div>

      {/* Stacked bar chart */}
      <div className="rounded-2xl bg-muted/20 border border-border/30 p-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 4, right: 0, left: -10, bottom: 0 }} barSize={period === '1M' ? 18 : 28}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
            {presentCategories.map(cat => (
              <Bar
                key={cat}
                dataKey={cat}
                stackId="spend"
                fill={CATEGORY_CONFIG[cat]?.hex ?? '#94a3b8'}
                opacity={activeCategory && activeCategory !== cat ? 0.2 : 1}
                radius={cat === presentCategories[presentCategories.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveCategory(prev => prev === cat ? null : cat)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-muted-foreground text-center mt-1">
          Click a bar segment to filter by category
        </p>
      </div>

      {/* Category filter chips — py-2 for ≥44px touch targets */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveCategory(null)}
          className={cn(
            'rounded-full px-3 py-2 text-xs font-medium transition-all border min-h-[36px]',
            activeCategory === null
              ? 'bg-foreground text-background border-foreground'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
          )}
        >
          All
        </button>
        {presentCategories.map(cat => {
          const cfg = CATEGORY_CONFIG[cat];
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(prev => prev === cat ? null : cat)}
              className={cn(
                'rounded-full px-3 py-2 text-xs font-medium transition-all border flex items-center gap-1.5 min-h-[36px]',
                isActive
                  ? 'text-white border-transparent'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
              )}
              style={isActive ? { backgroundColor: cfg?.hex } : undefined}
            >
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: cfg?.hex }}
              />
              {cfg?.label ?? cat}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search merchants…"
          className="pl-8 h-9 text-sm rounded-xl"
        />
      </div>

      {/* Transaction list */}
      <div className="rounded-2xl border border-border/30 bg-card divide-y-0 overflow-hidden">
        {filteredTxns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No transactions match.</p>
        ) : (
          <div className="divide-y divide-border/20 px-3">
            {filteredTxns.map(tx => (
              <TxRow key={tx.transaction_id} tx={tx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
