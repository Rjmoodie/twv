import { Sparkles, ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JourneyDef } from './journeyConfig';
import type { JourneyDraft } from '@/hooks/useJourney';
import { useHaptics } from '@/hooks/useHaptics';
import { analyzeJourney } from '@/lib/journeyMetrics';

interface JourneyPreviewProps {
  journey: JourneyDef;
  draft: JourneyDraft;
  isLoggedIn: boolean;
  onSave: () => void;
  onRestart: () => void;
}

const JourneyPreview = ({ journey, draft, isLoggedIn, onSave, onRestart }: JourneyPreviewProps) => {
  const haptics = useHaptics();
  const analysis = analyzeJourney(journey, draft.answers);
  const metrics = analysis.metrics;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center space-y-2 pt-1">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${journey.colorBg}`}>
          <Sparkles className={`h-6 w-6 ${journey.colorIcon}`} />
        </div>
        <h2 className="text-xl font-bold text-foreground tracking-tight">Your personalised snapshot</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">{journey.promise}</p>
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        {analysis.errors.length > 0 ? (
          <div className="p-4 rounded-2xl border border-border/50 bg-muted/20 text-sm text-muted-foreground text-center">
            {analysis.errors.join(' ')}
          </div>
        ) : (
          metrics.map((m, i) => (
            <div
              key={i}
              className={`p-4 rounded-2xl border ${
                m.highlight
                  ? `${journey.colorAccent} ${journey.colorBg}`
                  : 'border-border/50 bg-muted/20'
              }`}
            >
              <p className="text-xs text-muted-foreground font-medium mb-1">{m.label}</p>
              <p className={`text-2xl font-bold tracking-tight ${m.highlight ? journey.colorIcon : 'text-foreground'}`}>
                {m.value}
              </p>
              {m.sub && (
                <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* CTA */}
      <div className="space-y-3 pt-1">
        <div className="p-3.5 rounded-xl border border-border/40 bg-muted/20">
          <p className="text-xs font-semibold text-foreground mb-1">
            {isLoggedIn ? 'Save your plan' : 'Save your plan & unlock full features'}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isLoggedIn
              ? 'Save this plan to your account and open your personalised coaching session.'
              : 'Create a free account to save this plan, track your progress, and get personalised recommendations as your situation changes.'}
          </p>
        </div>

        <Button
          className="w-full h-12 text-base rounded-xl flex items-center justify-center gap-2 font-semibold"
          onClick={() => { haptics.success(); onSave(); }}
        >
          {isLoggedIn ? 'Save my plan' : "Save my plan — it's free"}
          <ArrowRight className="h-4 w-4" />
        </Button>

        <button
          onClick={() => { haptics.tick(); onRestart(); }}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          <RotateCcw className="h-3 w-3" />
          Start over with different numbers
        </button>
      </div>
    </div>
  );
};

export default JourneyPreview;
