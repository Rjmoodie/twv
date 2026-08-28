import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/components/somatech/AuthProvider'
import {
  disconnectSchwab,
  listActiveUserSchwabConnections,
  listBrokerageTrades,
  syncSchwabConnection,
  updateBrokerageTradeStrategy,
  type SchwabConnection,
} from '@/services/brokerage/schwabService'

export interface Trade {
  id: string
  alpaca_order_id: string
  provider: 'schwab' | 'alpaca'
  ticker: string
  side: 'buy' | 'sell'
  qty: number
  filled_avg_price: number | null
  notional: number | null
  filled_at: string | null
  strategy: string | null
  synced_at: string
  source_as_of: string | null
}

interface TradesContextType {
  trades: Trade[]
  connection: SchwabConnection | null
  connections: SchwabConnection[]
  isLoading: boolean
  isSyncing: boolean
  error: string | null
  syncTrades: () => Promise<void>
  updateTradeStrategy: (tradeId: string, strategy: string) => Promise<void>
  disconnectBroker: () => Promise<void>
}

const TradesContext = createContext<TradesContextType | undefined>(undefined)

function normalizeTrade(row: Awaited<ReturnType<typeof listBrokerageTrades>>[number]): Trade {
  return {
    id: row.id,
    alpaca_order_id: row.provider_execution_id,
    provider: row.provider,
    ticker: row.ticker,
    side: row.side,
    qty: row.qty,
    filled_avg_price: row.filled_avg_price,
    notional: row.notional,
    filled_at: row.filled_at,
    strategy: row.strategy,
    synced_at: row.synced_at,
    source_as_of: row.source_as_of,
  }
}

export const TradesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [trades, setTrades] = useState<Trade[]>([])
  const [connections, setConnections] = useState<SchwabConnection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user) { setTrades([]); setConnections([]); return }
    const [connectionRows, tradeRows] = await Promise.all([
      listActiveUserSchwabConnections(), listBrokerageTrades(2000),
    ])
    setConnections(connectionRows)
    setTrades(tradeRows.map(normalizeTrade))
  }, [user])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    reload().catch(() => { if (!cancelled) setError('Failed to load broker trade data') })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [reload])

  const syncTrades = useCallback(async () => {
    if (!user || isSyncing || !connections.length) return
    setIsSyncing(true); setError(null)
    try {
      for (const connection of connections) await syncSchwabConnection(connection.id)
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Schwab sync failed; cached fills were preserved')
    } finally { setIsSyncing(false) }
  }, [connections, isSyncing, reload, user])

  const updateTradeStrategy = useCallback(async (tradeId: string, strategy: string) => {
    if (!user) return
    await updateBrokerageTradeStrategy(tradeId, user.id, strategy)
    setTrades(previous => previous.map(trade => trade.id === tradeId ? { ...trade, strategy } : trade))
  }, [user])

  const disconnectBroker = useCallback(async () => {
    const authorizationIds = [...new Set(connections.map(connection => connection.authorization_id))]
    for (const authorizationId of authorizationIds) await disconnectSchwab(authorizationId)
    await reload()
  }, [connections, reload])

  return <TradesContext.Provider value={{
    trades,
    connection: connections[0] ?? null,
    connections,
    isLoading,
    isSyncing,
    error,
    syncTrades,
    updateTradeStrategy,
    disconnectBroker,
  }}>{children}</TradesContext.Provider>
}

export function useTrades() {
  const context = useContext(TradesContext)
  if (!context) throw new Error('useTrades must be used within TradesProvider')
  return context
}
