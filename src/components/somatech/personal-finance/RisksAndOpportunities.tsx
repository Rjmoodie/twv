import React from 'react';
import { AlertTriangle, AlertCircle, Info, Lightbulb, Brain } from 'lucide-react';
import { FinancialRiskAlert, FinancialOpportunity } from '@/lib/personalFinanceEngine';
import { cn } from '@/lib/utils';

interface RiskCardProps {
  alert:       FinancialRiskAlert;
  onAskCoach?: (prompt: string) => void;
}

const SEVERITY_STYLES = {
  critical: { border: 'border-destructive/20/25',   bg: 'bg-destructive/100/5',   icon: AlertCircle,  iconColor: 'text-destructive',   label: 'bg-destructive/100/10 text-destructive'     },
  warning:  { border: 'border-warning/20/25', bg: 'bg-warning/100/5', icon: AlertTriangle, iconColor: 'text-warning', label: 'bg-warning/100/10 text-warning' },
  info:     { border: 'border-border/40',    bg: 'bg-muted/20',    icon: Info,          iconColor: 'text-muted-foreground', label: 'bg-muted text-muted-foreground' },
};

export function RiskAlertCard({ alert, onAskCoach }: RiskCardProps) {
  const s = SEVERITY_STYLES[alert.severity];
  const Icon = s.icon;

  return (
    <div className={cn('rounded-2xl border px-4 py-3.5 space-y-2', s.border, s.bg)}>
      <div className="flex items-start gap-2.5">
        <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', s.iconColor)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[13px] font-semibold text-foreground">{alert.title}</p>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wide', s.label)}>
              {alert.severity}
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed">{alert.explanation}</p>
          <p className="text-[12px] text-foreground/80 mt-1.5 leading-relaxed">
            <span className="font-medium">→ </span>{alert.recommendedAction}
          </p>
        </div>
      </div>
      {onAskCoach && (
        <button
          onClick={() => onAskCoach(`${alert.title}. ${alert.explanation} ${alert.recommendedAction}`)}
          className="flex items-center gap-1 text-[11px] text-primary hover:underline underline-offset-2 pl-6"
        >
          <Brain className="h-3 w-3" /> Ask Coach
        </button>
      )}
    </div>
  );
}

interface OpportunityCardProps {
  opportunity: FinancialOpportunity;
  onAskCoach?: (prompt: string) => void;
}

export function OpportunityCard({ opportunity, onAskCoach }: OpportunityCardProps) {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3.5 space-y-2">
      <div className="flex items-start gap-2.5">
        <Lightbulb className="h-4 w-4 text-accent shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground mb-0.5">{opportunity.title}</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">{opportunity.explanation}</p>
          {opportunity.estimatedImpact && (
            <p className="text-[11px] text-accent mt-1.5 font-medium">{opportunity.estimatedImpact}</p>
          )}
        </div>
      </div>
      {onAskCoach && (
        <button
          onClick={() => onAskCoach(`${opportunity.title}. ${opportunity.explanation} Help me act on this opportunity.`)}
          className="flex items-center gap-1 text-[11px] text-primary hover:underline underline-offset-2 pl-6"
        >
          <Brain className="h-3 w-3" /> Ask Coach
        </button>
      )}
    </div>
  );
}

interface Props {
  risks:         FinancialRiskAlert[];
  opportunities: FinancialOpportunity[];
  onAskCoach?:   (prompt: string) => void;
}

export default function RisksAndOpportunities({ risks, opportunities, onAskCoach }: Props) {
  if (risks.length === 0 && opportunities.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {risks.map(r => (
        <RiskAlertCard key={r.id} alert={r} onAskCoach={onAskCoach} />
      ))}
      {opportunities.map(o => (
        <OpportunityCard key={o.id} opportunity={o} onAskCoach={onAskCoach} />
      ))}
    </div>
  );
}
