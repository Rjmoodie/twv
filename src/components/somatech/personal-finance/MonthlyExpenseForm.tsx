import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Upload, Loader2, AlertTriangle } from 'lucide-react';
import { format, parseISO, startOfMonth } from 'date-fns';
import { type MonthlyCashFlow, type UsePersonalFinanceReturn } from '@/hooks/usePersonalFinance';
import {
  mapExpenseToCategory,
  CATEGORY_META,
  parseExpenseFile,
  type ExpenseCategoryKey,
  type ParsedExpenseItem,
} from '@/lib/expenseCategoryMapper';
import { cn } from '@/lib/utils';

// ── Local types ───────────────────────────────────────────────────────────────

interface ExpenseItem {
  id:     string;
  name:   string;
  amount: number;
}

interface IncomeState {
  primary_income:    number;
  side_income:       number;
  investment_income: number;
  other_income:      number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _uid = 0;
const uid = () => `exp_${++_uid}`;

const _currFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmt = (n: number) => _currFmt.format(n);

// Integer-only — cents truncated intentionally (budget entry doesn't need sub-dollar precision)
function formatAmt(raw: string): string {
  const digits = raw.split('.')[0].replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10).toLocaleString() : '';
}

function parseAmt(display: string): number {
  return parseInt(display.replace(/[^0-9]/g, '') || '0', 10);
}

