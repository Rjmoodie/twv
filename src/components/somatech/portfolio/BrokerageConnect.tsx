import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Database, Landmark, RefreshCw, ShieldCheck, Unlink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  deleteSchwabImportedData,
  disconnectSchwab,
  freshnessLabel,
  getSchwabAuthorization,
  listSchwabConnections,
  startSchwabAuthorization,
  syncSchwabConnection,
  type SchwabAuthorization,
  type SchwabConnection,
} from '@/services/brokerage/schwabService'

interface Props {
  portfolioId: string
  onConnectionChange?: (connection: SchwabConnection | null) => void
}

const statusStyle: Record<string, string> = {
  active: 'bg-accent/10 text-accent', expiring: 'bg-warning/10 text-warning',
  expired: 'bg-destructive/10 text-destructive', revoked: 'bg-destructive/10 text-destructive',
  error: 'bg-destructive/10 text-destructive', disconnected: 'bg-muted text-muted-foreground',
}

function expiryLabel(authorization: SchwabAuthorization | null) {
  if (!authorization) return null
  const ms = new Date(authorization.refresh_expires_at).getTime() - Date.now()
  if (!Number.isFinite(ms)) return null
  if (ms <= 0) return 'Authorization expired'
  const hours = Math.ceil(ms / 3_600_000)
  return hours <= 48 ? `Reconnect within ${hours}h` : `Reconnect in ${Math.ceil(hours / 24)} days`
}

