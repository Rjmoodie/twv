import React, { useMemo } from 'react';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { computeInsights, FinancialInsight, InsightSeverity } from '@/lib/financialInsights';
import { NetWorthSnapshot, MonthlyCashFlow } from '@/hooks/usePersonalFinance';
import { PlaidTransaction } from '@/hooks/useTransactions';
import { cn } from '@/lib/utils';

interface InsightCardsProps {
  snapshots:        NetWorthSnapshot[];
  cashFlows:        MonthlyCashFlow[];
  /** Last 90 days of Plaid transactions — enables subscription + merchant insights */
  allTransactions?: PlaidTransaction[];
  onAskCoach?:      (prompt: string) => void;
}

const SEVERITY_STYLES: Record<InsightSeverity, {
  bg: string; border: string; icon: React.FC<{ className?: string }>; iconColor: string;
}> = {
  warning:  { bg: 'bg-warning/10',  border: 'border-warning/25',  icon: AlertTriangle, iconColor: 'text-warning'  },
  positive: { bg: 'bg-accent/10',   border: 'border-accent/25',   icon: CheckCircle2,  iconColor: 'text-accent'   },
  info:     { bg: 'bg-primary/10',  border: 'border-primary/25',  icon: Info,          iconColor: 'text-primary'  },
};

function InsightCard({
  insight,
  onAskCoach,
  hero = false,
}: {
  insight: FinancialInsight;
  onAskCoach?: (p: string) => void;
  hero?: boolean;
}) {
  const { bg, border, icon: Icon, iconColor } = SEVERITY_STYLES[insight.severity];

  return (
    <div className={cn(
      'rounded-2xl border p-4 space-y-2',
      bg,
      border,
      // Hero warning card gets stronger left border + slight elevation
      hero && insight.severity === 'warning' && 'border-l-4 border-l-warning shadow-elev-1',
    )}>
      {/* Icon + title */}
      <div className="flex items-start gap-2.5">
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', bg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
        <p className={cn('heading-tight font-semibold leading-snug pt-0.5', hero ? 'text-base' : 'text-sm')}>
          {insight.title}
        </p>
      </div>

      {/* Plain-English detail */}
      <p className="text-xs text-muted-foreground leading-relaxed pl-[2.375rem]">
        {insight.detail}
      </p>

      {/* Coach prompt — violet, distinct */}
      {onAskCoach && (
        <div className={cn('pl-[2.375rem]', hero && 'pt-1')}>
          <button
            onClick={() => onAskCoach(insight.coachPrompt)}
            className={cn(
              'flex items-center gap-1.5 font-medium text-coach hover:text-coach/80 transition-colors',
              hero ? 'text-xs px-3 py-1.5 rounded-lg bg-coach/10 hover:bg-coach/15' : 'text-[11px]',
            )}
          >
            <Brain className="h-3 w-3" />
            Ask Coach about this
          </button>
        </div>
      )}
    </div>
  );
}

export default function InsightCards({ snapshots, cashFlows, allTransactions, onAskCoach }: InsightCardsProps) {
  const insights = useMemo(
    () => computeInsights(snapshots, cashFlows, allTransactions),
    [snapshots, cashFlows, allTransactions],
  );

  if (insights.length === 0) return null;

  // First warning-severity insight becomes the full-width hero
  const firstWarningIdx = insights.findIndex(i => i.severity === 'warning');
  const heroInsight     = firstWarningIdx !== -1 ? insights[firstWarningIdx] : null;
  const gridInsights    = heroInsight
    ? insights.filter((_, idx) => idx !== firstWarningIdx)
    : insights;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Brain className="h-3 w-3" /> Financial Insights
      </p>

      {/* Hero — first warning shown full-width with stronger treatment */}
      {heroInsight && (
        <InsightCard insight={heroInsight} onAskCoach={onAskCoach} hero />
      )}

      {/* Remaining insights in 2-column grid */}
      {gridInsights.length > 0 && (
        <div className={cn('grid gap-2 sm:grid-cols-2', gridInsights.length % 2 === 1 && '[&>*:last-child]:sm:col-span-2')}>
          {gridInsights.map(insight => (
            <InsightCard key={insight.id} insight={insight} onAskCoach={onAskCoach} />
          ))}
        </div>
      )}
    </div>
  );
}
