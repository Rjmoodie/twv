import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { MarketData } from "./mockData";

interface MarketSnapshotProps {
  marketData: MarketData | null;
  warning?: string | null;
}

const quoteTime = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;
};

const MarketSnapshot = ({ marketData, warning }: MarketSnapshotProps) => {
  if (!marketData) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3 px-4 pt-4">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span>Markets</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4 pt-0">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[62px] rounded-xl bg-muted/40 shimmer" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const indices = [
    { name: "SPY ETF",  value: marketData.sp500, change: marketData.change?.sp500, asOf: marketData.asOf.sp500, stale: marketData.stale.sp500 },
    { name: "QQQ ETF",  value: marketData.nasdaq, change: marketData.change?.nasdaq, asOf: marketData.asOf.nasdaq, stale: marketData.stale.nasdaq },
    { name: "DIA ETF",  value: marketData.dow, change: marketData.change?.dow, asOf: marketData.asOf.dow, stale: marketData.stale.dow },
    { name: "VIXY ETF", value: marketData.vix, change: marketData.change?.vix, asOf: marketData.asOf.vix, stale: marketData.stale.vix },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3 px-4 pt-4">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span>Markets</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4 pt-0">
        {indices.map((idx) => (
          <div
            key={idx.name}
            className="flex flex-col px-3 py-2.5 bg-muted/40 rounded-xl hover:bg-muted/70 transition-colors"
          >
            {/* Label row */}
            <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-1.5 leading-none">
              {idx.name}
            </p>
            {/* Value + change row — items-baseline aligns across different font sizes */}
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-bold font-mono tabular-nums text-foreground leading-none">
                {idx.value == null ? '—' : `$${idx.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
              </p>
              <div className="flex items-baseline gap-1 shrink-0">
                {idx.change != null && (idx.change >= 0
                  ? <TrendingUp  className="h-3 w-3 text-success self-center" />
                  : <TrendingDown className="h-3 w-3 text-destructive self-center" />)}
                <span className={`text-xs font-mono font-semibold tabular-nums leading-none ${idx.change == null ? "text-muted-foreground" : idx.change >= 0 ? "text-success" : "text-destructive"}`}>
                  {idx.change == null ? '—' : `${idx.change > 0 ? "+" : ""}${idx.change.toFixed(2)}%`}
                </span>
              </div>
            </div>
            <p className={`mt-1 text-[9px] ${idx.stale ? 'text-warning' : 'text-muted-foreground/70'}`}>
              {quoteTime(idx.asOf)
                ? `${idx.stale ? 'Cached · ' : ''}as of ${quoteTime(idx.asOf)}`
                : 'Observation time unavailable'}
            </p>
          </div>
        ))}
        {(warning || marketData.warning) && (
          <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-[10px] text-muted-foreground" role="status">
            {warning ?? marketData.warning}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default MarketSnapshot;
