/**
 * Client-side brokerage service.
 * Wraps Supabase table CRUD for brokerage_connections / execution_log
 * and proxies execution actions through Edge Functions.
 */

import { supabase } from '@/integrations/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BrokerageEnvironment = 'paper' | 'live'
export type ExecutionFrequency   = 'daily' | 'weekly' | 'monthly'
export type OrderStatus          = 'pending' | 'submitting' | 'submitted' | 'filled' | 'cancelled' | 'rejected' | 'error'

export interface BrokerageConnection {
  id:                     string
  user_id:                string
  portfolio_id:           string
  provider:               'alpaca'
  environment:            BrokerageEnvironment
  account_id:             string | null
  account_type:           string | null
  is_active:              boolean
  execution_enabled?:     boolean
  autonomous_enabled:     boolean
  approval_required:      boolean
  frequency:              ExecutionFrequency
  max_deploy_pct_per_run: number
  max_trades_per_run:     number
  max_position_pct:       number
  kill_switch:            boolean
  drawdown_pause_pct:     number
  next_run_at:            string | null
  last_run_at:            string | null
  created_at:             string
  updated_at:             string
}

const CONNECTION_COLUMNS = [
  'id', 'user_id', 'portfolio_id', 'provider', 'environment', 'account_id',
  'account_type', 'is_active', 'autonomous_enabled', 'approval_required',
  'frequency', 'max_deploy_pct_per_run', 'max_trades_per_run',
  'max_position_pct', 'kill_switch', 'drawdown_pause_pct', 'next_run_at',
  'last_run_at', 'created_at', 'updated_at',
].join(',')

export interface CreateConnectionInput {
  portfolio_id:           string
  environment:            BrokerageEnvironment
  api_key:                string
  api_secret:             string
  autonomous_enabled?:    boolean
  approval_required?:     boolean
  frequency?:             ExecutionFrequency
  max_deploy_pct_per_run?: number
  max_trades_per_run?:    number
  max_position_pct?:      number
  drawdown_pause_pct?:    number
}

export interface ExecutionLogEntry {
  id:               string
  run_id:           string | null
  connection_id:    string
  portfolio_id:     string
  ticker:           string
  action:           'BUY' | 'SELL'
  bucket:           string
  shares:           number | null
  notional_usd:     number | null
  fill_price:       number | null
  alpaca_order_id:  string | null
  status:           OrderStatus
  rationale:        string | null
  requires_approval: boolean
  approved_at:      string | null
  submitted_at:     string | null
  filled_at:        string | null
  error:            string | null
  created_at:       string
  updated_at:       string
}

export interface SyncResult {
  synced: number
  account: {
    equity:          string
    cash:            string
    portfolio_value: string
    buying_power:    string
    pdt:             boolean
  }
}

export interface GenerateResult {
  run_id:            string
  orders:            ExecutionLogEntry[]
  requires_approval: boolean
  message:           string
  paused?:           boolean
  reason?:           string
}

export interface ApproveResult {
  submitted: number
  results:   { id: string; ticker: string; status: string; error?: string; alpaca_order_id?: string }[]
}

// ─── Connection CRUD ──────────────────────────────────────────────────────────

export async function getConnection(portfolioId: string): Promise<BrokerageConnection | null> {
  const { data, error } = await supabase
    .from('brokerage_connections')
    .select(CONNECTION_COLUMNS)
    .eq('portfolio_id', portfolioId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data as BrokerageConnection | null
}

export async function createConnection(
  userId: string,
  input: CreateConnectionInput,
): Promise<BrokerageConnection> {
  const { data, error } = await supabase
    .from('brokerage_connections')
    .insert({
      user_id:                userId,
      portfolio_id:           input.portfolio_id,
      environment:            input.environment,
      api_key:                input.api_key,
      api_secret:             input.api_secret,
      autonomous_enabled:     input.autonomous_enabled  ?? false,
      approval_required:      input.approval_required   ?? true,
      frequency:              input.frequency           ?? 'weekly',
      max_deploy_pct_per_run: input.max_deploy_pct_per_run ?? 10,
      max_trades_per_run:     input.max_trades_per_run  ?? 5,
      max_position_pct:       input.max_position_pct    ?? 10,
      drawdown_pause_pct:     input.drawdown_pause_pct  ?? 10,
    })
    .select(CONNECTION_COLUMNS)
    .single()
  if (error) throw error
  return data as BrokerageConnection
}

export async function updateConnection(
  id: string,
  updates: Partial<Omit<BrokerageConnection, 'id' | 'user_id' | 'created_at'>>,
): Promise<void> {
  const { error } = await supabase
    .from('brokerage_connections')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteConnection(id: string): Promise<void> {
  const { error } = await supabase.from('brokerage_connections').delete().eq('id', id)
  if (error) throw error
}

export async function toggleKillSwitch(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('brokerage_connections')
    .update({ kill_switch: active, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ─── Execution Log ────────────────────────────────────────────────────────────

export async function listExecutionLog(
  portfolioId: string,
  limit = 50,
): Promise<ExecutionLogEntry[]> {
  const { data, error } = await supabase
    .from('execution_log')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as ExecutionLogEntry[]
}

export async function listPendingOrders(portfolioId: string): Promise<ExecutionLogEntry[]> {
  const { data, error } = await supabase
    .from('execution_log')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ExecutionLogEntry[]
}

// ─── Edge Function Invocations ────────────────────────────────────────────────

async function invokeFunction<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as T
}

export async function syncPositions(connectionId: string): Promise<SyncResult> {
  return invokeFunction<SyncResult>('alpaca-sync', { connection_id: connectionId })
}

export async function generateOrders(connectionId: string): Promise<GenerateResult> {
  return invokeFunction<GenerateResult>('execute-rebalance', {
    action: 'generate',
    connection_id: connectionId,
  })
}

export async function approveOrders(connectionId: string, orderIds: string[]): Promise<ApproveResult> {
  return invokeFunction<ApproveResult>('execute-rebalance', {
    action: 'approve',
    connection_id: connectionId,
    order_ids: orderIds,
  })
}

export async function cancelOrders(connectionId: string, orderIds: string[]): Promise<{ cancelled: number }> {
  return invokeFunction<{ cancelled: number }>('execute-rebalance', {
    action: 'cancel',
    connection_id: connectionId,
    order_ids: orderIds,
  })
}

// Test connectivity + return account summary
export async function testConnection(connectionId: string): Promise<SyncResult> {
  return syncPositions(connectionId)
}
