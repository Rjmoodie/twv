import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, TrendingUp, AlertTriangle } from 'lucide-react';

interface Props {
  prefill?: { homePrice?: number };
}

export default function RentVsOwnTool({ prefill }: Props) {
  const [homePrice, setHomePrice] = useState(prefill?.homePrice ?? 400000);
  const [propertyTax, setPropertyTax] = useState([1]);
  const [maintenance, setMaintenance] = useState([1.5]);
  const [opportunityCost, setOpportunityCost] = useState([3]);

  const totalRate = (propertyTax[0] + maintenance[0] + opportunityCost[0]) / 100;
  const breakEvenRent = Math.round((homePrice * totalRate) / 12);
  const annualUnrecoverable = Math.round(homePrice * totalRate);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <p className="text-sm text-muted-foreground">
          The 5% rule: if you can rent an equivalent home for <strong>less</strong> than the break-even below, renting is the better financial decision.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Home price</Label>
          <Input
            type="number"
            value={homePrice}
            onChange={(e) => setHomePrice(Number(e.target.value))}
            className="font-mono"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>Property tax rate</Label>
            <span className="font-mono text-muted-foreground">{propertyTax[0]}%</span>
          </div>
          <Slider min={0.3} max={3} step={0.1} value={propertyTax} onValueChange={setPropertyTax} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>Maintenance rate <span className="text-muted-foreground text-xs">(people underestimate this)</span></Label>
            <span className="font-mono text-muted-foreground">{maintenance[0]}%</span>
          </div>
          <Slider min={0.5} max={3} step={0.1} value={maintenance} onValueChange={setMaintenance} />
          {maintenance[0] < 1.5 && (
            <p className="text-xs text-warning flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Academic research suggests 2%+ is more realistic for most homes.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>Opportunity cost of equity</Label>
            <span className="font-mono text-muted-foreground">{opportunityCost[0]}%</span>
          </div>
          <Slider min={1} max={7} step={0.5} value={opportunityCost} onValueChange={setOpportunityCost} />
          <p className="text-xs text-muted-foreground">What you could earn by investing the down payment instead.</p>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Home className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Break-even rent/mo</span>
            </div>
            <p className="text-2xl font-bold text-primary">{fmt(breakEvenRent)}</p>
            <p className="text-xs text-muted-foreground mt-1">Rent below this → renting wins</p>
          </CardContent>
        </Card>

        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-destructive" />
              <span className="text-xs font-medium text-muted-foreground">Annual unrecoverable</span>
            </div>
            <p className="text-2xl font-bold text-destructive">{fmt(annualUnrecoverable)}</p>
            <p className="text-xs text-muted-foreground mt-1">Gone every year, regardless of appreciation</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl bg-muted/50 p-4 space-y-1.5 text-sm">
        <p className="font-semibold">Unrecoverable cost breakdown</p>
        <div className="flex justify-between text-muted-foreground">
          <span>Property tax ({propertyTax[0]}%)</span>
          <span>{fmt(homePrice * propertyTax[0] / 100)}/yr</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Maintenance ({maintenance[0]}%)</span>
          <span>{fmt(homePrice * maintenance[0] / 100)}/yr</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Opportunity cost ({opportunityCost[0]}%)</span>
          <span>{fmt(homePrice * opportunityCost[0] / 100)}/yr</span>
        </div>
        <div className="flex justify-between font-semibold border-t border-border pt-1.5 mt-1">
          <span>Total rate: {(propertyTax[0] + maintenance[0] + opportunityCost[0]).toFixed(1)}%</span>
          <span>{fmt(annualUnrecoverable)}/yr</span>
        </div>
      </div>
    </div>
  );
}
