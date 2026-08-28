import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Sun, Wrench, Building2, Plus, Minus } from 'lucide-react';

interface Props {
  prefill?: { initialInvestment?: number; discountRate?: number };
}

const QUICK_EXAMPLES = [
  {
    label: 'Solar panels',
    icon: Sun,
    initialInvestment: 10000,
    cashFlows: [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500],
    discountRate: 7,
  },
  {
    label: 'Equipment upgrade',
    icon: Wrench,
    initialInvestment: 50000,
    cashFlows: [12000, 14000, 16000, 16000, 14000, 12000, 10000],
    discountRate: 10,
  },
  {
    label: 'Vending machine',
    icon: Building2,
    initialInvestment: 10000,
    cashFlows: [2000, 3000, 5000, 7000],
    discountRate: 8,
  },
];

function calcNPV(initial: number, flows: number[], rate: number): number {
  const r = rate / 100;
  return flows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + r, i + 1), 0) - initial;
}

function calcIRR(initial: number, flows: number[]): number | null {
  if (initial <= 0) return null;
  // IRR only exists if there is at least one sign change in cash flows
  const hasPositive = flows.some((cf) => cf > 0);
  const hasNegative = flows.some((cf) => cf < 0);
  // Conventional: all flows same sign → no IRR
  if (!hasPositive) return null;
  // Also check NPV at lo bound is positive (solution exists in [lo, hi])
  const npvAtLo = flows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + -0.99, i + 1), 0) - initial;
  const npvAtHi = flows.reduce((acc, cf, i) => acc + cf / Math.pow(1 + 10, i + 1), 0) - initial;
  if ((npvAtLo < 0 && npvAtHi < 0) || (npvAtLo > 0 && npvAtHi > 0)) return null;
  // Bisection
  let lo = -0.99, hi = 10;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const npv = flows.reduce((acc, cf, idx) => acc + cf / Math.pow(1 + mid, idx + 1), 0) - initial;
    if (Math.abs(npv) < 0.001) return mid * 100;
    if (npv > 0) lo = mid;
    else hi = mid;
  }
  // Accept if residual is < 0.1% of initial investment
  const finalNpv = flows.reduce((acc, cf, idx) => acc + cf / Math.pow(1 + lo, idx + 1), 0) - initial;
  return Math.abs(finalNpv) < initial * 0.001 ? lo * 100 : null;
}

