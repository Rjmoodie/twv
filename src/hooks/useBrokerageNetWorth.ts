import { useCallback, useEffect, useRef, useState } from 'react'
import { getBrokerageNetWorth, type BrokerageNetWorth } from '@/services/brokerage/brokerageNetWorth'
import { useAuth } from '@/components/somatech/AuthProvider'

/**
 * What the linked brokerages add to net worth, or null when there are none.
 *
 * Failures resolve to null rather than throwing: the brokerage is one component
 * of the figure, and losing it should narrow what the dashboard claims, not
 * take the dashboard down.
 */
export function useBrokerageNetWorth() {
  const { user } = useAuth()
  const [data, setData] = useState<BrokerageNetWorth | null>(null)
  const [loading, setLoading] = useState(Boolean(user))
  const [error, setError] = useState<string | null>(null)
  const [dataUserId, setDataUserId] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const sequence = useRef(0)
  const refresh = useCallback(() => setRefreshTick((tick) => tick + 1), [])

  useEffect(() => {
    const request = ++sequence.current
    const userId = user?.id ?? null
    setData(null)
    setError(null)
    setDataUserId(null)
    if (!userId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void getBrokerageNetWorth()
      .then((result) => {
        if (!cancelled && request === sequence.current) {
          setData(result)
          setDataUserId(userId)
        }
      })
      .catch((cause) => {
        if (!cancelled && request === sequence.current) {
          setData(null)
          setError(cause instanceof Error ? cause.message : 'Brokerage value could not be loaded.')
          setDataUserId(userId)
        }
      })
      .finally(() => { if (!cancelled && request === sequence.current) setLoading(false) })
    return () => { cancelled = true }
  }, [user?.id, refreshTick])

  const ownsData = Boolean(user?.id && dataUserId === user.id)
  return {
    brokerage: ownsData ? data : null,
    loading: Boolean(user) && (!ownsData || loading),
    error: ownsData ? error : null,
    refresh,
  }
}
