import { BarChart3, Database, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ValuedMetricsSectionProps {
  sector: string;
  companyMetrics: Record<string, string | number>;
}

const label = (key: string) => key
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const display = (value: string | number) => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'Not reported';
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  }
  return value.trim() || 'Not reported';
};

export default function ValuedMetricsSection({ sector, companyMetrics }: ValuedMetricsSectionProps) {
  const metrics = Object.entries(companyMetrics).filter(([, value]) => value !== '' && value != null);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Reported company metrics</CardTitle>
            <CardDescription className="mt-1">Trailing market metrics from Alpha Vantage; filing-period ratios are calculated from the latest SEC annual filing and labeled accordingly.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2"><Badge variant="secondary">{sector || 'Sector unavailable'}</Badge><Badge variant="outline" className="gap-1"><Database className="h-3 w-3" />SEC + Alpha Vantage</Badge></div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {metrics.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map(([name, value]) => (
              <div key={name} className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs text-muted-foreground">{label(name)}</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{display(value)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-dashed p-5 text-sm text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p>No additional reported metrics are available for this filing. Somatech does not substitute estimated or fabricated benchmarks.</p></div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">Industry comparisons are shown only when a verifiable benchmark source is available; a missing benchmark is not treated as underperformance.</p>
      </CardContent>
    </Card>
  );
}
