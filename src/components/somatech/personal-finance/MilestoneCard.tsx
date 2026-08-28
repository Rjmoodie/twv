import React from 'react';
import { CheckCircle2, Clock, TrendingDown, Lock } from 'lucide-react';
import { FinancialMilestone } from '@/lib/personalFinanceEngine';
import { cn } from '@/lib/utils';

const $n = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const STATUS_CONFIG = {
  achieved:       { icon: CheckCircle2, color: 'text-accent', barColor: 'bg-emerald-500' },
  on_track:       { icon: Clock,        color: 'text-blue-500',    barColor: 'bg-blue-500'    },
  behind:         { icon: Clock,        color: 'text-warning',   barColor: 'bg-warning/100'   },
  not_possible:   { icon: Lock,         color: 'text-muted-foreground', barColor: 'bg-muted-foreground/30' },
};

function MilestoneRow({ milestone }: { milestone: FinancialMilestone }) {
  const cfg = STATUS_CONFIG[milestone.status];
  const Icon = cfg.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn('h-3.5 w-3.5 shrink-0', cfg.color)} />
          <span className="text-[13px] font-medium text-foreground truncate">{milestone.title}</span>
        </div>
        <div className="text-right shrink-0">
          {milestone.status === 'achieved' ? (
            <span className="text-[12px] text-accent font-medium">Achieved</span>
          ) : milestone.estimatedDate ? (
            <span className="text-[12px] text-muted-foreground">{milestone.estimatedDate}</span>
          ) : (
            <span className="text-[12px] text-muted-foreground">—</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-border/50 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', cfg.barColor)}
          style={{ width: `${milestone.progressPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{milestone.explanation}</span>
        {milestone.status !== 'achieved' && milestone.targetValue > 0 && (
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 ml-2">
            {$n(milestone.currentValue)} / {$n(milestone.targetValue)}
          </span>
        )}
      </div>
    </div>
  );
}

interface Props {
  milestones:  FinancialMilestone[];
  onAskCoach?: (prompt: string) => void;
}

export default function MilestoneCard({ milestones, onAskCoach }: Props) {
  if (milestones.length === 0) return null;

  const active   = milestones.filter(m => m.status !== 'achieved');
  const achieved = milestones.filter(m => m.status === 'achieved');

  return (
    <div className="rounded-2xl border border-border/40 bg-background px-5 py-4 space-y-4"
         style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}>
      <p className="text-[13px] font-semibold text-foreground">Financial Milestones</p>

      {active.length > 0 && (
        <div className="space-y-4 divide-y divide-border/30">
          {active.map((m, i) => (
            <div key={m.id} className={i > 0 ? 'pt-4' : ''}>
              <MilestoneRow milestone={m} />
            </div>
          ))}
        </div>
      )}

      {achieved.length > 0 && (
        <div className="pt-2 border-t border-border/30">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-2">Achieved</p>
          <div className="space-y-1.5">
            {achieved.map(m => (
              <div key={m.id} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                <span className="text-[12px] text-muted-foreground">{m.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {onAskCoach && active.length > 0 && (
        <button
          onClick={() => onAskCoach(`Here are my financial milestones: ${active.map(m => `${m.title} (${m.explanation})`).join('; ')}. Help me prioritise which to focus on and how to accelerate them.`)}
          className="text-[11px] text-primary hover:underline underline-offset-2"
        >
          Help me reach these faster →
        </button>
      )}

      <p className="text-[10px] text-muted-foreground/50 border-t border-border/20 pt-2">
        Projections at current surplus · Estimated dates are illustrative, not guaranteed
      </p>
    </div>
  );
}
