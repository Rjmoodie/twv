import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfetti } from "@/hooks/useConfetti";
import { useHaptics } from "@/hooks/useHaptics";
import {
  CheckCircle2, Circle, SkipForward, ChevronDown, ChevronRight,
  Clock, MessageCircle, Loader2, Lock, PlayCircle, Sparkles, X, TrendingUp, AlertTriangle,
} from "lucide-react";
import type { PersonalisedRoadmap, RoadmapMilestone, RoadmapPhase, MilestoneState } from "@/services/roadmapService";
import { buildRoadmap } from "@/services/roadmapService";
import type { MilestoneStatus, FinancialProfile, UserMilestone } from "@/services/coachService";

/**
 * The roadmap derives a savings capacity from the snapshot; the investment goal
 * carries a monthly contribution set separately. Nothing reconciled them, so the
 * two surfaces could quote different numbers for the same intent and neither
 * knew. Showing the disagreement is the point — it is a decision to make, not an
 * error to hide.
 */
function ContributionNote({ check }: { check: NonNullable<PersonalisedRoadmap['contributionCheck']> }) {
  if (check.status === 'aligned') return null;
  const warn = check.status === 'goal_exceeds_capacity';
  return (
    <div className={`rounded-lg border p-2.5 ${warn ? 'border-warning/40 bg-warning/10' : 'border-border bg-muted/40'}`}>
      <div className="flex items-start gap-1.5">
        {warn
          ? <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
          : <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />}
        <p className="text-xs leading-snug text-foreground">{check.message}</p>
      </div>
    </div>
  );
}

/**
 * What the rest of the app can see about a milestone.
 *
 * This never changes the milestone's state on its own. The roadmap can tell you
 * a brokerage is linked and holding twelve positions; it cannot tell whether the
 * account is taxable, and quietly completing the milestone on that basis is the
 * class of bug that made the debt milestones permanently wrong. So it states
 * what it sees and offers the click — the decision stays with the user.
 */