/** Sum expense items into MonthlyCashFlow category totals. */
function itemsToCategories(items: ExpenseItem[]): Record<ExpenseCategoryKey, number> {
  const totals: Record<ExpenseCategoryKey, number> = {
    housing: 0, food: 0, transport: 0, healthcare: 0, entertainment: 0,
    subscriptions: 0, clothing: 0, education: 0, travel: 0, other_expenses: 0,
  };
  for (const item of items) {
    totals[mapExpenseToCategory(item.name)] += item.amount;
  }
  return totals;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MonthlyExpenseFormProps {
  onSave: (data: Omit<MonthlyCashFlow, 'id'>) => Promise<void>;
}

export default function MonthlyExpenseForm({ onSave }: MonthlyExpenseFormProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  // YYYY-MM format for the native month input
  const [flowMonth, setFlowMonth] = useState(() =>
    format(startOfMonth(new Date()), 'yyyy-MM')
  );

  const [income, setIncome] = useState<IncomeState>({
    primary_income:    0,
    side_income:       0,
    investment_income: 0,
    other_income:      0,
  });

  const [items,     setItems]     = useState<ExpenseItem[]>([]);
  const [newName,   setNewName]   = useState('');
  const [newAmt,    setNewAmt]    = useState('');
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);

  // ── Derived totals ───────────────────────────────────────────────────────
  const totalExpenses = items.reduce((sum, i) => sum + i.amount, 0);
  const totalIncome   = income.primary_income + income.side_income
                      + income.investment_income + income.other_income;
  const surplus       = totalIncome - totalExpenses;
  const savingsRate   = totalIncome > 0 ? (surplus / totalIncome) * 100 : 0;

  // ── Add / remove items ────────────────────────────────────────────────────
  const addItem = useCallback(() => {
    const amount = parseAmt(newAmt);
    const name   = newName.trim();
    if (!name || amount <= 0) return;
    setItems(prev => [...prev, { id: uid(), name, amount }]);
    setNewName('');
    setNewAmt('');
  }, [newName, newAmt]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  // ── File upload ───────────────────────────────────────────────────────────
  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadErr(null);
    setUploading(true);

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (['xlsx', 'xls'].includes(ext)) {
      setUploadErr('Save your Excel file as CSV first: File → Save As → CSV, then upload.');
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    if (['doc', 'docx', 'pdf'].includes(ext)) {
      setUploadErr('Copy your expense list into a .txt file or export as CSV from your bank.');
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    try {
      const text   = await file.text();
      const parsed = parseExpenseFile(text);

      if (parsed.length === 0) {
        setUploadErr('No items found. Each line needs a name and an amount — e.g. "Rent, 1500".');
      } else {
        setItems(prev => [...prev, ...parsed.map(p => ({ ...p, id: uid() }))]);
      }
    } catch {
      setUploadErr('Could not read the file. Try saving as .csv or .txt.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const data: Omit<MonthlyCashFlow, 'id'> = {
        flow_month: flowMonth + '-01',   // YYYY-MM → YYYY-MM-01
        ...income,
        ...itemsToCategories(items),
        notes: null,
      };
      await onSave(data);
      toast({ title: 'Saved', description: 'Cash flow logged and Coach profile updated.' });
      setItems([]); // reset expenses; income likely unchanged month-to-month
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Month label for the save button — use day 15 to avoid timezone roll-back
  const monthLabel = (() => {
    try { return format(parseISO(flowMonth + '-15'), 'MMMM yyyy'); }
    catch { return flowMonth; }
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Month picker */}
      <div className="flex items-center gap-3">
        <Label className="text-xs text-muted-foreground shrink-0">Month</Label>
        <input
          type="month"
          value={flowMonth}
          onChange={e => setFlowMonth(e.target.value)}
          className="h-8 rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* ── Income ────────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-3">Income</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            ['primary_income',    'Primary'],
            ['side_income',       'Side'],
            ['investment_income', 'Investment'],
            ['other_income',      'Other'],
          ] as const).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input
                className="h-9 text-sm font-mono"
                type="number" min="0" placeholder="0"
                value={income[key] || ''}
                onChange={e => setIncome(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Expenses ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-destructive">Expenses</p>

        {/* Item list */}
        {items.length > 0 && (
          <div className="space-y-1.5">
            {items.map(item => {
              const catKey = mapExpenseToCategory(item.name);
              const cat    = CATEGORY_META[catKey];
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 rounded-xl bg-muted/40 border border-border/30 px-3 py-2"
                >
                  {/* Category colour dot */}
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />

                  {/* Name */}
                  <span className="flex-1 text-sm truncate">{item.name}</span>

                  {/* Category badge */}
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color + '22', color: cat.color }}
                  >
                    {cat.label}
                  </span>

                  {/* Amount */}
                  <span className="text-sm font-semibold tabular-nums shrink-0 w-16 text-right">
                    {fmt(item.amount)}
                  </span>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Running total */}
            <div className="flex items-center justify-between px-1 pt-1 border-t border-border/40">
              <span className="text-xs font-medium text-muted-foreground">
                {items.length} item{items.length !== 1 ? 's' : ''}
              </span>
              <span className="text-base font-bold tabular-nums text-destructive">
                {fmt(totalExpenses)}
              </span>
            </div>
          </div>
        )}

        {/* Add-item row */}
        {/* Live category preview — shown while typing a name so user sees how it'll be bucketed */}
        {newName.trim().length >= 2 && (() => {
          const catKey  = mapExpenseToCategory(newName);
          const cat     = CATEGORY_META[catKey];
          const isOther = catKey === 'other_expenses';
          return (
            <div className="flex items-center gap-1.5 text-[11px] px-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
              <span className="text-muted-foreground">
                Will be added to{' '}
                <span className="font-medium" style={{ color: cat.color }}>{cat.label}</span>
                {isOther && <span className="text-muted-foreground/60"> — rename for a better match</span>}
              </span>
            </div>
          );
        })()}
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Rent, Netflix, Groceries, Gym"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => !e.isComposing && e.key === 'Enter' && addItem()}
            className="flex-1 h-10 text-sm rounded-xl border-border/70 bg-background"
          />
          <div className="relative w-28 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none select-none">
              $
            </span>
            <Input
              inputMode="numeric"
              placeholder="0"
              value={newAmt}
              onChange={e => setNewAmt(formatAmt(e.target.value))}
              onKeyDown={e => !e.isComposing && e.key === 'Enter' && addItem()}
              className="h-10 text-sm rounded-xl border-border/70 bg-background pl-7 font-semibold"
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={addItem}
            disabled={!newName.trim() || parseAmt(newAmt) <= 0}
            className="h-10 w-10 rounded-xl p-0 shrink-0"
            aria-label="Add expense item"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Category key — shown when there are items to give context */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
            {Object.entries(CATEGORY_META)
              .filter(([key]) => items.some(i => mapExpenseToCategory(i.name) === key))
              .map(([, meta]) => (
                <div key={meta.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                  {meta.label}
                </div>
              ))}
          </div>
        )}

        {/* Upload */}
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.tsv"
            className="sr-only"
            onChange={handleFile}
            tabIndex={-1}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={cn(
              'flex items-center justify-center gap-2 w-full text-xs text-muted-foreground',
              'rounded-xl border border-dashed border-border/50 px-4 py-2.5',
              'hover:border-border hover:bg-muted/20 hover:text-foreground transition-all',
              uploading && 'opacity-60 cursor-not-allowed',
            )}
          >
            {uploading
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading file…</>
              : <><Upload className="h-3.5 w-3.5" /> Import from CSV or bank export</>
            }
          </button>
          <p className="text-[10px] text-muted-foreground/60 text-center">
            Most banks let you export transactions as CSV · Excel: save as CSV first
          </p>
          {uploadErr && (
            <div className="flex items-start gap-2 text-xs bg-warning/100/8 border border-warning/20/20 rounded-xl px-3 py-2.5">
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
              <span className="text-muted-foreground leading-relaxed">{uploadErr}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Summary + Save ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 space-y-3">
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Income</p>
            <p className="font-bold text-accent tabular-nums">{fmt(totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Expenses</p>
            <p className="font-bold text-destructive tabular-nums">{fmt(totalExpenses)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Surplus</p>
            <p className={cn('font-bold tabular-nums', surplus >= 0 ? 'text-accent' : 'text-destructive')}>
              {fmt(surplus)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Rate</p>
            <p className={cn('font-bold', savingsRate >= 20 ? 'text-accent' : 'text-warning')}>
              {savingsRate.toFixed(0)}%
            </p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || totalIncome === 0}
          className="w-full"
        >
          {saving ? 'Saving…' : `Save ${monthLabel}`}
        </Button>

        {totalIncome === 0 && (
          <p className="text-[10px] text-muted-foreground text-center">
            Enter your income above to save
          </p>
        )}
      </div>
    </div>
  );
}
