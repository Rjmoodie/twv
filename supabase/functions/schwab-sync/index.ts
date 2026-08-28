import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS, corsError, corsResponse } from '../_shared/cors.ts';
import { SchwabApiError, SchwabReadOnlyClient } from '../_shared/schwabClient.ts';
import { sha256Hex } from '../_shared/schwabCrypto.ts';
import {
  accountBalances,
  inferredBucket,
  isCompleteAccountSnapshot,
  normalizeFilledOrders,
  normalizePositions,
  sanitizeBrokerPayload,
  type CanonicalPosition,
} from '../_shared/schwabMapping.ts';
import {
  getSchwabAccessToken,
  SchwabAuthorizationExpiredError,
  SchwabRefreshBusyError,
} from '../_shared/schwabToken.ts';

type AdminClient = SupabaseClient<any>;

interface ConnectionRow {
  id: string;
  user_id: string;
  portfolio_id: string;
  authorization_id: string;
  account_hash: string;
  account_number_last_four: string | null;
  connection_status: string;
  sync_cursor: string | null;
  is_active: boolean;
}

interface SyncJob {
  id: string;
  connection_id: string;
  sync_kind: 'incremental' | 'full' | 'manual';
  attempt_count: number;
  max_attempts: number;
}

const retryMs = (attempt: number) => [30_000, 120_000, 600_000, 1_800_000, 3_600_000][Math.min(Math.max(attempt - 1, 0), 4)];

function orderWindow(cursor: string | null, full: boolean) {
  const end = new Date();
  const defaultLookback = full ? 90 : 7;
  const start = cursor ? new Date(cursor) : new Date(end.getTime() - defaultLookback * 86_400_000);
  // Overlap makes timestamp cursors safe against late fills and equal-time fills;
  // the provider execution id is the actual idempotency key.
  start.setTime(start.getTime() - 48 * 60 * 60 * 1000);
  return { from: start.toISOString(), to: end.toISOString() };
}

async function storeRawEvent(
  supabase: AdminClient,
  connectionId: string,
  eventKind: string,
  payload: unknown,
  status: 'processed' | 'quarantined',
  reason?: string,
  providerEventId?: string,
) {
  const sanitized = sanitizeBrokerPayload(payload);
  const payloadHash = await sha256Hex(JSON.stringify(sanitized));
  await supabase.from('brokerage_raw_events').upsert({
    connection_id: connectionId,
    event_kind: eventKind,
    provider_event_id: providerEventId ?? null,
    payload_hash: payloadHash,
    schema_version: eventKind === 'account_snapshot' ? 'schwab-account-v1-guarded' : 'schwab-orders-v1-guarded',
    processing_status: status,
    quarantine_reason: reason ?? null,
    sanitized_payload: sanitized,
  }, { onConflict: 'connection_id,payload_hash' });
  return payloadHash;
}

async function fetchSchwabSnapshot(
  supabase: AdminClient,
  authorizationId: string,
  accountHash: string,
  from: string,
  to: string,
): Promise<[Record<string, unknown>, Record<string, unknown>[]]> {
  let accessToken = await getSchwabAccessToken(supabase, authorizationId);
  const request = (client: SchwabReadOnlyClient) => Promise.all([
    client.getAccount(accountHash), client.listFilledOrders(accountHash, from, to),
  ]) as Promise<[Record<string, unknown>, Record<string, unknown>[]]>;
  try {
    return await request(new SchwabReadOnlyClient(accessToken));
  } catch (error) {
    if (!(error instanceof SchwabApiError) || error.status !== 401) throw error;
    await supabase.from('brokerage_oauth_tokens').update({ access_expires_at: new Date(0).toISOString() })
      .eq('authorization_id', authorizationId);
    accessToken = await getSchwabAccessToken(supabase, authorizationId);
    return request(new SchwabReadOnlyClient(accessToken));
  }
}

