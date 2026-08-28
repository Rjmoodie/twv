import React, { useState, useRef, useCallback, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyInput, formatMoney, parseCurrencyInput } from '@/lib/journeyMoney';

export interface ExpenseItem {
  id:     string;
  name:   string;
  amount: number;
}

interface ItemizedExpenseInputProps {
  items:            ExpenseItem[];
  onChange:         (items: ExpenseItem[]) => void;
  itemPlaceholder?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _uid = 0;
const uid = () => `item_${++_uid}`;

/**
 * Parses a CSV or plain-text file into expense items.
 * Handles:
 *   - Two-column CSV: "name, amount"
 *   - Bank statement CSV: "date, description, amount, balance" (takes last positive number as amount)
 *   - Tab-separated or space-separated: "name  amount"
 * Skips header rows and lines with no extractable amount.
 */
function parseFileText(text: string): ExpenseItem[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const items: ExpenseItem[] = [];

  const amountPattern = /^\$?-?[\d,]+\.?\d{0,2}$/;
  const headerPattern = /^(date|description|amount|category|name|balance|debit|credit|type|memo|ref)/i;

  for (const line of lines) {
    if (headerPattern.test(line)) continue;

    // Try CSV split first
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim());

    let amount = 0;
    let nameparts: string[] = [];

    // Matches date-like tokens in any common format so they're stripped from names:
    //   MM/DD, DD-MM, YYYY-MM-DD, DD/MM/YYYY, 2024-05, Jan 2024, etc.
    const isDateToken = (s: string) =>
      /^\d{4}[-/]\d{2}([-/]\d{2})?$/.test(s) ||  // ISO: 2024-05-15 or 2024-05
      /^\d{1,2}[-/]\d{1,2}([-/]\d{2,4})?$/.test(s) || // MM/DD or DD/MM/YYYY
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(s); // Month name

    // Scan from right to left for the first positive money-like column
    for (let i = cols.length - 1; i >= 0; i--) {
      if (amountPattern.test(cols[i])) {
        const val = parseFloat(cols[i].replace(/[$,]/g, ''));
        if (!isNaN(val) && val > 0) {
          amount = Math.round(val * 100) / 100;
          nameparts = cols.slice(0, i).filter(c => !isDateToken(c));
          break;
        }
      }
    }

    // Fallback: tab or multi-space separated
    if (!amount) {
      const parts = line.split(/\t|\s{3,}/).map(p => p.trim()).filter(Boolean);
      for (let i = parts.length - 1; i >= 0; i--) {
        const val = parseFloat(parts[i].replace(/[$,]/g, ''));
        if (!isNaN(val) && val > 0 && /\d/.test(parts[i])) {
          amount = Math.round(val * 100) / 100;
          nameparts = parts.slice(0, i).filter(p => !isDateToken(p));
          break;
        }
      }
    }

    const name = nameparts.join(' ').replace(/\s+/g, ' ').trim();
    // Require name ≥ 2 chars, ≤ 100 chars (100 allows long bank descriptions), no residual date token
    if (amount > 0 && name.length >= 2 && name.length <= 100 && !isDateToken(name)) {
      items.push({ id: uid(), name, amount });
    }
  }

