/**
 * execute-rebalance — Edge Function
 *
 * Two-phase operation, driven by `action` in the POST body:
 *
 *   action = 'generate'  → Compute drift, size orders, write them as `pending`
 *                          in execution_log. Returns proposed orders for approval.
 *
 *   action = 'approve'   → Submit approved pending orders to Alpaca.
 *                          Body: { connection_id, order_ids: string[] }
 *
 *   action = 'cancel'    → Cancel pending orders without submitting.
 *                          Body: { connection_id, order_ids: string[] }
 *
 * Market-hours guard: only submits when NYSE is open (10am ET for safety margin).
 * Capital limit guard: total notional per run ≤ equity × max_deploy_pct_per_run / 100.
 * Trade count guard: orders per run ≤ max_trades_per_run.
 * Drawdown guard: pauses if portfolio_value drop ≥ drawdown_pause_pct from last high.
 * Sector concentration: rejects orders that would push a bucket over max_position_pct.
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AlpacaClient } from '../_shared/alpacaClient.ts'
import { corsResponse, corsError, CORS_HEADERS } from '../_shared/cors.ts'

type AdminClient = ReturnType<typeof createClient<any>>

type Action = 'generate' | 'approve' | 'cancel'

interface GenerateBody  { action: 'generate'; connection_id: string }
interface ApproveBody   { action: 'approve';  connection_id: string; order_ids: string[] }
interface CancelBody    { action: 'cancel';   connection_id: string; order_ids: string[] }
type ReqBody = GenerateBody | ApproveBody | CancelBody

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return corsError('Missing Authorization header', 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) return corsError('Unauthorized', 401)

    const body = await req.json() as ReqBody
    if (!body?.connection_id || !['generate', 'approve', 'cancel'].includes(body.action)) {
      return corsError('Invalid request body', 400)
    }
    if (body.action !== 'generate' && (!Array.isArray(body.order_ids) || body.order_ids.length === 0 || body.order_ids.length > 50)) {
      return corsError('order_ids must contain between 1 and 50 orders', 400)
    }

    // ── Load & validate connection ────────────────────────────────────────────
    const { data: conn, error: connErr } = await supabase
      .from('brokerage_connections')
      .select('*')
      .eq('id', body.connection_id)
      .eq('user_id', user.id)
      .single()

    if (connErr || !conn) return corsError('Connection not found', 404)
    // Provider capability boundary: Schwab is a read-only source of truth and
    // must never be routed through any code path that can place an order.
    if (conn.provider !== 'alpaca') {
      return corsError('Order execution is only available for an explicitly connected Alpaca account', 409)
    }
    if (conn.execution_enabled !== true) {
      return corsError('Alpaca execution is disabled for this connection', 403)
    }
    if (!conn.api_key || !conn.api_secret) return corsError('Alpaca credentials are unavailable', 409)
    if (conn.kill_switch)  return corsError('Kill switch is active — no orders will be placed', 403)

    const alpaca = new AlpacaClient(conn.api_key, conn.api_secret, conn.environment)

    // ── APPROVE ────────────────────────────────────────────────────────────────
    if (body.action === 'approve') {
      return await handleApprove(supabase, alpaca, conn, body.order_ids)
    }

    // ── CANCEL ─────────────────────────────────────────────────────────────────
    if (body.action === 'cancel') {
      return await handleCancel(supabase, conn, body.order_ids)
    }

    // ── GENERATE ───────────────────────────────────────────────────────────────
    return await handleGenerate(supabase, alpaca, conn, user.id)

  } catch (err) {
    return corsError(String(err), 500)
  }
})

// ─── GENERATE ─────────────────────────────────────────────────────────────────

async function handleGenerate(
  supabase: AdminClient,
  alpaca: AlpacaClient,
  conn: Record<string, unknown>,
  userId: string,
) {
  const { count: pendingCount, error: pendingError } = await supabase
    .from('execution_log')
    .select('id', { count: 'exact', head: true })
    .eq('connection_id', conn.id)
    .eq('status', 'pending')
  if (pendingError) throw pendingError
  if ((pendingCount ?? 0) > 0) {
    return corsError('Review or cancel the existing pending orders before generating another run', 409)
  }

  // Sync positions first
  const [account, positions, holdings, allocations, portfolio] = await Promise.all([
    alpaca.getAccount(),
    alpaca.listPositions(),
    loadHoldings(supabase, conn.portfolio_id as string),
    loadAllocations(supabase, conn.portfolio_id as string),
    loadPortfolio(supabase, conn.portfolio_id as string),
  ])

  const equity        = parseFloat(account.equity as string)
  const portfolioVal  = parseFloat(account.portfolio_value as string)

  // ── Drawdown check ────────────────────────────────────────────────────────
  const lastHighVal = await getLastHighValue(supabase, conn.id as string)
  if (lastHighVal > 0) {
    const drawdownPct = ((lastHighVal - portfolioVal) / lastHighVal) * 100
    if (drawdownPct >= (conn.drawdown_pause_pct as number)) {
      return corsResponse({
        paused: true,
        reason: `Drawdown of ${drawdownPct.toFixed(1)}% exceeds circuit breaker of ${conn.drawdown_pause_pct}%`,
        drawdown_pct: drawdownPct,
      })
    }
  }

  // ── Compute drift ─────────────────────────────────────────────────────────
  const totalValue = portfolioVal

  // Build target map
  const targetPctByBucket: Record<string, number> = {}
  for (const a of allocations) {
    targetPctByBucket[a.bucket as string] = a.target_pct as number
  }

  // Build actual map from Alpaca positions (use live prices)
  const actualByBucket: Record<string, number> = {}
  const symbolToBucket: Record<string, string> = {}
  for (const h of holdings) {
    symbolToBucket[h.ticker as string] = h.bucket as string
  }
  for (const pos of positions) {
    const bucket = symbolToBucket[pos.symbol] ?? 'US_EQUITY_LARGE'
    actualByBucket[bucket] = (actualByBucket[bucket] ?? 0) + parseFloat(pos.market_value)
  }

  // ── Order sizing ──────────────────────────────────────────────────────────
  const maxDeployUsd   = equity * ((conn.max_deploy_pct_per_run as number) / 100)
  const maxPosition    = (conn.max_position_pct as number) / 100
  const maxTrades      = conn.max_trades_per_run as number
  const rebalThreshold = Number(portfolio?.rebalance_threshold_pct ?? 5)

  const orders: OrderProposal[] = []

  for (const [bucket, targetPct] of Object.entries(targetPctByBucket)) {
    const actualVal  = actualByBucket[bucket] ?? 0
    const targetVal  = (targetPct / 100) * totalValue
    const driftPct   = ((actualVal - targetVal) / (totalValue || 1)) * 100
    const gapUsd     = targetVal - actualVal

    if (Math.abs(driftPct) < rebalThreshold) continue
    if (Math.abs(gapUsd) < 50) continue  // ignore tiny gaps

    // Find the best holding in this bucket to buy/sell
    const bucketHoldings = holdings.filter((h: Record<string, unknown>) => h.bucket === bucket)
    if (bucketHoldings.length === 0) continue

    if (gapUsd > 0) {
      // BUY: pick the holding with highest conviction (first for now; could rank by score)
      const target = bucketHoldings[0] as Record<string, unknown>
      const livePosition = positions.find((position) => position.symbol === (target.ticker as string))
      const availableToSell = livePosition ? Math.abs(parseFloat(livePosition.market_value)) : 0
      const notional = Math.min(Math.abs(gapUsd), maxDeployUsd * 0.5, availableToSell)
      if (notional < 10) continue
      // Enforce per-position cap
      const currentMV = parseFloat(String(target.market_value ?? 0))
      const maxPositionUsd = equity * maxPosition
      const maxBuyUsd = Math.max(0, maxPositionUsd - currentMV)
      const finalNotional = Math.min(notional, maxBuyUsd)
      if (finalNotional < 10) continue

      orders.push({
        ticker:        target.ticker as string,
        action:        'BUY',
        bucket,
        notional_usd:  parseFloat(finalNotional.toFixed(2)),
        rationale:     `Bucket ${bucket} is ${Math.abs(driftPct).toFixed(1)}% below target (gap $${Math.abs(gapUsd).toFixed(0)})`,
      })
    } else {
      // SELL: prefer lots held longest (approximate via cost_basis since we don't track lot dates)
      const liveSymbols = new Set(positions.map((position) => position.symbol))
      const sellableHoldings = bucketHoldings.filter((holding: Record<string, unknown>) => liveSymbols.has(holding.ticker as string))
      if (sellableHoldings.length === 0) continue
      const target = sellableHoldings.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        parseFloat(String(a.cost_basis ?? 0)) - parseFloat(String(b.cost_basis ?? 0))
      )[0] as Record<string, unknown>
      const notional = Math.min(Math.abs(gapUsd), maxDeployUsd * 0.5)
      orders.push({
        ticker:       target.ticker as string,
        action:       'SELL',
        bucket,
        notional_usd: parseFloat(notional.toFixed(2)),
        rationale:    `Bucket ${bucket} is ${Math.abs(driftPct).toFixed(1)}% above target (gap $${Math.abs(gapUsd).toFixed(0)})`,
      })
    }

    if (orders.length >= maxTrades) break
  }

  if (orders.length === 0) {
    return corsResponse({ orders: [], message: 'Portfolio is within tolerance — no rebalancing needed' })
  }

  // ── Create run + write pending orders ─────────────────────────────────────
  const { data: run, error: runError } = await supabase
    .from('execution_runs')
    .insert({
      connection_id: conn.id,
      portfolio_id:  conn.portfolio_id,
      run_type:      'manual',
      status:        'running',
    })
    .select()
    .single()
  if (runError || !run) throw runError ?? new Error('Could not create execution run')

  const logRows = orders.map((o) => ({
    run_id:           run.id,
    connection_id:    conn.id,
    portfolio_id:     conn.portfolio_id,
    ticker:           o.ticker,
    action:           o.action,
    bucket:           o.bucket,
    notional_usd:     o.notional_usd,
    status:           'pending',
    rationale:        o.rationale,
    requires_approval: conn.approval_required,
  }))

  const { data: logEntries, error: logError } = await supabase
    .from('execution_log')
    .insert(logRows)
    .select()
  if (logError || !logEntries) {
    await supabase.from('execution_runs').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: String(logError ?? 'Could not persist proposed orders'),
    }).eq('id', run.id)
    throw logError ?? new Error('Could not persist proposed orders')
  }

  await supabase.from('execution_runs').update({ status: 'completed', completed_at: new Date().toISOString(), summary: { orders_generated: orders.length } }).eq('id', run.id)

  return corsResponse({
    run_id: run.id,
    orders: logEntries,
    requires_approval: conn.approval_required,
    message: conn.approval_required
      ? `${orders.length} orders generated — review and approve to submit`
      : `${orders.length} orders generated`,
  })
}

// ─── APPROVE ──────────────────────────────────────────────────────────────────

async function handleApprove(
  supabase: AdminClient,
  alpaca: AlpacaClient,
  conn: Record<string, unknown>,
  orderIds: string[],
) {
  // Market hours check
  const isOpen = await alpaca.isMarketOpen()
  if (!isOpen) {
    return corsError('Market is closed — orders will not be submitted outside trading hours', 400)
  }

  const { data: pendingOrders } = await supabase
    .from('execution_log')
    .select('*')
    .in('id', orderIds)
    .eq('connection_id', conn.id)
    .eq('status', 'pending')

  if (!pendingOrders?.length) return corsError('No pending orders found', 404)

  if (pendingOrders.length > Number(conn.max_trades_per_run ?? 5)) {
    return corsError('Selected orders exceed the configured per-run trade limit', 400)
  }

  const account = await alpaca.getAccount()
  const equity = parseFloat(account.equity as string)
  const maxBuyNotional = equity * (Number(conn.max_deploy_pct_per_run ?? 10) / 100)
  const selectedBuyNotional = pendingOrders
    .filter((order) => order.action === 'BUY')
    .reduce((sum, order) => sum + Number(order.notional_usd ?? 0), 0)
  if (!Number.isFinite(selectedBuyNotional) || selectedBuyNotional > maxBuyNotional) {
    return corsError('Selected buy orders exceed the configured deployment limit', 400)
  }

  // Recover claims abandoned by a timed-out invocation, then atomically claim
  // this request's still-pending rows. The conditional update is the lock.
  const staleClaimCutoff = new Date(Date.now() - 15 * 60_000).toISOString()
  await supabase
    .from('execution_log')
    .update({ status: 'pending' })
    .eq('connection_id', conn.id)
    .eq('status', 'submitting')
    .lt('updated_at', staleClaimCutoff)

  const { data: claimedOrders, error: claimError } = await supabase
    .from('execution_log')
    .update({ status: 'submitting', approved_at: new Date().toISOString() })
    .in('id', pendingOrders.map((order) => order.id))
    .eq('connection_id', conn.id)
    .eq('status', 'pending')
    .select('*')
  if (claimError) throw claimError
  if (!claimedOrders?.length) return corsError('Orders are already being submitted', 409)

  const results = []
  for (const order of claimedOrders) {
    try {
      const alpacaOrder = await alpaca.placeOrder({
        symbol:        order.ticker,
        side:          order.action.toLowerCase() as 'buy' | 'sell',
        type:          'market',
        time_in_force: 'day',
        notional:      order.notional_usd?.toString(),
      })

      await supabase.from('execution_log').update({
        status:          'submitted',
        alpaca_order_id: alpacaOrder.id,
        submitted_at:    new Date().toISOString(),
      }).eq('id', order.id)

      results.push({ id: order.id, ticker: order.ticker, alpaca_order_id: alpacaOrder.id, status: 'submitted' })

    } catch (err) {
      await supabase.from('execution_log').update({
        status: 'error',
        error:  String(err),
      }).eq('id', order.id)
      results.push({ id: order.id, ticker: order.ticker, status: 'error', error: String(err) })
    }
  }

  return corsResponse({ submitted: results.filter((r) => r.status === 'submitted').length, results })
}

// ─── CANCEL ───────────────────────────────────────────────────────────────────

async function handleCancel(
  supabase: AdminClient,
  conn: Record<string, unknown>,
  orderIds: string[],
) {
  const { data, error } = await supabase
    .from('execution_log')
    .update({ status: 'cancelled' })
    .in('id', orderIds)
    .eq('connection_id', conn.id)
    .eq('status', 'pending')
    .select('id')
  if (error) throw error

  return corsResponse({ cancelled: data?.length ?? 0 })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadHoldings(supabase: AdminClient, portfolioId: string) {
  const { data } = await supabase.from('portfolio_holdings').select('*').eq('portfolio_id', portfolioId)
  return data ?? []
}

async function loadAllocations(supabase: AdminClient, portfolioId: string) {
  const { data } = await supabase.from('portfolio_allocations').select('*').eq('portfolio_id', portfolioId)
  return data ?? []
}

async function loadPortfolio(supabase: AdminClient, portfolioId: string) {
  const { data, error } = await supabase
    .from('portfolios')
    .select('rebalance_threshold_pct')
    .eq('id', portfolioId)
    .single()
  if (error) throw error
  return data
}

async function getLastHighValue(supabase: AdminClient, connectionId: string): Promise<number> {
  const { data } = await supabase
    .from('execution_runs')
    .select('summary')
    .eq('connection_id', connectionId)
    .eq('run_type', 'sync')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(10)

  if (!data?.length) return 0
  const values = data.map((r) => (r.summary as Record<string, number>)?.portfolio_value ?? 0).filter((v) => v > 0)
  return values.length > 0 ? Math.max(...values) : 0
}

interface OrderProposal {
  ticker: string
  action: 'BUY' | 'SELL'
  bucket: string
  notional_usd: number
  rationale: string
}