async function replacePositions(
  supabase: AdminClient,
  connection: ConnectionRow,
  positions: CanonicalPosition[],
  dataAsOf: string,
) {
  const rows = positions.map(position => ({
    user_id: connection.user_id,
    connection_id: connection.id,
    ...position,
    provider_data_as_of: dataAsOf,
    updated_at: dataAsOf,
  }));
  if (rows.length) {
    const { error } = await supabase.from('brokerage_positions').upsert(rows, { onConflict: 'connection_id,instrument_id' });
    if (error) throw new Error(`Could not persist Schwab positions: ${error.message}`);
  }
  const { data: existing, error: readError } = await supabase.from('brokerage_positions')
    .select('id,instrument_id').eq('connection_id', connection.id);
  if (readError) throw new Error('Could not reconcile Schwab positions');
  const current = new Set(positions.map(position => position.instrument_id));
  const staleIds = (existing ?? []).filter(row => !current.has(row.instrument_id)).map(row => row.id);
  if (staleIds.length) {
    const { error } = await supabase.from('brokerage_positions').delete().in('id', staleIds);
    if (error) throw new Error('Could not remove closed Schwab positions');
  }
}

async function projectPortfolioHoldings(
  supabase: AdminClient,
  connection: ConnectionRow,
  dataAsOf: string,
) {
  const { data: connections } = await supabase.from('brokerage_connections').select('id')
    .eq('portfolio_id', connection.portfolio_id).eq('provider', 'schwab').eq('is_active', true);
  const connectionIds = (connections ?? []).map(row => row.id);
  const [{ data: positions }, { data: mappings }, { data: snapshots }] = await Promise.all([
    supabase.from('brokerage_positions').select('*').in('connection_id', connectionIds),
    supabase.from('portfolio_position_mappings').select('*')
      .eq('portfolio_id', connection.portfolio_id).eq('provider', 'schwab'),
    supabase.from('brokerage_account_snapshots').select('connection_id,cash_balance,provider_data_as_of')
      .in('connection_id', connectionIds).order('provider_data_as_of', { ascending: false }),
  ]);
  const mappingByInstrument = new Map((mappings ?? []).map(row => [row.instrument_id, row]));
  const aggregate = new Map<string, {
    ticker: string; company_name: string | null; bucket: string; shares: number;
    cost: number; market: number; classification_source: 'user' | 'inferred'; notes: string | null;
  }>();
  let unprojected = 0;
  for (const position of positions ?? []) {
    const symbol = typeof position.symbol === 'string' ? position.symbol.toUpperCase() : '';
    const assetType = String(position.asset_type ?? 'UNKNOWN').toUpperCase();
    // Options and unknown instruments remain visible in the canonical broker
    // ledger but cannot enter equity P&L/allocation math without multipliers.
    if (!symbol || assetType.includes('OPTION') || assetType === 'UNKNOWN') { unprojected += 1; continue; }
    const mapping = mappingByInstrument.get(position.instrument_id);
    const inferred = inferredBucket(assetType);
    const bucket = mapping?.bucket ?? inferred.bucket;
    const classificationSource = mapping?.classification_source === 'user' ? 'user' : 'inferred';
    const signedQuantity = Number(position.quantity) * (position.long_short === 'short' ? -1 : 1);
    const costBasis = Number(position.cost_basis ?? 0) * (position.long_short === 'short' ? -1 : 1);
    const marketValue = Number(position.market_value ?? 0);
    const current = aggregate.get(symbol) ?? {
      ticker: symbol, company_name: position.description ?? null, bucket,
      shares: 0, cost: 0, market: 0, classification_source: classificationSource,
      notes: mapping?.notes ?? null,
    };
    current.shares += signedQuantity;
    current.cost += costBasis;
    current.market += marketValue;
    if (classificationSource === 'user') {
      current.bucket = bucket; current.classification_source = 'user'; current.notes = mapping?.notes ?? current.notes;
    }
    aggregate.set(symbol, current);
  }

  const latestCashByConnection = new Map<string, number>();
  for (const snapshot of snapshots ?? []) {
    if (!latestCashByConnection.has(snapshot.connection_id)) {
      latestCashByConnection.set(snapshot.connection_id, Number(snapshot.cash_balance ?? 0));
    }
  }
  const cash = [...latestCashByConnection.values()].reduce((sum, value) => sum + value, 0);
  if (cash !== 0) {
    aggregate.set('CASH', {
      ticker: 'CASH', company_name: 'Schwab cash balance', bucket: 'CASH', shares: cash,
      cost: cash, market: cash, classification_source: 'inferred', notes: null,
    });
  }
  const rows = [...aggregate.values()].map(row => ({
    ticker: row.ticker,
    company_name: row.company_name,
    bucket: row.bucket,
    shares: row.shares,
    cost_basis: row.shares === 0 ? null : Math.abs(row.cost / row.shares),
    current_price: row.shares === 0 ? null : Math.abs(row.market / row.shares),
    market_value: row.market,
    notes: row.notes,
    classification_source: row.classification_source,
  }));
  const { error } = await supabase.rpc('replace_schwab_portfolio_holdings', {
    p_user_id: connection.user_id,
    p_portfolio_id: connection.portfolio_id,
    p_provider_data_as_of: dataAsOf,
    p_rows: rows,
  });
  if (error) throw new Error(`Could not project Schwab positions into Portfolio: ${error.message}`);
  return { rows, unprojected };
}

