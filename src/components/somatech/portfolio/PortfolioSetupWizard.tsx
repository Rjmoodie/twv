import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { usePortfolio } from '@/contexts/PortfolioContext'
import {
  GOAL_LABELS,
  GOAL_DESCRIPTIONS,
  BUCKET_LABELS,
  DEFAULT_ALLOCATIONS,
  DEFAULT_CONSTRAINTS,
  type GoalType,
  type AllocationTarget,
  type AssetBucket,
} from '@/types/portfolio'
import { GOAL_METADATA } from '@/services/portfolio/portfolioService'
import type { InvestmentGoalRecord } from '@/services/investmentGoalService'
import {
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  DollarSign,
  Shield,
  BarChart2,
  Search,
  Scale,
  Check,
  AlertCircle,
  Target,
} from 'lucide-react'

interface AllocationPreset {
  name: string
  description: string
  author?: string
  allocations: AllocationTarget[]
}

const STANDARD_PRESETS: AllocationPreset[] = [
  {
    name: '60/40 Classic',
    description: 'Traditional balanced portfolio balancing growth with stability.',
    allocations: [
      { bucket: 'US_EQUITY_LARGE', target_pct: 60, min_pct: 50, max_pct: 70 },
      { bucket: 'FIXED_INCOME_INVESTMENT_GRADE', target_pct: 40, min_pct: 30, max_pct: 50 },
    ],
  },
  {
    name: 'Three-Fund',
    description: 'Broad global equity with a small bond buffer — simple and low-cost.',
    allocations: [
      { bucket: 'US_EQUITY_LARGE', target_pct: 60, min_pct: 50, max_pct: 70 },
      { bucket: 'INTL_EQUITY_DEVELOPED', target_pct: 30, min_pct: 20, max_pct: 40 },
      { bucket: 'FIXED_INCOME_INVESTMENT_GRADE', target_pct: 10, min_pct: 5, max_pct: 20 },
    ],
  },
  {
    name: 'All Weather',
    author: 'Ray Dalio',
    description: 'Designed to perform across all economic environments: growth, recession, inflation, deflation.',
    allocations: [
      { bucket: 'US_EQUITY_LARGE', target_pct: 30, min_pct: 20, max_pct: 40 },
      { bucket: 'FIXED_INCOME_INVESTMENT_GRADE', target_pct: 40, min_pct: 30, max_pct: 55 },
      { bucket: 'FIXED_INCOME_HIGH_YIELD', target_pct: 15, min_pct: 10, max_pct: 25 },
      { bucket: 'REAL_ASSETS', target_pct: 15, min_pct: 5, max_pct: 25 },
    ],
  },
  {
    name: '90/10',
    author: 'Warren Buffett',
    description: 'Aggressive equity exposure for long horizons; cash buffer for opportunistic buying.',
    allocations: [
      { bucket: 'US_EQUITY_LARGE', target_pct: 90, min_pct: 80, max_pct: 95 },
      { bucket: 'CASH', target_pct: 10, min_pct: 5, max_pct: 20 },
    ],
  },
  {
    name: 'Permanent Portfolio',
    author: 'Harry Browne',
    description: 'Equal weight across four uncorrelated assets — thrives in any macro regime.',
    allocations: [
      { bucket: 'US_EQUITY_LARGE', target_pct: 25, min_pct: 20, max_pct: 30 },
      { bucket: 'FIXED_INCOME_INVESTMENT_GRADE', target_pct: 25, min_pct: 20, max_pct: 30 },
      { bucket: 'REAL_ASSETS', target_pct: 25, min_pct: 20, max_pct: 30 },
      { bucket: 'CASH', target_pct: 25, min_pct: 20, max_pct: 30 },
    ],
  },
  {
    name: 'Aggressive Growth',
    description: 'High equity concentration across US and international markets for maximum long-run compounding.',
    allocations: [
      { bucket: 'US_EQUITY_LARGE', target_pct: 50, min_pct: 40, max_pct: 65 },
      { bucket: 'US_EQUITY_SMALL', target_pct: 20, min_pct: 10, max_pct: 30 },
      { bucket: 'INTL_EQUITY_DEVELOPED', target_pct: 20, min_pct: 10, max_pct: 30 },
      { bucket: 'ALTERNATIVES', target_pct: 10, min_pct: 5, max_pct: 20 },
    ],
  },
]

