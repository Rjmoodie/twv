import { describe, expect, it } from 'vitest';
import { shouldSuppress, signPayload, timingSafeEqual, verifySvixSignature } from './svix.ts';

const SECRET = 'whsec_' + btoa('a-shared-webhook-secret-value-32');
const ID = 'msg_2abc';
const BODY = JSON.stringify({ type: 'email.delivered', data: { email_id: 'e1' } });

const at = (offsetSeconds = 0) => String(Math.floor(Date.now() / 1000) + offsetSeconds);

async function headerFor(timestamp: string, body = BODY, id = ID) {
  return `v1,${await signPayload(SECRET, `${id}.${timestamp}.${body}`)}`;
}

describe('verifySvixSignature', () => {
  it('accepts a correctly signed, fresh payload', async () => {
    const timestamp = at();
    const result = await verifySvixSignature({
      secret: SECRET, id: ID, timestamp, signatureHeader: await headerFor(timestamp), body: BODY,
    });
    expect(result).toEqual({ valid: true });
  });

  it('accepts when the header carries several versions and one matches', async () => {
    const timestamp = at();
    const header = `v1,ZmFrZQ== ${await headerFor(timestamp)}`;
    const result = await verifySvixSignature({
      secret: SECRET, id: ID, timestamp, signatureHeader: header, body: BODY,
    });
    expect(result).toEqual({ valid: true });
  });

  it('rejects a tampered body', async () => {
    const timestamp = at();
    const header = await headerFor(timestamp);
    const result = await verifySvixSignature({
      secret: SECRET, id: ID, timestamp, signatureHeader: header,
      body: JSON.stringify({ type: 'email.bounced', data: { email_id: 'e1' } }),
    });
    expect(result).toEqual({ valid: false, reason: 'bad_signature' });
  });

  it('rejects a signature made with a different secret', async () => {
    const timestamp = at();
    const header = `v1,${await signPayload('whsec_' + btoa('some-other-secret-value-here-32'), `${ID}.${timestamp}.${BODY}`)}`;
    const result = await verifySvixSignature({
      secret: SECRET, id: ID, timestamp, signatureHeader: header, body: BODY,
    });
    expect(result).toEqual({ valid: false, reason: 'bad_signature' });
  });

  it('rejects a replayed delivery outside the freshness window', async () => {
    const timestamp = at(-3600);
    const result = await verifySvixSignature({
      secret: SECRET, id: ID, timestamp, signatureHeader: await headerFor(timestamp), body: BODY,
    });
    expect(result).toEqual({ valid: false, reason: 'stale_timestamp' });
  });

  it('rejects a payload signed for a different message id', async () => {
    const timestamp = at();
    const header = await headerFor(timestamp, BODY, 'msg_other');
    const result = await verifySvixSignature({
      secret: SECRET, id: ID, timestamp, signatureHeader: header, body: BODY,
    });
    expect(result).toEqual({ valid: false, reason: 'bad_signature' });
  });

  it('rejects missing headers rather than defaulting to trusted', async () => {
    expect(await verifySvixSignature({ secret: SECRET, id: null, timestamp: at(), signatureHeader: 'v1,x', body: BODY }))
      .toEqual({ valid: false, reason: 'missing_headers' });
    expect(await verifySvixSignature({ secret: '', id: ID, timestamp: at(), signatureHeader: 'v1,x', body: BODY }))
      .toEqual({ valid: false, reason: 'missing_headers' });
  });
});

describe('timingSafeEqual', () => {
  it('compares by value and rejects length mismatches', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('shouldSuppress', () => {
  it('always suppresses a complaint', () => {
    expect(shouldSuppress('email.complained', null)).toBe(true);
  });

  it('suppresses a permanent bounce but not a transient one', () => {
    expect(shouldSuppress('email.bounced', 'Permanent')).toBe(true);
    expect(shouldSuppress('email.bounced', 'Transient')).toBe(false);
    expect(shouldSuppress('email.bounced', 'SoftBounce')).toBe(false);
  });

  it('treats an untyped bounce as permanent', () => {
    expect(shouldSuppress('email.bounced', null)).toBe(true);
  });

  it('never suppresses on a delivery or open', () => {
    expect(shouldSuppress('email.delivered', null)).toBe(false);
    expect(shouldSuppress('email.opened', null)).toBe(false);
  });
});
