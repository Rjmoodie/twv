import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Droplets, Activity, Scale } from 'lucide-react';

interface Inputs {
  revenue: number;
  cogs: number;
  netIncome: number;
  totalAssets: number;
  equity: number;
  currentAssets: number;
  currentLiabilities: number;
  inventory: number;
  totalDebt: number;
  receivables: number;
  daysInPeriod: number;
}

const DEFAULTS: Inputs = {
  revenue: 81462,
  cogs: 60609,
  netIncome: 12556,
  totalAssets: 82338,
  equity: 44704,
  currentAssets: 40917,
  currentLiabilities: 26709,
  inventory: 12839,
  totalDebt: 5246,
  receivables: 2952,
  daysInPeriod: 365,
};

function field(label: string, key: keyof Inputs, val: number, set: (k: keyof Inputs, v: number) => void, hint?: string) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={val}
        onChange={(e) => set(key, Number(e.target.value))}
        className="h-7 text-xs font-mono"
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function RatioCard({
  label, value, benchmark, interpretation, good,
}: {
  label: string; value: string; benchmark: string; interpretation: string; good: boolean | null;
}) {
  return (
    <Card className={`border ${good === true ? 'border-emerald-500/30 bg-emerald-500/5' : good === false ? 'border-destructive/30 bg-destructive/5' : 'border-border'}`}>
      <CardContent className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
          {good != null && (
            <Badge variant="secondary" className={`text-[10px] shrink-0 ${good ? 'bg-emerald-100 text-accent dark:bg-emerald-900/40 dark:text-accent' : 'bg-destructive/10 text-destructive dark:bg-destructive/10/40 dark:text-destructive'}`}>
              {good ? 'Healthy' : 'Weak'}
            </Badge>
          )}
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-[10px] text-muted-foreground">{benchmark}</p>
        <p className="text-xs text-muted-foreground leading-snug mt-1">{interpretation}</p>
      </CardContent>
    </Card>
  );
}