async function syncConnection(
  supabase: AdminClient,
  connection: ConnectionRow,
  job: SyncJob | null,
) {
  const now = new Date();
  const dataAsOf = now.toISOString();
  const { data: run, error: runError } = await supabase.from('brokerage_sync_runs').insert({
    job_id: job?.id ?? null, connection_id: connection.id, status: 'running', started_at: dataAsOf,
  }).select('id').single();
  if (runError || !run) throw new Error('Could not start Schwab sync audit run');
  await supabase.from('brokerage_connections').update({ last_sync_attempt_at: dataAsOf }).eq('id', connection.id);

  try {
    const window = orderWindow(connection.sync_cursor, job?.sync_kind === 'full');
    const [accountPayload, rawOrders] = await fetchSchwabSnapshot(
      supabase, connection.authorization_id, connection.account_hash, window.from, window.to,
    );
    const positionsResult = normalizePositions(accountPayload);
    const executionsResult = normalizeFilledOrders(Array.isArray(rawOrders) ? rawOrders : []);
    const complete = isCompleteAccountSnapshot(accountPayload, positionsResult.values.length);
    await storeRawEvent(supabase, connection.id, 'account_snapshot', accountPayload,
      complete ? 'processed' : 'quarantined', complete ? undefined : 'incomplete_account_snapshot');
    for (const item of positionsResult.quarantined) {
      await storeRawEvent(supabase, connection.id, 'position', item.payload, 'quarantined', item.reason);
    }
    for (const order of rawOrders) {
      const id = typeof order.orderId === 'string' || typeof order.orderId === 'number' ? String(order.orderId) : undefined;
      await storeRawEvent(supabase, connection.id, 'filled_order', order, 'processed', undefined, id);
    }
    for (const item of executionsResult.quarantined) {
      await storeRawEvent(supabase, connection.id, 'filled_order', item.payload, 'quarantined', item.reason);
    }
    if (!complete) throw new Error('Schwab returned an incomplete account snapshot; existing positions were preserved');

    const balances = accountBalances(accountPayload);
    // account_type describes the account, not a point-in-time balance, and lives
    // on brokerage_connections. Spreading the whole object into the snapshot sent
    // a column the table does not have, so Postgres rejected the entire row.
    const { account_type: _accountType, ...snapshotBalances } = balances;
    await replacePositions(supabase, connection, positionsResult.values, dataAsOf);
    const { error: snapshotError } = await supabase.from('brokerage_account_snapshots').insert({
      user_id: connection.user_id, connection_id: connection.id,
      provider_data_as_of: dataAsOf, ...snapshotBalances, is_complete: true,
    });
    if (snapshotError) throw new Error(`Could not persist Schwab account balance snapshot: ${snapshotError.message}`);

    let insertedExecutions = 0;
    for (const execution of executionsResult.values) {
      const sourceHash = await sha256Hex(JSON.stringify(execution));
      const { data, error } = await supabase.from('brokerage_executions').upsert({
        user_id: connection.user_id, connection_id: connection.id, provider: 'schwab',
        ...execution, source_event_hash: sourceHash,
      }, { onConflict: 'connection_id,provider_execution_id,provider_leg_id', ignoreDuplicates: true }).select('id');
      if (error) throw new Error(`Could not persist Schwab execution: ${error.message}`);
      insertedExecutions += data?.length ?? 0;
    }

    const projection = await projectPortfolioHoldings(supabase, connection, dataAsOf);
    const projectedValue = projection.rows.reduce((sum, row) => sum + Number(row.market_value ?? 0), 0);
    const liquidation = Number(balances.liquidation_value ?? projectedValue);
    const variance = liquidation - projectedValue;
    const tolerance = Math.max(1, Math.abs(liquidation) * 0.001);
    const reconciled = Math.abs(variance) <= tolerance && projection.unprojected === 0;
    const reconciliationStatus = projection.unprojected > 0 ? 'unsupported' : reconciled ? 'reconciled' : 'variance';

    await supabase.from('brokerage_connections').update({
      account_type: balances.account_type,
      connection_status: 'active', last_sync_error: null,
      last_positions_synced_at: dataAsOf, last_executions_synced_at: dataAsOf,
      provider_data_as_of: dataAsOf, sync_cursor: window.to,
      last_reconciled_at: dataAsOf, reconciliation_status: reconciliationStatus,
      reconciliation_variance: variance,
    }).eq('id', connection.id);
    await supabase.from('brokerage_sync_runs').update({
      status: reconciled ? 'completed' : 'partial', completed_at: new Date().toISOString(),
      positions_seen: positionsResult.values.length, executions_seen: executionsResult.values.length,
      executions_inserted: insertedExecutions,
      quarantined_events: positionsResult.quarantined.length + executionsResult.quarantined.length,
      provider_data_as_of: dataAsOf,
      diagnostics: { reconciliation_status: reconciliationStatus, variance, unprojected_positions: projection.unprojected },
    }).eq('id', run.id);
    return {
      connection_id: connection.id,
      positions: positionsResult.values.length,
      executions: executionsResult.values.length,
      executions_inserted: insertedExecutions,
      quarantined: positionsResult.quarantined.length + executionsResult.quarantined.length,
      reconciliation_status: reconciliationStatus,
      provider_data_as_of: dataAsOf,
    };
  } catch (error) {
    const code = error instanceof SchwabAuthorizationExpiredError ? 'authorization_expired'
      : error instanceof SchwabRefreshBusyError ? 'refresh_busy'
      : error instanceof SchwabApiError ? `provider_${error.status}`
      : 'sync_failed';
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown sync failure';
    const terminal = code === 'authorization_expired' || code === 'provider_403' || code === 'provider_404';
    await Promise.all([
      supabase.from('brokerage_sync_runs').update({
        status: 'failed', completed_at: new Date().toISOString(), error_code: code, error_message: message,
      }).eq('id', run.id),
      supabase.from('brokerage_connections').update({
        connection_status: terminal ? (code === 'authorization_expired' ? 'expired' : 'revoked') : 'error',
        last_sync_error: message,
      }).eq('id', connection.id),
    ]);
    throw Object.assign(error instanceof Error ? error : new Error(message), { syncCode: code, terminal });
  }
}

