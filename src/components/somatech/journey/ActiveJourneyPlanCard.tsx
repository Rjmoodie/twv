import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, Check, Loader2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/somatech/AuthProvider';
import { useNavigation } from '@/contexts/NavigationContext';
import { getJourney } from './journeyConfig';
import { formatMoney } from '@/lib/journeyMoney';
import {
  journeyPlanService,
  type JourneyPlanAction,
  type JourneyPlanRecord,
} from '@/services/journeyPlanService';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface ActiveJourneyPlanCardProps {
  currentMonthlySurplus?: number | null;
  compact?: boolean;
}

function formatDueDate(value: string | null): string {
  if (!value) return 'No due date';
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: new Date(`${value}T12:00:00`).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

export default function ActiveJourneyPlanCard({ currentMonthlySurplus, compact = false }: ActiveJourneyPlanCardProps) {
  const { user } = useAuth();
  const { navigateToModule } = useNavigation();
  const [plans, setPlans] = useState<JourneyPlanRecord[]>([]);
  const [actions, setActions] = useState<JourneyPlanAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setPlans([]); setActions([]); return; }
    setLoading(true);
    try {
      const loadedPlans = await journeyPlanService.list(user.id);
      const active = loadedPlans.filter(plan => plan.status === 'active');
      const loadedActions = active.length ? await journeyPlanService.listActions(user.id) : [];
      setPlans(active);
      setActions(loadedActions.filter(action => active.some(plan => plan.id === action.plan_id)));
    } catch {
      // This card is progressive enhancement while the migration rolls out.
      setPlans([]);
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
    window.addEventListener('somatech:journey-plan-updated', load);
    return () => window.removeEventListener('somatech:journey-plan-updated', load);
  }, [load]);

  const monthlyCommitment = plans.reduce((sum, plan) => sum + Number(plan.monthly_commitment || 0), 0);
  const unappliedCount = plans.filter(plan => plan.activated_revision !== plan.revision).length;
  const pending = useMemo(() => actions
    .filter(action => action.status === 'pending')
    .sort((a, b) => (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31')), [actions]);
  const nextAction = pending[0] ?? null;
  const nextPlan = nextAction ? plans.find(plan => plan.id === nextAction.plan_id) : plans[0];
  const overCommittedBy = currentMonthlySurplus == null
    ? 0
    : Math.max(0, monthlyCommitment - currentMonthlySurplus);

  const completeNextAction = async () => {
    if (!nextAction) return;
    setCompletingId(nextAction.id);
    try {
      const completed = await journeyPlanService.setActionStatus(nextAction.id, 'completed');
      setActions(current => current.map(action => action.id === completed.id ? completed : action));
      window.dispatchEvent(new CustomEvent('somatech:journey-plan-updated'));
      toast({ title: 'Action completed', description: 'Your plan and Financial Calendar now reflect the same progress.' });
    } catch (error) {
      toast({
        title: 'Action was not completed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCompletingId(null);
    }
  };

  if (!user || (!loading && plans.length === 0)) return null;

  if (loading && plans.length === 0) {
    return <div className="flex min-h-24 items-center justify-center rounded-2xl border border-border/40 bg-card"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <section className={cn('overflow-hidden rounded-2xl border bg-card', overCommittedBy > 0 ? 'border-destructive/30' : 'border-primary/20')}>
      <div className={cn('flex flex-wrap items-center gap-3 px-4 py-3.5', overCommittedBy > 0 ? 'bg-destructive/5' : 'bg-primary/[0.04]')}>
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', overCommittedBy > 0 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
          {overCommittedBy > 0 ? <AlertTriangle className="h-4 w-4" /> : <Target className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{plans.length === 1 ? getJourney(plans[0].journey_id)?.title : `${plans.length} active operating plans`}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatMoney(monthlyCommitment)}/month committed
            {currentMonthlySurplus != null && ` from ${formatMoney(currentMonthlySurplus)} current surplus`}
            {unappliedCount > 0 && ` · ${unappliedCount} ${unappliedCount === 1 ? 'plan has' : 'plans have'} unapplied edits`}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => navigateToModule('journey')}>
          Open plan <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {overCommittedBy > 0 && (
        <div className="border-t border-destructive/15 px-4 py-2.5 text-xs text-destructive">
          Commitments exceed current monthly surplus by {formatMoney(overCommittedBy)}. Rebalance the plan before adding another goal.
        </div>
      )}

      {!compact && nextAction && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border/35 px-4 py-3.5">
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{nextAction.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {getJourney(nextPlan?.journey_id ?? plans[0].journey_id)?.title} · due {formatDueDate(nextAction.due_date)} · {pending.length} remaining
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={completingId === nextAction.id} onClick={() => void completeNextAction()}>
            {completingId === nextAction.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Complete
          </Button>
        </div>
      )}
    </section>
  );
}
