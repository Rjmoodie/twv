import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ── Income Statement ──────────────────────────────────────────────────────────

const IS_ROWS = [
  { key: 'revenue',     label: 'Revenue',                  indent: 0, isBase: true },
  { key: 'cogs',        label: 'Cost of Goods Sold',        indent: 1 },
  { key: 'grossProfit', label: 'Gross Profit',              indent: 0, derived: (d: ISData) => d.revenue - d.cogs },
  { key: 'opex',        label: 'Operating Expenses',        indent: 1 },
  { key: 'ebit',        label: 'Operating Income (EBIT)',   indent: 0, derived: (d: ISData) => d.revenue - d.cogs - d.opex },
  { key: 'interest',    label: 'Interest Expense',          indent: 1 },
  { key: 'ebt',         label: 'Profit Before Tax',         indent: 0, derived: (d: ISData) => d.revenue - d.cogs - d.opex - d.interest },
  { key: 'tax',         label: 'Tax',                       indent: 1 },
  { key: 'netIncome',   label: 'Net Income',                indent: 0, derived: (d: ISData) => d.revenue - d.cogs - d.opex - d.interest - d.tax },
] as const;

type ISKey = 'revenue' | 'cogs' | 'opex' | 'interest' | 'tax';

interface ISData { revenue: number; cogs: number; opex: number; interest: number; tax: number }

const IS_DEFAULTS: ISData = { revenue: 100000, cogs: 60000, opex: 20000, interest: 2000, tax: 4500 };

// ── Balance Sheet ─────────────────────────────────────────────────────────────

const BS_ROWS = [
  { key: 'ppe',          label: 'Property, Plant & Equipment', indent: 1, side: 'asset' as const },
  { key: 'goodwill',     label: 'Goodwill & Intangibles',      indent: 1, side: 'asset' as const },
  { key: 'ncAssets',     label: 'Total Non-Current Assets',    indent: 0, side: 'asset' as const, derived: (d: BSData) => d.ppe + d.goodwill },
  { key: 'cash',         label: 'Cash & Equivalents',          indent: 1, side: 'asset' as const },
  { key: 'receivables',  label: 'Accounts Receivable',         indent: 1, side: 'asset' as const },
  { key: 'inventory',    label: 'Inventory',                   indent: 1, side: 'asset' as const },
  { key: 'curAssets',    label: 'Total Current Assets',        indent: 0, side: 'asset' as const, derived: (d: BSData) => d.cash + d.receivables + d.inventory },
  { key: 'totalAssets',  label: 'Total Assets',                indent: 0, side: 'asset' as const, isBase: true, derived: (d: BSData) => d.ppe + d.goodwill + d.cash + d.receivables + d.inventory },
  { key: 'ltDebt',       label: 'Long-Term Debt',              indent: 1, side: 'liab' as const },
  { key: 'stDebt',       label: 'Short-Term Debt & Payables',  indent: 1, side: 'liab' as const },
  { key: 'totalLiab',    label: 'Total Liabilities',           indent: 0, side: 'liab' as const, derived: (d: BSData) => d.ltDebt + d.stDebt },
  { key: 'equity',       label: 'Shareholder Equity',          indent: 0, side: 'liab' as const, derived: (d: BSData) => d.ppe + d.goodwill + d.cash + d.receivables + d.inventory - d.ltDebt - d.stDebt },
] as const;

type BSKey = 'ppe' | 'goodwill' | 'cash' | 'receivables' | 'inventory' | 'ltDebt' | 'stDebt';

interface BSData { ppe: number; goodwill: number; cash: number; receivables: number; inventory: number; ltDebt: number; stDebt: number }

const BS_DEFAULTS: BSData = { ppe: 50000, goodwill: 10000, cash: 15000, receivables: 12000, inventory: 13000, ltDebt: 30000, stDebt: 10000 };

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