  return items.slice(0, 60); // cap to avoid giant imports
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ItemizedExpenseInput({
  items,
  onChange,
  itemPlaceholder = 'Expense name (e.g. Rent)',
}: ItemizedExpenseInputProps) {
  const nameId   = useId();
  const amountId = useId();

  const [newName,   setNewName]   = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  const addItem = useCallback(() => {
    const amount = parseCurrencyInput(newAmount);
    const name   = newName.trim();
    if (!name || amount <= 0) return;
    onChange([...items, { id: uid(), name, amount }]);
    setNewName('');
    setNewAmount('');
  }, [newName, newAmount, items, onChange]);

  const removeItem = useCallback((id: string) => {
    onChange(items.filter(item => item.id !== id));
  }, [items, onChange]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadErr(null);
    setUploading(true);

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    // Excel — can't parse without a library; guide them to CSV
    if (ext === 'xlsx' || ext === 'xls') {
      setUploadErr(
        'Excel files need to be saved as CSV first: File → Save As → CSV (.csv), then upload here.'
      );
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    // Word / PDF — binary, not parseable as text
    if (ext === 'docx' || ext === 'doc' || ext === 'pdf') {
      setUploadErr(
        'Word and PDF files can\'t be read directly. Copy your expense list into a plain .txt file or export as CSV from your bank.'
      );
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseFileText(text);

      if (parsed.length === 0) {
        setUploadErr(
          'No expense items were found. Make sure each line has a name and a dollar amount — e.g. "Rent, 1500".'
        );
      } else {
        setUploadErr(null);
        onChange([...items, ...parsed]);
      }
    } catch {
      setUploadErr('Could not read the file. Try saving as .csv or .txt and uploading again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [items, onChange]);

  return (
    <div className="space-y-3">

      {/* ── Item list ───────────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
          {items.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 rounded-xl bg-muted/40 border border-border/30 px-3 py-2"
            >
              <span className="flex-1 text-sm text-foreground truncate">{item.name}</span>
              <span className="text-sm font-semibold tabular-nums shrink-0">{formatMoney(item.amount, 'USD', 2)}</span>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors rounded"
                aria-label={`Remove ${item.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Running total ────────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="flex items-center justify-between px-1 border-t border-border/40 pt-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {items.length} item{items.length !== 1 ? 's' : ''} · Total
          </span>
          <span className="text-lg font-bold tabular-nums">{formatMoney(total, 'USD', 2)}</span>
        </div>
      )}

      {/* ── Add new item ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor={nameId} className="sr-only">Expense name</label>
          <Input
            id={nameId}
            placeholder={itemPlaceholder}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => !e.isComposing && e.key === 'Enter' && addItem()}
            className="h-11 text-sm rounded-xl border-border/70 bg-background"
          />
        </div>
        <div className="relative w-28 shrink-0">
          <label htmlFor={amountId} className="sr-only">Amount</label>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none select-none">
            $
          </span>
          <Input
            id={amountId}
            inputMode="decimal"
            placeholder="0"
            value={newAmount}
            onChange={e => setNewAmount(formatCurrencyInput(e.target.value))}
            onKeyDown={e => !e.isComposing && e.key === 'Enter' && addItem()}
            className="h-11 text-sm rounded-xl border-border/70 bg-background pl-7 font-semibold"
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={addItem}
          disabled={!newName.trim() || parseCurrencyInput(newAmount) <= 0}
          className="h-11 w-11 rounded-xl p-0 shrink-0"
          aria-label="Add item"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Upload ───────────────────────────────────────────────────────────── */}
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
            'flex items-center justify-center gap-2 w-full',
            'rounded-xl border border-dashed border-border/50 px-4 py-2.5',
            'text-xs text-muted-foreground',
            'hover:border-border hover:bg-muted/20 hover:text-foreground',
            'transition-all duration-150',
            uploading && 'opacity-60 cursor-not-allowed',
          )}
        >
          {uploading
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading file…</>
            : <><Upload className="h-3.5 w-3.5" /> Import from CSV or text file</>
          }
        </button>

        {/* Format hint */}
        <p className="text-[10px] text-muted-foreground/60 text-center leading-relaxed">
          CSV exports from your bank work best · Each line needs a name and amount
          · Excel: save as CSV first
        </p>

        {/* Upload error */}
        {uploadErr && (
          <div className="flex items-start gap-2 text-xs bg-warning/100/8 border border-warning/20/20 rounded-xl px-3 py-2.5">
            <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
            <span className="text-muted-foreground leading-relaxed">{uploadErr}</span>
          </div>
        )}
      </div>
    </div>
  );
}
