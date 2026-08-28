import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, Layers, TrendingDown, TrendingUp } from 'lucide-react';
import DataSourceTag from './DataSourceTag';
import type { StockData } from './types';
import { valueCompany, type ValuationRung } from './valuationLadder';
import { classifySic } from '../../../supabase/functions/_shared/sicClassification';

interface ValuationLadderPanelProps {
  ticker: string;
  stockData: StockData | null;
}

const CONFIDENCE_COPY: Record<ValuationRung['confidence'], string> = {
  high: 'Cash-flow based',
  medium: 'Earnings based',
  low: 'Revenue or asset based',
};

function Money({ value }: { value: number }) {
  return <span className="font-mono tabular-nums">${value.toFixed(2)}</span>;
}

/**
 * Shown when the discounted cash flow cannot run.
 *
 * "N/A" is a true statement about the model and a useless one about the company:
 * it reads as though nothing is known, when in fact the filings support a value by
 * a different instrument. This names the instrument used, what it was computed
 * from, and why the better ones did not apply.
 */
export default function ValuationLadderPanel({ ticker, stockData }: ValuationLadderPanelProps) {
  const result = useMemo(() => {
    if (!stockData?.annualFinancials?.length) return null;
    const latest = stockData.annualFinancials[0];
    return valueCompany({
      annual: stockData.annualFinancials,
      price: stockData.price ?? null,
      sharesOutstanding: latest?.sharesOutstanding ?? null,
      // An absent or unparseable code classifies as 'general', which is the
      // permissive case: an unknown filer gets the full ladder rather than being
      // narrowed to book value by a missing field.
      businessClass: classifySic(stockData.sic),
    });
  }, [stockData]);

  if (!result) return null;

  if (!result.selected) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground"><Info className="h-4 w-4" />{ticker} cannot be valued from its filings</p>
        <p className="mt-1">{result.unvaluableReason}</p>
      </div>
    );
  }

  const selected = result.selected;
  const positive = selected.upsidePct != null && selected.upsidePct > 0;

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 font-semibold"><Layers className="h-4 w-4 text-primary" />Alternative valuation</h3>
        <Badge variant="secondary">{selected.label}</Badge>
        <DataSourceTag kind="model" />
        <Badge variant="outline" className="ml-auto">{CONFIDENCE_COPY[selected.confidence]}</Badge>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {result.sectorNote
          ? `Instruments were selected for what ${ticker} is, not only for what its numbers allow.`
          : `A discounted cash flow could not run for ${ticker}, so the highest-confidence instrument its filings do support was used instead.`}
      </p>

      {result.sectorNote && (
        <p className="mt-3 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <strong className="text-foreground">Classified from SEC filings</strong>
            {stockData?.sicDescription ? ` as ${stockData.sicDescription.toLowerCase()}` : ''}
            {stockData?.sic ? ` (SIC ${stockData.sic})` : ''}. {result.sectorNote}
          </span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-6">
        <div>
          <p className="text-xs text-muted-foreground">Estimated value</p>
          <p className="text-2xl font-semibold"><Money value={selected.valuePerShare} /></p>
        </div>
        {selected.upsidePct != null && (
          <div>
            <p className="text-xs text-muted-foreground">Versus market</p>
            <p className={`flex items-center gap-1 text-2xl font-semibold ${positive ? 'text-accent' : 'text-destructive'}`}>
              {positive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {positive ? '+' : ''}{selected.upsidePct.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      <p className="mt-3 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Basis:</strong> {selected.basis}.
        {selected.multiple != null && ' The multiple is an assumption, not a filed figure — adjust it against peers before relying on the result.'}
      </p>

      {result.skipped.length > 0 && (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">Why not a higher-confidence instrument?</summary>
          <ul className="mt-2 space-y-1 pl-4">
            {result.skipped.map((entry) => <li key={entry.method}>· <strong className="text-foreground">{entry.label}</strong> — {entry.reason}</li>)}
          </ul>
        </details>
      )}

      {result.corroborating.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Cross-checks</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {result.corroborating.map((rung) => (
              <div key={rung.method} className="rounded-lg border p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{rung.label}</span>
                  <Money value={rung.valuePerShare} />
                </div>
                <p className="mt-0.5 text-muted-foreground">{rung.basis}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            A wide spread between these is itself the finding: it means the instruments disagree about what the company is worth, and no single number should be treated as the answer.
          </p>
        </div>
      )}
    </div>
  );
}