const BUCKET_COLORS: Record<AssetBucket, string> = {
  US_EQUITY_LARGE: 'bg-blue-500',
  US_EQUITY_SMALL: 'bg-blue-400',
  INTL_EQUITY_DEVELOPED: 'bg-indigo-400',
  INTL_EQUITY_EMERGING: 'bg-violet-400',
  FIXED_INCOME_INVESTMENT_GRADE: 'bg-emerald-500',
  FIXED_INCOME_HIGH_YIELD: 'bg-emerald-400',
  REAL_ASSETS: 'bg-amber-400',
  ALTERNATIVES: 'bg-orange-400',
  CASH: 'bg-slate-400',
}

const GOAL_ICONS: Record<GoalType, React.ReactNode> = {
  quality_growth:       <TrendingUp className="w-5 h-5" />,
  total_return:         <BarChart2 className="w-5 h-5" />,
  dividend_income:      <DollarSign className="w-5 h-5" />,
  capital_preservation: <Shield className="w-5 h-5" />,
  deep_value:           <Search className="w-5 h-5" />,
  balanced:             <Scale className="w-5 h-5" />,
}

const GOALS = Object.keys(GOAL_LABELS) as GoalType[]

const RISK_LABELS = ['Very Conservative', 'Conservative', 'Moderate', 'Aggressive', 'Very Aggressive']

interface WizardState {
  name: string
  goal: GoalType | null
  horizon_years: number
  risk_tolerance: number
  risk_capacity: number
  initial_capital: string
  allocations: AllocationTarget[]
}

interface Props {
  onComplete?: () => void
  investmentGoal?: InvestmentGoalRecord | null
}

const riskScore = (risk: InvestmentGoalRecord['risk_profile']): 1 | 3 | 5 =>
  risk === 'conservative' ? 1 : risk === 'growth' ? 5 : 3

const policyGoal = (risk: InvestmentGoalRecord['risk_profile']): GoalType =>
  risk === 'conservative' ? 'capital_preservation' : risk === 'growth' ? 'total_return' : 'balanced'

