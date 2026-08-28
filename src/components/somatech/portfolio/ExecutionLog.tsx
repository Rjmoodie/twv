import React, { useState, useEffect, useCallback } from 'react'
import {
  listExecutionLog,
  listPendingOrders,
  generateOrders,
  approveOrders,
  cancelOrders,
  type ExecutionLogEntry,
  type BrokerageConnection,
} from '@/services/brokerage/alpacaService'
import { listBrokerageTrades, type BrokerageTrade, type SchwabConnection } from '@/services/brokerage/schwabService'

interface Props {
  portfolioId: string
  connection: BrokerageConnection | SchwabConnection | null
  onRefreshNeeded?: () => void
}

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-warning/10 text-warning dark:bg-warning/15/30 dark:text-warning',
  submitting:'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  filled:    'bg-accent/10 text-accent dark:bg-accent/30 dark:text-accent',
  cancelled: 'bg-muted text-muted-foreground',
  rejected:  'bg-destructive/10 text-destructive dark:bg-destructive/10/30 dark:text-destructive',
  error:     'bg-destructive/10 text-destructive dark:bg-destructive/10/30 dark:text-destructive',
}

export default function ExecutionLog({ portfolioId, connection, onRefreshNeeded }: Props) {
  const [log, setLog]                 = useState<ExecutionLogEntry[]>([])
  const [brokerTrades, setBrokerTrades] = useState<BrokerageTrade[]>([])
  const [pending, setPending]         = useState<ExecutionLogEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [generating, setGenerating]   = useState(false)
  const [approving, setApproving]     = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [error, setError]             = useState<string | null>(null)
  const [message, setMessage]         = useState<string | null>(null)
  const [tab, setTab]                 = useState<'pending' | 'history'>('pending')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (connection?.provider === 'schwab') {
        const trades = await listBrokerageTrades(500)
        setBrokerTrades(trades.filter(trade => trade.connection_id === connection.id))
        setLog([]); setPending([]); setSelectedIds(new Set())
        return
      }
      const [logData, pendingData] = await Promise.all([
        listExecutionLog(portfolioId),
        listPendingOrders(portfolioId),
      ])
      setLog(logData)
      setPending(pendingData)
      setSelectedIds(new Set(pendingData.map((o) => o.id)))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Execution history could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [portfolioId, connection?.id, connection?.provider])

  useEffect(() => { void load() }, [load])

  async function handleGenerate() {
    if (!connection) return
    setGenerating(true)
    setError(null)
    setMessage(null)
    try {
      const result = await generateOrders(connection.id)
      if (result.paused) {
        setMessage(`⏸ ${result.reason}`)
      } else if (result.orders?.length === 0) {
        setMessage(result.message ?? 'Portfolio is within tolerance — no rebalancing needed')
      } else {
        setMessage(result.message)
        await load()
        setTab('pending')
      }
    } catch (e) {
      setError(String(e).replace('Error: ', ''))
    } finally {
      setGenerating(false)
    }
  }

  async function handleApprove() {
    if (!connection || selectedIds.size === 0) return
    setApproving(true)
    setError(null)
    setMessage(null)
    try {
      const result = await approveOrders(connection.id, Array.from(selectedIds))
      setMessage(`${result.submitted} order${result.submitted !== 1 ? 's' : ''} submitted to Alpaca`)
      await load()
      onRefreshNeeded?.()
    } catch (e) {
      setError(String(e).replace('Error: ', ''))
    } finally {
      setApproving(false)
    }
  }

  async function handleCancel(ids: string[]) {
    if (!connection) return
    try {
      await cancelOrders(connection.id, ids)
      await load()
    } catch (e) {
      setError(String(e).replace('Error: ', ''))
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const hasPending = pending.length > 0

  if (connection?.provider === 'schwab') {
    return <SchwabActivityPanel trades={brokerTrades} loading={loading} error={error} />
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-base">Execution</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {connection ? 'Rebalance orders and activity log' : 'Connect a brokerage account to enable trading'}
            </p>
          </div>
          {connection && !connection.kill_switch && (
            <button
              onClick={handleGenerate}
              disabled={generating || !connection}
              className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {generating ? 'Analyzing…' : 'Generate Orders'}
            </button>
          )}
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-destructive/10 dark:bg-destructive/10/20 text-sm text-destructive dark:text-destructive border border-destructive/20 dark:border-destructive/20">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-3 p-3 rounded-lg bg-muted/60 text-sm text-foreground border border-border">
            {message}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['pending', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'pending' ? `Pending${hasPending ? ` (${pending.length})` : ''}` : 'History'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted/40 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : tab === 'pending' ? (
          <PendingPanel
            orders={pending}
            selectedIds={selectedIds}
            onToggle={toggleSelect}
            onApprove={handleApprove}
            onCancel={(id) => handleCancel([id])}
            onCancelAll={() => handleCancel(pending.map((o) => o.id))}
            approving={approving}
            requiresApproval={connection?.approval_required ?? true}
          />
        ) : (
          <HistoryPanel entries={log.filter((e) => e.status !== 'pending')} />
        )}
      </div>
    </div>
  )
}

function SchwabActivityPanel({ trades, loading, error }: { trades: BrokerageTrade[]; loading: boolean; error: string | null }) {
  return <div className="rounded-xl border border-border bg-card">
    <div className="border-b px-6 py-5">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="font-semibold">Broker activity</h3><p className="mt-0.5 text-sm text-muted-foreground">Executed Schwab fills · read only · never auto-published</p></div>
        <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{trades.length} fill{trades.length === 1 ? '' : 's'}</span>
      </div>
      {error && <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    </div>
    <div className="p-4">
      {loading ? <div className="space-y-2">{[1, 2, 3].map(value => <div key={value} className="h-12 animate-pulse rounded-lg bg-muted/40" />)}</div>
        : trades.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">No supported fills have been imported yet. The first sync runs after authorization.</div>
        : <div className="space-y-1.5">{trades.slice(0, 100).map(trade => <div key={trade.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/40">
          <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${trade.side === 'buy' ? 'bg-accent/10 text-accent' : 'bg-destructive/10 text-destructive'}`}>{trade.side.toUpperCase()}</span>
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">{trade.ticker}</p><p className="text-xs text-muted-foreground">{new Date(trade.filled_at).toLocaleString()}</p></div>
          <div className="text-right"><p className="text-sm tabular-nums">{trade.qty.toLocaleString()} {trade.qty === 1 ? 'unit' : 'units'}</p><p className="text-xs text-muted-foreground">{trade.filled_avg_price == null ? 'Price unavailable' : `@ $${trade.filled_avg_price.toFixed(2)}`}</p></div>
        </div>)}</div>}
      <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">Fills are broker facts. Add strategy and lessons in Trades; sharing with members requires a separate reviewed publication draft.</p>
    </div>
  </div>
}

// ─── Pending Panel ─────────────────────────────────────────────────────────────

function PendingPanel({
  orders, selectedIds, onToggle, onApprove, onCancel, onCancelAll, approving, requiresApproval,
}: {
  orders: ExecutionLogEntry[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onApprove: () => void
  onCancel: (id: string) => void
  onCancelAll: () => void
  approving: boolean
  requiresApproval: boolean
}) {
  if (orders.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        No pending orders. Click "Generate Orders" to analyze drift and create a rebalance plan.
      </div>
    )
  }

  const totalNotional = orders
    .filter((o) => selectedIds.has(o.id))
    .reduce((s, o) => s + (o.notional_usd ?? 0), 0)

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div
          key={order.id}
          className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
            selectedIds.has(order.id) ? 'border-foreground/40 bg-muted/30' : 'border-border bg-transparent'
          }`}
        >
          {requiresApproval && (
            <input
              type="checkbox"
              checked={selectedIds.has(order.id)}
              onChange={() => onToggle(order.id)}
              className="mt-0.5 accent-foreground"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                order.action === 'BUY'
                  ? 'bg-accent/10 text-accent dark:bg-accent/30 dark:text-accent'
                  : 'bg-destructive/10 text-destructive dark:bg-destructive/10/30 dark:text-destructive'
              }`}>
                {order.action}
              </span>
              <span className="font-semibold text-sm">{order.ticker}</span>
              <span className="text-xs text-muted-foreground">{order.bucket.replace(/_/g, ' ')}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{order.rationale}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-semibold">
              ${order.notional_usd?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <button
              onClick={() => onCancel(order.id)}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <div className="pt-2 border-t border-border flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''} · <span className="font-medium text-foreground">${totalNotional.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} notional</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancelAll}
            className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel All
          </button>
          <button
            onClick={onApprove}
            disabled={approving || selectedIds.size === 0}
            className="px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent disabled:opacity-40 transition-opacity"
          >
            {approving
              ? 'Submitting…'
              : `${requiresApproval ? 'Approve & Submit' : 'Submit'} (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── History Panel ─────────────────────────────────────────────────────────────

function HistoryPanel({ entries }: { entries: ExecutionLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        No order history yet.
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/40 transition-colors">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
            entry.action === 'BUY'
              ? 'bg-accent/10 text-accent dark:bg-accent/30 dark:text-accent'
              : 'bg-destructive/10 text-destructive dark:bg-destructive/10/30 dark:text-destructive'
          }`}>
            {entry.action}
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm">{entry.ticker}</span>
            <span className="text-xs text-muted-foreground ml-2">{entry.bucket.replace(/_/g, ' ')}</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">
              ${entry.notional_usd?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) ?? '—'}
            </div>
            {entry.fill_price && (
              <div className="text-xs text-muted-foreground">@ ${entry.fill_price.toFixed(2)}</div>
            )}
          </div>
          <div className="w-20 text-right">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[entry.status] ?? ''}`}>
              {entry.status}
            </span>
          </div>
          <div className="w-28 text-right text-xs text-muted-foreground">
            {new Date(entry.created_at).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  )
}
