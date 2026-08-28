import React from 'react';
import { CreditCard, PieChart, TrendingUp, Home, Briefcase, HelpCircle, ArrowRight, Sparkles } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JourneyRecommendation, RecommendationPriority } from '@/lib/journeyRecommendations';
import type { JourneyId } from '@/components/somatech/journey/journeyConfig';
import { JOURNEYS } from '@/components/somatech/journey/journeyConfig';

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  'credit-card': CreditCard,
  'pie-chart':   PieChart,
  'trending-up': TrendingUp,
  'home':        Home,
  'briefcase':   Briefcase,
};

const PRIORITY_CONFIG: Record<RecommendationPriority, {
  badge:    string;
  label:    string;
  cardBg:   string;
  cardBorder: string;
}> = {
  critical:    {
    badge:       'bg-destructive/100/10 text-destructive border border-destructive/20/20',
    label:       'Priority',
    cardBg:      'bg-destructive/100/5 hover:bg-destructive/100/8',
    cardBorder:  'border-destructive/20/20',
  },
  moderate:    {
    badge:       'bg-warning/100/10 text-warning border border-warning/20/20',
    label:       'Suggested',
    cardBg:      'bg-card hover:bg-muted/40',
    cardBorder:  'border-border/50',
  },
  opportunity: {
    badge:       'bg-primary/10 text-primary border border-primary/20',
    label:       'Opportunity',
    cardBg:      'bg-card hover:bg-muted/40',
    cardBorder:  'border-border/50',
  },
};

interface SuggestedJourneysProps {
  recommendations: JourneyRecommendation[];
  onStartJourney:  (journeyId: JourneyId) => void;
}

export default function SuggestedJourneys({ recommendations, onStartJourney }: SuggestedJourneysProps) {
  if (recommendations.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Journeys for your situation
        </p>
      </div>

      {/* Recommendation cards */}
      <div className="space-y-2">
        {recommendations.map(rec => {
          const journeyDef = JOURNEYS.find(j => j.id === rec.journeyId);
          if (!journeyDef) return null;

          const Icon   = ICON_MAP[journeyDef.iconName] ?? HelpCircle;
          const config = PRIORITY_CONFIG[rec.priority];

          return (
            <button
              key={rec.journeyId}
              onClick={() => onStartJourney(rec.journeyId)}
              className={cn(
                'w-full flex items-start gap-3.5 p-4 rounded-2xl border text-left',
                'transition-all duration-200 hover:shadow-sm active:scale-[0.99]',
                config.cardBg,
                config.cardBorder,
              )}
            >
              {/* Icon */}
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                journeyDef.colorBg,
              )}>
                <Icon className={cn('h-4 w-4', journeyDef.colorIcon)} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground">
                    {journeyDef.title}
                  </span>
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', config.badge)}>
                    {config.label}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {rec.reason}
                </p>

                <p className="text-[11px] text-primary font-medium mt-1.5">
                  Start — answers pre-filled from your data →
                </p>
              </div>

              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-2.5" />
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground/50 text-center">
        Derived from your connected bank data · For planning purposes only · Not financial advice
      </p>
    </div>
  );
}