export default function BrokerageConnect({ portfolioId, onConnectionChange }: Props) {
  const { toast } = useToast()
  const [connections, setConnections] = useState<SchwabConnection[]>([])
  const [authorization, setAuthorization] = useState<SchwabAuthorization | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const primary = useMemo(
    () => connections.find(connection => connection.is_primary && connection.is_active)
      ?? connections.find(connection => connection.is_active) ?? null,
    [connections],
  )

  async function load() {
    setLoading(true); setError(null)
    try {
      const rows = await listSchwabConnections(portfolioId)
      setConnections(rows)
      const active = rows.find(row => row.is_primary && row.is_active) ?? rows.find(row => row.is_active) ?? null
      onConnectionChange?.(active)
      const authorizationId = active?.authorization_id ?? rows[0]?.authorization_id
      setAuthorization(authorizationId ? await getSchwabAuthorization(authorizationId) : null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load Schwab connection')
      onConnectionChange?.(null)
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [portfolioId])
  // The OAuth result arrives as a query parameter, so it has to be consumed:
  // left in the URL it re-announces itself every time this tab is mounted, and
  // survives every subsequent navigation.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('brokerage_connected') === 'schwab'
    const failed = params.has('brokerage_error')
    if (!connected && !failed) return

    if (connected) {
      toast({ title: 'Schwab connected', description: 'The first read-only sync has been queued.' })
    } else {
      toast({ title: 'Schwab connection was not completed', description: 'No portfolio data was changed. Try connecting again.', variant: 'destructive' })
    }

    params.delete('brokerage_connected')
    params.delete('brokerage_error')
    const query = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
  }, [toast])

  async function connect(reconnect = false) {
    setWorking('authorize'); setError(null)
    try { await startSchwabAuthorization(portfolioId, reconnect ? authorization?.id : undefined) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start Schwab authorization'); setWorking(null) }
  }

  async function sync(connection: SchwabConnection) {
    setWorking(connection.id); setError(null)
    try {
      const result = await syncSchwabConnection(connection.id)
      await load()
      toast({ title: 'Schwab data refreshed', description: `${result.positions} positions and ${result.executions} fills checked.` })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Schwab sync could not complete') }
    finally { setWorking(null) }
  }

  async function disconnect() {
    if (!authorization || !window.confirm('Disconnect Schwab? Updates stop, but imported history is retained and marked stale.')) return
    setWorking('disconnect')
    try {
      await disconnectSchwab(authorization.id); await load()
      toast({ title: 'Schwab disconnected', description: 'Imported facts were retained and labeled as stale.' })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not disconnect Schwab') }
    finally { setWorking(null) }
  }

  async function removeImportedData() {
    if (!authorization || !window.confirm('Permanently remove imported Schwab positions, balances, fills, and journal links from SomaTech? This cannot be undone. Your Schwab account is not affected.')) return
    setWorking('delete')
    try { await deleteSchwabImportedData(authorization.id); await load(); toast({ title: 'Imported Schwab data removed' }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove imported Schwab data') }
    finally { setWorking(null) }
  }

  if (loading) return <div className="h-56 animate-pulse rounded-xl border bg-card" />

  if (!connections.length) {
    return <div className="rounded-xl border bg-card p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5"><Landmark className="h-5 w-5 text-primary" /></div>
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">Connect Schwab</h3><Badge>Primary source</Badge><Badge variant="secondary">Read only</Badge></div>
          <p className="mt-1 text-sm text-muted-foreground">Import actual balances, positions, cost basis and fills. SomaTech has no Schwab order-placement capability.</p></div>
      </div>
      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border p-3"><ShieldCheck className="mb-2 h-4 w-4 text-accent" /><p className="font-medium">OAuth protected</p><p className="mt-1 text-xs text-muted-foreground">No Schwab password is shared.</p></div>
        <div className="rounded-lg border p-3"><Database className="mb-2 h-4 w-4 text-primary" /><p className="font-medium">Source labeled</p><p className="mt-1 text-xs text-muted-foreground">Every value carries its timestamp.</p></div>
        <div className="rounded-lg border p-3"><CheckCircle2 className="mb-2 h-4 w-4 text-accent" /><p className="font-medium">Reconciled</p><p className="mt-1 text-xs text-muted-foreground">Positions and cash are checked against value.</p></div>
      </div>
      {error && <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Button className="mt-5 w-full" onClick={() => void connect()} disabled={working === 'authorize'}>{working === 'authorize' ? 'Opening Schwab…' : 'Connect Schwab securely'}</Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">You will leave SomaTech briefly to authorize access on Schwab.</p>
    </div>
  }

  const expiry = expiryLabel(authorization)
  const needsReconnect = !primary || ['expiring', 'expired', 'revoked', 'disconnected'].includes(authorization?.status ?? primary.connection_status)
  return <div className="space-y-4 rounded-xl border bg-card p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">Schwab brokerage</h3><Badge>Primary source</Badge><Badge variant="secondary">Read only</Badge>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[authorization?.status ?? primary?.connection_status ?? 'error']}`}>{authorization?.status ?? primary?.connection_status ?? 'unknown'}</span></div>
        <p className="mt-1 text-sm text-muted-foreground">{primary ? freshnessLabel(primary) : 'Updates are stopped. Retained data is stale.'}</p>
        {expiry && <p className={`mt-1 text-xs ${needsReconnect ? 'text-warning' : 'text-muted-foreground'}`}>{expiry}</p>}</div>
      <Button variant={needsReconnect ? 'default' : 'outline'} size="sm" onClick={() => void connect(true)} disabled={working === 'authorize'}>{needsReconnect ? 'Reconnect Schwab' : 'Renew authorization'}</Button>
    </div>
    {error && <div className="flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
    <div className="space-y-2">{connections.map(connection => <div key={connection.id} className="rounded-lg border p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="text-sm font-medium">{connection.display_name ?? `Schwab ••••${connection.account_number_last_four ?? ''}`}</p>{connection.is_primary && <Badge variant="secondary" className="text-[10px]">Portfolio source</Badge>}</div>
        <p className="mt-1 text-xs text-muted-foreground">{connection.account_type ?? 'Brokerage account'} · {freshnessLabel(connection)}</p></div>
        {connection.is_active && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void sync(connection)} disabled={working === connection.id || needsReconnect}><RefreshCw className={`h-3.5 w-3.5 ${working === connection.id ? 'animate-spin' : ''}`} />{working === connection.id ? 'Syncing…' : 'Sync now'}</Button>}</div>
      {connection.reconciliation_status !== 'reconciled' && connection.provider_data_as_of && <div className="mt-3 flex gap-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{connection.reconciliation_status === 'unsupported' ? 'Some instruments stay in the broker ledger but are excluded from allocation and P&L math until they can be valued safely.' : `Account reconciliation needs review${connection.reconciliation_variance == null ? '' : ` (difference $${Number(connection.reconciliation_variance).toFixed(2)})`}.`}</div>}
    </div>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4"><p className="max-w-md text-xs text-muted-foreground">Disconnect preserves an auditable history. Removing imported data is a separate permanent action.</p><div className="flex gap-2">
      {connections.some(connection => connection.is_active) ? <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={() => void disconnect()} disabled={working === 'disconnect'}><Unlink className="h-3.5 w-3.5" />Disconnect</Button> : <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void removeImportedData()} disabled={working === 'delete'}>Remove imported data</Button>}
    </div></div>
  </div>
}
