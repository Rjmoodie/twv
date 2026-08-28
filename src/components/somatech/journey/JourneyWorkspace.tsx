import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Check, ChevronDown, Database, GitBranch,
  FileDown, Loader2, MessageCircle, Save, Share2, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { JourneyDef } from './journeyConfig';
import type { JourneyDraft } from '@/hooks/useJourney';
import type { JourneyPlanRecord } from '@/services/journeyPlanService';
import { analyzeJourney, describeMetricDelta } from '@/lib/journeyMetrics';
import { formatCurrencyInput, formatMoney, parseCurrencyInput } from '@/lib/journeyMoney';
import ItemizedExpenseInput, { type ExpenseItem } from './ItemizedExpenseInput';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { printJourneyPlan } from '@/lib/journeyExport';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface JourneyWorkspaceProps {
  journey: JourneyDef;
  draft: JourneyDraft;
  plan: JourneyPlanRecord | null;
  plans: JourneyPlanRecord[];
  availableMonthlySurplus: number | null;
  otherActiveCommitments: number;
  onAnswer: (questionId: string, value: string | number) => void;
  onPersist: (answers: Record<string, string | number>) => Promise<void>;
  onActivate: () => Promise<void>;
  onBranch: (name: string) => Promise<void>;
  onSelectPlan: (plan: JourneyPlanRecord) => void;
  onBack: () => void;
  onShare: () => void;
  onAskCoach?: () => void;
  onOpenInsights?: () => void;
}

function readItems(value: string | number | undefined): ExpenseItem[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(item =>
      item && typeof item.id === 'string' && typeof item.name === 'string' && Number.isFinite(item.amount)
    ) : [];
  } catch { return []; }
}

