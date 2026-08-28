import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Sparkles, Plus, Trash2, Wand2 } from 'lucide-react';
import { NetWorthSnapshot, MonthlyCashFlow, ScenarioModel, computeNetWorth, computeCashFlow, UsePersonalFinanceReturn } from '@/hooks/usePersonalFinance';
import { cn } from '@/lib/utils';

// ── Life-event scenario templates ─────────────────────────────────────────────
// Each maps a real-world question into the existing ScenarioModel fields.
interface ScenarioTemplate {
  name:  string;
  emoji: string;
  description: string;
  income_change_pct:     number;
  expense_change_pct:    number;
  one_time_cost:         number;
  extra_monthly_savings: number;
  color: string;
}

const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  { name: 'New Job',           emoji: '💼', description: '+15% income boost',           income_change_pct: 15,   expense_change_pct: 0,   one_time_cost: 0,      extra_monthly_savings: 0,   color: '#10b981' },
  { name: 'Promotion',         emoji: '🚀', description: '+25% income boost',           income_change_pct: 25,   expense_change_pct: 5,   one_time_cost: 0,      extra_monthly_savings: 0,   color: '#6366f1' },
  { name: 'Job Loss',          emoji: '⚡', description: 'Income drops to zero',        income_change_pct: -100, expense_change_pct: -20, one_time_cost: 0,      extra_monthly_savings: 0,   color: '#ef4444' },
  { name: 'Move Cities',       emoji: '🏠', description: '+20% higher cost of living',  income_change_pct: 0,    expense_change_pct: 20,  one_time_cost: 3000,   extra_monthly_savings: 0,   color: '#f59e0b' },
  { name: 'Buy a Car',         emoji: '🚗', description: '$5k down + $400/mo costs',    income_change_pct: 0,    expense_change_pct: 0,   one_time_cost: 5000,   extra_monthly_savings: -400, color: '#8b5cf6' },
  { name: 'Aggressive Saving', emoji: '🏦', description: 'Cut 20% expenses, save more', income_change_pct: 0,    expense_change_pct: -20, one_time_cost: 0,      extra_monthly_savings: 300, color: '#3b82f6' },
  { name: 'Invest More',       emoji: '📈', description: '+$500/mo to investments',     income_change_pct: 0,    expense_change_pct: 0,   one_time_cost: 0,      extra_monthly_savings: 500, color: '#14b8a6' },
  { name: 'Emergency Expense', emoji: '🚨', description: '$5k unexpected cost',         income_change_pct: 0,    expense_change_pct: 0,   one_time_cost: 5000,   extra_monthly_savings: 0,   color: '#ef4444' },
  { name: 'Start a Business',  emoji: '🏗️', description: '-30% income, +$1k/mo costs', income_change_pct: -30,  expense_change_pct: 0,   one_time_cost: 10000,  extra_monthly_savings: 0,   color: '#f59e0b' },
  { name: 'Reduce Spending',   emoji: '✂️', description: 'Cut 15% across the board',   income_change_pct: 0,    expense_change_pct: -15, one_time_cost: 0,      extra_monthly_savings: 0,   color: '#06b6d4' },
];

