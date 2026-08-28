import { supabase } from '@/integrations/supabase/client'

// The generated Supabase types predate the brokerage schema. Keep the escape
// hatch local to this adapter instead of weakening typing across the app.
const db = supabase as any

export type BrokerageConnectionStatus = 'active' | 'expiring' | 'expired' | 'revoked' | 'error' | 'disconnected'
export type ReconciliationStatus = 'pending' | 'reconciled' | 'variance' | 'unsupported'

export interface SchwabConnection {
  id: string
  user_id: string
  portfolio_id: string
  authorization_id: string
  provider: 'schwab'
  environment: 'live'
  account_id: string | null
  account_type: string | null
  account_number_last_four: string | null
  display_name: string | null
  capabilities: Record<string, string>
  is_active: boolean
  is_primary: boolean
  connection_status: BrokerageConnectionStatus
  execution_enabled: false
  kill_switch: true
  last_sync_attempt_at: string | null
  last_positions_synced_at: string | null
  last_executions_synced_at: string | null
  provider_data_as_of: string | null
  last_reconciled_at: string | null
  reconciliation_status: ReconciliationStatus
  reconciliation_variance: number | null
  last_sync_error: string | null
  created_at: string
  updated_at: string
}

export interface SchwabAuthorization {
  id: string
  status: BrokerageConnectionStatus
  refresh_expires_at: string
  last_authorized_at: string
}

export interface BrokerageTrade {
  id: string
  connection_id: string
  portfolio_id: string
  provider: 'schwab' | 'alpaca'
  provider_execution_id: string
  ticker: string
  side: 'buy' | 'sell'
  qty: number
  filled_avg_price: number | null
  notional: number | null
  filled_at: string
  strategy: string | null
  synced_at: string
  source_as_of: string | null
}

export interface SchwabSyncResult {
  connection_id: string
  positions: number
  executions: number
  executions_inserted: number
  quarantined: number
  reconciliation_status: ReconciliationStatus
  provider_data_as_of: string
}

const CONNECTION_COLUMNS = [
  // Explicit, because `select('*')` asks PostgREST for every column and
  // brokerage_connections grants authenticated only column-level SELECT:
  // api_key, api_secret, account_hash and sync_cursor are deliberately
  // withheld, so a star select is refused outright with 403.
  'id', 'user_id', 'portfolio_id', 'authorization_id', 'provider', 'environment',
  'account_id', 'account_type', 'account_number_last_four', 'display_name',
  'capabilities', 'is_active', 'is_primary', 'connection_status',
  'execution_enabled', 'kill_switch', 'last_sync_attempt_at',
  'last_positions_synced_at', 'last_executions_synced_at', 'provider_data_as_of',
  'last_reconciled_at', 'reconciliation_status', 'reconciliation_variance',
  'last_sync_error', 'created_at', 'updated_at',
].join(',')

async function invoke<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data as T
}

export async function listSchwabConnections(portfolioId: string): Promise<SchwabConnection[]> {
  const { data, error } = await db.from('brokerage_connections')
    .select(CONNECTION_COLUMNS)
    .eq('portfolio_id', portfolioId)
    .eq('provider', 'schwab')
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as SchwabConnection[]
}

export async function listActiveUserSchwabConnections(): Promise<SchwabConnection[]> {
  const { data, error } = await db.from('brokerage_connections')
    .select(CONNECTION_COLUMNS).eq('provider', 'schwab').eq('is_active', true)
    .order('is_primary', { ascending: false })
  if (error) throw error
  return (data ?? []) as SchwabConnection[]
}

export async function getPrimarySchwabConnection(portfolioId: string): Promise<SchwabConnection | null> {
  const { data, error } = await db.from('brokerage_connections')
    .select(CONNECTION_COLUMNS)
    .eq('portfolio_id', portfolioId)
    .eq('provider', 'schwab')
    .eq('is_primary', true)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data as SchwabConnection | null
}

export interface BrokerageCashSnapshot {
  cash_balance: number | null
  liquidation_value: number | null
  buying_power: number | null
  provider_data_as_of: string
}

/**
 * Latest broker balance for a portfolio. Every sync records one, but nothing
 * read them, so the account's real cash and buying power were collected and
 * then discarded.
 */
