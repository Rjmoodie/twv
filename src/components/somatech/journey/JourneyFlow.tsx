import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getJourney } from './journeyConfig';
import type { JourneyId } from './journeyConfig';
import JourneySelector from './JourneySelector';
import JourneyIntake from './JourneyIntake';
import JourneyWorkspace from './JourneyWorkspace';
import JourneySharePrompt from './JourneySharePrompt';
import {
  loadAllCompletedJourneys,
  mapProfileToJourneyAnswers,
  saveCompletedJourney,
  useJourney,
} from '@/hooks/useJourney';
import type { CompletedJourney, JourneyDraft } from '@/hooks/useJourney';
import { useJourneyPlans } from '@/hooks/useJourneyPlans';
import { useAuth } from '@/components/somatech/AuthProvider';
import { useNavigation } from '@/contexts/NavigationContext';
import { coachService } from '@/services/coachService';
import type { FinancialProfile } from '@/services/coachService';
import { generateJourneyCalendarSeeds } from '@/services/journeyMilestones';
import { calendarSeedKey, reconcileJourneyPlanEvents } from '@/services/financialCalendarService';
import { saveInvestmentGoal } from '@/services/investmentGoalService';
import { journeyPlanService, type JourneyPlanRecord } from '@/services/journeyPlanService';
import { analyzeJourney } from '@/lib/journeyMetrics';
import { usePersonalFinance, computeCashFlow } from '@/hooks/usePersonalFinance';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type FlowStage = 'selector' | 'intake' | 'workspace' | 'share';

function isFlowStage(value: string | null): value is FlowStage {
  return value === 'selector' || value === 'intake' || value === 'workspace' || value === 'share';
}

interface JourneyFlowProps {
  open: boolean;
  onClose: () => void;
  onRequestAuth: () => void;
  onBrowseCommunity?: () => void;
}

function withPlanDefaults(draft: JourneyDraft): JourneyDraft {
  if (draft.journeyId !== 'home-buying') return draft;
  return {
    ...draft,
    answers: { depositPercent: 20, mortgageRate: 6.5, ...draft.answers },
  };
}

function planToCompleted(plan: JourneyPlanRecord): CompletedJourney {
  return {
    journeyId: plan.journey_id,
    answers: plan.answers,
    completedAt: new Date(plan.updated_at).getTime(),
  };
}

