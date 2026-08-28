import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Landmark, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import {
  ratesAPI, findRate, formatRate, formatSpread, formatChangeBps, describeFreshness,
  type RateReading,
} from '@/services/api/rates-api';

/**
 * Interest rates across the board — policy, the Treasury curve, and what
 * households actually pay to borrow.
 *
 * Deliberately not colour-coded the way the market tiles are. A falling
 * mortgage rate is good news if you are borrowing and bad news if you are
 * saving, so painting a drop red (or green) asserts something about the user's
 * position that this widget cannot know. Direction is shown; judgement is not.
 */

const Row = ({ rate, format = formatRate }: {
  rate: RateReading | undefined;
  format?: (value: number | null) => string;
}) => {
  const change = formatChangeBps(rate?.changeBps ?? null);
  const rose = (rate?.changeBps ?? 0) > 0;

  return (
    <div className="flex items-baseline justify-between gap-2 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors">
      <p className="text-xs text-muted-foreground truncate">{rate?.label ?? '—'}</p>
      <div className="flex items-baseline gap-1.5 shrink-0">
        <p className="text-sm font-bold font-mono tabular-nums text-foreground leading-none">
          {format(rate?.value ?? null)}
        </p>
        {change && (
          <span className="flex items-baseline gap-0.5 text-[10px] font-mono tabular-nums text-muted-foreground">
            {rose
              ? <ArrowUp className="h-2.5 w-2.5 self-center" />
              : <ArrowDown className="h-2.5 w-2.5 self-center" />}
            {change}
          </span>
        )}
      </div>
    </div>
  );
};

const ColumnHeading = ({ children }: { children: React.ReactNode }) => (
  <p className="px-3 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
    {children}
  </p>
);

const Freshness = ({ children }: { children: React.ReactNode }) =>
  children ? <p className="px-3 pt-1 text-[10px] text-muted-foreground/70">{children}</p> : null;

const Shell = ({ children, note }: { children: React.ReactNode; note?: string }) => (
  <Card className="h-full">
    <CardHeader className="pb-3 px-4 pt-4">
      <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm sm:text-base">
        <span className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          <span>Rates</span>
        </span>
        {note && (
          <span className="text-[11px] font-normal text-muted-foreground">{note}</span>
        )}
      </CardTitle>
    </CardHeader>
    <CardContent className="px-1 pb-4 pt-0">{children}</CardContent>
  </Card>
);

const RatesSnapshot = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['rates-snapshot'],
    queryFn: () => ratesAPI.snapshot(),
    // Nothing here republishes more than once a day.
    staleTime: 60 * 60 * 1000,
    gcTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Shell>
        <div className="grid gap-4 px-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, column) => (
            <div key={column} className="space-y-2">
              <div className="h-3 w-24 rounded bg-muted/50 shimmer" />
              {Array.from({ length: 4 }).map((_, row) => (
                <div key={row} className="h-8 rounded-lg bg-muted/40 shimmer" />
              ))}
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  if (isError) {
    return (
      <Shell>
        <div className="px-3 py-6 text-center">
          <p className="text-sm font-medium">Rate data is unavailable</p>
          <button
            className="mt-2 text-xs font-medium text-primary hover:underline"
            onClick={() => void refetch()}
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  const rates = data?.rates ?? [];

  // A deployment without FRED_API_KEY answers 200 with an empty set. Say what is
  // actually wrong instead of rendering a grid of dashes.
  if (rates.length === 0 || rates.every((rate) => rate.value == null)) {
    return (
      <Shell>
        <div className="px-3 py-6 text-center">
          <p className="text-sm font-medium">Rate data is unavailable</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data?.warning ?? 'No rate series were returned.'}
          </p>
          <button className="mt-2 text-xs font-medium text-primary hover:underline" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  const upper = findRate(rates, 'DFEDTARU');
  const lower = findRate(rates, 'DFEDTARL');
  const spread = findRate(rates, 'T10Y2Y');

  const targetRange = upper?.value != null && lower?.value != null
    ? `${lower.value.toFixed(2)} – ${upper.value.toFixed(2)}%`
    : '—';

  const nextFomc = data?.nextFomc
    ? new Date(`${data.nextFomc.date}T00:00:00`).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric',
      })
    : null;

  return (
    <Shell note={nextFomc ? `Next Fed decision · ${nextFomc}` : undefined}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

        {/* ── Fed policy ─────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <ColumnHeading>Fed policy</ColumnHeading>
          <div className="mx-3 rounded-xl bg-muted/40 px-3 py-2.5">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-1.5 leading-none">
              Target range
            </p>
            <p className="text-base font-bold font-mono tabular-nums text-foreground leading-none">
              {targetRange}
            </p>
          </div>
          <Row rate={findRate(rates, 'EFFR')} />
          <Row rate={findRate(rates, 'SOFR')} />
          <Freshness>{describeFreshness(findRate(rates, 'EFFR'))}</Freshness>
        </div>

        {/* ── Treasury curve ─────────────────────────────────────────────── */}
        <div className="space-y-1">
          <ColumnHeading>Treasury yields</ColumnHeading>
          <Row rate={findRate(rates, 'DGS3MO')} />
          <Row rate={findRate(rates, 'DGS2')} />
          <Row rate={findRate(rates, 'DGS10')} />
          <Row rate={findRate(rates, 'DGS30')} />
          <Row rate={spread} format={formatSpread} />
          {spread?.value != null && spread.value < 0 && (
            <p className="px-3 pt-1 text-[10px] leading-relaxed text-muted-foreground/80">
              Curve is inverted — short-term Treasuries yield more than long-term.
            </p>
          )}
          <Freshness>{describeFreshness(findRate(rates, 'DGS10'))}</Freshness>
        </div>

        {/* ── Consumer borrowing ─────────────────────────────────────────── */}
        <div className="space-y-1">
          <ColumnHeading>What you'd pay</ColumnHeading>
          <Row rate={findRate(rates, 'MORTGAGE30US')} />
          <Row rate={findRate(rates, 'MORTGAGE15US')} />
          <Row rate={findRate(rates, 'DPRIME')} />
          <Row rate={findRate(rates, 'TERMCBCCALLNS')} />
          <Row rate={findRate(rates, 'TERMCBAUTO48NS')} />
          <Row rate={findRate(rates, 'SNDR')} />
          <Freshness>{describeFreshness(findRate(rates, 'MORTGAGE30US'))}</Freshness>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-3">
        <a
          href={data?.sourceUrl ?? 'https://fred.stlouisfed.org/'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {data?.source ?? 'FRED'}
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
        {data?.warning && (
          <span className="text-[10px] text-muted-foreground/70">{data.warning}</span>
        )}
      </div>
    </Shell>
  );
};

export default RatesSnapshot;
