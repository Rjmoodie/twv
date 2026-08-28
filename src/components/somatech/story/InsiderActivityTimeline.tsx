import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface InsiderTransactionRow {
  id: number;
  accession: string;
  form: '4' | '4/A';
  line_index: number;
  actor_key: string;
  joint_filing: boolean;
  owner_name: string;
  officer_title: string | null;
  classification: 'open_market_purchase' | 'open_market_sale' | 'grant' | 'option_exercise' | 'tax_withholding' | 'gift' | 'other';
  transaction_date: string;
  shares: number;
  price_per_share: number | null;
  shares_owned_after: number | null;
  filed_at: string;
  filing_url: string;
  plan_10b5_1: boolean;
  price_suspect: boolean;
}

interface EffectiveTransaction extends InsiderTransactionRow {
  ownerNames: string[];
  officerTitles: string[];
}

const labels: Record<InsiderTransactionRow['classification'], string> = {
  open_market_purchase: 'Open-market purchase',
  open_market_sale: 'Open-market sale',
  grant: 'Grant',
  option_exercise: 'Option exercise',
  tax_withholding: 'Tax withholding',
  gift: 'Gift',
  other: 'Other filed transaction',
};

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const safeDate = (value: string): string => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString() : 'date unavailable';
};

const groupEffectiveTransactions = (rows: InsiderTransactionRow[]): EffectiveTransaction[] => {
  const grouped = new Map<string, EffectiveTransaction>();
  for (const row of rows) {
    const key = `${row.accession}:${row.line_index}:${row.actor_key}`;
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.ownerNames.includes(row.owner_name)) existing.ownerNames.push(row.owner_name);
      if (row.officer_title && !existing.officerTitles.includes(row.officer_title)) existing.officerTitles.push(row.officer_title);
      continue;
    }
    grouped.set(key, {
      ...row,
      ownerNames: [row.owner_name],
      officerTitles: row.officer_title ? [row.officer_title] : [],
    });
  }
  return [...grouped.values()];
};

export default function InsiderActivityTimeline({ ticker }: { ticker: string }) {
  const [rows, setRows] = useState<EffectiveTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestSequence = useRef(0);
  const normalizedTicker = ticker.toUpperCase();

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError(false);
    const { data, error: queryError } = await (supabase as any)
      .from('insider_transactions')
      .select('id,accession,form,line_index,actor_key,joint_filing,owner_name,officer_title,classification,transaction_date,shares,price_per_share,shares_owned_after,filed_at,filing_url,plan_10b5_1,price_suspect')
      .eq('ticker', normalizedTicker)
      .eq('is_superseded', false)
      .order('filed_at', { ascending: false })
      .limit(100);
    if (sequence !== requestSequence.current) return;
    if (queryError) {
      setRows([]);
      setError(true);
    } else {
      setRows(groupEffectiveTransactions((data ?? []) as InsiderTransactionRow[]));
    }
    setLoading(false);
  }, [normalizedTicker]);

  useEffect(() => {
    void load();
    const activeRequest = requestSequence.current;
    return () => {
      if (requestSequence.current === activeRequest) requestSequence.current = activeRequest + 1;
    };
  }, [load]);

  return (
    <section className="rounded-xl border bg-muted/10 p-4" aria-labelledby={`insider-activity-${normalizedTicker}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 id={`insider-activity-${normalizedTicker}`} className="flex items-center gap-2 font-semibold">
            <Users className="h-4 w-4 text-primary" />Filed insider activity
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">Effective SEC Form 4 facts. Joint filings are grouped once so shares and people are not double-counted.</p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      {loading && rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading effective insider filings…</p>
      ) : error ? (
        <p className="mt-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground" role="status">
          Insider filings are temporarily unavailable. The financial story remains usable.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          No effective Form 4 transactions are stored for {normalizedTicker}. This is not evidence that insiders made no transactions.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.slice(0, 20).map(row => {
            const reliablePrice = !row.price_suspect && row.price_per_share != null && row.price_per_share > 0;
            const isPurchase = row.classification === 'open_market_purchase';
            const isSale = row.classification === 'open_market_sale';
            return (
              <article key={`${row.accession}:${row.line_index}:${row.actor_key}`} className="rounded-lg border bg-background/70 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{row.ownerNames.join(' · ')}</p>
                      {row.joint_filing && <Badge variant="outline">Joint filing</Badge>}
                      {row.form === '4/A' && <Badge variant="outline">Amended</Badge>}
                      {row.plan_10b5_1 && <Badge variant="outline">10b5-1 disclosed</Badge>}
                    </div>
                    {row.officerTitles.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{row.officerTitles.join(' · ')}</p>}
                  </div>
                  <Badge variant={isSale ? 'destructive' : isPurchase ? 'secondary' : 'outline'}>{labels[row.classification]}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <span><strong>{compact.format(row.shares)}</strong> shares</span>
                  {reliablePrice ? <span>at <strong>{money.format(row.price_per_share!)}</strong></span> : <span className="text-muted-foreground">Filed price withheld as unreliable</span>}
                  {row.shares_owned_after != null && <span className="text-muted-foreground">{compact.format(row.shares_owned_after)} held after</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Transaction {safeDate(`${row.transaction_date}T00:00:00Z`)}</span>
                  <span>Filed {safeDate(row.filed_at)}</span>
                  <a href={row.filing_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    SEC filing <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </article>
            );
          })}
          {rows.length > 20 && <p className="text-xs text-muted-foreground">Showing the 20 most recently filed effective transactions.</p>}
        </div>
      )}

      <div className="mt-4 flex gap-2 border-t pt-3 text-[11px] text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>Grants, exercises, tax withholding, gifts, and open-market trades are labeled separately. A filed transaction is not a recommendation or proof of intent.</p>
      </div>
    </section>
  );
}
