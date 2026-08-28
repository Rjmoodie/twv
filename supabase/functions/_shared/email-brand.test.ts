import { describe, expect, it } from 'vitest';
import {
  assertFooterCompliance,
  emailFooter,
  emailShell,
  escapeHtml,
  listUnsubscribeHeaders,
  safeUrl,
} from './email-brand.ts';

const POSTAL = '"SomaTech, 1 Market St, San Francisco, CA 94105"'.replace(/"/g, '');
const UNSUB = 'https://somatech.pro/email/unsubscribe?token=abc';

/**
 * These assert the rules, not the markup. Styling is free to change; a
 * marketing send without an opt-out must never become possible.
 */
describe('footer compliance', () => {
  it('refuses marketing without an unsubscribe URL', () => {
    expect(() => emailFooter({ variant: 'marketing', postalAddress: POSTAL }))
      .toThrow(/unsubscribe/i);
  });

  it('refuses marketing without a postal address', () => {
    expect(() => emailFooter({ variant: 'marketing', unsubscribeUrl: UNSUB }))
      .toThrow(/postal address/i);
  });

  it('refuses a marketing unsubscribe URL that is not http(s)', () => {
    expect(() => emailFooter({ variant: 'marketing', unsubscribeUrl: 'javascript:alert(1)', postalAddress: POSTAL }))
      .toThrow(/unsubscribe/i);
  });

  it('never leaks an unsubscribe link into transactional mail', () => {
    expect(() => emailFooter({ variant: 'transactional', unsubscribeUrl: UNSUB }))
      .toThrow(/must not carry an unsubscribe/i);
  });

  it('never leaks a marketing postal address into internal mail', () => {
    expect(() => emailFooter({ variant: 'internal', postalAddress: POSTAL }))
      .toThrow(/must not carry a marketing postal address/i);
  });

  it('knows all three variants', () => {
    expect(() => assertFooterCompliance({ variant: 'transactional' })).not.toThrow();
    expect(() => assertFooterCompliance({ variant: 'internal' })).not.toThrow();
    expect(() => assertFooterCompliance({ variant: 'marketing', unsubscribeUrl: UNSUB, postalAddress: POSTAL })).not.toThrow();
  });

  it('renders the opt-out and the postal address in a compliant marketing footer', () => {
    const footer = emailFooter({ variant: 'marketing', unsubscribeUrl: UNSUB, postalAddress: POSTAL });
    expect(footer).toContain(UNSUB);
    expect(footer).toContain('Market St');
  });

  it('offers no opt-out of any kind in a transactional footer', () => {
    const footer = emailFooter({ variant: 'transactional' });
    expect(footer.toLowerCase()).not.toContain('unsubscribe');
  });
});

describe('one-click unsubscribe headers', () => {
  it('sets RFC 8058 headers for marketing', () => {
    expect(listUnsubscribeHeaders({ variant: 'marketing', unsubscribeUrl: UNSUB, postalAddress: POSTAL })).toEqual({
      'List-Unsubscribe': `<${UNSUB}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('sets no headers for transactional mail', () => {
    expect(listUnsubscribeHeaders({ variant: 'transactional' })).toEqual({});
  });
});

describe('escaping', () => {
  it('escapes interpolated values in the shell', () => {
    const html = emailShell({ variant: 'transactional', heading: '<script>alert(1)</script>', bodyHtml: '<p>ok</p>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#039;');
  });

  it('rejects non-http schemes', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,x')).toBeNull();
    expect(safeUrl('https://somatech.pro/x')).toBe('https://somatech.pro/x');
  });
});
