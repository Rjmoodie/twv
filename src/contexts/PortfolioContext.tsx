import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/components/somatech/AuthProvider'
import {
  listPortfolios,
  createPortfolio as svcCreate,
  updatePortfolio as svcUpdate,
  deletePortfolio as svcDelete,
  setDefaultPortfolio as svcSetDefault,
  computeAllocationDrift,
  getHoldingMarketValue,
  type AllocationDrift,
} from '@/services/portfolio/portfolioService'
import type {
  Portfolio,
  CreatePortfolioInput,
  AllocationTarget,
} from '@/types/portfolio'

interface PortfolioContextValue {
  portfolios:       Portfolio[]
  active:           Portfolio | null
  drifts:           AllocationDrift[]
  loading:          boolean
  error:            string | null
  setActive:        (id: string) => void
  createPortfolio:  (input: CreatePortfolioInput) => Promise<Portfolio>
  updatePortfolio:  (id: string, updates: Partial<Portfolio>) => Promise<void>
  deletePortfolio:  (id: string) => Promise<void>
  setDefault:       (id: string) => Promise<void>
  refresh:          () => Promise<void>
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null)

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [activeId, setActiveId]     = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [dataUserId, setDataUserId] = useState<string | null>(null)
  const refreshSequence = useRef(0)

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current
    if (!user?.id) {
      setPortfolios([])
      setActiveId(null)
      setError(null)
      setDataUserId(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await listPortfolios(user.id)
      if (sequence !== refreshSequence.current) return
      setPortfolios(data)
      setDataUserId(user.id)
      setError(null)
      // Preserve active selection if still valid; else fall back to default
      setActiveId((prev) => {
        if (prev && data.some((p) => p.id === prev)) return prev
        return data.find((p) => p.is_default)?.id ?? data[0]?.id ?? null
      })
    } catch (cause) {
      if (sequence !== refreshSequence.current) return
      console.error('Failed to load portfolios:', cause)
      setPortfolios([])
      setActiveId(null)
      setDataUserId(user.id)
      setError(cause instanceof Error ? cause.message : 'Portfolio data could not be loaded.')
    } finally {
      if (sequence === refreshSequence.current) setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    const handleOnline = () => { if (error) void refresh() }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [error, refresh])

  const ownsData = Boolean(user?.id && dataUserId === user.id)
  const visiblePortfolios = ownsData ? portfolios : []
  const active = visiblePortfolios.find((p) => p.id === activeId) ?? visiblePortfolios[0] ?? null

  // Compute drift for active portfolio
  const drifts: AllocationDrift[] = React.useMemo(() => {
    if (!active?.allocations || !active?.holdings) return []
    const totalValue = active.holdings.reduce((s, h) => s + getHoldingMarketValue(h), 0)
    return computeAllocationDrift(active.allocations as AllocationTarget[], active.holdings, totalValue)
  }, [active])

  const createPortfolio = useCallback(async (input: CreatePortfolioInput): Promise<Portfolio> => {
    if (!user?.id) throw new Error('Not authenticated')
    const p = await svcCreate(user.id, input)
    await refresh()
    setActiveId(p.id)
    return p
  }, [user?.id, refresh])

  const updatePortfolio = useCallback(async (id: string, updates: Partial<Portfolio>) => {
    await svcUpdate(id, updates)
    await refresh()
  }, [refresh])

  const deletePortfolio = useCallback(async (id: string) => {
    await svcDelete(id)
    await refresh()
  }, [refresh])

  const setDefault = useCallback(async (id: string) => {
    if (!user?.id) return
    await svcSetDefault(user.id, id)
    await refresh()
  }, [user?.id, refresh])

  return (
    <PortfolioContext.Provider value={{
      portfolios: visiblePortfolios,
      active,
      drifts,
      loading: Boolean(user) && (!ownsData || loading),
      error: ownsData ? error : null,
      setActive: setActiveId,
      createPortfolio,
      updatePortfolio,
      deletePortfolio,
      setDefault,
      refresh,
    }}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext)
  if (!ctx) throw new Error('usePortfolio must be used inside PortfolioProvider')
  return ctx
}
