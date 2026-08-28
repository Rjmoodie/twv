import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS, corsError, corsResponse } from '../_shared/cors.ts';
import { encryptBrokerToken, randomUrlSafe, sha256Hex } from '../_shared/schwabCrypto.ts';
import { SchwabReadOnlyClient } from '../_shared/schwabClient.ts';

const AUTHORIZE_URL = 'https://api.schwabapi.com/v1/oauth/authorize';
const TOKEN_URL = 'https://api.schwabapi.com/v1/oauth/token';
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://somatech.pro').replace(/\/$/, '');

type AdminClient = SupabaseClient<any>;

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function callbackUrl(): string {
  const explicit = Deno.env.get('SCHWAB_CALLBACK_URL');
  if (explicit) return explicit;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('SUPABASE_URL is not configured');
  return `${supabaseUrl}/functions/v1/schwab-oauth`;
}

function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/?module=portfolio';
  }
  try {
    const parsed = new URL(value, APP_URL);
    return parsed.origin === APP_URL ? `${parsed.pathname}${parsed.search}${parsed.hash}` : '/?module=portfolio';
  } catch {
    return '/?module=portfolio';
  }
}

function redirect(returnTo: string, key: 'brokerage_connected' | 'brokerage_error', value: string): Response {
  const destination = new URL(safeReturnTo(returnTo), APP_URL);
  destination.searchParams.set(key, value);
  return new Response(null, { status: 303, headers: { ...noStoreHeaders, Location: destination.toString() } });
}

async function authenticatedUser(req: Request, supabase: AdminClient) {
  const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!bearer) return null;
  const { data: { user } } = await supabase.auth.getUser(bearer);
  return user;
}

