/**
 * SpendingBreakdown
 *
 * Three-tab view driven by persisted Plaid transactions:
 *   Subscriptions — detected recurring charges with opportunity cost
 *   Top Merchants — ranked spend this month
 *   Discretionary — entertainment + subscriptions + travel + clothing bundle
 *
 * Shown only when Plaid is connected and transactions exist.
 * Each item has an "Ask Coach" button that fires a pre-built prompt.
 */

import React, { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Brain, RefreshCw, TrendingDown, CreditCard, ShoppingBag, Repeat2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlaidTransaction } from '@/hooks/useTransactions';
import { MonthlyCashFlow, computeCashFlow } from '@/hooks/usePersonalFinance';
import {
  detectRecurringCharges,
  totalRecurringPerMonth,
  opportunityCost,
  RecurringCharge,
} from '@/lib/recurringCharges';

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const $n  = (n: number) => fmt.format(n);
const $d  = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// ── Props ─────────────────────────────────────────────────────────────────────

interface SpendingBreakdownProps {
  /** Last 90 days of transactions — for recurring detection */
  allTransactions: PlaidTransaction[];
  /** Current month transactions — for top merchant ranking */
  transactions:    PlaidTransaction[];
  /** Latest cash flow month — for discretionary calculation */
  latestFlow?:     MonthlyCashFlow | null;
  onAskCoach?:     (prompt: string) => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AskCoachButton({ prompt, onAskCoach }: { prompt: string; onAskCoach?: (p: string) => void }) {
  if (!onAskCoach) return null;
  return (
    <button
      onClick={() => onAskCoach(prompt)}
      className="flex items-center gap-1 text-[11px] text-primary hover:underline underline-offset-2 transition-colors shrink-0"
    >
      <Brain className="h-3 w-3" />
      Ask Coach
    </button>
  );
}

// ── Subscriptions tab ─────────────────────────────────────────────────────────

function SubscriptionsTab({
  recurring,
  onAskCoach,
}: {
  recurring: RecurringCharge[];
  onAskCoach?: (p: string) => void;
}) {
  const active   = recurring.filter(c => !c.possiblyCancelled);
  const inactive = recurring.filter(c =>  c.possiblyCancelled);
  const total    = totalRecurringPerMonth(recurring);
  const oc10yr   = opportunityCost(total, 10);

  if (active.length === 0 && inactive.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No recurring charges detected yet. Sync again after a second month of data.
      </p>
    );
  }

  const allPrompt = `I have ${active.length} active recurring charges totalling ${$n(total)}/mo: ${active.map(c => `${c.merchant} ${$d(c.amount)}`).join(', ')}. Help me audit which ones are worth keeping and prioritise what to cut.`;

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="rounded-xl bg-muted/40 px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Active recurring</p>
            <p className="text-lg font-semibold">{$n(total)}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">10-yr opportunity cost at 7%</p>
            <p className="text-base font-semibold text-warning">{$n(oc10yr)}</p>
          </div>
        </div>
        <AskCoachButton prompt={allPrompt} onAskCoach={onAskCoach} />
      </div>

