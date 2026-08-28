import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptBrokerToken, encryptBrokerToken } from './schwabCrypto.ts';

const TOKEN_URL = 'https://api.schwabapi.com/v1/oauth/token';
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

type AdminClient = SupabaseClient<any>;

interface TokenRow {
  authorization_id: string;
  access_token_ciphertext: string;
  access_token_iv: string;
  access_expires_at: string;
  refresh_token_ciphertext: string;
  refresh_token_iv: string;
  refresh_lease_owner: string | null;
  refresh_lease_expires_at: string | null;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
}

export class SchwabAuthorizationExpiredError extends Error {
  constructor() { super('Schwab authorization expired; reconnect is required'); }
}

export class SchwabRefreshBusyError extends Error {
  constructor() { super('Another worker is refreshing this Schwab authorization'); }
}

async function tokenRow(supabase: AdminClient, authorizationId: string): Promise<TokenRow> {
  const { data, error } = await supabase
    .from('brokerage_oauth_tokens')
    .select('*')
    .eq('authorization_id', authorizationId)
    .single();
  if (error || !data) throw new Error('Schwab token record is unavailable');
  return data as TokenRow;
}

async function markExpired(supabase: AdminClient, authorizationId: string, code: string) {
  await Promise.all([
    supabase.from('brokerage_authorizations').update({
      status: 'expired', last_error_code: code, updated_at: new Date().toISOString(),
    }).eq('id', authorizationId),
    supabase.from('brokerage_connections').update({
      connection_status: 'expired', last_sync_error: 'Authorization expired',
    }).eq('authorization_id', authorizationId),
  ]);
}

export async function getSchwabAccessToken(supabase: AdminClient, authorizationId: string): Promise<string> {
  const [{ data: authorization }, initial] = await Promise.all([
    supabase.from('brokerage_authorizations').select('status,refresh_expires_at').eq('id', authorizationId).single(),
    tokenRow(supabase, authorizationId),
  ]);
  if (!authorization || new Date(authorization.refresh_expires_at).getTime() <= Date.now()
      || ['expired', 'revoked', 'disconnected'].includes(authorization.status)) {
    await markExpired(supabase, authorizationId, 'refresh_expired');
    throw new SchwabAuthorizationExpiredError();
  }
  if (new Date(initial.access_expires_at).getTime() > Date.now() + REFRESH_BUFFER_MS) {
    return decryptBrokerToken(initial.access_token_ciphertext, initial.access_token_iv);
  }

  const workerId = crypto.randomUUID();
  const { data: claimed, error: claimError } = await supabase.rpc('claim_brokerage_token_refresh', {
    p_authorization_id: authorizationId,
    p_worker_id: workerId,
    p_lease_seconds: 60,
  });
  if (claimError) throw new Error('Could not serialize Schwab token refresh');
  const leased = (claimed as TokenRow[] | null)?.[0];
  if (!leased) {
    // A short-lived race is retried by the durable sync queue. Never use the
    // pre-race refresh token: it may already have rotated.
    throw new SchwabRefreshBusyError();
  }

  // A previous worker may have refreshed just before this lease was acquired.
  if (new Date(leased.access_expires_at).getTime() > Date.now() + REFRESH_BUFFER_MS) {
    await supabase.from('brokerage_oauth_tokens').update({
      refresh_lease_owner: null, refresh_lease_expires_at: null,
    }).eq('authorization_id', authorizationId).eq('refresh_lease_owner', workerId);
    return decryptBrokerToken(leased.access_token_ciphertext, leased.access_token_iv);
  }

  const clientId = Deno.env.get('SCHWAB_CLIENT_ID');
  const clientSecret = Deno.env.get('SCHWAB_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('Schwab OAuth client is not configured');
  const oldRefreshToken = await decryptBrokerToken(leased.refresh_token_ciphertext, leased.refresh_token_iv);
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: oldRefreshToken }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    await supabase.from('brokerage_oauth_tokens').update({
      refresh_lease_owner: null, refresh_lease_expires_at: null,
    }).eq('authorization_id', authorizationId).eq('refresh_lease_owner', workerId);
    if (response.status === 400 || response.status === 401) {
      await markExpired(supabase, authorizationId, 'refresh_rejected');
      throw new SchwabAuthorizationExpiredError();
    }
    throw new Error(`Schwab token refresh failed with status ${response.status}`);
  }

  const refreshed = await response.json() as TokenResponse;
  if (!refreshed.access_token || !Number.isFinite(refreshed.expires_in)) {
    throw new Error('Schwab token refresh returned an unexpected payload');
  }
  const nextRefresh = refreshed.refresh_token || oldRefreshToken;
  const [access, refresh] = await Promise.all([
    encryptBrokerToken(refreshed.access_token),
    encryptBrokerToken(nextRefresh),
  ]);
  const now = new Date();
  const { error: persistError } = await supabase.from('brokerage_oauth_tokens').update({
    access_token_ciphertext: access.ciphertext,
    access_token_iv: access.iv,
    access_expires_at: new Date(now.getTime() + refreshed.expires_in * 1000).toISOString(),
    refresh_token_ciphertext: refresh.ciphertext,
    refresh_token_iv: refresh.iv,
    last_refreshed_at: now.toISOString(),
    updated_at: now.toISOString(),
    refresh_lease_owner: null,
    refresh_lease_expires_at: null,
  }).eq('authorization_id', authorizationId).eq('refresh_lease_owner', workerId);
  if (persistError) throw new Error('Could not persist refreshed Schwab tokens');

  // Deliberately do not move brokerage_authorizations.refresh_expires_at here.
  // The documented seven-day deadline is anchored to interactive authorization,
  // not inferred from refresh-token rotation.
  return refreshed.access_token;
}