const fmt  = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtK = (n: number) => {
  const abs = Math.abs(n);
  return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(0)}k`;
};

function projectNetWorth(
  startNetWorth: number,
  monthlyIncome: number,
  monthlyExpenses: number,
  scenario: ScenarioModel,
  months: number
): number[] {
  // Clamp income floor at 0 — can't earn negative income
  const adjIncome   = Math.max(0, monthlyIncome * (1 + scenario.income_change_pct / 100));
  const adjExpenses = monthlyExpenses * (1 + scenario.expense_change_pct / 100);
  const monthlySavings = adjIncome - adjExpenses + scenario.extra_monthly_savings;

  let nw = startNetWorth;
  const series: number[] = [nw];

  for (let m = 1; m <= months; m++) {
    const oneTime = m === 1 ? -scenario.one_time_cost : 0;
    // Positive NW earns 6% annual (0.5%/mo); negative NW accrues 7% annual debt cost (0.583%/mo)
    const growthRate = nw > 0 ? 0.005 : 0.00583;
    nw = nw + monthlySavings + oneTime + nw * growthRate;
    series.push(nw);
  }
  return series;
}

function deduplicateNames(scenarios: ScenarioModel[]): string[] {
  const counts: Record<string, number> = {};
  const seen:   Record<string, number> = {};
  scenarios.forEach(s => { counts[s.name] = (counts[s.name] ?? 0) + 1; });
  return scenarios.map(s => {
    if (counts[s.name] <= 1) return s.name;
    seen[s.name] = (seen[s.name] ?? 0) + 1;
    return seen[s.name] === 1 ? s.name : `${s.name} (${seen[s.name]})`;
  });
}

const SCENARIO_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4'];

// Hoisted outside component — stable type identity prevents slider remount on parent re-render
interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}

function SliderField({ label, value, onChange, min, max, step, suffix = '%' }: SliderFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className={cn('text-xs font-mono font-medium', value > 0 ? 'text-accent' : value < 0 ? 'text-destructive' : 'text-muted-foreground')}>
          {value > 0 ? '+' : ''}{suffix === '%' ? `${value}%` : fmt(value)}
        </span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="w-full" />
    </div>
  );
}

export default function ScenarioSection({ snapshots, cashFlows, scenarios, saveScenario, deleteScenario }: {
  snapshots:      NetWorthSnapshot[];
  cashFlows:      MonthlyCashFlow[];
  scenarios:      ScenarioModel[];
  saveScenario:   UsePersonalFinanceReturn['saveScenario'];
  deleteScenario: UsePersonalFinanceReturn['deleteScenario'];
}) {
  const { toast } = useToast();
  const [showBuilder, setShowBuilder] = useState(false);
  const [newScenario, setNewScenario] = useState<Omit<ScenarioModel, 'id' | 'is_preset'>>({
    name: '',
    income_change_pct: 0,
    expense_change_pct: 0,
    one_time_cost: 0,
    extra_monthly_savings: 0,
    color: '#8b5cf6',
  });

  const latestSnapshot = snapshots[snapshots.length - 1];
  const latestFlow     = cashFlows[cashFlows.length - 1];

  const startNetWorth   = latestSnapshot ? computeNetWorth(latestSnapshot).netWorth : 0;
  const { totalIncome, totalExpenses } = latestFlow ? computeCashFlow(latestFlow) : { totalIncome: 0, totalExpenses: 0 };
  // Show warning only when no data at all has been logged
  const hasBaseline = snapshots.length > 0 || cashFlows.length > 0;

  // Single projection pass — chartRows and milestoneData share the same computed arrays
  const { chartRows, scenarioNames, milestoneData } = useMemo(() => {
    const MONTHS = 60;
    const projections = scenarios.map(s => projectNetWorth(startNetWorth, totalIncome, totalExpenses, s, MONTHS));
    const names = deduplicateNames(scenarios);

    const points = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60];
    const rows = points.map(m => {
      const row: Record<string, number | string> = {
        month: m === 0 ? 'Now' : m < 12 ? `${m}m` : `${m / 12}yr`,
      };
      names.forEach((name, i) => { row[name] = projections[i][m]; });
      return row;
    });

    const milestones = scenarios.map((s, i) => ({
      name: s.name,
      color: s.color,
      yr1: projections[i][12],
      yr3: projections[i][36],
      yr5: projections[i][60],
    }));

    return { chartRows: rows, scenarioNames: names, milestoneData: milestones };
  }, [scenarios, startNetWorth, totalIncome, totalExpenses]);

  // Memoized live preview — only recomputes when builder inputs or baseline change
  const previewProjections = useMemo(() => {
    if (!showBuilder) return null;
    const scenario = { ...newScenario, is_preset: false } as ScenarioModel;
    return [1, 3, 5].map(yr => ({
      yr,
      value: projectNetWorth(startNetWorth, totalIncome, totalExpenses, scenario, yr * 12)[yr * 12],
    }));
  }, [showBuilder, newScenario, startNetWorth, totalIncome, totalExpenses]);

  const handleSave = async () => {
    if (!newScenario.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' }); return;
    }
    try {
      await saveScenario({ ...newScenario, is_preset: false });
      setShowBuilder(false);
      setNewScenario({ name: '', income_change_pct: 0, expense_change_pct: 0, one_time_cost: 0, extra_monthly_savings: 0, color: '#8b5cf6' });
      toast({ title: 'Scenario saved' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {!hasBaseline && (
        <div className="rounded-2xl border border-warning/20/30 bg-warning/100/10 px-4 py-3 text-sm text-warning">
          Log at least one month of net worth and cash flow data to see personalised projections.
          Showing illustrative projections with $0 baseline.
        </div>
      )}

      {/* Projection chart */}
      <Card className="app-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">5-Year Net Worth Projection</CardTitle>
          <CardDescription>
            Starting from {fmt(startNetWorth)} · {fmt(totalIncome)}/mo income · 6% annual return on positive net worth, 7% cost on debt
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scenarios.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
              No scenarios yet — add one below.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartRows} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} width={56} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {scenarioNames.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name}
                    stroke={scenarios[i]?.color || SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                    strokeWidth={2} dot={false} strokeDasharray={i > 0 ? '5 3' : undefined} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Milestone table */}
      <Card className="app-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Projected Net Worth Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          {scenarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a scenario to see milestone projections.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Scenario</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">1 Year</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">3 Years</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">5 Years</th>
                  </tr>
                </thead>
                <tbody>
                  {milestoneData.map(row => (
                    <tr key={row.name} className="border-b border-border/30 last:border-0">
                      <td className="py-2.5 flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                        {row.name}
                      </td>
                      <td className="py-2.5 text-right font-mono">{fmt(row.yr1)}</td>
                      <td className="py-2.5 text-right font-mono">{fmt(row.yr3)}</td>
                      <td className="py-2.5 text-right font-mono font-medium">{fmt(row.yr5)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scenario cards */}
      {scenarios.length === 0 ? (
        <div className="rounded-2xl border border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
          No scenarios saved. Use the builder below to create your first what-if scenario.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {scenarios.map(s => (
            <Card key={s.id ?? s.name} className="app-card relative">
              <div className="absolute top-3 right-3 w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
              <CardContent className="pt-4 space-y-1.5">
                <p className="text-sm font-semibold pr-6">{s.name}</p>
                <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                  {s.income_change_pct !== 0 && (
                    <span>Income: <span className={s.income_change_pct > 0 ? 'text-accent' : 'text-destructive'}>{s.income_change_pct > 0 ? '+' : ''}{s.income_change_pct}%</span></span>
                  )}
                  {s.expense_change_pct !== 0 && (
                    <span>Expenses: <span className={s.expense_change_pct < 0 ? 'text-accent' : 'text-destructive'}>{s.expense_change_pct > 0 ? '+' : ''}{s.expense_change_pct}%</span></span>
                  )}
                  {s.one_time_cost > 0 && (
                    <span>One-time: <span className="text-warning">-{fmt(s.one_time_cost)}</span></span>
                  )}
                  {s.one_time_cost < 0 && (
                    <span>One-time gain: <span className="text-accent">+{fmt(Math.abs(s.one_time_cost))}</span></span>
                  )}
                  {s.extra_monthly_savings > 0 && (
                    <span>+Savings: <span className="text-accent">{fmt(s.extra_monthly_savings)}/mo</span></span>
                  )}
                  {s.income_change_pct === 0 && s.expense_change_pct === 0 && s.one_time_cost === 0 && s.extra_monthly_savings === 0 && (
                    <span className="col-span-2">Baseline — no changes</span>
                  )}
                </div>
                {!s.is_preset && s.id && (
                  <Button size="sm" variant="ghost" onClick={() => deleteScenario(s.id!)} className="absolute bottom-2 right-2 h-7 w-7 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Life-event scenario templates */}
      <Card className="app-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            What-if Templates
          </CardTitle>
          <CardDescription>Tap a life event to instantly add it as a scenario</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SCENARIO_TEMPLATES.map(t => (
              <button
                key={t.name}
                onClick={() => {
                  setNewScenario({
                    name: t.name,
                    income_change_pct: t.income_change_pct,
                    expense_change_pct: t.expense_change_pct,
                    one_time_cost: t.one_time_cost,
                    extra_monthly_savings: t.extra_monthly_savings,
                    color: t.color,
                  });
                  setShowBuilder(true);
                }}
                className="flex flex-col items-start gap-1 p-3 rounded-xl border border-border/50 bg-card hover:border-border hover:bg-muted/30 transition-all text-left"
              >
                <span className="text-lg leading-none">{t.emoji}</span>
                <span className="text-[12px] font-semibold text-foreground leading-snug">{t.name}</span>
                <span className="text-[11px] text-muted-foreground leading-snug">{t.description}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom scenario builder */}
      <Card className="app-card">
        <CardHeader className="cursor-pointer pb-3" onClick={() => setShowBuilder(b => !b)}>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Build Custom Scenario
            </span>
            <Plus className={cn('h-4 w-4 text-muted-foreground transition-transform', showBuilder && 'rotate-45')} />
          </CardTitle>
          <CardDescription>Model any what-if: career change, big purchase, lifestyle shift</CardDescription>
        </CardHeader>
        {showBuilder && (
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs">Scenario Name</Label>
              <Input
                placeholder="e.g. Start Business, Move Abroad, Coast FIRE…"
                value={newScenario.name}
                onChange={e => setNewScenario(s => ({ ...s, name: e.target.value }))}
                className="text-sm"
              />
            </div>

            <SliderField label="Income change" value={newScenario.income_change_pct}
              onChange={v => setNewScenario(s => ({ ...s, income_change_pct: v }))} min={-100} max={100} step={5} />

            <SliderField label="Expense change" value={newScenario.expense_change_pct}
              onChange={v => setNewScenario(s => ({ ...s, expense_change_pct: v }))} min={-50} max={100} step={5} />

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">One-time cost / gain (month 1)</Label>
              <Input type="number" placeholder="e.g. 5000 cost or -10000 for a gain"
                value={newScenario.one_time_cost || ''}
                onChange={e => setNewScenario(s => ({ ...s, one_time_cost: parseFloat(e.target.value) || 0 }))}
                className="text-sm font-mono" />
            </div>

            <SliderField label="Extra monthly savings" value={newScenario.extra_monthly_savings}
              onChange={v => setNewScenario(s => ({ ...s, extra_monthly_savings: v }))} min={0} max={3000} step={50} suffix="$" />

            {/* Live preview */}
            <div className="rounded-xl bg-muted/40 border border-border/60 px-4 py-3 text-sm space-y-1">
              <p className="text-xs text-muted-foreground font-medium mb-2">5-Year Preview</p>
              {previewProjections?.map(({ yr, value }) => (
                <div key={yr} className="flex justify-between">
                  <span className="text-muted-foreground">{yr} year{yr > 1 ? 's' : ''}</span>
                  <span className="font-mono font-medium">{fmt(value)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowBuilder(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} className="gap-2">
                <Plus className="h-3.5 w-3.5" /> Add Scenario
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