export async function getLatestCashSnapshot(portfolioId: string): Promise<BrokerageCashSnapshot | null> {
  const connections = await listSchwabConnections(portfolioId)
  const ids = connections.filter(connection => connection.is_active).map(connection => connection.id)
  if (!ids.length) return null

  const { data, error } = await db.from('brokerage_account_snapshots')
    .select('connection_id,cash_balance,liquidation_value,buying_power,provider_data_as_of')
    .in('connection_id', ids)
    .order('provider_data_as_of', { ascending: false })
    // Enough rows to be sure each connection's newest is present.
    .limit(ids.length * 25)
  if (error) throw error
  if (!data || data.length === 0) return null

  // This previously took a single newest row across every connection, which
  // reported one account's cash as the whole portfolio's. Correct for one
  // account, silently wrong for two.
  const latest = new Map<string, any>()
  for (const row of data) {
    if (!latest.has(row.connection_id)) latest.set(row.connection_id, row)
  }

  const num = (value: unknown) => (value == null ? null : Number(value))
  let cash: number | null = null
  let liquidation: number | null = null
  let buyingPower: number | null = null
  let asOf: string | null = null

  // A null stays null unless some account reports a figure; summing treats an
  // absent balance as absent rather than as zero.
  const add = (running: number | null, value: number | null) =>
    value == null ? running : (running ?? 0) + value

  for (const row of latest.values()) {
    cash = add(cash, num(row.cash_balance))
    liquidation = add(liquidation, num(row.liquidation_value))
    buyingPower = add(buyingPower, num(row.buying_power))
    // The combined figure is only as fresh as its stalest part.
    if (asOf == null || row.provider_data_as_of < asOf) asOf = row.provider_data_as_of
  }

  return {
    cash_balance: cash,
    liquidation_value: liquidation,
    buying_power: buyingPower,
    provider_data_as_of: asOf!,
  }
}

export async function getSchwabAuthorization(id: string): Promise<SchwabAuthorization | null> {
  const { data, error } = await db.from('brokerage_authorizations')
    .select('id,status,refresh_expires_at,last_authorized_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as SchwabAuthorization | null
}

export async function startSchwabAuthorization(
  portfolioId: string,
  authorizationId?: string,
): Promise<void> {
  const response = await invoke<{ authorize_url: string }>('schwab-oauth', {
    action: 'authorize',
    portfolio_id: portfolioId,
    authorization_id: authorizationId,
    return_to: '/?module=portfolio&portfolio_tab=brokerage',
  })
  if (!response.authorize_url.startsWith('https://api.schwabapi.com/')) {
    throw new Error('Schwab returned an unsafe authorization destination')
  }
  window.location.assign(response.authorize_url)
}

export function syncSchwabConnection(connectionId: string): Promise<SchwabSyncResult> {
  return invoke<SchwabSyncResult>('schwab-sync', { connection_id: connectionId })
}

export async function disconnectSchwab(authorizationId: string): Promise<void> {
  await invoke('schwab-oauth', { action: 'disconnect', authorization_id: authorizationId })
}

export async function deleteSchwabImportedData(authorizationId: string): Promise<void> {
  await invoke('schwab-oauth', { action: 'delete_imported_data', authorization_id: authorizationId })
}

export async function listBrokerageTrades(limit = 1000): Promise<BrokerageTrade[]> {
  const { data, error } = await db.rpc('get_brokerage_trade_feed', { p_limit: limit })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row,
    qty: Number(row.qty),
    filled_avg_price: row.filled_avg_price == null ? null : Number(row.filled_avg_price),
    notional: row.notional == null ? null : Number(row.notional),
  })) as BrokerageTrade[]
}

export async function updateBrokerageTradeStrategy(executionId: string, userId: string, strategy: string): Promise<void> {
  const { error } = await db.from('trade_annotations').upsert({
    execution_id: executionId,
    user_id: userId,
    strategy: strategy.trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'execution_id' })
  if (error) throw error
}

export function freshnessLabel(connection: Pick<SchwabConnection, 'provider_data_as_of' | 'connection_status'>): string {
  if (!connection.provider_data_as_of) return 'Not synced yet'
  const date = new Date(connection.provider_data_as_of)
  if (!Number.isFinite(date.getTime())) return 'Last update unavailable'
  const ageMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000))
  const age = ageMinutes < 60 ? `${ageMinutes}m ago`
    : ageMinutes < 1440 ? `${Math.floor(ageMinutes / 60)}h ago`
    : `${Math.floor(ageMinutes / 1440)}d ago`
  return `${connection.connection_status === 'active' ? 'Schwab as of' : 'Last successful Schwab update'} ${date.toLocaleString()} (${age})`
}
