import { useState } from "react";
import { useAuth } from "@/components/somatech/AuthProvider";
import { useCoachProfile } from "@/hooks/useCoachProfile";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useNavigation } from "@/contexts/NavigationContext";
import { useHaptics } from "@/hooks/useHaptics";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  label: string;
  description: string;
  done: boolean;
  moduleId: string;
}

export default function OnboardingChecklist() {
  const { user } = useAuth();
  const { portfolios, loading: portfolioLoading, error: portfolioError } = usePortfolio();
  const { navigateToModule } = useNavigation();
  const haptics = useHaptics();
  const { profile, isLoading: profileLoading, error: profileError } = useCoachProfile();
  const [expanded, setExpanded] = useState(true);

  // Anonymous users can't complete any of these steps — don't render
  if (!user) return null;
  // Unknown is not incomplete. Wait for both account-scoped sources rather
  // than flashing setup steps that the user has already completed.
  if (profileLoading || portfolioLoading || profileError || portfolioError) return null;

  const steps: Step[] = [
    {
      id: "account",
      label: "Create your account",
      description: "You're in — welcome.",
      done: true,
      moduleId: "dashboard",
    },
    {
      id: "profile",
      label: "Complete financial profile",
      description: "Tell us your situation so we can personalise everything.",
      done: !!profile?.completed_intake,
      moduleId: "financial-coach",
    },
    {
      id: "snapshot",
      label: "Add your numbers",
      description: "Income, expenses, savings — unlocks your roadmap.",
      done: !!profile?.snapshot_completed,
      moduleId: "financial-coach",
    },
    {
      id: "portfolio",
      label: "Set up your portfolio",
      description: "Define your goal, horizon, and risk level.",
      done: portfolios.length > 0,
      moduleId: "portfolio",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;
  const progress = Math.round((completedCount / steps.length) * 100);

  // Hide once fully complete
  if (allDone) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => { haptics.tick(); setExpanded((v) => !v); }}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-primary/5 transition-colors"
      >
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold heading-tight">Getting started</span>
            <span className="badge-gold">{completedCount}/{steps.length}</span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-primary/15 rounded-full overflow-hidden w-full max-w-48">
            <div
              role="progressbar"
              aria-label="Account setup progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="h-full bg-primary rounded-full transition-all duration-700 shadow-glow-primary"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Steps */}
      {expanded && (
        <div className="border-t border-primary/15 divide-y divide-primary/10">
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={() => { if (!step.done) { haptics.tap(); navigateToModule(step.moduleId); } }}
              disabled={step.done}
              className={cn(
                "group w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors",
                step.done ? "opacity-50 cursor-default" : "hover:bg-primary/5"
              )}
            >
              {step.done
                ? <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", step.done && "line-through text-muted-foreground")}>
                  {step.label}
                </p>
                {!step.done && (
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                )}
              </div>
              {!step.done && (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