function pctBar(pct: number) {
  const clamped = Math.min(Math.abs(pct), 100);
  return (
    <div className="w-full bg-muted rounded-full h-1 mt-1">
      <div
        className={`h-1 rounded-full ${pct < 0 ? 'bg-destructive' : 'bg-primary'}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function pctClass(pct: number, isExpense: boolean): string {
  if (isExpense) return pct > 60 ? 'text-destructive' : pct > 40 ? 'text-warning' : 'text-foreground';
  return pct > 20 ? 'text-accent' : pct > 10 ? 'text-foreground' : 'text-destructive';
}

// ── Components ────────────────────────────────────────────────────────────────

function IncomeStatement() {
  const [d, setD] = useState<ISData>(IS_DEFAULTS);

  const update = (key: ISKey, val: string) => {
    const n = parseFloat(val);
    setD((prev) => ({ ...prev, [key]: isNaN(n) ? 0 : n }));
  };

  const getValue = (row: typeof IS_ROWS[number]): number => {
    if ('derived' in row && row.derived) return row.derived(d);
    return d[row.key as ISKey] ?? 0;
  };

  const base = d.revenue;
  const inputKeys: ISKey[] = ['revenue', 'cogs', 'opex', 'interest', 'tax'];
  const isInputRow = (key: string): key is ISKey => inputKeys.includes(key as ISKey);
  const EXPENSES: string[] = ['cogs', 'opex', 'interest', 'tax'];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every line item as a % of revenue. Reveals cost structure and margin profile at a glance.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left py-2 font-medium w-48">Line item</th>
              <th className="text-right py-2 font-medium w-32">Amount ($)</th>
              <th className="text-right py-2 font-medium w-20">% Rev</th>
              <th className="text-left py-2 font-medium pl-4">Visual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {IS_ROWS.map((row) => {
              const val = getValue(row);
              const pct = base > 0 ? (val / base) * 100 : 0;
              const isDerived = 'derived' in row && row.derived;
              const isExp = EXPENSES.includes(row.key);

              return (
                <tr key={row.key} className={isDerived ? 'bg-muted/20' : ''}>
                  <td className={`py-2 ${row.indent === 1 ? 'pl-4 text-muted-foreground' : 'font-medium'}`}>
                    {row.label}
                    {'isBase' in row && row.isBase && <Badge variant="secondary" className="ml-2 text-[10px] py-0">base</Badge>}
                  </td>
                  <td className="py-1.5 pl-2 text-right">
                    {isInputRow(row.key) ? (
                      <Input
                        type="number"
                        value={d[row.key as ISKey]}
                        onChange={(e) => update(row.key as ISKey, e.target.value)}
                        className="h-7 text-right text-xs font-mono w-28 ml-auto"
                      />
                    ) : (
                      <span className={`font-mono text-xs ${val < 0 ? 'text-destructive' : ''}`}>{fmt(val)}</span>
                    )}
                  </td>
                  <td className={`py-2 text-right font-mono text-xs ${isDerived ? pctClass(pct, false) : isExp ? pctClass(pct, true) : ''}`}>
                    {pct.toFixed(1)}%
                  </td>
                  <td className="py-2 pl-4 w-32">{pctBar(pct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl bg-muted/40 border border-border p-4 grid grid-cols-3 gap-4 text-center text-sm">
        {[
          { label: 'Gross margin', value: base > 0 ? ((d.revenue - d.cogs) / base * 100).toFixed(1) + '%' : '—' },
          { label: 'Operating margin', value: base > 0 ? ((d.revenue - d.cogs - d.opex) / base * 100).toFixed(1) + '%' : '—' },
          { label: 'Net margin', value: base > 0 ? ((d.revenue - d.cogs - d.opex - d.interest - d.tax) / base * 100).toFixed(1) + '%' : '—' },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold mt-0.5">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BalanceSheet() {
  const [d, setD] = useState<BSData>(BS_DEFAULTS);

  const update = (key: BSKey, val: string) => {
    const n = parseFloat(val);
    setD((prev) => ({ ...prev, [key]: isNaN(n) ? 0 : n }));
  };

  const totalAssets = d.ppe + d.goodwill + d.cash + d.receivables + d.inventory;
  const inputKeys: BSKey[] = ['ppe', 'goodwill', 'cash', 'receivables', 'inventory', 'ltDebt', 'stDebt'];
  const isInputKey = (key: string): key is BSKey => inputKeys.includes(key as BSKey);

  const getValue = (row: typeof BS_ROWS[number]): number => {
    if ('derived' in row && row.derived) return row.derived(d);
    return d[row.key as BSKey] ?? 0;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every line item as a % of total assets. Reveals capital structure and asset composition at a glance.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(['asset', 'liab'] as const).map((side) => {
          const sideRows = BS_ROWS.filter((r) => r.side === side);
          return (
            <div key={side}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {side === 'asset' ? 'Assets' : 'Liabilities & Equity'}
              </p>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border/40">
                  {sideRows.map((row) => {
                    const val = getValue(row);
                    const pct = totalAssets > 0 ? (val / totalAssets) * 100 : 0;
                    const isDerived = 'derived' in row && row.derived;

                    return (
                      <tr key={row.key} className={isDerived ? 'bg-muted/20' : ''}>
                        <td className={`py-1.5 ${row.indent === 1 ? 'pl-4 text-xs text-muted-foreground' : 'font-medium text-sm'}`}>
                          {row.label}
                          {'isBase' in row && row.isBase && <Badge variant="secondary" className="ml-2 text-[10px] py-0">base</Badge>}
                        </td>
                        <td className="py-1 pl-2 text-right">
                          {isInputKey(row.key) ? (
                            <Input
                              type="number"
                              value={d[row.key as BSKey]}
                              onChange={(e) => update(row.key as BSKey, e.target.value)}
                              className="h-6 text-right text-xs font-mono w-24 ml-auto"
                            />
                          ) : (
                            <span className="font-mono text-xs">{fmt(val)}</span>
                          )}
                        </td>
                        <td className="py-1.5 text-right font-mono text-xs text-muted-foreground w-14">
                          {pct.toFixed(1)}%
                        </td>
                        <td className="py-1.5 pl-3 w-20">{pctBar(pct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl bg-muted/40 border border-border p-4 grid grid-cols-3 gap-4 text-center text-sm">
        {[
          {
            label: 'Current ratio',
            value: d.stDebt > 0 ? ((d.cash + d.receivables + d.inventory) / d.stDebt).toFixed(2) : '—',
            note: '> 1.5 healthy',
          },
          {
            label: 'Debt / Assets',
            value: totalAssets > 0 ? (((d.ltDebt + d.stDebt) / totalAssets) * 100).toFixed(1) + '%' : '—',
            note: '< 50% is conservative',
          },
          {
            label: 'Equity / Assets',
            value: totalAssets > 0 ? (((totalAssets - d.ltDebt - d.stDebt) / totalAssets) * 100).toFixed(1) + '%' : '—',
            note: 'Net asset cushion',
          },
        ].map(({ label, value, note }) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold mt-0.5">{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CommonSizeAnalysis() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-medium">Common Size Analysis</p>
        <p className="text-sm text-muted-foreground">
          Normalise financial statements to percentages so any two companies — regardless of size — can be compared on equal footing.
        </p>
      </div>

      <Tabs defaultValue="income">
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="income">Income Statement</TabsTrigger>
          <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
        </TabsList>
        <TabsContent value="income" className="pt-4">
          <IncomeStatement />
        </TabsContent>
        <TabsContent value="balance" className="pt-4">
          <BalanceSheet />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Common size removes the size distortion — a startup with $1M revenue and a Fortune 500 with $100B revenue can both have a 25% gross margin. The percentage tells you more than the raw dollar amount.
      </p>
    </div>
  );
}
