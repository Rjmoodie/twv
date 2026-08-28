import { CreditCard, PieChart, TrendingUp, Home, Briefcase, HelpCircle, Users, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { JourneyDef, JourneyId } from './journeyConfig';
import { JOURNEYS } from './journeyConfig';
import { useHaptics } from '@/hooks/useHaptics';
import type { CompletedJourney } from '@/hooks/useJourney';
import { formatDistanceToNow } from 'date-fns';

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  'credit-card': CreditCard,
  'pie-chart':   PieChart,
  'trending-up': TrendingUp,
  'home':        Home,
  'briefcase':   Briefcase,
};

interface JourneySelectorProps {
  onSelect: (id: JourneyId) => void;
  onViewPlan: (id: JourneyId) => void;
  completedJourneys: Partial<Record<JourneyId, CompletedJourney>>;
  onBrowseCommunity?: () => void;
}

const JourneySelector = ({ onSelect, onViewPlan, completedJourneys, onBrowseCommunity }: JourneySelectorProps) => {
  const haptics = useHaptics();

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2 pt-2">
        <h2 className="text-xl font-bold text-foreground tracking-tight">What's your financial goal?</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Choose a path and we'll build your personalised plan — no account needed to start.
        </p>
      </div>

      {/* Journey grid */}
      <div className="grid grid-cols-1 gap-3">
        {JOURNEYS.map((journey: JourneyDef) => {
          const Icon = ICON_MAP[journey.iconName] ?? HelpCircle;
          const completed = completedJourneys[journey.id];

          return (
            <div
              key={journey.id}
              className={`rounded-2xl border text-left transition-all ${
                completed
                  ? 'border-border/80 bg-card'
                  : 'border-border/60 bg-card hover:bg-muted/40 active:scale-[0.98]'
              }`}
            >
              {/* Main card row */}
              <button
                onClick={() => {
                  haptics.tap();
                  if (completed) {
                    onViewPlan(journey.id);
                  } else {
                    onSelect(journey.id);
                  }
                }}
                className="w-full flex items-start gap-4 p-4 text-left"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${journey.colorBg}`}>
                  <Icon className={`h-5 w-5 ${journey.colorIcon}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{journey.title}</span>
                    {completed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Plan saved
                      </span>
                    ) : (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${journey.colorBg} ${journey.colorIcon}`}>
                        {journey.tagline}
                      </span>
                    )}
                  </div>
                  {completed ? (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Last updated {formatDistanceToNow(new Date(completed.completedAt), { addSuffix: true })} · Tap to view your plan
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground leading-relaxed">{journey.audience}</p>
                      <p className="text-xs text-foreground/70 mt-1 leading-relaxed">{journey.promise}</p>
                    </>
                  )}
                </div>
                <ArrowRight className={`h-4 w-4 shrink-0 mt-1 ${completed ? 'text-accent' : 'text-muted-foreground/50'}`} />
              </button>

              {/* Completed actions row */}
              {completed && (
                <div className="flex gap-2 px-4 pb-3 pt-0 border-t border-border/30 mt-0">
                  <button
                    onClick={() => { haptics.tap(); onViewPlan(journey.id); }}
                    className="flex-1 text-xs font-medium py-2 rounded-xl bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                  >
                    View plan
                  </button>
                  <button
                    onClick={() => { haptics.tick(); onSelect(journey.id); }}
                    className="flex items-center gap-1.5 px-3 text-xs font-medium py-2 rounded-xl bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Update
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Browse community option */}
      {onBrowseCommunity && (
        <button
          onClick={() => { haptics.tap(); onBrowseCommunity(); }}
          className="w-full group relative overflow-hidden flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/8 to-primary/4 hover:from-primary/15 hover:to-primary/8 hover:border-primary/35 transition-all duration-200 active:scale-[0.98]"
        >
          <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-primary/20 blur-xl pointer-events-none" />
          <div className="flex items-center gap-4 relative">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground leading-snug">Not ready to start?</p>
              <p className="text-xs text-muted-foreground mt-0.5">See what others are achieving</p>
            </div>
          </div>
          <div className="relative flex items-center justify-center w-7 h-7 rounded-xl bg-primary/15 border border-primary/20 shrink-0 group-hover:bg-primary/25 group-hover:border-primary/35 transition-all">
            <ArrowRight className="h-3.5 w-3.5 text-primary group-hover:translate-x-0.5 transition-transform duration-150" />
          </div>
        </button>
      )}
    </div>
  );
};

export default JourneySelector;
