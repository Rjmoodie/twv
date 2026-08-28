import React from 'react';
import { TrendingUp, TrendingDown, Minus, ShieldAlert, Sparkles, ArrowRight } from 'lucide-react';
import { FinancialPictureSummary, FinancialStageSummary } from '@/lib/personalFinanceEngine';
import { cn } from '@/lib/utils';

const $n = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

interface Props {
  summary: FinancialPictureSummary;
  stage:   FinancialStageSummary;
  onAskCoach?: (prompt: string) => void;
}

export default function FinancialPictureSummaryCard({ summary, stage, onAskCoach }: Props) {
  if (!summary.hasData) {
    return (
      <div className="rounded-2xl border border-border/50 bg-muted/20 px-5 py-4 text-sm text-muted-foreground text-center">
        Connect your bank or log your first month to see your financial picture.
      </div>
    );
  }

  const changeDir = summary.netWorthChange === null ? null
    : summary.netWorthChange > 0 ? 'up'
    : summary.netWorthChange < 0 ? 'down'
    : 'flat';

  return (
    <div className="rounded-2xl border border-border/40 bg-background overflow-hidden"
         style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}>
      {/* Top bar — stage badge */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-border/30">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {stage.stage} Stage
        </span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">{stage.title}</span>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Headline + net worth */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-foreground leading-snug">
              {summary.headline}
            </p>
            {summary.narrative && (
              <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
                {summary.narrative}
              </p>
            )}
          </div>

          {/* Net worth pill */}
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground mb-0.5">Net Worth</p>
            <p className="text-xl font-bold text-foreground tabular-nums">
              {$n(summary.currentNetWorth)}
            </p>
            {changeDir && summary.netWorthChange !== null && (
              <div className={cn(
                'flex items-center justify-end gap-1 text-xs mt-0.5',
                changeDir === 'up'   ? 'text-accent' :
                changeDir === 'down' ? 'text-destructive'     : 'text-muted-foreground'
              )}>
                {changeDir === 'up'   && <TrendingUp className="h-3 w-3" />}
                {changeDir === 'down' && <TrendingDown className="h-3 w-3" />}
                {changeDir === 'flat' && <Minus className="h-3 w-3" />}
                <span>
                  {changeDir === 'flat' ? 'No change' :
                    `${changeDir === 'up' ? '+' : ''}${$n(summary.netWorthChange)}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Strength / Risk / Move */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {summary.mainStrength && (
            <div className="rounded-xl bg-emerald-500/6 border border-emerald-500/15 px-3.5 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
                <span className="text-[11px] font-semibold text-accent uppercase tracking-wide">Strength</span>
              </div>
              <p className="text-[12px] text-foreground leading-snug">{summary.mainStrength}</p>
            </div>
          )}

          {summary.mainRisk && (
            <div className="rounded-xl bg-warning/100/6 border border-warning/20/15 px-3.5 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldAlert className="h-3.5 w-3.5 text-warning shrink-0" />
                <span className="text-[11px] font-semibold text-warning uppercase tracking-wide">Main Risk</span>
              </div>
              <p className="text-[12px] text-foreground leading-snug">{summary.mainRisk}</p>
            </div>
          )}

          {summary.bestNextMove && (
            <div className="rounded-xl bg-primary/6 border border-primary/15 px-3.5 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">Next Move</span>
              </div>
              <p className="text-[12px] text-foreground leading-snug">{summary.bestNextMove}</p>
              {onAskCoach && (
                <button
                  onClick={() => onAskCoach(`${summary.bestNextMove} — help me build a specific plan.`)}
                  className="text-[11px] text-primary hover:underline mt-1.5 block"
                >
                  Ask Coach →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="px-5 py-2 border-t border-border/20 bg-muted/20">
        <p className="text-[10px] text-muted-foreground/60">
          Estimates based on available data · For planning purposes only · Not financial advice
        </p>
      </div>
    </div>
  );
}
