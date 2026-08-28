import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { NetWorthChangeAnalysis } from '@/lib/personalFinanceEngine';
import { cn } from '@/lib/utils';

const $n = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

interface Props {
  analysis:    NetWorthChangeAnalysis;
  onAskCoach?: (prompt: string) => void;
}

function DriverBar({ label, amount, variant }: { label: string; amount: number; variant: 'positive' | 'negative' }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        'w-1.5 h-1.5 rounded-full shrink-0',
        variant === 'positive' ? 'bg-emerald-500' : 'bg-red-400'
      )} />
      <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
        <span className="text-[13px] text-muted-foreground truncate">{label}</span>
        <span className={cn(
          'text-[13px] font-medium tabular-nums shrink-0',
          variant === 'positive' ? 'text-accent' : 'text-destructive'
        )}>
          {variant === 'positive' ? '+' : '-'}{$n(amount)}
        </span>
      </div>
    </div>
  );
}

export default function NetWorthChangeCard({ analysis, onAskCoach }: Props) {
  const { netWorthChange, topPositiveDrivers, topNegativeDrivers, explanation } = analysis;
  const isPositive = netWorthChange > 0;
  const isNegative = netWorthChange < 0;
  const isFlat     = netWorthChange === 0;

  const hasDrivers = topPositiveDrivers.length > 0 || topNegativeDrivers.length > 0;

  return (
    <div className="rounded-2xl border border-border/40 bg-background px-5 py-4 space-y-3"
         style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-foreground">What changed this month</span>
        <div className={cn(
          'flex items-center gap-1 text-[13px] font-semibold tabular-nums',
          isPositive ? 'text-accent' : isNegative ? 'text-destructive' : 'text-muted-foreground'
        )}>
          {isPositive && <TrendingUp className="h-3.5 w-3.5" />}
          {isNegative && <TrendingDown className="h-3.5 w-3.5" />}
          {isFlat     && <Minus className="h-3.5 w-3.5" />}
          {isFlat ? 'No change' : `${isPositive ? '+' : ''}${$n(netWorthChange)}`}
        </div>
      </div>

      {/* Explanation */}
      <p className="text-[13px] text-muted-foreground leading-relaxed">{explanation}</p>

      {/* Drivers */}
      {hasDrivers && (
        <div className="space-y-2 pt-1 border-t border-border/30">
          {topPositiveDrivers.map(d => (
            <DriverBar key={d.key} label={d.label} amount={d.amount} variant="positive" />
          ))}
          {topNegativeDrivers.map(d => (
            <DriverBar key={d.key} label={d.label} amount={d.amount} variant="negative" />
          ))}
        </div>
      )}

      {onAskCoach && (
        <button
          onClick={() => onAskCoach(`My net worth ${isPositive ? 'increased' : isNegative ? 'decreased' : 'was unchanged'} by ${$n(Math.abs(netWorthChange))} this month. ${explanation} Help me understand what to do next.`)}
          className="text-[11px] text-primary hover:underline underline-offset-2 pt-0.5"
        >
          Ask Coach about this →
        </button>
      )}
    </div>
  );
}
