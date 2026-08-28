/**
 * alpaca-sync — Edge Function
 *
 * Pulls live positions + prices from Alpaca and writes them into
 * portfolio_holdings for the requesting user.
 *
 * POST body: { connection_id: string }
 * Returns:   { synced: number, account: AlpacaAccount }
 */

import { serve }           from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient }    from 'https://esm.sh/@supabase/supabase-js@2'
import { AlpacaClient }    from '../_shared/alpacaClient.ts'
import { corsResponse, corsError, CORS_HEADERS } from '../_shared/cors.ts'

type AdminClient = ReturnType<typeof createClient<any>>

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
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

    // ── Input ─────────────────────────────────────────────────────────────────
    const { connection_id } = await req.json() as { connection_id: string }
    if (!connection_id) return corsError('connection_id required')

    // ── Load connection (RLS ensures user owns it) ────────────────────────────
    const { data: conn, error: connErr } = await supabase
      .from('brokerage_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('user_id', user.id)
      .single()

    if (connErr || !conn) return corsError('Connection not found', 404)
    if (conn.provider !== 'alpaca') {
      return corsError('This endpoint only accepts an Alpaca connection', 409)
    }
    if (!conn.api_key || !conn.api_secret) return corsError('Alpaca credentials are unavailable', 409)
    if (conn.kill_switch)  return corsError('Kill switch is active', 403)
    const { data: schwabPrimary } = await supabase.from('brokerage_connections').select('id')
      .eq('portfolio_id', conn.portfolio_id).eq('provider', 'schwab')
      .eq('is_primary', true).eq('is_active', true).maybeSingle()
    if (schwabPrimary) {
      return corsError('Schwab is the primary position source for this portfolio; Alpaca position projection is disabled', 409)
    }

    // ── Log run ───────────────────────────────────────────────────────────────
    const { data: run } = await supabase
      .from('execution_runs')
      .insert({
        connection_id,
        portfolio_id: conn.portfolio_id,
        run_type: 'sync',
        status: 'running',
      })
      .select()
      .single()

    const alpaca  = new AlpacaClient(conn.api_key, conn.api_secret, conn.environment)

    try {
      // ── Fetch account + positions ─────────────────────────────────────────
      const [account, positions] = await Promise.all([
        alpaca.getAccount(),
        alpaca.listPositions(),
      ])

      // ── Resolve sector→bucket mapping (best-effort) ───────────────────────
      // We store positions as US_EQUITY_LARGE by default; user can reassign in UI
      const tickerBucketMap = await getExistingBuckets(supabase, conn.portfolio_id, positions.map((p) => p.symbol))

      // ── Upsert holdings ───────────────────────────────────────────────────
      const holdingRows = positions.map((p) => ({
        portfolio_id:  conn.portfolio_id,
        ticker:        p.symbol,
        bucket:        tickerBucketMap[p.symbol] ?? 'US_EQUITY_LARGE',
        shares:        parseFloat(p.qty),
        cost_basis:    parseFloat(p.avg_entry_price),
        current_price: parseFloat(p.current_price),
        market_value:  parseFloat(p.market_value),
        source:        'alpaca',
        updated_at:    new Date().toISOString(),
      }))

      if (holdingRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from('portfolio_holdings')
          .upsert(holdingRows, { onConflict: 'portfolio_id,ticker,source' })
        if (upsertErr) throw upsertErr
      }

      // ── Remove stale holdings no longer in Alpaca positions ───────────────
      const activeSymbols = positions.map((p) => p.symbol)
      let staleDelete = supabase
          .from('portfolio_holdings')
          .delete()
          .eq('portfolio_id', conn.portfolio_id)
          .eq('source', 'alpaca')
      if (activeSymbols.length > 0) {
        staleDelete = staleDelete
          .not('ticker', 'in', `(${activeSymbols.map((s) => `"${s}"`).join(',')})`)
      }
      const { error: staleDeleteError } = await staleDelete
      if (staleDeleteError) throw staleDeleteError

      // ── Mark run complete ─────────────────────────────────────────────────
      await supabase.from('execution_runs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        summary: {
          positions_synced: positions.length,
          portfolio_value:  parseFloat(account.portfolio_value),
          cash:             parseFloat(account.cash),
          equity:           parseFloat(account.equity),
        },
      }).eq('id', run.id)

      await supabase.from('brokerage_connections').update({
        last_run_at: new Date().toISOString(),
        account_id:   account.id,
        account_type: account.account_type ?? null,
      }).eq('id', connection_id)

      return corsResponse({
        synced:  positions.length,
        account: {
          equity:          account.equity,
          cash:            account.cash,
          portfolio_value: account.portfolio_value,
          buying_power:    account.buying_power,
          pdt:             account.pattern_day_trader,
        },
      })

    } catch (err) {
      await supabase.from('execution_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: String(err),
      }).eq('id', run.id)
      throw err
    }

  } catch (err) {
    return corsError(String(err), 500)
  }
})

async function getExistingBuckets(
  supabase: AdminClient,
  portfolioId: string,
  tickers: string[],
): Promise<Record<string, string>> {
  if (tickers.length === 0) return {}
  const { data } = await supabase
    .from('portfolio_holdings')
    .select('ticker, bucket')
    .eq('portfolio_id', portfolioId)
    .in('ticker', tickers)
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.ticker] = row.bucket
  return map
}