export default function FinancialRatiosTool() {
  const [d, setD] = useState<Inputs>(DEFAULTS);
  const upd = (k: keyof Inputs, v: number) => setD((prev) => ({ ...prev, [k]: v }));

  // ── Profitability ──────────────────────────────────────────────────────────
  const grossMargin = d.revenue > 0 ? ((d.revenue - d.cogs) / d.revenue) * 100 : null;
  const netMargin = d.revenue > 0 ? (d.netIncome / d.revenue) * 100 : null;
  const roa = d.totalAssets > 0 ? (d.netIncome / d.totalAssets) * 100 : null;
  // Allow negative equity — negative ROE is meaningful (worse than 0)
  const roe = d.equity !== 0 ? (d.netIncome / d.equity) * 100 : null;

  // ── Liquidity ──────────────────────────────────────────────────────────────
  const currentRatio = d.currentLiabilities > 0 ? d.currentAssets / d.currentLiabilities : null;
  const quickRatio = d.currentLiabilities > 0 ? (d.currentAssets - d.inventory) / d.currentLiabilities : null;

  // ── Activity ───────────────────────────────────────────────────────────────
  // Inventory turnover is N/A for service businesses (no inventory)
  const inventoryTurnover = d.inventory > 0 ? d.cogs / d.inventory : null;
  const avgCollectionPeriod = d.revenue > 0 && d.daysInPeriod > 0 ? (d.receivables / d.revenue) * d.daysInPeriod : null;

  // ── Leverage ───────────────────────────────────────────────────────────────
  const debtToAssets = d.totalAssets > 0 ? (d.totalDebt / d.totalAssets) * 100 : null;
  // D/E is meaningless with zero or negative equity — show N/A
  const debtToEquity = d.equity > 0 ? d.totalDebt / d.equity : null;

  const pct = (n: number | null) => n == null ? 'N/A' : n.toFixed(1) + '%';
  const x = (n: number | null) => n == null ? 'N/A' : n.toFixed(2) + 'x';

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Enter financial statement figures to compute all four ratio categories. Pre-loaded with Tesla FY2022.
      </p>

      <Tabs defaultValue="profitability">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profitability" className="text-xs gap-1"><TrendingUp className="h-3 w-3" />Profit</TabsTrigger>
          <TabsTrigger value="liquidity" className="text-xs gap-1"><Droplets className="h-3 w-3" />Liquid</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs gap-1"><Activity className="h-3 w-3" />Activity</TabsTrigger>
          <TabsTrigger value="leverage" className="text-xs gap-1"><Scale className="h-3 w-3" />Leverage</TabsTrigger>
        </TabsList>

        {/* ── Profitability ──────────────────────────────────────────────── */}
        <TabsContent value="profitability" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-2">
            {field('Revenue ($M)', 'revenue', d.revenue, upd)}
            {field('Cost of Goods Sold ($M)', 'cogs', d.cogs, upd)}
            {field('Net Income ($M)', 'netIncome', d.netIncome, upd)}
            {field('Total Assets ($M)', 'totalAssets', d.totalAssets, upd)}
            {field('Shareholder Equity ($M)', 'equity', d.equity, upd)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <RatioCard
              label="Gross Profit Margin"
              value={pct(grossMargin)}
              benchmark="Software: 60–80% | Services: 30–50% | Retail: 20–40%"
              interpretation="Revenue remaining after production costs. Higher = more pricing power."
              good={grossMargin == null ? null : grossMargin > 40 ? true : grossMargin < 20 ? false : null}
            />
            <RatioCard
              label="Net Profit Margin"
              value={pct(netMargin)}
              benchmark="Strong: > 15% | Average: 5–15% | Thin: < 5%"
              interpretation="Bottom-line profit after all costs, interest, and tax."
              good={netMargin == null ? null : netMargin > 15 ? true : netMargin < 5 ? false : null}
            />
            <RatioCard
              label="Return on Assets (ROA)"
              value={pct(roa)}
              benchmark="Strong: > 10% | Average: 5–10% | Weak: < 5%"
              interpretation="How efficiently assets generate profit. Asset-light businesses score higher."
              good={roa == null ? null : roa > 10 ? true : roa < 5 ? false : null}
            />
            <RatioCard
              label="Return on Equity (ROE)"
              value={pct(roe)}
              benchmark="Strong: > 15% | Average: 10–15% | Weak: < 10%"
              interpretation="Return generated on shareholders' capital. Warren Buffett looks for > 15% sustained."
              good={roe == null ? null : roe > 15 ? true : roe < 10 ? false : null}
            />
          </div>
        </TabsContent>

        {/* ── Liquidity ──────────────────────────────────────────────────── */}
        <TabsContent value="liquidity" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-2">
            {field('Current Assets ($M)', 'currentAssets', d.currentAssets, upd, 'Cash, receivables, inventory')}
            {field('Current Liabilities ($M)', 'currentLiabilities', d.currentLiabilities, upd, 'Due within 12 months')}
            {field('Inventory ($M)', 'inventory', d.inventory, upd, 'Excluded from quick ratio')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <RatioCard
              label="Current Ratio"
              value={x(currentRatio)}
              benchmark="Healthy: 1.5–3× | Tight: 1–1.5× | Risky: < 1×"
              interpretation="Can the company cover short-term obligations with short-term assets?"
              good={currentRatio == null ? null : currentRatio >= 1.5 ? true : currentRatio < 1 ? false : null}
            />
            <RatioCard
              label="Quick Ratio (Acid Test)"
              value={x(quickRatio)}
              benchmark="Healthy: > 1× | Tight: 0.7–1× | Risky: < 0.7×"
              interpretation="More conservative — strips out inventory which can be slow to convert to cash."
              good={quickRatio == null ? null : quickRatio >= 1 ? true : quickRatio < 0.7 ? false : null}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Note: very high ratios (&gt; 3×) can indicate idle cash that is not being reinvested efficiently.
          </p>
        </TabsContent>

        {/* ── Activity ───────────────────────────────────────────────────── */}
        <TabsContent value="activity" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-2">
            {field('Revenue ($M)', 'revenue', d.revenue, upd)}
            {field('COGS ($M)', 'cogs', d.cogs, upd)}
            {field('Inventory ($M)', 'inventory', d.inventory, upd)}
            {field('Accounts Receivable ($M)', 'receivables', d.receivables, upd)}
            {field('Days in period', 'daysInPeriod', d.daysInPeriod, upd, '365 for annual, 90 for quarterly')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <RatioCard
              label="Inventory Turnover"
              value={inventoryTurnover == null ? 'N/A' : inventoryTurnover.toFixed(1) + '×'}
              benchmark="Retail: 8–12× | Manufacturing: 4–8× | Low: < 3× | N/A for service businesses"
              interpretation="How many times inventory is sold and replaced per year. Higher = leaner operations."
              good={inventoryTurnover == null ? null : inventoryTurnover > 6 ? true : inventoryTurnover < 3 ? false : null}
            />
            <RatioCard
              label="Avg Collection Period"
              value={avgCollectionPeriod == null ? 'N/A' : avgCollectionPeriod.toFixed(0) + ' days'}
              benchmark="Fast: < 30 days | Average: 30–60 days | Slow: > 60 days"
              interpretation="How long it takes to collect payment after a sale. Shorter = better cash conversion."
              good={avgCollectionPeriod == null ? null : avgCollectionPeriod < 30 ? true : avgCollectionPeriod > 60 ? false : null}
            />
          </div>
        </TabsContent>

        {/* ── Leverage ───────────────────────────────────────────────────── */}
        <TabsContent value="leverage" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-2">
            {field('Total Debt ($M)', 'totalDebt', d.totalDebt, upd, 'Short + long-term borrowings')}
            {field('Total Assets ($M)', 'totalAssets', d.totalAssets, upd)}
            {field('Shareholder Equity ($M)', 'equity', d.equity, upd)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <RatioCard
              label="Debt / Assets"
              value={pct(debtToAssets)}
              benchmark="Conservative: < 30% | Moderate: 30–50% | High: > 50%"
              interpretation="What percentage of assets are financed by debt. Higher = more financial risk."
              good={debtToAssets == null ? null : debtToAssets < 30 ? true : debtToAssets > 50 ? false : null}
            />
            <RatioCard
              label="Debt / Equity"
              value={debtToEquity == null ? 'N/A (neg. equity)' : x(debtToEquity)}
              benchmark="Conservative: < 0.5× | Moderate: 0.5–1.5× | High: > 1.5×"
              interpretation="How much debt the company uses per dollar of equity. N/A when equity is zero or negative."
              good={debtToEquity == null ? null : debtToEquity < 0.5 ? true : debtToEquity > 1.5 ? false : null}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Leverage ratios vary dramatically by industry — compare only within the same sector. A 1.5× D/E that's dangerous for a retailer is conservative for a utility.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
