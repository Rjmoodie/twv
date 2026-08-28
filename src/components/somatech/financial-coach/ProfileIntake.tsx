import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { FinancialProfile } from '@/hooks/useFinancialCoach';
import { ChevronRight, CheckCircle2 } from 'lucide-react';

interface ProfileIntakeProps {
  onComplete: (profile: FinancialProfile) => void;
}

type SelectStep = {
  type?: 'select';
  id: keyof FinancialProfile;
  question: string;
  optional?: boolean;
  options: { label: string; value: string | number | boolean }[];
};

type TextStep = {
  type: 'text';
  id: keyof FinancialProfile;
  question: string;
  optional?: boolean;
  placeholder: string;
};

type Step = SelectStep | TextStep;

const STEPS: Step[] = [
  {
    type: 'text',
    id: 'display_name',
    question: "What should I call you?",
    placeholder: "Your first name",
    optional: true,
  },
  {
    id: 'age',
    question: "How old are you?",
    options: [
      { label: 'Under 25', value: 22 },
      { label: '25–34', value: 29 },
      { label: '35–44', value: 39 },
      { label: '45–54', value: 49 },
      { label: '55–64', value: 59 },
      { label: '65+', value: 67 },
    ],
  },
  {
    id: 'income_range',
    question: "What's your approximate annual household income?",
    options: [
      { label: 'Under $30k', value: '<30k' },
      { label: '$30k – $60k', value: '30-60k' },
      { label: '$60k – $100k', value: '60-100k' },
      { label: '$100k – $200k', value: '100-200k' },
      { label: 'Over $200k', value: '>200k' },
    ],
  },
  {
    id: 'marital_status',
    question: "What's your relationship status?",
    options: [
      { label: 'Single', value: 'single' },
      { label: 'Married', value: 'married' },
      { label: 'Partnered', value: 'partnered' },
      { label: 'Divorced', value: 'divorced' },
      { label: 'Widowed', value: 'widowed' },
    ],
  },
  {
    id: 'dependents',
    question: "Do you have financial dependents?",
    options: [
      { label: 'None', value: 0 },
      { label: '1', value: 1 },
      { label: '2', value: 2 },
      { label: '3+', value: 3 },
    ],
  },
  {
    id: 'employment_type',
    question: "How would you describe your employment?",
    options: [
      { label: 'Employed (W2)', value: 'employed' },
      { label: 'Self-employed / Freelance', value: 'self-employed' },
      { label: 'Business owner', value: 'business-owner' },
      { label: 'Student', value: 'student' },
      { label: 'Retired', value: 'retired' },
      { label: 'Not currently working', value: 'unemployed' },
    ],
  },
  {
    id: 'housing_status',
    question: "What's your current housing situation?",
    options: [
      { label: 'Renting', value: 'renting' },
      { label: 'I own my home', value: 'owning' },
      { label: 'Living with family', value: 'living-with-family' },
      { label: 'Other', value: 'other' },
    ],
  },
  {
    id: 'current_savings_range',
    question: "Roughly, how much do you have saved or invested?",
    options: [
      { label: 'Under $5k', value: '<5k' },
      { label: '$5k – $25k', value: '5-25k' },
      { label: '$25k – $100k', value: '25-100k' },
      { label: '$100k – $500k', value: '100-500k' },
      { label: 'Over $500k', value: '>500k' },
    ],
  },
  {
    id: 'has_emergency_fund',
    question: "Do you have an emergency fund (3–6 months of expenses)?",
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
      { label: 'Working on it', value: false },
    ],
  },
  {
    id: 'has_retirement_account',
    question: "Do you have a retirement account (401k, IRA, Roth IRA)?",
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
  },
  {
    id: 'risk_tolerance',
    question: "If your investments dropped 25% tomorrow, what would you do?",
    options: [
      { label: "Sell — I can't stomach that loss", value: 'conservative' },
      { label: "Hold and wait it out", value: 'moderate' },
      { label: "Buy more — it's on sale", value: 'aggressive' },
    ],
  },
  {
    id: 'primary_concern',
    question: "What's the #1 thing on your mind financially right now?",
    options: [
      { label: 'Saving more money', value: 'saving-more' },
      { label: 'Investing smarter', value: 'investing' },
      { label: 'Buying a home', value: 'buying-home' },
      { label: 'Planning for retirement', value: 'retirement' },
      { label: 'Getting out of debt', value: 'debt' },
      { label: 'Reducing my tax bill', value: 'tax' },
      { label: 'Something else', value: 'other' },
    ],
  },
];

export default function ProfileIntake({ onComplete }: ProfileIntakeProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<FinancialProfile>>({});
  const [selected, setSelected] = useState<string | number | boolean | null>(null);
  const [textValue, setTextValue] = useState('');
  const [animating, setAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentStep = STEPS[step];
  const isTextStep = currentStep.type === 'text';
  const progress = (step / STEPS.length) * 100;
  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    if (isTextStep) {
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [step, isTextStep]);

  const canAdvance = isTextStep
    ? (currentStep.optional || textValue.trim().length > 0)
    : selected !== null;

  const advance = () => {
    const value = isTextStep ? (textValue.trim() || undefined) : selected;
    const updated = value !== undefined
      ? { ...answers, [currentStep.id]: value }
      : { ...answers };
    setAnswers(updated);

    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      setSelected(null);
      setTextValue('');
      if (isLast) {
        onComplete({ ...updated, completed_intake: true });
      } else {
        setStep((s) => s + 1);
      }
    }, 180);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canAdvance) advance();
  };

  return (
    <div className="flex flex-col h-full items-center justify-center px-6 py-8 max-w-lg mx-auto">
      {/* Progress */}
      <div className="w-full mb-8">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>Profile setup</span>
          <span>{step + 1} of {STEPS.length}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div
        className={cn(
          "w-full transition-all duration-200",
          animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        )}
      >
        <h2 className="text-xl font-semibold text-foreground mb-6 leading-snug">
          {currentStep.question}
          {currentStep.optional && (
            <span className="text-sm font-normal text-muted-foreground ml-2">(optional)</span>
          )}
        </h2>

        {isTextStep ? (
          <Input
            ref={inputRef}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={(currentStep as TextStep).placeholder}
            className="text-base h-12 rounded-xl"
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {(currentStep as SelectStep).options.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setSelected(opt.value)}
                className={cn(
                  "w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all duration-150",
                  selected === opt.value
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                    : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <span className="flex items-center gap-3">
                  {selected === opt.value && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        )}

        <Button
          className="w-full mt-6 gap-2"
          onClick={advance}
          disabled={!canAdvance}
          size="lg"
        >
          {isLast ? 'Start coaching' : 'Next'}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
