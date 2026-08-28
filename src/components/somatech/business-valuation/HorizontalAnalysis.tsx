import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, TrendingUp, TrendingDown, Minus as FlatIcon } from 'lucide-react';

const METRICS = ['Revenue', 'Gross Profit', 'Operating Income', 'Net Income'] as const;
type Metric = typeof METRICS[number];

const TESLA_PRESET: { years: string[]; data: Record<Metric, (number | null)[]> } = {
  years: ['2018', '2019', '2020', '2021', '2022'],
  data: {
    Revenue:           [21461, 24578, 31536, 53823, 81462],
    'Gross Profit':    [4042,  4069,  6630,  13606, 20853],
    'Operating Income':[388,   -69,   1994,  6523,  13656],
    'Net Income':      [976,   -862,  721,   5519,  12556],
  },
};

function calcYoY(prev: number | null, curr: number | null): { abs: number | null; pct: number | null } {
  if (prev == null || curr == null || prev === 0) return { abs: null, pct: null };
  return { abs: curr - prev, pct: ((curr - prev) / Math.abs(prev)) * 100 };
}

function calcCAGR(first: number | null, last: number | null, n: number): number | null {
  // CAGR is undefined when either boundary is non-positive or the ratio is negative
  if (first == null || last == null || first <= 0 || last <= 0 || n <= 0) return null;
  const result = (Math.pow(last / first, 1 / n) - 1) * 100;
  return isFinite(result) ? result : null;
}

const fmt = (n: number | null, isMillions = true) => {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (isMillions) {
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}B`;
    return `${sign}$${abs.toFixed(0)}M`;
  }
  return `${sign}${abs.toFixed(1)}%`;
};

const fmtPct = (n: number | null) => {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
};

function Arrow({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-muted-foreground text-xs">—</span>;
  if (pct > 5) return <TrendingUp className="h-3 w-3 text-accent inline" />;
  if (pct < -5) return <TrendingDown className="h-3 w-3 text-destructive inline" />;
  return <FlatIcon className="h-3 w-3 text-muted-foreground inline" />;
}

function pctColor(pct: number | null): string {
  if (pct == null) return 'text-muted-foreground';
  if (pct > 5) return 'text-accent';
  if (pct < -5) return 'text-destructive';
  return 'text-muted-foreground';
}

export default function HorizontalAnalysis() {
  const [years, setYears] = useState<string[]>(['2020', '2021', '2022', '2023', '2024']);
  const [data, setData] = useState<Record<Metric, (number | null)[]>>({
    Revenue:            [null, null, null, null, null],
    'Gross Profit':     [null, null, null, null, null],
    'Operating Income': [null, null, null, null, null],
    'Net Income':       [null, null, null, null, null],
  });

  const addYear = () => {
    if (years.length >= 7) return;
    const lastNum = Number(years[years.length - 1]);
    const next = isNaN(lastNum) ? String(new Date().getFullYear() + years.length) : String(lastNum + 1);
    setYears((y) => [...y, next]);
    setData((d) => {
      const out = { ...d };
      METRICS.forEach((m) => { out[m] = [...out[m], null]; });
      return out;
    });
  };

  const removeYear = () => {
    if (years.length <= 2) return;
    setYears((y) => y.slice(0, -1));
    setData((d) => {
      const out = { ...d };
      METRICS.forEach((m) => { out[m] = out[m].slice(0, -1); });
      return out;
    });
  };

  const loadPreset = () => {
    setYears([...TESLA_PRESET.years]);
    setData({ ...TESLA_PRESET.data } as any);
  };

  const updateCell = (metric: Metric, colIdx: number, val: string) => {
    const num = val === '' || val === '-' ? null : Number(val);
    setData((d) => {
      const row = [...d[metric]];
      row[colIdx] = num;
      return { ...d, [metric]: row };
    });
  };

  const n = years.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <p className="text-sm text-muted-foreground">
          Enter financial figures (in millions) across years to see year-over-year changes and compounded growth rates.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={loadPreset}>
            Load Tesla example
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={removeYear} disabled={years.length <= 2}>
            <Minus className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={addYear} disabled={years.length >= 7}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Year header inputs */}
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          {/* Year row */}
          <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: `160px repeat(${n}, 1fr)` }}>
            <span className="text-xs text-muted-foreground font-medium py-1">Metric ($M)</span>
            {years.map((yr, i) => (
              <Input
                key={i}
                value={yr}
                onChange={(e) => setYears((y) => y.map((v, idx) => (idx === i ? e.target.value : v)))}
                className="text-center text-xs h-7 font-medium"
              />
            ))}
          </div>

          {/* Data rows */}
          {METRICS.map((metric) => (
            <div key={metric}>
              {/* Input row */}
              <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `160px repeat(${n}, 1fr)` }}>
                <span className="text-xs font-medium flex items-center">{metric}</span>
                {data[metric].map((val, i) => (
                  <Input
                    key={i}
                    type="number"
                    value={val ?? ''}
                    onChange={(e) => updateCell(metric, i, e.target.value)}
                    placeholder="—"
                    className="text-center text-xs h-7 font-mono"
                  />
                ))}
              </div>

              {/* YoY row */}
              <div
                className="grid gap-1 mb-3 pb-3 border-b border-border"
                style={{ gridTemplateColumns: `160px repeat(${n}, 1fr)` }}
              >
                <span className="text-[10px] text-muted-foreground flex items-center pl-2">YoY change</span>
                {data[metric].map((_, i) => {
                  if (i === 0) return <span key={i} className="text-center text-[10px] text-muted-foreground">base</span>;
                  const { pct } = calcYoY(data[metric][i - 1], data[metric][i]);
                  return (
                    <span key={i} className={`text-center text-[10px] font-mono flex items-center justify-center gap-0.5 ${pctColor(pct)}`}>
                      <Arrow pct={pct} />
                      {fmtPct(pct)}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}

          {/* CAGR summary row */}
          <div className="mt-2">
            <p className="text-xs font-semibold text-muted-foreground mb-2">CAGR ({years[0]} → {years[n - 1]})</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: `160px repeat(${METRICS.length}, 1fr)` }}>
              <span className="text-xs text-muted-foreground">Compound growth</span>
              {METRICS.map((metric) => {
                const first = data[metric][0];
                const last = data[metric][n - 1];
                const cagr = calcCAGR(first, last, n - 1);
                return (
                  <div key={metric} className="text-center">
                    <Badge
                      variant="secondary"
                      className={`text-xs font-mono ${cagr == null ? '' : cagr > 0 ? 'bg-emerald-100 text-accent dark:bg-emerald-900/40 dark:text-accent' : 'bg-destructive/10 text-destructive dark:bg-destructive/10/40 dark:text-destructive'}`}
                    >
                      {cagr == null ? '—' : `${cagr >= 0 ? '+' : ''}${cagr.toFixed(1)}%`}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">{metric.split(' ')[0]}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Most recent year on the left is industry convention — reversed from typical reading order. CAGR (compound annual growth rate) smooths lumpy years into a single representative growth rate.
      </p>
    </div>
  );
}
