import { useEffect, useState } from "react";
import { useAuth } from "@/components/somatech/AuthProvider";
import { useCoachProfile } from "@/hooks/useCoachProfile";
import { coachService } from "@/services/coachService";
import { buildRoadmap } from "@/services/roadmapService";
import { useNavigation } from "@/contexts/NavigationContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, Map, X } from "lucide-react";

type BannerState = { title: string; subtitle: string; progress: number; moduleId: string };

export default function NextStepBanner() {
  const { user } = useAuth();
  const { profile } = useCoachProfile();
  const { navigateToModule } = useNavigation();
  const [state, setState] = useState<BannerState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || !profile || dismissed) return;
    if (!profile.completed_intake || !profile.snapshot_completed) return;

    let cancelled = false;

    (async () => {
      try {
        const milestones = await coachService.getMilestones(user.id);
        const roadmap = buildRoadmap(profile, milestones);
        const current = roadmap.currentMilestone;
        if (!current || cancelled) return;

        const phase = roadmap.phases.find((p) => p.id === roadmap.currentPhaseId);
        const progress = phase && phase.totalCount > 0
          ? Math.round((phase.completedCount / phase.totalCount) * 100)
          : 0;

        if (!cancelled) setState({
          title: current.title,
          subtitle: `${phase?.title ?? "Roadmap"}  ·  ${progress}% complete`,
          progress,
          moduleId: (current as any).moduleId ?? 'financial-coach',
        });
      } catch {
        // fail silently — banner is non-critical
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, profile, dismissed]);

  if (!state || dismissed) return null;

  return (
    <div className="relative flex items-center gap-4 rounded-xl border border-primary/25 bg-primary/5 px-5 py-4 animate-fade-in">
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Map className="h-5 w-5 text-primary" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug">{state.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{state.subtitle}</p>
        <div className="mt-2 flex items-center gap-2 max-w-48">
          <div className="flex-1 h-1 bg-primary/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            {state.progress}%
          </span>
        </div>
      </div>

      {/* CTA */}
      <Button size="sm" onClick={() => navigateToModule(state.moduleId)} className="shrink-0 gap-1.5">
        Continue
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
