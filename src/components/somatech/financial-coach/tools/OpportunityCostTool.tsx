import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Coffee, Car, Home } from 'lucide-react';

interface Props {
  prefill?: { amount?: number; years?: number };
}

const QUICK_EXAMPLES = [
  { label: 'Daily coffee', icon: Coffee, amount: 10, years: 40 },
  { label: 'Used car', icon: Car, amount: 15000, years: 30 },
  { label: 'Down payment', icon: Home, amount: 80000, years: 30 },
];

export default function OpportunityCostTool({ prefill }: Props) {
  const [amount, setAmount] = useState(prefill?.amount ?? 10000);
  const [years, setYears] = useState([prefill?.years ?? 30]);
  const [rate, setRate] = useState([7]);

  const futureValue = amount * Math.pow(1 + rate[0] / 100, years[0]);
  const opportunity = futureValue - amount;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const multiplier = (futureValue / amount).toFixed(1);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Every dollar you spend today has a future value shadow. Here's what it's really costing you in compounded terms.
      </p>

      {/* Quick examples */}
      <div className="flex gap-2 flex-wrap">
        {QUICK_EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            onClick={() => { setAmount(ex.amount); setYears([ex.years]); }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <ex.icon className="h-3 w-3" />
            {ex.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Amount spent today</Label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="font-mono"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>Time horizon</Label>
            <span className="font-mono text-muted-foreground">{years[0]} years</span>
          </div>
          <Slider min={5} max={50} step={1} value={years} onValueChange={setYears} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>Expected annual return</Label>
            <span className="font-mono text-muted-foreground">{rate[0]}%</span>
          </div>
          <Slider min={3} max={12} step={0.5} value={rate} onValueChange={setRate} />
          <p className="text-xs text-muted-foreground">Historical S&P 500 average ≈ 7% real return</p>
        </div>
      </div>

      {/* Result */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-5 text-center space-y-2">
          <p className="text-sm text-muted-foreground">That {fmt(amount)} spent today is actually worth</p>
          <p className="text-4xl font-bold text-primary">{fmt(futureValue)}</p>
          <p className="text-sm text-muted-foreground">
            in {years[0]} years — a <strong>{multiplier}×</strong> multiplier
          </p>
        </CardContent>
      </Card>

      <div className="rounded-xl bg-muted/50 p-4 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Amount today</span>
          <span className="font-mono">{fmt(amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Compounded over {years[0]} yrs @ {rate[0]}%</span>
          <span className="font-mono text-primary">+{fmt(opportunity)}</span>
        </div>
        <div className="flex justify-between font-semibold border-t border-border pt-1.5 mt-1">
          <span>Total future value</span>
          <span className="font-mono">{fmt(futureValue)}</span>
        </div>
      </div>
    </div>
  );
}
