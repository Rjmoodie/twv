/**
 * Svix webhook signature verification, which is the scheme Resend uses.
 *
 * A webhook endpoint that does not verify is an open write to your own
 * suppression list: anyone who learns the URL can mark any address as bounced
 * and silently stop that person's mail.
 */

const encoder = new TextEncoder();

/** Comparison that does not leak how much of the signature matched. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let index = 0; index < view.length; index++) binary += String.fromCharCode(view[index]);
  return btoa(binary);
}

export async function signPayload(secret: string, signedContent: string): Promise<string> {
  // The portion after `whsec_` is base64; everything else is treated as raw.
  const raw = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(raw);
  } catch {
    keyBytes = encoder.encode(raw);
  }
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToBase64(await crypto.subtle.sign('HMAC', key, encoder.encode(signedContent)));
}

export interface VerifyInput {
  secret: string;
  id: string | null;
  timestamp: string | null;
  /** Raw `svix-signature` header: one or more space-separated `v1,<sig>` parts. */
  signatureHeader: string | null;
  body: string;
  now?: Date;
  toleranceSeconds?: number;
}

export type VerifyResult =
  | { valid: true }
  | { valid: false; reason: 'missing_headers' | 'stale_timestamp' | 'bad_signature' };

export async function verifySvixSignature(input: VerifyInput): Promise<VerifyResult> {
  const { secret, id, timestamp, signatureHeader, body } = input;
  if (!secret || !id || !timestamp || !signatureHeader) return { valid: false, reason: 'missing_headers' };

  // Without a freshness window a captured delivery can be replayed forever.
  const tolerance = input.toleranceSeconds ?? 300;
  const sentAt = Number(timestamp);
  const now = (input.now ?? new Date()).getTime() / 1000;
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > tolerance) {
    return { valid: false, reason: 'stale_timestamp' };
  }

  const expected = await signPayload(secret, `${id}.${timestamp}.${body}`);
  // The header may carry several versions; any one matching is a pass.
  const provided = signatureHeader.split(' ')
    .map(part => part.trim())
    .filter(part => part.startsWith('v1,'))
    .map(part => part.slice(3));

  return provided.some(candidate => timingSafeEqual(candidate, expected))
    ? { valid: true }
    : { valid: false, reason: 'bad_signature' };
}

/**
 * Resend reports transient and permanent failures through the same event, and
 * only a permanent one should stop future mail. An unrecognised bounce with no
 * type is treated as permanent: a false suppression costs one address, while
 * repeatedly mailing a dead one costs the sending domain.
 */
export function shouldSuppress(event: string, bounceType: string | null | undefined): boolean {
  if (event === 'email.complained') return true;
  if (event !== 'email.bounced') return false;
  if (!bounceType) return true;
  return !/transient|soft|delayed|undetermined/i.test(bounceType);
}
