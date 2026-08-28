import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { FinancialHealthScore, HealthScoreComponent } from '@/lib/personalFinanceEngine';
import { cn } from '@/lib/utils';

interface Props {
  score: FinancialHealthScore;
}

const STATUS_COLORS: Record<string, { ring: string; text: string; bg: string }> = {
  'Critical':        { ring: '#ef4444', text: 'text-destructive',     bg: 'bg-destructive/100/10'     },
  'Needs Attention': { ring: '#f59e0b', text: 'text-warning',   bg: 'bg-warning/100/10'   },
  'Stable':          { ring: '#3b82f6', text: 'text-blue-500',    bg: 'bg-blue-500/10'    },
  'Strong':          { ring: '#10b981', text: 'text-accent', bg: 'bg-emerald-500/10' },
  'Excellent':       { ring: '#8b5cf6', text: 'text-violet-500',  bg: 'bg-violet-500/10'  },
};

const COMPONENT_LABELS: Record<string, string> = {
  cashRunway:     'Cash Runway',
  savingsRate:    'Savings Rate',
  debtBurden:     'Debt Burden',
  netWorthTrend:  'Net Worth Trend',
  expenseControl: 'Expense Control',
};

function ScoreBar({ component, name }: { component: HealthScoreComponent; name: string }) {
  const pct = Math.round((component.score / component.maxScore) * 100);
  const barColor =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 55 ? 'bg-blue-500'    :
    pct >= 35 ? 'bg-warning/100'   : 'bg-destructive/100';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-foreground">{COMPONENT_LABELS[name]}</span>
          <span className="text-[11px] text-muted-foreground">({component.weight}%)</span>
        </div>
        <span className={cn('text-[12px] font-semibold', barColor.replace('bg-', 'text-'))}>
          {component.label}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-border/50 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[12px] text-muted-foreground leading-relaxed">{component.explanation}</p>
    </div>
  );
}

// SVG score ring
function ScoreRing({ score, status }: { score: number; status: string }) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS['Stable'];
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="7" />
        <circle
          cx="50" cy="50" r={radius} fill="none"
          stroke={colors.ring} strokeWidth="7"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-foreground leading-none">{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export default function FinancialHealthScoreCard({ score }: Props) {
  const [expanded, setExpanded] = useState(false);
  const colors = STATUS_COLORS[score.status] ?? STATUS_COLORS['Stable'];

  return (
    <div className="rounded-2xl border border-border/40 bg-background overflow-hidden"
         style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}>
      {/* Header row */}
      <button
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <ScoreRing score={score.totalScore} status={score.status} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[15px] font-semibold text-foreground">Financial Health</span>
            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', colors.text, colors.bg)}>
              {score.status}
            </span>
            {score.isPartial && (
              <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted">
                Partial data
              </span>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
            {score.summary}
          </p>
        </div>

        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded component breakdown */}
      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-border/30 space-y-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium pt-2">
            Score breakdown
          </p>
          {(Object.entries(score.components) as [string, HealthScoreComponent][]).map(([name, comp]) => (
            <ScoreBar key={name} name={name} component={comp} />
          ))}
          <p className="text-[10px] text-muted-foreground/60 pt-1 border-t border-border/20 mt-3">
            Score is based on cash runway, savings rate, debt burden, net worth trend, and expense control.
            At current pace — not a guarantee of future outcomes.
          </p>
        </div>
      )}
    </div>
  );
}