export default function PortfolioSetupWizard({ onComplete, investmentGoal }: Props) {
  const { createPortfolio } = usePortfolio()
  const [step, setStep] = useState(investmentGoal ? 1 : 0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [state, setState] = useState<WizardState>({
    name: investmentGoal ? `$${investmentGoal.target_amount.toLocaleString()} Goal Portfolio` : '',
    goal: investmentGoal ? policyGoal(investmentGoal.risk_profile) : null,
    horizon_years: investmentGoal?.horizon_years ?? 10,
    risk_tolerance: investmentGoal ? riskScore(investmentGoal.risk_profile) : 3,
    risk_capacity: 3,
    initial_capital: investmentGoal ? String(investmentGoal.current_balance) : '',
    allocations: investmentGoal ? [...DEFAULT_ALLOCATIONS[policyGoal(investmentGoal.risk_profile)]] : [],
  })

  function update<K extends keyof WizardState>(key: K, val: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: val }))
  }

  function selectGoal(goal: GoalType) {
    setState((prev) => ({
      ...prev,
      goal,
      allocations: [...DEFAULT_ALLOCATIONS[goal]],
    }))
    setStep(1)
  }

  function adjustAllocation(bucket: AssetBucket, newPct: number) {
    setState((prev) => ({
      ...prev,
      allocations: prev.allocations.map((a) =>
        a.bucket === bucket ? { ...a, target_pct: newPct } : a
      ),
    }))
  }

  const allocationTotal = state.allocations.reduce((s, a) => s + a.target_pct, 0)
  const allocationValid = Math.abs(allocationTotal - 100) < 1

  async function handleCreate() {
    if (!state.goal || !allocationValid) return
    setSaving(true)
    setSaveError(null)
    try {
      await createPortfolio({
        name:               state.name.trim(),
        goal:               state.goal,
        horizon_years:      state.horizon_years,
        risk_tolerance:     state.risk_tolerance as 1 | 2 | 3 | 4 | 5,
        risk_capacity:      state.risk_capacity as 1 | 2 | 3 | 4 | 5,
        initial_capital:    state.initial_capital ? parseFloat(state.initial_capital) : undefined,
        investment_goal_id: investmentGoal?.id,
        target_amount: investmentGoal?.target_amount,
        monthly_contribution: investmentGoal?.monthly_contribution,
        target_allocations: state.allocations,
        constraints:        DEFAULT_CONSTRAINTS,
      })
      onComplete?.()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create portfolio. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const steps = ['Goal', 'Horizon & Risk', 'Name & Capital', 'Allocations']

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {investmentGoal && (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <div className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Investment Journey connected</p></div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Review the proposed policy for your ${investmentGoal.target_amount.toLocaleString()} target over {investmentGoal.horizon_years} years, starting with ${investmentGoal.current_balance.toLocaleString()} and ${investmentGoal.monthly_contribution.toLocaleString()}/month. Nothing is invested until you approve and act on a deployment plan.
          </p>
        </div>
      )}
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2 transition-colors ${
              i < step ? 'bg-primary border-primary text-primary-foreground'
              : i === step ? 'border-primary text-primary bg-background'
              : 'border-muted text-muted-foreground bg-background'
            }`}>
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {i < steps.length - 1 && <div className={`h-px flex-1 ${i < step ? 'bg-primary' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: Goal selection — auto-advances on click, no nav needed */}
      {step === 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">What's your primary investing goal?</h2>
          <p className="text-sm text-muted-foreground">Click a goal to continue. This determines which research models and filters are applied.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GOALS.map((goal) => {
              const meta = GOAL_METADATA[goal]
              const selected = state.goal === goal
              return (
                <Card
                  key={goal}
                  onClick={() => selectGoal(goal)}
                  className={`cursor-pointer transition-all border-2 hover:border-primary/50 ${selected ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center gap-2 font-medium ${selected ? 'text-primary' : ''}`}>
                        {GOAL_ICONS[goal]}
                        {GOAL_LABELS[goal]}
                      </div>
                      {selected && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{GOAL_DESCRIPTIONS[goal]}</p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{meta.typical_horizon}</Badge>
                      <Badge variant="outline" className="text-xs">Risk {meta.risk_range}</Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 1: Horizon & Risk */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Horizon & Risk Profile</h2>

          <div className="space-y-3">
            <Label>Time Horizon — <span className="text-primary font-semibold">{state.horizon_years} years</span></Label>
            <Slider
              min={1} max={40} step={1}
              value={[state.horizon_years]}
              onValueChange={([v]) => update('horizon_years', v)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1yr (short-term)</span>
              <span>20yr</span>
              <span>40yr (generational)</span>
            </div>
            {state.horizon_years >= 10 && (
              <p className="text-xs text-blue-600 dark:text-blue-400">Long horizon: moat durability and ROIIC weighted higher in research filters.</p>
            )}
            {state.horizon_years <= 3 && (
              <p className="text-xs text-warning dark:text-warning">Short horizon: balance sheet strength and earnings quality filters tightened.</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Risk Tolerance — <span className="text-primary font-semibold">{RISK_LABELS[state.risk_tolerance - 1]}</span></Label>
            <p className="text-xs text-muted-foreground">Your <em>willingness</em> to accept volatility (subjective).</p>
            <Slider
              min={1} max={5} step={1}
              value={[state.risk_tolerance]}
              onValueChange={([v]) => update('risk_tolerance', v as 1|2|3|4|5)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Very Conservative</span>
              <span>Moderate</span>
              <span>Very Aggressive</span>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Risk Capacity — <span className="text-primary font-semibold">{RISK_LABELS[state.risk_capacity - 1]}</span></Label>
            <p className="text-xs text-muted-foreground">Your <em>ability</em> to absorb losses without derailing goals (income, expenses, dependents).</p>
            <Slider
              min={1} max={5} step={1}
              value={[state.risk_capacity]}
              onValueChange={([v]) => update('risk_capacity', v as 1|2|3|4|5)}
            />
          </div>

          {state.risk_tolerance !== state.risk_capacity && (
            <p className="text-xs bg-warning/10 dark:bg-warning/15/30 text-warning dark:text-warning rounded p-2 border border-warning/20 dark:border-warning/20">
              Your effective risk constraint is <strong>{RISK_LABELS[Math.min(state.risk_tolerance, state.risk_capacity) - 1]}</strong> — the binding limit is always the lower of tolerance and capacity.
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button onClick={() => setStep(2)} className="bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80">
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Name & Capital */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">Name your portfolio</h2>
          <div className="space-y-2">
            <Label htmlFor="port-name">Portfolio name</Label>
            <Input
              id="port-name"
              placeholder={`My ${GOAL_LABELS[state.goal!]} Portfolio`}
              value={state.name}
              onChange={(e) => update('name', e.target.value)}
              maxLength={60}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="port-capital">Initial capital (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="port-capital"
                type="number"
                placeholder="100,000"
                className="pl-7"
                value={state.initial_capital}
                onChange={(e) => update('initial_capital', e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">Used to compute dollar amounts for allocation gaps and position sizing.</p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={state.name.trim().length < 2} className="bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80">
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Allocations */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Target allocations</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Start from a preset or build your own mix. Must total 100%.
              </p>
            </div>
            <Badge variant={allocationValid ? 'default' : 'destructive'} className="flex-shrink-0 mt-1">
              {allocationTotal.toFixed(0)}% of 100%
            </Badge>
          </div>

          {/* Goal-suggested preset */}
          {state.goal && (
            <div
              onClick={() => {
                setState(prev => ({ ...prev, allocations: [...DEFAULT_ALLOCATIONS[state.goal!]] }))
                setActivePreset('suggested')
              }}
              className={`rounded-lg border-2 p-3 cursor-pointer transition-all space-y-2 ${
                activePreset === 'suggested'
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-muted/30 hover:border-primary/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activePreset === 'suggested' && <Check className="w-3.5 h-3.5 text-primary" />}
                  <p className="text-xs font-semibold text-foreground">
                    Suggested for {GOAL_LABELS[state.goal]}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">Goal-based</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {state.goal === 'deep_value' && 'Equity-heavy with small-cap tilt to capture mispriced assets.'}
                {state.goal === 'quality_growth' && 'Large-cap dominant with international diversification.'}
                {state.goal === 'total_return' && 'Diversified equity with a bond buffer for rebalancing.'}
                {state.goal === 'dividend_income' && 'Income-oriented with REITs and investment-grade bonds.'}
                {state.goal === 'capital_preservation' && 'Bond-heavy to protect principal and limit drawdown.'}
                {state.goal === 'balanced' && 'Classic 60/40-style split across equity and fixed income.'}
              </p>
              <div className="flex h-2 rounded-full overflow-hidden gap-px">
                {DEFAULT_ALLOCATIONS[state.goal].map((a) => (
                  <div
                    key={a.bucket}
                    className={`${BUCKET_COLORS[a.bucket]} transition-all`}
                    style={{ width: `${a.target_pct}%` }}
                    title={`${BUCKET_LABELS[a.bucket]}: ${a.target_pct}%`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {DEFAULT_ALLOCATIONS[state.goal].map((a) => (
                  <span key={a.bucket} className="text-xs text-muted-foreground">
                    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${BUCKET_COLORS[a.bucket]}`} />
                    {BUCKET_LABELS[a.bucket]} {a.target_pct}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Standard presets */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Classic Frameworks</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STANDARD_PRESETS.map((preset) => (
                <div
                  key={preset.name}
                  onClick={() => {
                    setState(prev => ({ ...prev, allocations: [...preset.allocations] }))
                    setActivePreset(preset.name)
                  }}
                  className={`rounded-lg border-2 p-3 cursor-pointer transition-all space-y-1.5 ${
                    activePreset === preset.name
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {activePreset === preset.name && <Check className="w-3 h-3 text-primary" />}
                      <span className="text-sm font-semibold">{preset.name}</span>
                    </div>
                    {preset.author && (
                      <span className="text-xs text-muted-foreground">{preset.author}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{preset.description}</p>
                  <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                    {preset.allocations.map((a) => (
                      <div
                        key={a.bucket}
                        className={`${BUCKET_COLORS[a.bucket]}`}
                        style={{ width: `${a.target_pct}%` }}
                        title={`${BUCKET_LABELS[a.bucket]}: ${a.target_pct}%`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                    {preset.allocations.map((a) => (
                      <span key={a.bucket} className="text-xs text-muted-foreground">
                        {BUCKET_LABELS[a.bucket]} {a.target_pct}%
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom sliders */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Fine-tune your mix
            </p>
            <div className="space-y-4">
              {state.allocations.map((a) => {
                const suggested = state.goal ? DEFAULT_ALLOCATIONS[state.goal].find(d => d.bucket === a.bucket) : null
                const outOfRange = suggested && (a.target_pct < suggested.min_pct || a.target_pct > suggested.max_pct)
                return (
                  <div key={a.bucket} className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${BUCKET_COLORS[a.bucket]}`} />
                        <span className="font-medium">{BUCKET_LABELS[a.bucket]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {suggested && (
                          <span className={`text-xs ${outOfRange ? 'text-warning dark:text-warning' : 'text-muted-foreground'}`}>
                            suggested {suggested.min_pct}–{suggested.max_pct}%
                          </span>
                        )}
                        <span className={`font-semibold tabular-nums w-8 text-right ${outOfRange ? 'text-warning dark:text-warning' : 'text-primary'}`}>
                          {a.target_pct}%
                        </span>
                      </div>
                    </div>
                    <Slider
                      min={0} max={80} step={1}
                      value={[a.target_pct]}
                      onValueChange={([v]) => {
                        adjustAllocation(a.bucket, v)
                        setActivePreset(null)
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {!allocationValid && (
            <p className="text-xs text-destructive">Allocations must sum to 100%. Currently at {allocationTotal.toFixed(1)}%.</p>
          )}

          {saveError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {saveError}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button onClick={handleCreate} disabled={!allocationValid || saving} className="bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80">
              {saving ? 'Creating…' : 'Create Portfolio'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