export default function JourneyWorkspace({
  journey, draft, plan, plans, availableMonthlySurplus, otherActiveCommitments,
  onAnswer, onPersist, onActivate, onBranch, onSelectPlan, onBack, onShare, onAskCoach, onOpenInsights,
}: JourneyWorkspaceProps) {
  const analysis = useMemo(() => analyzeJourney(journey, draft.answers), [journey, draft.answers]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(() => plan?.updated_at ? new Date(plan.updated_at) : null);
  const [activationPending, setActivationPending] = useState(false);
  const [scenarioPending, setScenarioPending] = useState(false);
  const [currencyInputs, setCurrencyInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(journey.questions
      .filter(question => question.type === 'currency')
      .map(question => [question.id, formatCurrencyInput(String(draft.answers[question.id] ?? ''))])),
  );
  const latestAnswers = useRef(draft.answers);
  const onPersistRef = useRef(onPersist);
  const saveQueue = useRef(Promise.resolve());
  const firstAutosave = useRef(true);
  latestAnswers.current = draft.answers;
  onPersistRef.current = onPersist;

  useEffect(() => {
    setCurrencyInputs(Object.fromEntries(journey.questions
      .filter(question => question.type === 'currency')
      .map(question => [question.id, formatCurrencyInput(String(draft.answers[question.id] ?? ''))])));
    setSavedAt(plan?.updated_at ? new Date(plan.updated_at) : null);
  // A selected plan is a new editing document; ordinary keystrokes remain local.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey, plan?.id]);

  const relatedPlans = plans.filter(item => item.journey_id === journey.id);
  const baseline = relatedPlans.find(item => item.is_baseline) ?? null;
  const baselineAnalysis = plan?.parent_plan_id && baseline
    ? analyzeJourney(journey, baseline.answers)
    : null;
  const hasUnappliedChanges = plan?.status === 'active' && plan.activated_revision !== plan.revision;

  const totalCommitment = analysis.monthlyCommitment + otherActiveCommitments;
  const overCommittedBy = availableMonthlySurplus === null || analysis.monthlyCommitment <= 0
    ? 0
    : Math.max(0, totalCommitment - availableMonthlySurplus);

  useEffect(() => {
    if (firstAutosave.current) { firstAutosave.current = false; return; }
    const timer = window.setTimeout(() => {
      const snapshot = latestAnswers.current;
      setSaveState('saving');
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(() => onPersistRef.current(snapshot))
        .then(() => {
          setSavedAt(new Date());
          setSaveState(latestAnswers.current === snapshot ? 'saved' : 'saving');
        })
        .catch(() => setSaveState('error'));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draft.answers]);

  const changeSimple = (questionId: string, type: string, raw: string) => {
    if (type === 'currency') {
      const displayValue = formatCurrencyInput(raw);
      setCurrencyInputs(current => ({ ...current, [questionId]: displayValue }));
      onAnswer(questionId, parseCurrencyInput(displayValue));
    }
    else if (type === 'select') onAnswer(questionId, raw);
    else {
      const value = Number.parseFloat(raw);
      if (Number.isFinite(value)) onAnswer(questionId, value);
    }
  };

  const createScenario = async () => {
    const name = window.prompt('Name this scenario', `Scenario ${relatedPlans.length}`)?.trim();
    if (!name) return;
    setScenarioPending(true);
    try {
      await onBranch(name);
    } catch (error) {
      toast({
        title: 'Scenario could not be created',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally { setScenarioPending(false); }
  };

  const activate = async () => {
    setActivationPending(true);
    try {
      await onActivate();
    } catch (error) {
      toast({
        title: 'Plan was not activated',
        description: error instanceof Error ? error.message : 'Your draft remains saved. Please try again.',
        variant: 'destructive',
      });
    } finally { setActivationPending(false); }
  };

  const exportPlan = () => {
    try {
      printJourneyPlan({
        journey,
        planName: plan?.name ?? 'Local plan',
        answers: draft.answers,
        analysis,
        baselineName: baseline?.name ?? 'Baseline',
        baselineAnalysis,
      });
    } catch (error) {
      toast({
        title: 'Export could not open',
        description: error instanceof Error ? error.message : 'Please allow pop-ups and try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 pb-24 pt-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/50 bg-card px-4 py-3">
        <button onClick={onBack} className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Back to journeys">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', journey.colorBg)}>
          <Sparkles className={cn('h-4 w-4', journey.colorIcon)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold">{journey.title}</h1>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              plan?.status === 'active' ? 'bg-accent/15 text-accent' : plan?.parent_plan_id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}
            >{hasUnappliedChanges ? 'Unapplied edits' : plan?.status === 'active' ? 'Active plan' : plan?.parent_plan_id ? 'Scenario' : 'Draft plan'}</span>
          </div>
          <p className="text-xs text-muted-foreground">Edit assumptions, understand the consequences, then activate only what you intend to execute.</p>
        </div>

        {relatedPlans.length > 1 && plan && (
          <Select value={plan.id} onValueChange={id => {
            const selected = relatedPlans.find(item => item.id === id);
            if (selected) onSelectPlan(selected);
          }}>
            <SelectTrigger className="h-9 w-[180px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {relatedPlans.map(item => <SelectItem key={item.id} value={item.id}>{item.name}{item.is_baseline ? ' · baseline' : ''}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex min-w-[115px] items-center justify-end gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          {saveState === 'saving' && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving</>}
          {saveState === 'saved' && <><Check className="h-3.5 w-3.5 text-accent" /> Saved{savedAt ? ` ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</>}
          {saveState === 'error' && <><AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Save failed</>}
          {saveState === 'idle' && <><Save className="h-3.5 w-3.5" /> Autosave on</>}
        </div>
      </div>

      {availableMonthlySurplus !== null && analysis.monthlyCommitment > 0 && (
        <div className={cn('flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm',
          overCommittedBy > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-accent/20 bg-accent/5')}
        >
          {overCommittedBy > 0 ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <Check className="h-4 w-4 text-accent" />}
          <div className="flex-1">
            <span className="font-medium">Monthly capacity check: </span>
            <span className="text-muted-foreground">
              {formatMoney(totalCommitment)} committed across active goals versus {formatMoney(availableMonthlySurplus)} current surplus.
              {overCommittedBy > 0 && ` Resolve the ${formatMoney(overCommittedBy)} gap before activation.`}
            </span>
          </div>
          {onOpenInsights && <button onClick={onOpenInsights} className="text-xs font-medium text-primary hover:underline">Review cash flow</button>}
        </div>
      )}

      <details className="sticky top-0 z-20 overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-sm backdrop-blur lg:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Live plan consequence</span>
            <span className="mt-0.5 block truncate text-sm font-semibold">
              {analysis.errors.length > 0
                ? 'Review inputs to recalculate'
                : `${analysis.metrics[0]?.label ?? 'Monthly commitment'}: ${analysis.metrics[0]?.value ?? formatMoney(analysis.monthlyCommitment)}`}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </summary>
        <div className="grid gap-2 border-t border-border/40 p-3 sm:grid-cols-2">
          {analysis.errors.length > 0 ? (
            <p className="text-xs text-destructive">{analysis.errors.join(' ')}</p>
          ) : analysis.metrics.map(metric => (
            <div key={metric.id} className="rounded-xl bg-muted/25 px-3 py-2">
              <p className="text-[10px] text-muted-foreground">{metric.label}</p>
              <p className="mt-0.5 text-sm font-semibold">{metric.value}</p>
            </div>
          ))}
        </div>
      </details>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
        <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-4 sm:p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your numbers and assumptions</p>
            <p className="mt-1 text-xs text-muted-foreground">Source labels distinguish linked financial facts from manual planning choices.</p>
          </div>

          {journey.questions.map(question => {
            const value = draft.answers[question.id];
            const metadata = plan?.input_metadata[question.id];
            const isLinked = metadata ? metadata.linked : draft.prefilledIds?.includes(question.id);
            return (
              <div key={question.id} className="space-y-2 rounded-2xl border border-border/35 bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label htmlFor={`workspace-${question.id}`} className="text-sm font-medium">{question.label}</Label>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{question.why}</p>
                  </div>
                  {isLinked && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/8 px-2 py-1 text-[10px] text-primary">
                      <Database className="h-3 w-3" /> Linked actual
                    </span>
                  )}
                </div>

                {question.type === 'itemized' ? (
                  <ItemizedExpenseInput
                    items={readItems(draft.answers[`${question.id}_items`])}
                    itemPlaceholder={question.itemPlaceholder}
                    onChange={items => {
                      onAnswer(question.id, items.reduce((sum, item) => sum + item.amount, 0));
                      onAnswer(`${question.id}_items`, JSON.stringify(items));
                    }}
                  />
                ) : question.type === 'select' ? (
                  <Select value={String(value ?? '')} onValueChange={next => changeSimple(question.id, question.type, next)}>
                    <SelectTrigger id={`workspace-${question.id}`} className="h-11 rounded-xl"><SelectValue placeholder="Select an option" /></SelectTrigger>
                    <SelectContent>{question.options?.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <div className="relative">
                    {question.prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{question.prefix}</span>}
                    <Input
                      id={`workspace-${question.id}`}
                      inputMode={question.type === 'currency' || question.type === 'percent' ? 'decimal' : 'numeric'}
                      value={question.type === 'currency' ? (currencyInputs[question.id] ?? '') : String(value ?? '')}
                      onChange={event => changeSimple(question.id, question.type, event.target.value)}
                      className={cn('h-11 rounded-xl font-medium', question.prefix && 'pl-7', question.suffix && 'pr-12')}
                    />
                    {question.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{question.suffix}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <aside className="hidden space-y-4 lg:sticky lg:top-4 lg:block lg:self-start">
          <section className="space-y-4 rounded-2xl border border-border/50 bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your operating plan</p>
                <p className="mt-1 text-xs text-muted-foreground">Recomputed from the latest valid inputs.</p>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Live</span>
            </div>

            {analysis.errors.length > 0 && (
              <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive">
                {analysis.errors.join(' ')}
              </div>
            )}

            <div className="space-y-2.5">
              {analysis.metrics.map(metric => {
                const baselineMetric = baselineAnalysis?.metrics.find(item => item.id === metric.id);
                const delta = baselineMetric ? describeMetricDelta(baselineMetric, metric) : null;
                return (
                  <div key={metric.id} className={cn('rounded-2xl border p-4', metric.highlight ? `${journey.colorBg} ${journey.colorAccent}` : 'border-border/40 bg-muted/15')}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground">{metric.label}</p>
                        <p className={cn('mt-1 text-xl font-bold tracking-tight', metric.highlight && journey.colorIcon)}>{metric.value}</p>
                      </div>
                      <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full',
                        metric.status === 'good' ? 'bg-accent' : metric.status === 'watch' ? 'bg-warning' : metric.status === 'risk' ? 'bg-destructive' : 'bg-muted-foreground/40')} />
                    </div>
                    {metric.sub && <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{metric.sub}</p>}
                    {delta && (
                      <p className={cn('mt-2 text-[11px] font-medium', delta.favorable === false ? 'text-warning' : delta.favorable === true ? 'text-accent' : 'text-primary')}>
                        {delta.label} vs baseline{delta.favorable === true ? ' · improves plan' : delta.favorable === false ? ' · worsens plan' : ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {analysis.assumptions.length > 0 && (
              <details className="rounded-xl border border-border/35 bg-muted/10 px-3 py-2.5 text-xs">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">Model assumptions <ChevronDown className="h-3.5 w-3.5" /></summary>
                <div className="mt-2 space-y-1 text-muted-foreground">
                  {analysis.assumptions.map(assumption => <p key={assumption.id}>{assumption.label}: {assumption.value}</p>)}
                </div>
              </details>
            )}

            <div className="grid gap-2 pt-1 sm:grid-cols-2">
              <Button onClick={activate} disabled={activationPending || analysis.errors.length > 0 || overCommittedBy > 0} className="gap-2">
                {activationPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {hasUnappliedChanges ? 'Apply changes' : plan?.status === 'active' ? 'Re-apply plan' : 'Activate plan'}
              </Button>
              <Button variant="outline" onClick={createScenario} disabled={!plan || scenarioPending} className="gap-2">
                {scenarioPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />} New scenario
              </Button>
              {onAskCoach && <Button variant="outline" onClick={onAskCoach} className="gap-2"><MessageCircle className="h-4 w-4" /> Discuss with Coach</Button>}
              <Button variant="outline" onClick={exportPlan} className="gap-2"><FileDown className="h-4 w-4" /> {baselineAnalysis ? 'Export comparison' : 'Export PDF'}</Button>
              <Button variant="outline" onClick={onShare} disabled={plan?.status !== 'active' || hasUnappliedChanges} className="gap-2"><Share2 className="h-4 w-4" /> Share progress</Button>
            </div>
            <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
              Autosave changes this document. Activation is the explicit action that updates connected goals, actions, and calendar milestones.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
