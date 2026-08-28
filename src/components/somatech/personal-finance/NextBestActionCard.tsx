import React from 'react';
import { ArrowRight, Zap, Target, Brain } from 'lucide-react';
import { NextBestAction } from '@/lib/personalFinanceEngine';
import { cn } from '@/lib/utils';
import HelpTooltip from '@/components/somatech/guide/HelpTooltip';

const $n = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

interface Props {
  action:      NextBestAction;
  onAskCoach?: (prompt: string) => void;
}

const PRIORITY_STYLES = {
  high:   { border: 'border-destructive/20/25',   bg: 'bg-destructive/100/5',     badge: 'bg-destructive/100/10 text-destructive',     icon: Zap    },
  medium: { border: 'border-warning/20/25', bg: 'bg-warning/100/5',   badge: 'bg-warning/100/10 text-warning', icon: Target },
  low:    { border: 'border-primary/20',   bg: 'bg-primary/5',     badge: 'bg-primary/10 text-primary',     icon: ArrowRight },
};

const CATEGORY_LABELS: Record<string, string> = {
  cash_runway: 'Emergency Fund',
  debt:        'Debt',
  spending:    'Spending',
  income:      'Income',
  investing:   'Investing',
  goal:        'Goal',
};

export default function NextBestActionCard({ action, onAskCoach }: Props) {
  const styles = PRIORITY_STYLES[action.priority];
  const Icon   = styles.icon;

  return (
    <div className={cn(
      'rounded-2xl border px-5 py-4 space-y-3',
      styles.border, styles.bg
    )} style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
          action.priority === 'high' ? 'bg-destructive/100/15' : action.priority === 'medium' ? 'bg-warning/100/15' : 'bg-primary/10'
        )}>
          <Icon className={cn('h-4 w-4',
            action.priority === 'high' ? 'text-destructive' : action.priority === 'medium' ? 'text-warning' : 'text-primary'
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide', styles.badge)}>
              {action.priority === 'high' ? 'Top priority' : action.priority === 'medium' ? 'Recommended' : 'Consider'}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {CATEGORY_LABELS[action.category] ?? action.category}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-[14px] font-semibold text-foreground leading-snug">{action.title}</p>
            <HelpTooltip term="next_move" side="right" />
          </div>
        </div>
      </div>

      <p className="text-[13px] text-muted-foreground leading-relaxed">{action.explanation}</p>

      {action.estimatedImpact && (
        <div className="rounded-xl bg-background/60 border border-border/30 px-3.5 py-2.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
            Estimated impact
          </p>
          <p className="text-[12px] text-foreground">{action.estimatedImpact}</p>
        </div>
      )}

      {onAskCoach && (
        <button
          onClick={() => onAskCoach(`${action.title}. ${action.explanation} Help me build a specific step-by-step plan to action this.`)}
          className="flex items-center gap-1.5 text-[12px] text-primary hover:underline underline-offset-2"
        >
          <Brain className="h-3 w-3" />
          Build a plan with Coach
        </button>
      )}
    </div>
  );
}