      {/* Active list */}
      {active.length > 0 && (
        <div className="space-y-1">
          {active.map(charge => (
            <div
              key={charge.merchant}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Repeat2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{charge.merchant}</p>
                  <p className="text-[11px] text-muted-foreground">{charge.monthsActive} of last 3 months</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="text-sm font-semibold tabular-nums">{$d(charge.amount)}</p>
                <AskCoachButton
                  prompt={`I pay ${$d(charge.amount)}/mo to ${charge.merchant}. Is this worth it? What's the opportunity cost vs investing that money?`}
                  onAskCoach={onAskCoach}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Possibly cancelled */}
      {inactive.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide px-1">
            Not seen this month — possibly cancelled
          </p>
          {inactive.map(charge => (
            <div
              key={charge.merchant}
              className="flex items-center justify-between rounded-lg px-3 py-2 opacity-60"
            >
              <p className="text-sm">{charge.merchant}</p>
              <div className="flex items-center gap-3">
                <p className="text-sm tabular-nums">{$d(charge.amount)}</p>
                <AskCoachButton
                  prompt={`${charge.merchant} (${$d(charge.amount)}/mo) hasn't appeared this month. If I cancelled it, should I redirect that money anywhere specific?`}
                  onAskCoach={onAskCoach}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Top Merchants tab ─────────────────────────────────────────────────────────

function TopMerchantsTab({
  transactions,
  onAskCoach,
}: {
  transactions: PlaidTransaction[];
  onAskCoach?:  (p: string) => void;
}) {
  const ranked = useMemo(() => {
    const totals = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.pending || tx.amount <= 0) continue;
      const key = tx.merchant_name ?? tx.name;
      totals.set(key, (totals.get(key) ?? 0) + tx.amount);
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [transactions]);

  if (ranked.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No transactions this month yet.</p>;
  }

  const max = ranked[0][1];
  const total = ranked.reduce((s, [, v]) => s + v, 0);
  const allPrompt = `My top merchants this month: ${ranked.map(([m, v]) => `${m} ${$n(v)}`).join(', ')}. What does this spending pattern tell you and what would you change?`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Top {ranked.length} merchants · {$n(total)} total</p>
        <AskCoachButton prompt={allPrompt} onAskCoach={onAskCoach} />
      </div>
      <div className="space-y-2">
        {ranked.map(([merchant, amount]) => (
          <div key={merchant} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate max-w-[60%]">{merchant}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">{$n(amount)}</span>
                <AskCoachButton
                  prompt={`I spent ${$n(amount)} at ${merchant} this month. Is this too much? What's a healthy budget for this?`}
                  onAskCoach={onAskCoach}
                />
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60 transition-all"
                style={{ width: `${(amount / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Discretionary tab ─────────────────────────────────────────────────────────

const DISCRETIONARY_CATS: { key: keyof MonthlyCashFlow; label: string; color: string }[] = [
  { key: 'subscriptions', label: 'Subscriptions', color: 'bg-violet-500' },
  { key: 'entertainment', label: 'Entertainment', color: 'bg-blue-500'   },
  { key: 'travel',        label: 'Travel',        color: 'bg-warning/100'  },
  { key: 'clothing',      label: 'Clothing',      color: 'bg-rose-500'   },
];

function DiscretionaryTab({
  latestFlow,
  onAskCoach,
}: {
  latestFlow?:  MonthlyCashFlow | null;
  onAskCoach?:  (p: string) => void;
}) {
  if (!latestFlow) {
    return <p className="text-sm text-muted-foreground text-center py-6">Cash flow data not available.</p>;
  }

  const { totalIncome } = computeCashFlow(latestFlow);
  const cats = DISCRETIONARY_CATS.map(c => ({
    ...c,
    amount: (latestFlow[c.key] as number) ?? 0,
  })).filter(c => c.amount > 0);

  const total = cats.reduce((s, c) => s + c.amount, 0);
  const pctOfIncome = totalIncome > 0 ? (total / totalIncome) * 100 : 0;
  const oc10yr = opportunityCost(total * 0.20, 10);

  if (total === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No discretionary spending recorded this month.</p>;
  }

  const coachPrompt = `My discretionary spending this month: ${cats.map(c => `${c.label} ${$n(c.amount)}`).join(', ')} — ${$n(total)} total (${pctOfIncome.toFixed(1)}% of income). Help me find the cuts with the least impact on my quality of life, using the PERMA framework.`;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-xl bg-muted/40 px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Total discretionary</p>
            <p className="text-lg font-semibold">
              {$n(total)}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                {pctOfIncome.toFixed(1)}% of income
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Redirecting 20% for 10 yrs</p>
            <p className="text-base font-semibold text-accent">{$n(oc10yr)}</p>
          </div>
        </div>
        <AskCoachButton prompt={coachPrompt} onAskCoach={onAskCoach} />
      </div>

      {/* Category bars */}
      <div className="space-y-3">
        {cats.map(cat => (
          <div key={cat.key} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn('w-2 h-2 rounded-full shrink-0', cat.color)} />
                <span className="truncate">{cat.label}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-semibold tabular-nums">{$n(cat.amount)}</span>
                <span className="text-xs text-muted-foreground hidden xs:inline">{total > 0 ? `${Math.round(cat.amount / total * 100)}%` : ''}</span>
                <AskCoachButton
                  prompt={`I spent ${$n(cat.amount)} on ${cat.label.toLowerCase()} this month. What's a healthy amount for someone at my financial stage?`}
                  onAskCoach={onAskCoach}
                />
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', cat.color)}
                style={{ width: `${total > 0 ? (cat.amount / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {pctOfIncome > 25 && (
        <p className="text-xs text-warning flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5 shrink-0" />
          Above 25% of income — the typical ceiling for discretionary spending.
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SpendingBreakdown({
  allTransactions,
  transactions,
  latestFlow,
  onAskCoach,
}: SpendingBreakdownProps) {
  const recurring = useMemo(
    () => detectRecurringCharges(allTransactions),
    [allTransactions]
  );

  const hasData = allTransactions.length > 0 || transactions.length > 0;
  if (!hasData) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <CreditCard className="h-3 w-3" /> Spending Breakdown
      </p>
      <Tabs defaultValue="subscriptions">
        <TabsList className="w-full grid grid-cols-3 h-9">
          <TabsTrigger value="subscriptions" className="text-xs gap-1.5">
            <Repeat2 className="h-3.5 w-3.5" />
            Subscriptions
            {recurring.filter(c => !c.possiblyCancelled).length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">
                {recurring.filter(c => !c.possiblyCancelled).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="merchants" className="text-xs gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5" />
            Top Merchants
          </TabsTrigger>
          <TabsTrigger value="discretionary" className="text-xs gap-1.5">
            <TrendingDown className="h-3.5 w-3.5" />
            Discretionary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="mt-3">
          <SubscriptionsTab recurring={recurring} onAskCoach={onAskCoach} />
        </TabsContent>
        <TabsContent value="merchants" className="mt-3">
          <TopMerchantsTab transactions={transactions} onAskCoach={onAskCoach} />
        </TabsContent>
        <TabsContent value="discretionary" className="mt-3">
          <DiscretionaryTab latestFlow={latestFlow} onAskCoach={onAskCoach} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
