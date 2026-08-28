const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function encryptionKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('SCHWAB_TOKEN_ENCRYPTION_KEY');
  if (!raw) throw new Error('SCHWAB_TOKEN_ENCRYPTION_KEY is not configured');

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(raw);
  } catch {
    throw new Error('SCHWAB_TOKEN_ENCRYPTION_KEY must be base64-encoded');
  }
  if (bytes.byteLength !== 32) {
    throw new Error('SCHWAB_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes');
  }
  return crypto.subtle.importKey('raw', arrayBuffer(bytes), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptBrokerToken(value: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(),
    encoder.encode(value),
  );
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

export async function decryptBrokerToken(ciphertext: string, iv: string): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: arrayBuffer(base64ToBytes(iv)) },
    await encryptionKey(),
    arrayBuffer(base64ToBytes(ciphertext)),
  );
  return decoder.decode(decrypted);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function randomUrlSafe(bytes = 32): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(bytes)))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
