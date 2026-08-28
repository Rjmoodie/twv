import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react'
import { useTrades } from './context/TradesProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function ConnectBrokerDialog() {
  const { connection, connections, isSyncing, error, syncTrades } = useTrades()

  if (!connection) {
    return <Card className="app-card">
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5"><ShieldCheck className="h-5 w-5 text-primary" /></div>
          <div><div className="flex items-center gap-2"><p className="font-medium">Connect Schwab in Portfolio</p><Badge>Primary source</Badge><Badge variant="secondary">Read only</Badge></div>
            <p className="mt-1 text-sm text-muted-foreground">Trades uses the same verified fills and freshness controls as Portfolio—no duplicate broker credentials.</p></div>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => window.location.assign('/?module=portfolio&portfolio_tab=brokerage')}>
          Open Portfolio <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  }

  return <Card className="app-card">
    <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-accent/10 p-2.5"><CheckCircle2 className="h-5 w-5 text-accent" /></div>
        <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">Schwab fills connected</p><Badge>Primary</Badge><Badge variant="secondary">Read only</Badge></div>
          <p className="mt-1 text-xs text-muted-foreground">{connections.length} linked account{connections.length === 1 ? '' : 's'} · {connection.provider_data_as_of ? `broker data as of ${new Date(connection.provider_data_as_of).toLocaleString()}` : 'initial sync pending'}</p></div>
      </div>
      <div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => void syncTrades()} disabled={isSyncing} className="gap-1.5"><RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />{isSyncing ? 'Syncing…' : 'Sync fills'}</Button>
        <Button size="sm" variant="ghost" onClick={() => window.location.assign('/?module=portfolio&portfolio_tab=brokerage')}>Manage</Button></div>
    </CardContent>
    {error && <CardContent className="pt-0"><div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}</div></CardContent>}
  </Card>
}
