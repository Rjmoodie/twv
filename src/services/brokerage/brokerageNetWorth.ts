import { supabase } from '@/integrations/supabase/client'
import { listActiveUserSchwabConnections } from './schwabService'

const db = supabase as any

export interface BrokerageNetWorth {
  /** Total account value across every linked brokerage. */
  totalUsd: number
  /** Stalest of the per-connection snapshot times — the total is only as fresh as its oldest part. */
  asOf: string | null
  connectionCount: number
  /** Connections whose latest snapshot carried no usable value. */
  unvaluedCount: number
}

interface SnapshotRow {
  connection_id: string
  liquidation_value: number | string | null
  cash_balance: number | string | null
  long_market_value: number | string | null
  provider_data_as_of: string
}

/** Numerics arrive from PostgREST as strings; `Number(null)` is 0, which would be a lie. */
const num = (value: unknown): number | null => {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * What one snapshot says the account is worth.
 *
 * liquidation_value is Schwab's own total and already nets short positions, so
 * it wins. The fallback exists because a partial sync can leave it null while
 * still reporting the parts; if neither is usable the connection is counted as
 * unvalued rather than silently contributing zero.
 */
export function snapshotValue(row: Pick<SnapshotRow, 'liquidation_value' | 'cash_balance' | 'long_market_value'>): number | null {
  const liquidation = num(row.liquidation_value)
  if (liquidation != null) return liquidation

  const cash = num(row.cash_balance)
  const long = num(row.long_market_value)
  if (cash == null && long == null) return null
  return (cash ?? 0) + (long ?? 0)
}

/** Reduces newest-first rows to one row per connection. Exported for testing. */
export function latestPerConnection(rows: SnapshotRow[]): Map<string, SnapshotRow> {
  const latest = new Map<string, SnapshotRow>()
  for (const row of rows) {
    // Rows arrive ordered newest-first, so the first sighting is the latest.
    if (!latest.has(row.connection_id)) latest.set(row.connection_id, row)
  }
  return latest
}

export function summarise(ids: string[], latest: Map<string, SnapshotRow>): BrokerageNetWorth {
  let totalUsd = 0
  let unvaluedCount = 0
  let asOf: string | null = null

  for (const id of ids) {
    const row = latest.get(id)
    const value = row ? snapshotValue(row) : null
    if (row == null || value == null) {
      unvaluedCount++
      continue
    }
    totalUsd += value
    // ISO-8601 strings compare lexicographically, so this is the earliest.
    if (asOf == null || row.provider_data_as_of < asOf) asOf = row.provider_data_as_of
  }

  return { totalUsd, asOf, connectionCount: ids.length, unvaluedCount }
}

/**
 * What the linked brokerages contribute to net worth.
 *
 * Plaid already excludes accounts matched to a direct brokerage connection
 * (financial_account_links.include_in_plaid_net_worth = false), so this adds to
 * the Plaid figure rather than double-counting it. Before this existed the
 * exclusion ran with nothing to replace it, and a linked brokerage balance
 * simply vanished from net worth.
 *
 * Returns null when there is no brokerage at all — distinct from a brokerage
 * worth $0, which callers should render.
 */
export async function getBrokerageNetWorth(): Promise<BrokerageNetWorth | null> {
  const connections = (await listActiveUserSchwabConnections()).filter((c) => c.is_active)
  if (connections.length === 0) return null

  const ids = connections.map((c) => c.id)
  const { data, error } = await db
    .from('brokerage_account_snapshots')
    .select('connection_id,liquidation_value,cash_balance,long_market_value,provider_data_as_of')
    .in('connection_id', ids)
    .order('provider_data_as_of', { ascending: false })
    // Enough rows to be sure every connection's latest is present, without
    // pulling the whole history of ~20-minute snapshots.
    .limit(ids.length * 25)
  if (error) throw error

  return summarise(ids, latestPerConnection((data ?? []) as SnapshotRow[]))
}