export default function JourneyFlow({ open, onClose, onRequestAuth, onBrowseCommunity }: JourneyFlowProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { navigateToModule } = useNavigation();
  const finance = usePersonalFinance();
  const { draft: rawDraft, isDraftStale, startJourney, saveAnswer, attachPlan, clearDraft } = useJourney();
  const draft = rawDraft ? withPlanDefaults(rawDraft) : null;
  const planState = useJourneyPlans(user?.id);
  const [currentPlan, setCurrentPlan] = useState<JourneyPlanRecord | null>(null);
  const currentPlanRef = useRef<JourneyPlanRecord | null>(null);
  const persistChain = useRef<Promise<void>>(Promise.resolve());
  const profileRef = useRef<Partial<FinancialProfile> | null>(null);
  const [stage, setStage] = useState<FlowStage>(() => {
    const routed = searchParams.get('journeyView');
    if (isFlowStage(routed) && (routed === 'selector' || rawDraft)) return routed;
    if (!rawDraft) return 'selector';
    const journey = getJourney(rawDraft.journeyId);
    if (!journey) return 'selector';
    const complete = journey.questions.every(question => rawDraft.answers[question.id] !== undefined);
    return complete ? 'workspace' : 'intake';
  });
  const [discardOpen, setDiscardOpen] = useState(false);

  const navigateStage = useCallback((next: FlowStage, replace = false) => {
    setStage(next);
    const params = new URLSearchParams(searchParams);
    params.set('journeyView', next);
    setSearchParams(params, { replace });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const routed = searchParams.get('journeyView');
    if (isFlowStage(routed) && (routed === 'selector' || rawDraft)) setStage(routed);
  }, [searchParams, rawDraft]);

  useEffect(() => {
    if (searchParams.get('journeyView')) return;
    const params = new URLSearchParams(searchParams);
    params.set('journeyView', stage);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams, stage]);

  useEffect(() => { currentPlanRef.current = currentPlan; }, [currentPlan]);

  useEffect(() => {
    if (!open || !user) return;
    coachService.getProfile(user.id)
      .then(profile => { profileRef.current = profile ?? null; })
      .catch(() => { profileRef.current = null; });
  }, [open, user]);

  useEffect(() => {
    if (!draft || currentPlan || planState.plans.length === 0) return;
    const matching = draft.planId
      ? planState.plans.find(plan => plan.id === draft.planId)
      : planState.plans.find(plan => plan.journey_id === draft.journeyId && (plan.is_baseline || plan.status === 'active'));
    if (matching) setCurrentPlan(matching);
  }, [draft, currentPlan, planState.plans]);

  useEffect(() => {
    if (rawDraft && !getJourney(rawDraft.journeyId)) {
      clearDraft();
      navigateStage('selector', true);
    }
  }, [rawDraft, clearDraft, navigateStage]);

  const completedJourneys = useMemo(() => {
    const combined = loadAllCompletedJourneys();
    for (const plan of planState.plans) {
      if (plan.parent_plan_id === null && (!combined[plan.journey_id] || plan.is_baseline || plan.status === 'active')) {
        combined[plan.journey_id] = planToCompleted(plan);
      }
    }
    return combined;
  }, [planState.plans]);

  const latestFlow = finance.isDemo ? null : finance.cashFlows[finance.cashFlows.length - 1] ?? null;
  const availableMonthlySurplus = latestFlow ? computeCashFlow(latestFlow).surplus : null;
  const otherActiveCommitments = planState.plans
    // Activating a scenario replaces the active plan for the same Journey, so
    // only commitments from other Journeys compete for monthly capacity.
    .filter(plan => plan.status === 'active' && plan.journey_id !== draft?.journeyId)
    .reduce((sum, plan) => sum + Number(plan.monthly_commitment || 0), 0);

  const handleSelect = (id: JourneyId) => {
    const existing = planState.plans.find(plan => plan.journey_id === id && (plan.is_baseline || plan.status === 'active'));
    if (existing) {
      startJourney(id, withPlanDefaults({ journeyId: id, answers: existing.answers, startedAt: Date.now() }).answers, [], undefined, existing.id);
      setCurrentPlan(existing);
      navigateStage('workspace');
      return;
    }
    const profile = profileRef.current;
    if (profile) {
      const { answers, prefilledIds } = mapProfileToJourneyAnswers(id, profile);
      const seeded = withPlanDefaults({ journeyId: id, answers, startedAt: Date.now(), prefilledIds });
      startJourney(id, seeded.answers, prefilledIds, 'profile');
    } else {
      const seeded = withPlanDefaults({ journeyId: id, answers: {}, startedAt: Date.now() });
      startJourney(id, seeded.answers, []);
    }
    setCurrentPlan(null);
    navigateStage('intake');
  };

  const handleViewPlan = (id: JourneyId) => {
    const remote = planState.plans.find(plan => plan.journey_id === id && (plan.is_baseline || plan.status === 'active'));
    const completed = completedJourneys[id];
    if (remote) {
      startJourney(id, withPlanDefaults({ journeyId: id, answers: remote.answers, startedAt: Date.now() }).answers, [], undefined, remote.id);
      setCurrentPlan(remote);
      navigateStage('workspace');
    } else if (completed) {
      startJourney(id, withPlanDefaults({ journeyId: id, answers: completed.answers, startedAt: completed.completedAt }).answers, []);
      setCurrentPlan(null);
      navigateStage('workspace');
    } else {
      handleSelect(id);
    }
  };

  const ensurePlan = useCallback(async (answers: Record<string, string | number>) => {
    if (!user || !draft) return null;
    let plan = currentPlanRef.current;
    const nextDraft = { ...draft, answers };
    if (!plan) {
      plan = await planState.createFromDraft(nextDraft);
    } else if (JSON.stringify(plan.answers) !== JSON.stringify(answers)) {
      const journey = getJourney(draft.journeyId);
      if (!journey) throw new Error('Journey definition unavailable.');
      plan = await planState.update(plan, answers, analyzeJourney(journey, answers));
    }
    if (plan) {
      currentPlanRef.current = plan;
      setCurrentPlan(plan);
      attachPlan(plan.id);
    }
    return plan;
  }, [user, draft, planState, attachPlan]);

  const persistAnswers = useCallback((answers: Record<string, string | number>) => {
    if (!draft) return Promise.resolve();
    const plan = currentPlanRef.current;
    if (!plan || plan.parent_plan_id === null) saveCompletedJourney({ ...draft, answers });
    persistChain.current = persistChain.current
      .catch(() => undefined)
      .then(async () => { await ensurePlan(answers); });
    return persistChain.current;
  }, [draft, ensurePlan]);

  const handleIntakeComplete = async () => {
    if (!draft) return;
    saveCompletedJourney(draft);
    navigateStage('workspace');
    if (user) {
      try { await ensurePlan(draft.answers); }
      catch (cause) {
        toast({ title: 'Plan saved on this device', description: cause instanceof Error ? cause.message : 'Account sync will retry when you edit.', variant: 'destructive' });
      }
    }
  };

  const handleActivate = async () => {
    if (!draft) return;
    if (!user) { onRequestAuth(); return; }
    const journey = getJourney(draft.journeyId);
    if (!journey) return;
    const analysis = analyzeJourney(journey, draft.answers);
    if (analysis.errors.length) {
      toast({ title: 'Review the plan first', description: analysis.errors.join(' '), variant: 'destructive' });
      return;
    }

    await persistAnswers(draft.answers);
    const plan = currentPlanRef.current;
    if (!plan) throw new Error('The plan could not be persisted.');
    const activated = await planState.activate(plan, analysis);
    currentPlanRef.current = activated;
    setCurrentPlan(activated);

    const connectionFailures: string[] = [];
    if (draft.journeyId === 'investor-starter') {
      try {
        await saveInvestmentGoal(user.id, draft.answers);
        await queryClient.invalidateQueries({ queryKey: ['investment-goal', user.id] });
      } catch { connectionFailures.push('Portfolio'); }
    }
    const seeds = generateJourneyCalendarSeeds(draft.journeyId, draft.answers);
    try {
      await reconcileJourneyPlanEvents(user.id, activated.id, activated.revision, seeds);
    } catch { connectionFailures.push('Financial Calendar'); }
    try {
      await journeyPlanService.reconcileActions(activated, seeds.map(seed => ({
        action_key: calendarSeedKey(seed),
        title: seed.title,
        description: seed.description,
        category: seed.category,
        action_type: seed.event_type === 'check_in' ? 'check_in' : seed.event_type === 'coach_reminder' ? 'review' : 'milestone',
        amount: typeof seed.metadata.amount === 'number' ? seed.metadata.amount : null,
        due_date: seed.event_date,
        cadence: seed.event_type === 'check_in' ? 'monthly' : null,
        metadata: seed.metadata,
      })));
    } catch { connectionFailures.push('Dashboard actions'); }

    saveCompletedJourney(draft);
    window.dispatchEvent(new CustomEvent('somatech:journey-plan-updated', { detail: { planId: activated.id } }));
    if (connectionFailures.length) {
      toast({
        title: 'Plan activated; a connection needs retrying',
        description: `${connectionFailures.join(' and ')} did not update. Your plan is active and safe; use Re-apply plan to retry.`,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Operating plan activated',
      description: `Your ${journey.title} actions and milestones are now connected to Calendar${draft.journeyId === 'investor-starter' ? ' and Portfolio' : ''}.`,
    });
  };

  const handleBranch = async (name: string) => {
    if (!draft) return;
    if (!user) { onRequestAuth(); return; }
    await persistAnswers(draft.answers);
    const plan = currentPlanRef.current;
    if (!plan) return;
    const scenario = await planState.branch(plan, name);
    setCurrentPlan(scenario);
    startJourney(scenario.journey_id, scenario.answers, [], undefined, scenario.id);
    toast({ title: 'Scenario created', description: 'Scenario edits remain hypothetical until you activate the plan.' });
  };

  const handleSelectPlan = (plan: JourneyPlanRecord) => {
    setCurrentPlan(plan);
    startJourney(plan.journey_id, withPlanDefaults({ journeyId: plan.journey_id, answers: plan.answers, startedAt: Date.now() }).answers, [], undefined, plan.id);
  };

  const handleShareDone = () => {
    window.dispatchEvent(new CustomEvent('somatech:moment-created'));
    navigateStage('workspace', true);
  };

  const currentJourney = draft ? getJourney(draft.journeyId) : null;

  if (!open) return null;

  if (planState.loading && stage === 'selector') {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      {planState.error && user && (
        <div className="mx-auto mt-4 flex max-w-3xl items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>Account plan storage is unavailable. Your local copy remains intact. {planState.error}</span>
        </div>
      )}

      {stage === 'selector' && (
        <div className="mx-auto max-w-2xl px-4 py-8">
          <JourneySelector
            onSelect={handleSelect}
            onViewPlan={handleViewPlan}
            completedJourneys={completedJourneys}
            onBrowseCommunity={onBrowseCommunity}
          />
          {rawDraft && (
            <button
              type="button"
              onClick={() => setDiscardOpen(true)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Discard current draft
            </button>
          )}
          <button onClick={onClose} className="mt-5 w-full text-center text-xs text-muted-foreground hover:text-foreground">Return to previous screen</button>
        </div>
      )}

      {stage === 'intake' && draft && currentJourney && (
        <div className="mx-auto max-w-xl px-4 py-8">
          <JourneyIntake
            journey={currentJourney}
            draft={draft}
            isDraftStale={isDraftStale}
            onAnswer={saveAnswer}
            onBack={() => navigateStage('selector')}
            onComplete={() => { void handleIntakeComplete(); }}
            prefilledIds={draft.prefilledIds}
          />
        </div>
      )}

      {stage === 'workspace' && draft && currentJourney && (
        <JourneyWorkspace
          journey={currentJourney}
          draft={draft}
          plan={currentPlan}
          plans={planState.plans}
          availableMonthlySurplus={availableMonthlySurplus}
          otherActiveCommitments={otherActiveCommitments}
          onAnswer={saveAnswer}
          onPersist={persistAnswers}
          onActivate={handleActivate}
          onBranch={handleBranch}
          onSelectPlan={handleSelectPlan}
          onBack={() => navigateStage('selector')}
          onShare={() => navigateStage('share')}
          onAskCoach={() => navigateToModule('financial-coach')}
          onOpenInsights={() => navigateToModule('personal-finance')}
        />
      )}

      {stage === 'share' && draft && (
        <div className="mx-auto max-w-lg px-4 py-8">
          <JourneySharePrompt
            draft={draft}
            planId={currentPlan?.status === 'active' && currentPlan.activated_revision === currentPlan.revision ? currentPlan.id : undefined}
            sourceRevision={currentPlan?.status === 'active' && currentPlan.activated_revision === currentPlan.revision ? currentPlan.revision : undefined}
            onDone={handleShareDone}
          />
        </div>
      )}

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this device draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes only the unfinished local draft. Saved account plans and activated actions are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep draft</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { clearDraft(); setCurrentPlan(null); navigateStage('selector', true); }}
            >
              Discard draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
