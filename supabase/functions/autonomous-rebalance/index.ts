/**
 * autonomous-rebalance — Scheduled Edge Function (cron)
 *
 * Runs on a schedule (configure in Supabase Dashboard → Edge Functions → Schedule).
 * For each active brokerage connection where:
 *   - autonomous_enabled = true
 *   - kill_switch = false
 *   - next_run_at <= now()
 * It invokes the full sync → generate → (optionally submit if approval_required=false) pipeline.
 *
 * Schedule recommendation: every day at 10:30 AM ET (15:30 UTC)
 *   cron: "30 15 * * 1-5"
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AlpacaClient } from '../_shared/alpacaClient.ts'
import { corsResponse, corsError, CORS_HEADERS } from '../_shared/cors.ts'

type AdminClient = ReturnType<typeof createClient<any>>

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authHeader = req.headers.get('Authorization')
  if (!serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
    return corsError('Unauthorized', 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey,
  )

  // ── Find connections due for a run ──────────────────────────────────────────
  const now = new Date().toISOString()
  const { data: connections, error } = await supabase
    .from('brokerage_connections')
    .select('*')
    .eq('provider', 'alpaca')
    .eq('execution_enabled', true)
    .eq('autonomous_enabled', true)
    .eq('is_active', true)
    .eq('kill_switch', false)
    .lte('next_run_at', now)

  if (error) return corsError(String(error), 500)
  if (!connections?.length) {
    return corsResponse({ processed: 0, message: 'No connections due for autonomous rebalance' })
  }

  const results = []

  for (const conn of connections) {
    const runId = crypto.randomUUID()
    try {
      if (conn.provider !== 'alpaca' || conn.execution_enabled !== true || !conn.api_key || !conn.api_secret) {
        results.push({ connection_id: conn.id, skipped: true, reason: 'Not an order-capable Alpaca connection' })
        continue
      }
      // ── Create run record ───────────────────────────────────────────────────
      const { data: run } = await supabase
        .from('execution_runs')
        .insert({
          id:            runId,
          connection_id: conn.id,
          portfolio_id:  conn.portfolio_id,
          run_type:      'autonomous',
          status:        'running',
        })
        .select()
        .single()

      const alpaca = new AlpacaClient(conn.api_key, conn.api_secret, conn.environment)

      // ── Market hours check ──────────────────────────────────────────────────
      const isOpen = await alpaca.isMarketOpen()
      if (!isOpen) {
        await supabase.from('execution_runs').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          summary: { skipped: true, reason: 'Market closed' },
        }).eq('id', run.id)
        // Still advance next_run_at to avoid re-triggering same day
        await advanceNextRun(supabase, conn)
        results.push({ connection_id: conn.id, skipped: true, reason: 'Market closed' })
        continue
      }

      // ── Sync positions ──────────────────────────────────────────────────────
      const [account, positions, holdings, allocations, portfolio] = await Promise.all([
        alpaca.getAccount(),
        alpaca.listPositions(),
        loadRows(supabase, 'portfolio_holdings', conn.portfolio_id),
        loadRows(supabase, 'portfolio_allocations', conn.portfolio_id),
        loadPortfolio(supabase, conn.portfolio_id),
      ])

      const portfolioVal = parseFloat(account.portfolio_value)
      const equity       = parseFloat(account.equity)

      // ── Drawdown check ──────────────────────────────────────────────────────
      const lastHigh = await getLastHighValue(supabase, conn.id)
      if (lastHigh > 0) {
        const drawdownPct = ((lastHigh - portfolioVal) / lastHigh) * 100
        if (drawdownPct >= conn.drawdown_pause_pct) {
          await supabase.from('execution_runs').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            summary: { paused: true, drawdown_pct: drawdownPct, reason: 'Drawdown circuit breaker' },
          }).eq('id', run.id)
          await advanceNextRun(supabase, conn)
          results.push({ connection_id: conn.id, paused: true, drawdown_pct: drawdownPct })
          continue
        }
      }

      // ── Upsert synced positions ─────────────────────────────────────────────
      const symbolBucketMap: Record<string, string> = {}
      for (const h of holdings) symbolBucketMap[h.ticker] = h.bucket

      const holdingRows = positions.map((p) => ({
        portfolio_id:  conn.portfolio_id,
        ticker:        p.symbol,
        bucket:        symbolBucketMap[p.symbol] ?? 'US_EQUITY_LARGE',
        shares:        parseFloat(p.qty),
        cost_basis:    parseFloat(p.avg_entry_price),
        current_price: parseFloat(p.current_price),
        market_value:  parseFloat(p.market_value),
        source:        'alpaca',
        updated_at:    new Date().toISOString(),
      }))

      if (holdingRows.length > 0) {
        const { error: holdingError } = await supabase.from('portfolio_holdings').upsert(holdingRows, { onConflict: 'portfolio_id,ticker,source' })
        if (holdingError) throw holdingError
      }

      const activeSymbols = positions.map((position) => position.symbol)
      let staleDelete = supabase
        .from('portfolio_holdings')
        .delete()
        .eq('portfolio_id', conn.portfolio_id)
        .eq('source', 'alpaca')
      if (activeSymbols.length > 0) {
        staleDelete = staleDelete.not('ticker', 'in', `(${activeSymbols.map((symbol) => `"${symbol}"`).join(',')})`)
      }
      const { error: staleDeleteError } = await staleDelete
      if (staleDeleteError) throw staleDeleteError

      // ── Compute drift & size orders ─────────────────────────────────────────
      const totalValue = portfolioVal
      const targetMap: Record<string, number> = {}
      for (const a of allocations) targetMap[a.bucket] = a.target_pct

      const actualByBucket: Record<string, number> = {}
      for (const p of positions) {
        const bucket = symbolBucketMap[p.symbol] ?? 'US_EQUITY_LARGE'
        actualByBucket[bucket] = (actualByBucket[bucket] ?? 0) + parseFloat(p.market_value)
      }

      const maxDeployUsd = equity * (conn.max_deploy_pct_per_run / 100)
      const orders: OrderProposal[] = []

      for (const [bucket, targetPct] of Object.entries(targetMap)) {
        if (orders.length >= conn.max_trades_per_run) break
        const actualVal = actualByBucket[bucket] ?? 0
        const targetVal = (targetPct / 100) * totalValue
        const driftPct  = ((actualVal - targetVal) / (totalValue || 1)) * 100
        const gapUsd    = targetVal - actualVal
        if (Math.abs(driftPct) < Number(portfolio?.rebalance_threshold_pct ?? 5)) continue
        if (Math.abs(gapUsd) < 50)  continue

        const bucketHoldings = holdingRows.filter((h) => h.bucket === bucket)
        if (bucketHoldings.length === 0) continue

        if (gapUsd > 0) {
          const target = bucketHoldings[0]
          const notional = Math.min(Math.abs(gapUsd), maxDeployUsd * 0.5, equity * (conn.max_position_pct / 100) - (actualByBucket[bucket] ?? 0))
          if (notional < 10) continue
          orders.push({ ticker: target.ticker, action: 'BUY', bucket, notional_usd: parseFloat(notional.toFixed(2)), rationale: `Auto: ${bucket} ${Math.abs(driftPct).toFixed(1)}% below target` })
        } else {
          const liveBySymbol = new Map(positions.map((position) => [position.symbol, Math.abs(parseFloat(position.market_value))]))
          const target = bucketHoldings.find((holding) => liveBySymbol.has(holding.ticker))
          if (!target) continue
          const notional = Math.min(Math.abs(gapUsd), maxDeployUsd * 0.5, liveBySymbol.get(target.ticker) ?? 0)
          if (notional < 10) continue
          orders.push({ ticker: target.ticker, action: 'SELL', bucket, notional_usd: parseFloat(notional.toFixed(2)), rationale: `Auto: ${bucket} ${Math.abs(driftPct).toFixed(1)}% above target` })
        }
      }

      // ── Write pending orders ────────────────────────────────────────────────
      let ordersSubmitted = 0
      let ordersGenerated = 0

      if (orders.length > 0) {
        const logRows = orders.map((o) => ({
          run_id:            run.id,
          connection_id:     conn.id,
          portfolio_id:      conn.portfolio_id,
          ticker:            o.ticker,
          action:            o.action,
          bucket:            o.bucket,
          notional_usd:      o.notional_usd,
          status:            'pending',
          rationale:         o.rationale,
          requires_approval: conn.approval_required,
        }))

        const { data: logEntries } = await supabase.from('execution_log').insert(logRows).select()
        ordersGenerated = logEntries?.length ?? 0

        // Auto-submit if approval not required
        if (!conn.approval_required && logEntries?.length) {
          for (const entry of logEntries) {
            try {
              const alpacaOrder = await alpaca.placeOrder({
                symbol:        entry.ticker,
                side:          entry.action.toLowerCase() as 'buy' | 'sell',
                type:          'market',
                time_in_force: 'day',
                notional:      entry.notional_usd?.toString(),
              })
              await supabase.from('execution_log').update({
                status: 'submitted', alpaca_order_id: alpacaOrder.id,
                submitted_at: new Date().toISOString(),
              }).eq('id', entry.id)
              ordersSubmitted++
            } catch (err) {
              await supabase.from('execution_log').update({ status: 'error', error: String(err) }).eq('id', entry.id)
            }
          }
        }
      }

      await supabase.from('execution_runs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        summary: {
          positions_synced:   positions.length,
          orders_generated:   ordersGenerated,
          orders_submitted:   ordersSubmitted,
          total_notional_usd: orders.reduce((s, o) => s + o.notional_usd, 0),
          portfolio_value:    portfolioVal,
        },
      }).eq('id', run.id)

      await supabase.from('brokerage_connections').update({
        last_run_at: new Date().toISOString(),
        account_id:  account.id,
      }).eq('id', conn.id)

      await advanceNextRun(supabase, conn)

      results.push({
        connection_id:    conn.id,
        positions_synced: positions.length,
        orders_generated: ordersGenerated,
        orders_submitted: ordersSubmitted,
        pending_approval: conn.approval_required ? ordersGenerated : 0,
      })

    } catch (err) {
      await supabase.from('execution_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: String(err),
      }).eq('id', runId)
      results.push({ connection_id: conn.id, error: String(err) })
    }
  }

  return corsResponse({ processed: connections.length, results })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadRows(supabase: AdminClient, table: string, portfolioId: string) {
  const { data } = await supabase.from(table).select('*').eq('portfolio_id', portfolioId)
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
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(20)
  if (!data?.length) return 0
  const vals = data.map((r) => (r.summary as Record<string, number>)?.portfolio_value ?? 0).filter((v) => v > 0)
  return vals.length > 0 ? Math.max(...vals) : 0
}

async function advanceNextRun(supabase: AdminClient, conn: Record<string, unknown>) {
  const next = new Date()
  if (conn.frequency === 'daily')       next.setDate(next.getDate() + 1)
  else if (conn.frequency === 'weekly') next.setDate(next.getDate() + 7)
  else                                  next.setMonth(next.getMonth() + 1)
  // Always schedule at 10:30 AM ET (15:30 UTC) on a weekday
  next.setUTCHours(15, 30, 0, 0)
  // Skip to Monday if lands on weekend
  if (next.getUTCDay() === 0) next.setUTCDate(next.getUTCDate() + 1)
  if (next.getUTCDay() === 6) next.setUTCDate(next.getUTCDate() + 2)
  await supabase.from('brokerage_connections').update({ next_run_at: next.toISOString() }).eq('id', conn.id as string)
}

interface OrderProposal {
  ticker: string
  action: 'BUY' | 'SELL'
  bucket: string
  notional_usd: number
  rationale: string
}