function EvidenceNote({
  evidence, onConfirm, disabled,
}: {
  evidence: NonNullable<RoadmapMilestone['evidence']>;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const Icon =
    evidence.tone === 'contradicts' ? AlertTriangle
    : evidence.tone === 'supports'  ? CheckCircle2
    : Sparkles;
  const tone =
    evidence.tone === 'contradicts' ? 'border-warning/40 bg-warning/10'
    : evidence.tone === 'supports'  ? 'border-accent/40 bg-accent/10'
    : 'border-border bg-muted/40';
  const iconTone =
    evidence.tone === 'contradicts' ? 'text-warning'
    : evidence.tone === 'supports'  ? 'text-accent'
    : 'text-muted-foreground';

  return (
    <div className={`rounded-md border p-2 ${tone}`}>
      <div className="flex items-start gap-1.5">
        <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${iconTone}`} />
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs leading-snug text-foreground">{evidence.statement}</p>
          {evidence.offersCompletion && (
            <Button size="sm" variant="outline" className="h-6 text-[11px]" disabled={disabled}
              onClick={onConfirm}>
              <CheckCircle2 className="h-3 w-3 mr-1" />Yes, mark it done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Full static maps — Tailwind JIT needs complete class strings, no dynamic construction
const PHASE_RINGS: Record<number, string> = {
  0: 'ring-destructive/40', 1: 'ring-orange-500', 2: 'ring-yellow-500',
  3: 'ring-emerald-500', 4: 'ring-blue-500', 5: 'ring-violet-500', 6: 'ring-slate-500',
};
const PHASE_BORDERS: Record<number, string> = {
  0: 'border-destructive/20', 1: 'border-orange-500', 2: 'border-yellow-500',
  3: 'border-emerald-500', 4: 'border-blue-500', 5: 'border-violet-500', 6: 'border-slate-500',
};

interface RoadmapViewProps {
  roadmap: PersonalisedRoadmap;
  profile: FinancialProfile;
  savedMilestones: UserMilestone[];
  onMarkMilestone: (milestoneId: string, status: MilestoneStatus) => Promise<void>;
  onAskCoach: (prompt: string) => void;
}

export default function RoadmapView({
  roadmap, profile, savedMilestones, onMarkMilestone, onAskCoach,
}: RoadmapViewProps) {
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [extraSavings, setExtraSavings] = useState(0);
  const [openPhases, setOpenPhases] = useState<Set<number>>(new Set([roadmap.currentPhaseId]));
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { fireMilestone } = useConfetti();
  const haptics = useHaptics();

  // Auto-open the new current phase when a phase advances (e.g. after marking last milestone done)
  useEffect(() => {
    setOpenPhases(prev => new Set([...prev, roadmap.currentPhaseId]));
  }, [roadmap.currentPhaseId]);

  // Edge case: require both fields for what-if to produce meaningful deltas
  const hasSnapshot = profile.monthly_take_home != null && profile.monthly_expenses != null;

  const whatIfRoadmap = useMemo(() => {
    if (!whatIfMode || extraSavings === 0 || !hasSnapshot) return null;
    return buildRoadmap(
      { ...profile, monthly_take_home: (profile.monthly_take_home ?? 0) + extraSavings },
      savedMilestones
    );
  }, [whatIfMode, extraSavings, hasSnapshot, profile, savedMilestones]);

  // milestoneId → what-if estimated weeks lookup
  const whatIfWeeks = useMemo(() => {
    const map = new Map<string, [number, number] | null>();
    if (!whatIfRoadmap) return map;
    for (const phase of whatIfRoadmap.phases)
      for (const m of phase.milestones)
        map.set(m.id, m.estimatedWeeks);
    return map;
  }, [whatIfRoadmap]);

  // One-line insight for the What If panel: "Phase N done ~X wks sooner"
  const phaseInsight = useMemo(() => {
    if (!whatIfRoadmap || extraSavings === 0) return null;
    const realPhase = roadmap.phases.find(p => p.id === roadmap.currentPhaseId);
    const simPhase  = whatIfRoadmap.phases.find(p => p.id === roadmap.currentPhaseId);
    if (!realPhase || !simPhase) return null;
    let realTotal = 0, simTotal = 0;
    for (const rm of realPhase.milestones) {
      if (rm.state === 'complete' || rm.state === 'skipped') continue;
      if (rm.estimatedWeeks) realTotal += (rm.estimatedWeeks[0] + rm.estimatedWeeks[1]) / 2;
      const sm = simPhase.milestones.find(m => m.id === rm.id);
      if (sm?.estimatedWeeks) simTotal += (sm.estimatedWeeks[0] + sm.estimatedWeeks[1]) / 2;
    }
    const saved = Math.round(realTotal - simTotal);
    return saved > 0 ? `Phase ${roadmap.currentPhaseId} done ~${saved} wks sooner` : null;
  }, [whatIfRoadmap, extraSavings, roadmap]);

  const togglePhase = useCallback((id: number) => {
    setOpenPhases(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleAction = useCallback(async (milestoneId: string, status: MilestoneStatus) => {
    setActionLoading(milestoneId);
    try {
      await onMarkMilestone(milestoneId, status);
      if (status === 'complete') { fireMilestone(); haptics.success(); }
      else if (status === 'in_progress') haptics.tap();
      else haptics.tick(); // skip
    } finally {
      setActionLoading(null);
    }
  }, [onMarkMilestone, fireMilestone]); // haptics methods are stable, no need in deps

  return (
    <div className="space-y-3 pb-6">
      <RealityCard roadmap={roadmap} whatIfRoadmap={whatIfMode ? whatIfRoadmap : null} />

      {roadmap.contributionCheck && <ContributionNote check={roadmap.contributionCheck} />}

      <WhatIfSection
        active={whatIfMode}
        extraSavings={extraSavings}
        weeklyCapacity={roadmap.weeklyCapacity}
        hasSnapshot={hasSnapshot}
        insight={phaseInsight}
        onToggle={() => { haptics.tap(); setWhatIfMode(v => !v); setExtraSavings(0); }}
        onExtraSavingsChange={setExtraSavings}
      />

      {/* Journey spine */}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border/50" />
        <div className="space-y-1.5">
          {roadmap.phases.map(phase => (
            <PhaseStation
              key={phase.id}
              phase={phase}
              isOpen={openPhases.has(phase.id)}
              isCurrent={phase.id === roadmap.currentPhaseId}
              onToggle={() => { haptics.tick(); togglePhase(phase.id); }}
              onAction={handleAction}
              onAskCoach={onAskCoach}
              actionLoading={actionLoading}
              whatIfMode={whatIfMode}
              whatIfWeeks={whatIfWeeks}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Reality card ───────────────────────────────────────────────────────────────

function RealityCard({
  roadmap,
  whatIfRoadmap,
}: {
  roadmap: PersonalisedRoadmap;
  whatIfRoadmap: PersonalisedRoadmap | null;
}) {
  const currentPhase = roadmap.phases.find(p => p.id === roadmap.currentPhaseId);
  const progress = currentPhase
    ? Math.round((currentPhase.completedCount / Math.max(currentPhase.totalCount, 1)) * 100)
    : 0;

  const capacity = whatIfRoadmap?.weeklyCapacity ?? roadmap.weeklyCapacity;
  const isSimulated = whatIfRoadmap !== null;
  const isOverBudget = capacity != null && capacity < 0;
  const displayWeeks = whatIfRoadmap?.currentMilestone?.estimatedWeeks
    ?? roadmap.currentMilestone?.estimatedWeeks;

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">
            Weekly savings capacity
          </p>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className={`text-2xl font-bold tabular-nums ${isOverBudget ? 'text-destructive' : 'text-foreground'}`}>
              {capacity != null ? `${capacity < 0 ? '-' : ''}$${Math.abs(capacity).toLocaleString()}` : '—'}
            </span>
            <span className="text-sm text-muted-foreground">/wk</span>
            {isOverBudget && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" />spending exceeds income
              </span>
            )}
            {isSimulated && !isOverBudget && (
              <span className="text-xs font-medium text-accent dark:text-accent">scenario</span>
            )}
          </div>
        </div>

        {displayWeeks && !isOverBudget && (
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground mb-0.5">Next milestone</p>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              ~{displayWeeks[0]}–{displayWeeks[1]} wks
            </p>
          </div>
        )}
      </div>

      {currentPhase && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Phase {currentPhase.id}: {currentPhase.title}</span>
            <span>{currentPhase.completedCount}/{currentPhase.totalCount}</span>
          </div>
          <div className="h-1 rounded-full bg-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${currentPhase.colorClass}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── What If section ────────────────────────────────────────────────────────────

function WhatIfSection({
  active, extraSavings, weeklyCapacity, hasSnapshot, insight, onToggle, onExtraSavingsChange,
}: {
  active: boolean;
  extraSavings: number;
  weeklyCapacity: number | null;
  hasSnapshot: boolean;
  insight: string | null;
  onToggle: () => void;
  onExtraSavingsChange: (v: number) => void;
}) {
  const haptics = useHaptics();

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    haptics.tick();
    onExtraSavingsChange(Number(e.target.value));
  };

  // Real base capacity for computing the new value (may be negative — show absolute improvement)
  const baseCapacity = weeklyCapacity ?? 0;
  const newCapacity = Math.round(baseCapacity + extraSavings / 4.33);

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
          active
            ? 'bg-primary/5 text-primary'
            : 'bg-card hover:bg-muted/30 text-muted-foreground hover:text-foreground'
        }`}
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left font-medium">
          {active
            ? extraSavings > 0
              ? `What If: +$${extraSavings.toLocaleString()}/mo extra`
              : 'What If — drag to simulate'
            : 'What If? Run a scenario'}
        </span>
        {active
          ? <X className="h-3.5 w-3.5 shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
      </button>

      {active && (
        <div className="px-4 py-3 border-t border-border/40 space-y-3">
          {!hasSnapshot ? (
            <p className="text-xs text-muted-foreground text-center py-1">
              Complete your financial snapshot to enable scenario planning.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Extra monthly savings</span>
                  <span className="font-semibold tabular-nums">+${extraSavings.toLocaleString()}/mo</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2000}
                  step={50}
                  value={extraSavings}
                  onChange={handleSlider}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground/50">
                  <span>$0</span><span>$2,000/mo</span>
                </div>
              </div>

              {extraSavings > 0 ? (
                <div className="flex items-start gap-2 text-xs rounded-lg bg-accent/10 text-accent px-3 py-2">
                  <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Capacity becomes{' '}
                    <strong>${newCapacity.toLocaleString()}/wk</strong>
                    {insight && <> · {insight}</>}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center">
                  Drag to see how extra savings reshapes your timeline
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Phase station ──────────────────────────────────────────────────────────────

function PhaseStation({
  phase, isOpen, isCurrent, onToggle, onAction, onAskCoach,
  actionLoading, whatIfMode, whatIfWeeks,
}: {
  phase: RoadmapPhase;
  isOpen: boolean;
  isCurrent: boolean;
  onToggle: () => void;
  onAction: (id: string, status: MilestoneStatus) => Promise<void>;
  onAskCoach: (prompt: string) => void;
  actionLoading: string | null;
  whatIfMode: boolean;
  whatIfWeeks: Map<string, [number, number] | null>;
}) {
  const phaseComplete = phase.completedCount === phase.totalCount && phase.totalCount > 0;
  const isLocked = !phase.isUnlocked;

  const ringClass   = PHASE_RINGS[phase.id]   ?? 'ring-gray-400';
  const borderClass = PHASE_BORDERS[phase.id] ?? 'border-gray-400';

  const nodeBase = 'absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-all';
  const nodeCls = phaseComplete
    ? `${nodeBase} ${phase.colorClass} text-white`
    : isCurrent
    ? `${nodeBase} ${phase.colorClass} text-white ring-2 ring-offset-2 ring-offset-background ${ringClass}`
    : isLocked
    ? `${nodeBase} bg-muted border border-border/60 text-muted-foreground/40`
    : `${nodeBase} bg-background border-2 ${borderClass} ${phase.textClass ?? 'text-foreground'}`;

  return (
    <div className="relative pl-12 pb-0.5">
      <div className={nodeCls}>
        {phaseComplete
          ? <CheckCircle2 className="h-4 w-4" />
          : isLocked
          ? <Lock className="h-3 w-3" />
          : <span>{phase.id}</span>}
      </div>

      <button
        onClick={onToggle}
        disabled={isLocked}
        className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
          isCurrent   ? 'bg-primary/5 hover:bg-primary/10'
          : phaseComplete ? 'opacity-60 hover:opacity-90 hover:bg-muted/20'
          : isLocked  ? 'opacity-35 cursor-default'
          : 'hover:bg-muted/30'
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-sm font-semibold ${isCurrent ? phase.textClass ?? '' : 'text-foreground'}`}>
              {phase.title}
            </span>
            {isCurrent && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0">Now</Badge>
            )}
            {phaseComplete && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 py-0 text-accent border-accent/20">
                Done
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{phase.subtitle}</p>
        </div>
        {!isLocked && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-muted-foreground tabular-nums">
              {phase.completedCount}/{phase.totalCount}
            </span>
            {isOpen
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        )}
      </button>

      {isOpen && !isLocked && (
        <div className="mt-1 space-y-1 border-l border-border/40 ml-3 pl-3">
          {phase.milestones.map(m => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              onAction={onAction}
              onAskCoach={onAskCoach}
              isLoading={actionLoading === m.id}
              whatIfWeeks={whatIfMode ? whatIfWeeks.get(m.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Milestone row ──────────────────────────────────────────────────────────────

function MilestoneRow({
  milestone, onAction, onAskCoach, isLoading, whatIfWeeks,
}: {
  milestone: RoadmapMilestone;
  onAction: (id: string, status: MilestoneStatus) => Promise<void>;
  onAskCoach: (prompt: string) => void;
  isLoading: boolean;
  whatIfWeeks?: [number, number] | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const haptics = useHaptics();
  const isLocked = milestone.state === 'locked';

  const delta = useMemo((): number | null => {
    if (!milestone.estimatedWeeks || whatIfWeeks == null) return null;
    const real = (milestone.estimatedWeeks[0] + milestone.estimatedWeeks[1]) / 2;
    const sim  = (whatIfWeeks[0] + whatIfWeeks[1]) / 2;
    const d = Math.round(sim - real);
    return d !== 0 ? d : null;
  }, [milestone.estimatedWeeks, whatIfWeeks]);

  const handleExpand = () => {
    if (isLocked) return;
    haptics.tick();
    setExpanded(v => !v);
  };

  return (
    <div className={`rounded-md border transition-colors ${
      isLocked            ? 'border-transparent opacity-35'
      : milestone.state === 'complete'    ? 'border-border/30 bg-muted/5'
      : milestone.state === 'skipped'     ? 'border-border/20 opacity-55'
      : milestone.state === 'in_progress' ? 'border-primary/25 bg-primary/5'
      : 'border-border/40 hover:border-border'
    }`}>
      <button
        className="w-full flex items-start gap-2.5 px-3 py-2 text-left"
        onClick={handleExpand}
        disabled={isLocked}
      >
        <StateIcon state={milestone.state} className="mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className={`text-sm leading-snug ${
            milestone.state === 'complete' ? 'line-through text-muted-foreground' : 'font-medium text-foreground'
          }`}>
            {milestone.title}
          </p>
          <TimelineHint milestone={milestone} whatIfWeeks={whatIfWeeks} delta={delta} />
        </div>
        {!isLocked && (
          expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
        )}
      </button>

      {expanded && !isLocked && (
        <div className="px-3 pb-3 space-y-2.5">
          <p className="text-xs text-muted-foreground">{milestone.description}</p>
          <p className="text-xs text-muted-foreground italic border-l-2 border-primary/25 pl-2">
            {milestone.why}
          </p>
          {milestone.evidence && milestone.state !== 'complete' && (
            <EvidenceNote
              evidence={milestone.evidence}
              disabled={isLoading}
              onConfirm={() => onAction(milestone.id, 'complete')}
            />
          )}
          <div className="flex flex-wrap gap-1.5">
            {(milestone.state === 'available' || milestone.state === 'in_progress') && (
              <>
                {milestone.state === 'available' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={isLoading}
                    onClick={() => onAction(milestone.id, 'in_progress')}>
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <PlayCircle className="h-3 w-3 mr-1" />}
                    Start
                  </Button>
                )}
                <Button size="sm" className="h-7 text-xs" disabled={isLoading}
                  onClick={() => onAction(milestone.id, 'complete')}>
                  {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                  Mark done
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" disabled={isLoading}
                  onClick={() => onAction(milestone.id, 'skipped')}>
                  <SkipForward className="h-3 w-3 mr-1" />Skip
                </Button>
              </>
            )}
            {milestone.state === 'complete' && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" disabled={isLoading}
                onClick={() => onAction(milestone.id, 'in_progress')}>
                Reopen
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs"
              onClick={() => onAskCoach(milestone.coachPrompt)}>
              <MessageCircle className="h-3 w-3 mr-1" />Ask Coach
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function StateIcon({ state, className }: { state: MilestoneState; className?: string }) {
  switch (state) {
    case 'complete':    return <CheckCircle2 className={`h-4 w-4 text-accent ${className}`} />;
    case 'skipped':     return <SkipForward  className={`h-4 w-4 text-muted-foreground ${className}`} />;
    case 'in_progress': return <PlayCircle   className={`h-4 w-4 text-primary ${className}`} />;
    case 'locked':      return <Lock         className={`h-4 w-4 text-muted-foreground/40 ${className}`} />;
    default:            return <Circle       className={`h-4 w-4 text-muted-foreground ${className}`} />;
  }
}

function TimelineHint({
  milestone, whatIfWeeks, delta,
}: {
  milestone: RoadmapMilestone;
  whatIfWeeks?: [number, number] | null;
  delta: number | null;
}) {
  if (milestone.state === 'complete' && milestone.completedAt) {
    const d = new Date(milestone.completedAt).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    return <p className="text-xs text-muted-foreground">Completed {d}</p>;
  }
  if (milestone.state === 'locked') {
    return <p className="text-xs text-muted-foreground">Complete prior phase to unlock</p>;
  }

  const display = whatIfWeeks ?? milestone.estimatedWeeks;
  // Guard: typicalWeeks may be undefined for milestones that don't require snapshot
  const [min, max] = milestone.typicalWeeks ?? [null, null];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3 shrink-0" />
        {display
          ? `~${display[0]}–${display[1]} wks${whatIfWeeks ? ' (scenario)' : ' at your rate'}`
          : min !== null && max !== null
            ? `~${min}–${max} wks typical`
            : 'Timeline varies'}
      </p>
      {delta !== null && (
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
          delta < 0
            ? 'bg-accent/10 text-accent'
            : 'bg-destructive/10 text-destructive'
        }`}>
          {delta < 0 ? `${delta} wks` : `+${delta} wks`}
        </span>
      )}
    </div>
  );
}
