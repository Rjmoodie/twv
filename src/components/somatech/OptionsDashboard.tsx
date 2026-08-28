import { useMemo } from 'react';
import { Activity, AlertTriangle, Link2, Loader2, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useOptionsPositions } from '@/hooks/useOptionsPositions';
import { useNavigation } from '@/contexts/NavigationContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import FinancialDisclaimer from './FinancialDisclaimer';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function OptionsDashboard() {
  const { positions, volumeAlerts, connected, isLoading, error, refresh } = useOptionsPositions();
  const { navigateToModule } = useNavigation();
  const totals = useMemo(() => ({
    marketValue: positions.reduce((sum, position) => sum + position.marketValue, 0),
    unrealizedPl: positions.reduce((sum, position) => sum + position.unrealizedPl, 0),
    expiringSoon: positions.filter((position) => position.daysToExpiry != null && position.daysToExpiry <= 14).length,
  }), [positions]);

  if (isLoading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (error && !connected) {
    return <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center px-6 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <h2 className="mt-4 text-lg font-semibold">Options data is temporarily unavailable</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      <Button className="mt-5 gap-2" onClick={refresh}><RefreshCw className="h-4 w-4" />Try again</Button>
    </div>;
  }

  if (!connected) {
    return <div className="mx-auto flex min-h-80 max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10"><Link2 className="h-6 w-6 text-primary" /></div>
      <h2 className="mt-4 text-lg font-semibold">Connect Alpaca to analyze your options</h2>
      <p className="mt-2 text-sm text-muted-foreground">SomaTech only displays positions and activity returned by your connected account. It does not invent strategy performance or trade recommendations.</p>
      <Button className="mt-5" onClick={() => navigateToModule('portfolio')}>Open brokerage settings</Button>
    </div>;
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Activity className="h-6 w-6 text-primary" />Options positions</h1><p className="mt-1 text-sm text-muted-foreground">Current Alpaca positions and market activity. Values refresh from the connected providers.</p></div>
      <Button variant="outline" size="sm" className="gap-2" onClick={refresh}><RefreshCw className="h-4 w-4" />Refresh</Button>
    </div>

    {error && <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><div><p className="font-medium">Options data could not be refreshed</p><p className="text-muted-foreground">{error}</p></div></div>}

    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Open positions" value={String(positions.length)} />
      <Metric label="Market value" value={money.format(totals.marketValue)} />
      <Metric label="Unrealized P&L" value={money.format(totals.unrealizedPl)} tone={totals.unrealizedPl >= 0 ? 'positive' : 'negative'} detail={`${totals.expiringSoon} expiring within 14 days`} />
    </div>

    <Card><CardHeader><CardTitle>Open positions</CardTitle><CardDescription>Contract details and values reported by Alpaca.</CardDescription></CardHeader><CardContent>
      {positions.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No open option positions were returned.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
        <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Contract</th><th>Underlying</th><th>Expiry</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Value</th><th className="text-right">P&L</th></tr></thead>
        <tbody>{positions.map((position) => <tr key={position.symbol} className="border-b last:border-0"><td className="py-3 font-mono font-medium">{position.symbol}</td><td>{position.ticker}</td><td>{position.expiry ?? '—'}{position.daysToExpiry != null && <span className="ml-1 text-xs text-muted-foreground">({position.daysToExpiry}d)</span>}</td><td className="text-right tabular-nums">{position.qty}</td><td className="text-right tabular-nums">{money.format(position.currentPrice)}</td><td className="text-right tabular-nums">{money.format(position.marketValue)}</td><td className={`text-right font-medium tabular-nums ${position.unrealizedPl >= 0 ? 'text-accent' : 'text-destructive'}`}>{money.format(position.unrealizedPl)} <span className="text-xs">({position.unrealizedPlPct.toFixed(1)}%)</span></td></tr>)}</tbody>
      </table></div>}
    </CardContent></Card>

    <Card><CardHeader><CardTitle>Underlying volume watch</CardTitle><CardDescription>High-volume equity activity for context. These are not options-flow signals or trade recommendations.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {volumeAlerts.length === 0 ? <p className="text-sm text-muted-foreground">No volume context is currently available.</p> : volumeAlerts.map((alert) => <div key={alert.ticker} className="rounded-xl border p-3"><div className="flex items-center justify-between"><span className="font-semibold">{alert.ticker}</span><Badge variant={alert.sentiment === 'Bullish' ? 'secondary' : 'destructive'}>{alert.sentiment}</Badge></div><div className="mt-3 flex items-center justify-between text-sm"><span className="text-muted-foreground">Change</span><span className="flex items-center gap-1 font-medium">{alert.changePercent >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-accent" /> : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}{alert.changePercent.toFixed(2)}%</span></div><div className="mt-1 flex items-center justify-between text-sm"><span className="text-muted-foreground">Volume</span><span className="tabular-nums">{alert.volume.toLocaleString()}</span></div></div>)}
    </CardContent></Card>
    <FinancialDisclaimer compact />
  </div>;
}

function Metric({ label, value, tone, detail }: { label: string; value: string; tone?: 'positive' | 'negative'; detail?: string }) {
  return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-bold tabular-nums ${tone === 'positive' ? 'text-accent' : tone === 'negative' ? 'text-destructive' : ''}`}>{value}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</CardContent></Card>;
}