async function failJob(supabase: AdminClient, job: SyncJob, error: Error & { syncCode?: string; terminal?: boolean }) {
  const terminal = error.terminal === true || job.attempt_count >= job.max_attempts;
  const status = terminal ? 'dead_letter' : 'failed';
  await supabase.from('brokerage_sync_jobs').update({
    status, last_error_code: error.syncCode ?? 'sync_failed', last_error: error.message.slice(0, 500),
    not_before: new Date(Date.now() + retryMs(job.attempt_count)).toISOString(),
    claim_owner: null, claimed_at: null, completed_at: terminal ? new Date().toISOString() : null,
  }).eq('id', job.id);
  if (terminal) {
    const { data: connection } = await supabase.from('brokerage_connections').select('user_id')
      .eq('id', job.connection_id).maybeSingle();
    if (connection) {
      await supabase.from('notification_outbox').insert({
        user_id: connection.user_id, event_type: 'brokerage_sync_failed',
        payload: { provider: 'Schwab', connection_id: job.connection_id },
        channels: ['in_app', 'push'],
        dedupe_key: `brokerage-sync-failed:${job.connection_id}:${new Date().toISOString().slice(0, 10)}`,
      });
    }
  }
}

async function connectionForUser(supabase: AdminClient, connectionId: string, userId?: string): Promise<ConnectionRow | null> {
  let query = supabase.from('brokerage_connections').select('*')
    .eq('id', connectionId).eq('provider', 'schwab').eq('is_active', true);
  if (userId) query = query.eq('user_id', userId);
  const { data } = await query.maybeSingle();
  return data as ConnectionRow | null;
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return corsError('Method not allowed', 405);
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const dispatchSecret = req.headers.get('x-dispatch-secret');
  const isWorker = dispatchSecret && dispatchSecret === Deno.env.get('SCHWAB_SYNC_SECRET');

  if (isWorker) {
    const batchSize = Math.min(Math.max(Number(body.batch_size ?? 2), 1), 5);
    const workerId = crypto.randomUUID();
    const { data: jobs, error } = await supabase.rpc('claim_brokerage_sync_jobs', {
      p_batch_size: batchSize, p_worker_id: workerId,
    });
    if (error) return corsError(`Could not claim Schwab sync work: ${error.message}`, 500);
    const results: unknown[] = [];
    for (const job of (jobs ?? []) as SyncJob[]) {
      const connection = await connectionForUser(supabase, job.connection_id);
      if (!connection) {
        await failJob(supabase, job, Object.assign(new Error('Schwab connection not found'), { terminal: true, syncCode: 'connection_missing' }));
        continue;
      }
      try {
        results.push(await syncConnection(supabase, connection, job));
        await supabase.from('brokerage_sync_jobs').update({
          status: 'completed', completed_at: new Date().toISOString(), claim_owner: null, claimed_at: null,
        }).eq('id', job.id).eq('claim_owner', workerId);
      } catch (error) {
        await failJob(supabase, job, error as Error & { syncCode?: string; terminal?: boolean });
        results.push({ connection_id: job.connection_id, error: 'sync_failed' });
      }
    }
    return corsResponse({ processed: (jobs ?? []).length, results });
  }

  const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!bearer) return corsError('Authentication required', 401);
  const { data: { user } } = await supabase.auth.getUser(bearer);
  if (!user) return corsError('Invalid or expired session', 401);
  if (typeof body.connection_id !== 'string') return corsError('connection_id is required', 400);
  const connection = await connectionForUser(supabase, body.connection_id, user.id);
  if (!connection) return corsError('Schwab connection not found', 404);
  try {
    return corsResponse(await syncConnection(supabase, connection, null));
  } catch (error) {
    const status = error instanceof SchwabAuthorizationExpiredError ? 409
      : error instanceof SchwabApiError && error.status === 429 ? 429 : 502;
    return corsError(error instanceof SchwabAuthorizationExpiredError
      ? 'Schwab authorization expired. Reconnect to resume syncing.'
      : 'Schwab sync could not complete. Existing portfolio data was preserved.', status);
  }
});
