import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingDown, AlertTriangle } from 'lucide-react';

interface Props {
  prefill?: { cashPercent?: number; horizon?: number };
}

export default function CostOfConservatismTool({ prefill }: Props) {
  const [portfolio, setPortfolio] = useState(100000);
  const [cashPct, setCashPct] = useState([prefill?.cashPercent ?? 50]);
  const [horizon, setHorizon] = useState([prefill?.horizon ?? 20]);
  const [equityReturn] = useState(7);
  const [cashReturn] = useState(2);

  const cashAmount = portfolio * (cashPct[0] / 100);
  const equityAmount = portfolio - cashAmount;

  const currentFV = cashAmount * Math.pow(1 + cashReturn / 100, horizon[0])
    + equityAmount * Math.pow(1 + equityReturn / 100, horizon[0]);

  const optimalFV = portfolio * Math.pow(1 + equityReturn / 100, horizon[0]);
  const costOfConservatism = optimalFV - currentFV;
  const annualDrag = portfolio * (cashPct[0] / 100) * ((equityReturn - cashReturn) / 100);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const severity = cashPct[0] > 60 ? 'high' : cashPct[0] > 30 ? 'medium' : 'low';

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Being too conservative isn't "safe" — it has a real compounded cost. Here's what your allocation is costing you vs. a fully-invested equivalent.
      </p>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Portfolio value</Label>
          <Input
            type="number"
            value={portfolio}
            onChange={(e) => setPortfolio(Number(e.target.value))}
            className="font-mono"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>Cash / bonds allocation</Label>
            <span className="font-mono text-muted-foreground">{cashPct[0]}%</span>
          </div>
          <Slider min={0} max={100} step={5} value={cashPct} onValueChange={setCashPct} />
          {severity === 'high' && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Over 60% in cash/bonds is highly conservative for most time horizons.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>Time horizon</Label>
            <span className="font-mono text-muted-foreground">{horizon[0]} years</span>
          </div>
          <Slider min={5} max={40} step={1} value={horizon} onValueChange={setHorizon} />
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Your allocation value</p>
            <p className="text-xl font-bold">{fmt(currentFV)}</p>
            <p className="text-xs text-muted-foreground mt-1">in {horizon[0]} years</p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Fully invested value</p>
            <p className="text-xl font-bold text-primary">{fmt(optimalFV)}</p>
            <p className="text-xs text-muted-foreground mt-1">at 7% equity return</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-destructive/5 border-destructive/20">
        <CardContent className="p-4 flex items-center gap-3">
          <TrendingDown className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">Cost of conservatism: {fmt(costOfConservatism)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              That's {fmt(annualDrag)}/year in foregone expected returns from your cash-heavy allocation.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl bg-muted/50 p-4 text-sm space-y-1">
        <p className="font-semibold mb-2">Assumptions</p>
        <div className="flex justify-between text-muted-foreground">
          <span>Equity return (index funds)</span><span>{equityReturn}%/yr</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Cash / bond return</span><span>{cashReturn}%/yr</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Return gap</span><span>{equityReturn - cashReturn}%/yr</span>
        </div>
      </div>
    </div>
  );
}
