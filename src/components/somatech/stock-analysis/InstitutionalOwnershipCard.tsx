import { useEffect, useState } from 'react';
import { Building2, ExternalLink, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface InstitutionalPosition {
  manager_name: string;
  manager_cik: string;
  report_period: string;
  filed_at: string;
  issuer_name: string;
  cusip: string;
  value_usd: number;
  shares: number;
  previous_shares: number | null;
  share_change: number;
  change_direction: 'new' | 'increased' | 'decreased' | 'exited' | 'unchanged';
  match_method: 'manual' | 'issuer_name_exact';
  filing_url: string;
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const safeDate = (value: string): string => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString() : 'date unavailable';
};

export default function InstitutionalOwnershipCard({ ticker }: { ticker: string }) {
  const [rows, setRows] = useState<InstitutionalPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setUnavailable(false);
    void (supabase as any).rpc('institutional_signal_for_ticker', { p_ticker: ticker.toUpperCase() })
      .then(({ data, error }: { data?: InstitutionalPosition[]; error?: unknown }) => {
        if (cancelled) return;
        setRows(error ? [] : data ?? []);
        setUnavailable(Boolean(error));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [ticker]);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-primary" />Institutional ownership</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Quarterly SEC Form 13F positions from selected investment managers.</p>
          </div>
          <Badge variant="outline" className="w-fit">Delayed disclosure</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading filed institutional positions…</p>
        ) : unavailable ? (
          <p className="text-sm text-muted-foreground">Institutional filings are temporarily unavailable. The company analysis remains usable.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mapped long-equity position for {ticker} appears in the latest filings from the tracked managers. This is not evidence that institutions broadly do not own it.</p>
        ) : (
          <div className="space-y-3">
            {rows.map(row => (
              <div key={`${row.manager_cik}-${row.cusip}`} className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{row.manager_name}</p>
                    <p className="text-xs text-muted-foreground">{row.issuer_name} · CUSIP {row.cusip}</p>
                  </div>
                  <Badge variant={row.change_direction === 'decreased' || row.change_direction === 'exited' ? 'destructive' : row.change_direction === 'unchanged' ? 'outline' : 'secondary'}>
                    {row.change_direction === 'new' ? 'New position' : row.change_direction === 'exited' ? 'Exited position' : row.change_direction}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">Reported shares</p><p className="font-medium tabular-nums">{row.change_direction === 'exited' ? '0' : compact.format(row.shares)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Quarterly change</p><p className="font-medium tabular-nums">{row.share_change > 0 ? '+' : ''}{compact.format(row.share_change)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Filed value</p><p className="font-medium tabular-nums">{row.change_direction === 'exited' ? '$0' : dollars.format(row.value_usd)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Period end</p><p className="font-medium tabular-nums">{row.report_period}</p></div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Filed {safeDate(row.filed_at)}</span>
                  <span>{row.match_method === 'manual' ? 'Identifier reviewed' : 'Strict issuer-name match'}</span>
                  <a className="inline-flex items-center gap-1 text-primary hover:underline" href={row.filing_url} target="_blank" rel="noreferrer">SEC filing <ExternalLink className="h-3 w-3" /></a>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>13F reports can arrive up to 45 days after quarter-end and cover reportable long U.S. securities—not a manager’s entire portfolio, cost basis, current position, or investment thesis. Options are excluded from the long-equity comparison above.</p>
        </div>
      </CardContent>
    </Card>
  );
}