async function beginAuthorization(req: Request, supabase: AdminClient) {
  const user = await authenticatedUser(req, supabase);
  if (!user) return corsError('Authentication required', 401);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (body.action === 'disconnect' && typeof body.authorization_id === 'string') {
    const { data: authorization } = await supabase.from('brokerage_authorizations').select('id')
      .eq('id', body.authorization_id).eq('user_id', user.id).maybeSingle();
    if (!authorization) return corsError('Schwab authorization not found', 404);
    const now = new Date().toISOString();
    await Promise.all([
      supabase.from('brokerage_oauth_tokens').delete().eq('authorization_id', authorization.id),
      supabase.from('brokerage_authorizations').update({
        status: 'disconnected', disconnected_at: now, updated_at: now,
      }).eq('id', authorization.id),
      supabase.from('brokerage_connections').update({
        is_active: false, is_primary: false, connection_status: 'disconnected', updated_at: now,
      }).eq('authorization_id', authorization.id),
    ]);
    const { data: disconnectedConnections } = await supabase.from('brokerage_connections').select('portfolio_id')
      .eq('authorization_id', authorization.id);
    for (const row of disconnectedConnections ?? []) {
      await supabase.from('portfolio_holdings').update({ is_stale: true }).eq('portfolio_id', row.portfolio_id).eq('source', 'schwab');
    }
    return corsResponse({ disconnected: true });
  }

  if (body.action === 'delete_imported_data' && typeof body.authorization_id === 'string') {
    const { data: authorization } = await supabase.from('brokerage_authorizations').select('id')
      .eq('id', body.authorization_id).eq('user_id', user.id).maybeSingle();
    if (!authorization) return corsError('Schwab authorization not found', 404);
    const { data: ownedConnections } = await supabase.from('brokerage_connections').select('portfolio_id')
      .eq('authorization_id', authorization.id);
    await supabase.from('brokerage_connections').delete().eq('authorization_id', authorization.id);
    await supabase.from('brokerage_authorizations').delete().eq('id', authorization.id);
    for (const row of ownedConnections ?? []) {
      await supabase.from('portfolio_holdings').delete().eq('portfolio_id', row.portfolio_id).eq('source', 'schwab');
    }
    return corsResponse({ deleted: true });
  }

  if (body.action !== 'authorize' || typeof body.portfolio_id !== 'string') {
    return corsError('portfolio_id is required', 400);
  }
  const { data: portfolio } = await supabase.from('portfolios').select('id').eq('id', body.portfolio_id).eq('user_id', user.id).maybeSingle();
  if (!portfolio) return corsError('Portfolio not found', 404);

  let reconnectAuthorizationId: string | null = null;
  if (typeof body.authorization_id === 'string') {
    const { data: owned } = await supabase.from('brokerage_authorizations').select('id')
      .eq('id', body.authorization_id).eq('user_id', user.id).maybeSingle();
    reconnectAuthorizationId = owned?.id ?? null;
  }

  const state = randomUrlSafe(32);
  const stateHash = await sha256Hex(state);
  const returnTo = safeReturnTo(body.return_to);
  const { error } = await supabase.from('brokerage_oauth_attempts').insert({
    state_hash: stateHash,
    user_id: user.id,
    portfolio_id: portfolio.id,
    reconnect_authorization_id: reconnectAuthorizationId,
    return_to: returnTo,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) return corsError('Could not start Schwab authorization', 500);

  const clientId = Deno.env.get('SCHWAB_CLIENT_ID');
  if (!clientId) return corsError('Schwab connection is not configured', 503);
  const authorize = new URL(AUTHORIZE_URL);
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', callbackUrl());
  authorize.searchParams.set('state', state);
  return new Response(JSON.stringify({ authorize_url: authorize.toString() }), {
    status: 200,
    headers: { ...CORS_HEADERS, ...noStoreHeaders, 'Content-Type': 'application/json' },
  });
}

async function exchangeCode(code: string) {
  const clientId = Deno.env.get('SCHWAB_CLIENT_ID');
  const clientSecret = Deno.env.get('SCHWAB_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('Schwab OAuth client is not configured');
  // URLSearchParams has already decoded the callback value. A second decode is
  // only attempted when the provider sent a visibly encoded terminal marker.
  let decoded = code;
  if (/%40$/i.test(decoded)) {
    try { decoded = decodeURIComponent(decoded); } catch { /* keep original */ }
  }
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: decoded,
      redirect_uri: callbackUrl(),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Schwab authorization exchange failed with status ${response.status}`);
  const token = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!token.access_token || !token.refresh_token || !Number.isFinite(token.expires_in)) {
    throw new Error('Schwab authorization returned an unexpected payload');
  }
  return token as { access_token: string; refresh_token: string; expires_in: number };
}

async function autoLinkPlaidAccounts(
  supabase: AdminClient,
  userId: string,
  connections: { id: string; lastFour: string }[],
) {
  const { data: plaidRows } = await supabase.from('plaid_connections').select('item_id,accounts').eq('user_id', userId);
  const links: Record<string, unknown>[] = [];
  for (const plaid of plaidRows ?? []) {
    for (const account of Array.isArray(plaid.accounts) ? plaid.accounts as Record<string, unknown>[] : []) {
      const mask = typeof account.mask === 'string' ? account.mask : '';
      const direct = connections.find(connection => connection.lastFour && connection.lastFour === mask);
      if (!direct || account.type !== 'investment' || typeof account.id !== 'string') continue;
      links.push({
        user_id: userId,
        brokerage_connection_id: direct.id,
        plaid_item_id: plaid.item_id,
        plaid_account_id: account.id,
        match_method: 'exact_last_four',
        include_in_plaid_net_worth: false,
      });
    }
  }
  if (links.length) {
    await supabase.from('financial_account_links').upsert(links, { onConflict: 'user_id,plaid_item_id,plaid_account_id' });
  }
}

async function finishAuthorization(req: Request, supabase: AdminClient) {
  const url = new URL(req.url);
  const rawState = url.searchParams.get('state');
  if (!rawState) return redirect('/?module=portfolio', 'brokerage_error', 'invalid_state');
  const stateHash = await sha256Hex(rawState);
  const { data: attempt } = await supabase.from('brokerage_oauth_attempts').select('*')
    .eq('state_hash', stateHash).is('used_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (!attempt) return redirect('/?module=portfolio', 'brokerage_error', 'invalid_or_expired_state');
  const returnTo = safeReturnTo(attempt.return_to);

  const { data: consumed, error: consumeError } = await supabase.from('brokerage_oauth_attempts')
    .update({ used_at: new Date().toISOString() })
    .eq('state_hash', stateHash).is('used_at', null).select('state_hash').maybeSingle();
  if (consumeError || !consumed) return redirect(returnTo, 'brokerage_error', 'authorization_already_used');
  if (url.searchParams.get('error')) return redirect(returnTo, 'brokerage_error', 'authorization_denied');
  const code = url.searchParams.get('code');
  if (!code) return redirect(returnTo, 'brokerage_error', 'missing_authorization_code');

  try {
    const token = await exchangeCode(code);
    const client = new SchwabReadOnlyClient(token.access_token);
    const accounts = await client.listAccountNumbers();
    if (!Array.isArray(accounts) || !accounts.length || accounts.some(account => !account.hashValue)) {
      throw new Error('Schwab returned no usable linked accounts');
    }
    const now = new Date();
    const refreshTtlSeconds = Number(Deno.env.get('SCHWAB_REFRESH_TOKEN_TTL_SECONDS') ?? '604800');
    const refreshExpiresAt = new Date(now.getTime() + refreshTtlSeconds * 1000).toISOString();
    let authorizationId = attempt.reconnect_authorization_id as string | null;
    if (authorizationId) {
      const { error } = await supabase.from('brokerage_authorizations').update({
        status: 'active', refresh_expires_at: refreshExpiresAt,
        last_authorized_at: now.toISOString(), last_error_code: null,
        disconnected_at: null, updated_at: now.toISOString(),
      }).eq('id', authorizationId).eq('user_id', attempt.user_id);
      if (error) throw new Error('Could not reconnect Schwab authorization');
    } else {
      const { data: inserted, error } = await supabase.from('brokerage_authorizations').insert({
        user_id: attempt.user_id, provider: 'schwab', status: 'active',
        refresh_expires_at: refreshExpiresAt, last_authorized_at: now.toISOString(),
      }).select('id').single();
      if (error || !inserted) throw new Error('Could not save Schwab authorization');
      authorizationId = inserted.id;
    }

    const [access, refresh] = await Promise.all([
      encryptBrokerToken(token.access_token), encryptBrokerToken(token.refresh_token),
    ]);
    const { error: tokenError } = await supabase.from('brokerage_oauth_tokens').upsert({
      authorization_id: authorizationId,
      access_token_ciphertext: access.ciphertext, access_token_iv: access.iv,
      access_expires_at: new Date(now.getTime() + token.expires_in * 1000).toISOString(),
      refresh_token_ciphertext: refresh.ciphertext, refresh_token_iv: refresh.iv,
      key_version: 1, refresh_lease_owner: null, refresh_lease_expires_at: null,
      updated_at: now.toISOString(),
    }, { onConflict: 'authorization_id' });
    if (tokenError) throw new Error('Could not protect Schwab authorization');

    await supabase.from('brokerage_connections').update({ is_primary: false })
      .eq('portfolio_id', attempt.portfolio_id).eq('is_primary', true);

    const connectionRefs: { id: string; lastFour: string }[] = [];
    for (let index = 0; index < accounts.length; index += 1) {
      const account = accounts[index];
      const lastFour = String(account.accountNumber ?? '').slice(-4);
      const { data: connection, error } = await supabase.from('brokerage_connections').upsert({
        user_id: attempt.user_id,
        portfolio_id: attempt.portfolio_id,
        authorization_id: authorizationId,
        provider: 'schwab', environment: 'live', api_key: null, api_secret: null,
        account_hash: account.hashValue,
        account_number_last_four: lastFour || null,
        display_name: lastFour ? `Schwab ••••${lastFour}` : `Schwab account ${index + 1}`,
        is_active: true, is_primary: index === 0, connection_status: 'active',
        autonomous_enabled: false, approval_required: true, kill_switch: true,
        capabilities: { positions: 'read', balances: 'read', executions: 'read', quotes: 'read', orders: 'none' },
        last_sync_error: null, updated_at: now.toISOString(),
      }, { onConflict: 'authorization_id,account_hash' }).select('id').single();
      if (error || !connection) throw new Error('Could not save a linked Schwab account');
      connectionRefs.push({ id: connection.id, lastFour });
      await supabase.from('brokerage_sync_jobs').insert({ connection_id: connection.id, sync_kind: 'full' });
    }
    await autoLinkPlaidAccounts(supabase, attempt.user_id, connectionRefs);
    return redirect(returnTo, 'brokerage_connected', 'schwab');
  } catch (error) {
    // No code, state or token is ever logged. Operators get only a stable class.
    console.error('Schwab OAuth callback failed', error instanceof Error ? error.message : 'unknown_error');
    return redirect(returnTo, 'brokerage_error', 'connection_failed');
  }
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  if (req.method === 'POST') return beginAuthorization(req, supabase);
  if (req.method === 'GET') return finishAuthorization(req, supabase);
  return new Response('Method not allowed', { status: 405, headers: noStoreHeaders });
});
