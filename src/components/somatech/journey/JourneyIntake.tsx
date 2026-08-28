import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, HelpCircle, AlertTriangle, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { JourneyDef, IntakeQuestion } from './journeyConfig';
import type { JourneyDraft } from '@/hooks/useJourney';
import { useHaptics } from '@/hooks/useHaptics';
import ItemizedExpenseInput, { type ExpenseItem } from './ItemizedExpenseInput';
import { formatCurrencyInput, parseCurrencyInput } from '@/lib/journeyMoney';

interface JourneyIntakeProps {
  journey:       JourneyDef;
  draft:         JourneyDraft;
  isDraftStale:  boolean;
  onAnswer:      (questionId: string, value: string | number) => void;
  onBack:        () => void;
  onComplete:    () => void;
  /** Question IDs pre-filled from Personal Finance data — shown with a review badge. */
  prefilledIds?: string[];
}

function WhyBlock({ question }: { question: IntakeQuestion }) {
  const [open, setOpen] = useState(false);
  const haptics = useHaptics();

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => { haptics.tick(); setOpen(o => !o); }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
        Why we ask this
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="mt-2.5 space-y-2.5 rounded-xl border border-border/50 bg-muted/30 p-3.5">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">What is this?</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{question.what}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Why it matters</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{question.why}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">How to find it</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{question.how}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const JourneyIntake = ({ journey, draft, isDraftStale, onAnswer, onBack, onComplete, prefilledIds }: JourneyIntakeProps) => {
  const haptics = useHaptics();
  const questions = journey.questions;

  // Resume from the first unanswered question — avoids skipping questions added since the draft was saved
  const [step, setStep] = useState(() => {
    const first = questions.findIndex(q => draft.answers[q.id] === undefined);
    return first === -1 ? questions.length - 1 : first;
  });

  const [displayValues, setDisplayValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    questions.forEach(q => {
      if (q.type === 'itemized') return; // managed separately
      const saved = draft.answers[q.id];
      if (saved !== undefined) {
        init[q.id] = q.type === 'currency'
          ? Number(saved).toLocaleString(undefined, { maximumFractionDigits: 2 })
          : String(saved);
      }
    });
    return init;
  });

  // Itemized questions keep their own items array, seeded from draft.answers[id + '_items'] JSON.
  // Validates the parsed value is an array of objects with id/name/amount — protects against
  // corrupted drafts or future schema changes passing a non-array (e.g. JSON.parse("123") = 123).
  const [itemizedValues, setItemizedValues] = useState<Record<string, ExpenseItem[]>>(() => {
    const init: Record<string, ExpenseItem[]> = {};
    questions.filter(q => q.type === 'itemized').forEach(q => {
      const raw = draft.answers[q.id + '_items'];
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          init[q.id] = Array.isArray(parsed)
            ? (parsed as unknown[]).filter(
                (item): item is ExpenseItem =>
                  typeof item === 'object' && item !== null &&
                  typeof (item as Record<string, unknown>).id     === 'string' &&
                  typeof (item as Record<string, unknown>).name   === 'string' &&
                  typeof (item as Record<string, unknown>).amount === 'number' &&
                  isFinite((item as Record<string, unknown>).amount as number) &&
                  ((item as Record<string, unknown>).amount as number) >= 0
              )
            : [];
        } catch {
          init[q.id] = [];
        }
      } else {
        init[q.id] = [];
      }
    });
    return init;
  });

  const question = questions[step];
  const rawValue = displayValues[question.id] ?? '';

  const isValid = (() => {
    // Itemized questions are always valid — zero items means $0 in that category, which is fine
    if (question.type === 'itemized') return true;
    if (question.type === 'select') return !!rawValue;
    if (rawValue === '') return false;
    const num = question.type === 'currency' ? parseCurrencyInput(rawValue) : parseFloat(rawValue);
    if (isNaN(num)) return false;
    if (question.min !== undefined && num < question.min) return false;
    if (question.max !== undefined && num > question.max) return false;
    return true;
  })();

  const rangeHint = (() => {
    if (question.type === 'itemized' || question.type === 'select' || rawValue === '') return null;
    const num = question.type === 'currency' ? parseCurrencyInput(rawValue) : parseFloat(rawValue);
    if (isNaN(num)) return null;
    if (question.min !== undefined && num < question.min)
      return `Must be at least ${question.prefix ?? ''}${question.min}${question.suffix ?? ''}`;
    if (question.max !== undefined && num > question.max)
      return `Must be at most ${question.prefix ?? ''}${question.max}${question.suffix ?? ''}`;
    return null;
  })();

  const handleChange = (val: string) => {
    if (question.type === 'currency') {
      const formatted = formatCurrencyInput(val);
      setDisplayValues(prev => ({ ...prev, [question.id]: formatted }));
      onAnswer(question.id, parseCurrencyInput(formatted));
    } else if (question.type === 'percent' || question.type === 'number') {
      setDisplayValues(prev => ({ ...prev, [question.id]: val }));
      const num = parseFloat(val);
      if (!isNaN(num)) onAnswer(question.id, num);
    } else {
      setDisplayValues(prev => ({ ...prev, [question.id]: val }));
      onAnswer(question.id, val);
    }
  };

  // Itemized: save total + JSON items list into separate draft keys
  const handleItemsChange = useCallback((qId: string, items: ExpenseItem[]) => {
    setItemizedValues(prev => ({ ...prev, [qId]: items }));
    const total = items.reduce((sum, i) => sum + i.amount, 0);
    onAnswer(qId, total);
    onAnswer(qId + '_items', JSON.stringify(items));
  }, [onAnswer]);

  const goNext = () => {
    if (!isValid) return;
    haptics.tap();
    if (step < questions.length - 1) {
      setStep(s => s + 1);
    } else {
      haptics.success();
      onComplete();
    }
  };

  const goBack = () => {
    haptics.tick();
    if (step === 0) onBack();
    else setStep(s => s - 1);
  };

  const progress = ((step + 1) / questions.length) * 100;

  return (
    <div className="space-y-6">
      {/* Stale draft warning */}
      {isDraftStale && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/20/30 bg-warning/100/10 px-3.5 py-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-warning leading-relaxed">
            These answers are over 30 days old — your numbers may have changed. Review each answer before continuing.
          </p>
        </div>
      )}

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium">
            {journey.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {step + 1} / {questions.length}
          </p>
        </div>
        <div className="h-1 rounded-full bg-border">
          <div
            className="h-1 rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-foreground leading-snug">{question.label}</h3>
          {prefilledIds?.includes(question.id) && (
            <div className="flex items-center gap-1.5 text-[11px] text-primary/80 bg-primary/6 border border-primary/15 rounded-lg px-2.5 py-1.5">
              <Database className="h-3 w-3 shrink-0" />
              Pre-filled from your saved financial data — review before continuing
            </div>
          )}
        </div>

        {question.type === 'itemized' ? (
          <ItemizedExpenseInput
            items={itemizedValues[question.id] ?? []}
            onChange={items => handleItemsChange(question.id, items)}
            itemPlaceholder={question.itemPlaceholder}
          />
        ) : question.type === 'select' ? (
          <Select value={rawValue} onValueChange={handleChange}>
            <SelectTrigger className="h-14 text-base rounded-xl border-border/70 bg-background">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              {question.options?.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="py-3">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="relative">
            {question.prefix && (
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-lg pointer-events-none select-none">
                {question.prefix}
              </span>
            )}
            <Input
              inputMode={question.type === 'currency' || question.type === 'percent' ? 'decimal' : 'numeric'}
              placeholder={question.placeholder}
              value={rawValue}
              onChange={e => handleChange(e.target.value)}
              onKeyDown={e => !e.isComposing && e.key === 'Enter' && goNext()}
              className={`h-14 text-lg rounded-xl border-border/70 bg-background font-semibold ${
                question.prefix ? 'pl-10' : ''
              } ${question.suffix ? 'pr-10' : ''}`}
              autoFocus={false}
            />
            {question.suffix && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-lg pointer-events-none select-none">
                {question.suffix}
              </span>
            )}
          </div>
        )}

        {rangeHint && (
          <p className="text-xs text-destructive font-medium -mt-1">{rangeHint}</p>
        )}

        <WhyBlock question={question} />
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={goBack}
          className="h-12 px-4 rounded-xl border-border/70 flex items-center gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          className="flex-1 h-12 text-base rounded-xl flex items-center justify-center gap-2 font-semibold"
          disabled={!isValid}
          onClick={goNext}
        >
          {step < questions.length - 1 ? (
            <>Next <ChevronRight className="h-4 w-4" /></>
          ) : (
            'See my plan →'
          )}
        </Button>
      </div>
    </div>
  );
};

export default JourneyIntake;