function calcPayback(initial: number, flows: number[]): number | null {
  let cumulative = 0;
  for (let i = 0; i < flows.length; i++) {
    cumulative += flows[i];
    if (cumulative >= initial) {
      const prev = cumulative - flows[i];
      const fraction = (initial - prev) / flows[i];
      return i + fraction;
    }
  }
  return null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default function CapitalBudgetingTool({ prefill }: Props) {
  const [initialInvestment, setInitialInvestment] = useState(prefill?.initialInvestment ?? 10000);
  const [discountRate, setDiscountRate] = useState([prefill?.discountRate ?? 8]);
  const [cashFlows, setCashFlows] = useState<number[]>([2000, 3000, 5000, 7000]);

  const npv = useMemo(() => calcNPV(initialInvestment, cashFlows, discountRate[0]), [initialInvestment, cashFlows, discountRate]);
  const irr = useMemo(() => calcIRR(initialInvestment, cashFlows), [initialInvestment, cashFlows]);
  const payback = useMemo(() => calcPayback(initialInvestment, cashFlows), [initialInvestment, cashFlows]);

  const worthIt = npv > 0;

  const loadExample = (ex: typeof QUICK_EXAMPLES[0]) => {
    setInitialInvestment(ex.initialInvestment);
    setCashFlows(ex.cashFlows);
    setDiscountRate([ex.discountRate]);
  };

  const updateFlow = (i: number, val: number) => {
    setCashFlows((prev) => prev.map((f, idx) => (idx === i ? val : f)));
  };

  const addYear = () => setCashFlows((prev) => [...prev, prev[prev.length - 1] ?? 0]);
  const removeYear = () => setCashFlows((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const rows = cashFlows.map((cf, i) => {
    const discounted = cf / Math.pow(1 + discountRate[0] / 100, i + 1);
    return { year: i + 1, cf, discounted };
  });

  const totalUndiscounted = cashFlows.reduce((a, b) => a + b, 0) - initialInvestment;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Should you make the investment? Enter your costs and expected cash flows — NPV, IRR, and payback period tell you the answer.
      </p>

      {/* Quick examples */}
      <div className="flex gap-2 flex-wrap">
        {QUICK_EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            onClick={() => loadExample(ex)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <ex.icon className="h-3 w-3" />
            {ex.label}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Initial investment (Year 0 cost)</Label>
          <Input
            type="number"
            value={initialInvestment}
            onChange={(e) => setInitialInvestment(Number(e.target.value))}
            className="font-mono"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>Discount rate</Label>
            <span className="font-mono text-muted-foreground">{discountRate[0]}%</span>
          </div>
          <Slider min={1} max={25} step={0.5} value={discountRate} onValueChange={setDiscountRate} />
          <p className="text-xs text-muted-foreground">Use your required rate of return or cost of capital (typically 7–12%).</p>
        </div>

        {/* Cash flows per year */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Annual cash flows</Label>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={removeYear} disabled={cashFlows.length <= 1}>
                <Minus className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addYear} disabled={cashFlows.length >= 15}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {cashFlows.map((cf, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-10 shrink-0">Yr {i + 1}</span>
                <Input
                  type="number"
                  value={cf}
                  onChange={(e) => updateFlow(i, Number(e.target.value))}
                  className="font-mono text-sm h-8"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-3 gap-2">
        <Card className={npv > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-destructive/10 border-destructive/20'}>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">NPV</p>
            <p className={`text-lg font-bold ${npv > 0 ? 'text-accent' : 'text-destructive'}`}>{fmt(npv)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{npv > 0 ? 'invest' : "don't invest"}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/40 border-border">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">IRR</p>
            <p className="text-lg font-bold">
              {irr != null ? `${irr.toFixed(1)}%` : 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">vs {discountRate[0]}% required</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/40 border-border">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Payback</p>
            <p className="text-lg font-bold">
              {payback != null ? `${payback.toFixed(1)} yrs` : '> ' + cashFlows.length + ' yrs'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">to recover cost</p>
          </CardContent>
        </Card>
      </div>

      {/* Verdict */}
      <div className={`rounded-xl p-4 flex items-start gap-3 ${worthIt ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-destructive/5 border border-destructive/20'}`}>
        {worthIt ? <TrendingUp className="h-5 w-5 text-accent shrink-0 mt-0.5" /> : <TrendingDown className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
        <div className="text-sm">
          <p className="font-semibold">{worthIt ? 'Investment clears the hurdle rate.' : 'Investment does not clear the hurdle rate.'}</p>
          <p className="text-muted-foreground mt-0.5">
            {worthIt
              ? `NPV of ${fmt(npv)} means this project creates value above your ${discountRate[0]}% required return${irr != null ? ` — the true return is ${irr.toFixed(1)}%` : ''}.`
              : `The discounted cash flows don't cover the ${fmt(initialInvestment)} cost at your ${discountRate[0]}% required return. Either improve the cash flows or accept a lower hurdle rate.`}
          </p>
        </div>
      </div>

      {/* Cash flow table */}
      <div className="rounded-xl bg-muted/50 overflow-hidden">
        <div className="grid grid-cols-4 gap-0 text-xs font-medium text-muted-foreground px-4 py-2 border-b border-border">
          <span>Year</span>
          <span className="text-right">Cash flow</span>
          <span className="text-right">Discounted</span>
          <span className="text-right">Cumulative disc.</span>
        </div>
        <div className="divide-y divide-border">
          <div className="grid grid-cols-4 gap-0 px-4 py-2 text-xs bg-destructive/5">
            <span className="font-medium">0</span>
            <span className="text-right font-mono text-destructive">({fmt(initialInvestment)})</span>
            <span className="text-right font-mono text-destructive">({fmt(initialInvestment)})</span>
            <span className="text-right font-mono text-destructive">({fmt(initialInvestment)})</span>
          </div>
          {rows.map((row, i) => {
            const cumDisc = rows.slice(0, i + 1).reduce((s, r) => s + r.discounted, 0) - initialInvestment;
            return (
              <div key={row.year} className="grid grid-cols-4 gap-0 px-4 py-2 text-xs">
                <span className="font-medium">{row.year}</span>
                <span className="text-right font-mono">{fmt(row.cf)}</span>
                <span className="text-right font-mono text-muted-foreground">{fmt(row.discounted)}</span>
                <span className={`text-right font-mono ${cumDisc >= 0 ? 'text-accent' : ''}`}>{fmt(cumDisc)}</span>
              </div>
            );
          })}
          <div className="grid grid-cols-4 gap-0 px-4 py-2 text-xs font-semibold border-t-2 border-border bg-muted/30">
            <span>Total</span>
            <span className="text-right font-mono">{fmt(totalUndiscounted)}</span>
            <span className="text-right font-mono"></span>
            <span className={`text-right font-mono ${npv >= 0 ? 'text-accent' : 'text-destructive'}`}>{fmt(npv)}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        NPV &gt; 0 → invest. IRR &gt; discount rate → invest. Use NPV when choosing between mutually exclusive projects — IRR can mislead when project sizes differ.
      </p>
    </div>
  );
}
