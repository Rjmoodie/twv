/**
 * The single place the branded shell and the legal rules for outbound mail
 * live. Nineteen hand-rolled footers is how a compliance gap starts, so this
 * module throws rather than warns: a non-compliant combination fails before a
 * message is handed to the provider, not after a regulator reads it.
 */

/**
 * Every message must be classified, because the class -- not the caller's
 * judgement -- decides what the footer is legally required to carry.
 *
 * - `transactional`: receipts, reminders, security mail. Must arrive, and must
 *   NOT offer an unsubscribe link. The recipient cannot opt out of the alert
 *   they explicitly asked for, and offering the link invites them to suppress
 *   mail they need.
 * - `marketing`: product announcements. CAN-SPAM 15 U.S.C. 7704(a)(3) and
 *   (a)(5) require a working opt-out and a physical postal address.
 * - `internal`: operational alerts to staff. Dressing an alarm in marketing
 *   chrome makes it read as marketing and slows the response.
 */
export type EmailVariant = 'transactional' | 'marketing' | 'internal';

export interface FooterOptions {
  variant: EmailVariant;
  /** Required for marketing, forbidden otherwise. */
  unsubscribeUrl?: string;
  /** Required for marketing: CAN-SPAM 7704(a)(5). */
  postalAddress?: string;
  /** Optional granular preference centre link; allowed on any user-facing mail. */
  preferencesUrl?: string;
}

export interface ShellOptions extends FooterOptions {
  /** Pre-escaped, trusted body HTML. Callers escape their own interpolations. */
  bodyHtml: string;
  /** Shown in the preview pane before the body is opened. */
  preheader?: string;
  heading?: string;
}

const BRAND = {
  name: 'SomaTech',
  site: 'https://somatech.pro',
  accent: '#2563eb',
  ink: '#0f172a',
  muted: '#667085',
  hairline: '#e4e7ec',
  canvas: '#f5f7fa',
} as const;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]!
  ));
}

/**
 * A URL is only safe to place in an href if it cannot smuggle script. Anything
 * that is not plainly http(s) is dropped rather than sanitised half-way.
 */
export function safeUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Validates a variant against the material it was given. Exported so senders
 * can fail at enqueue time instead of discovering the problem in the worker.
 */
export function assertFooterCompliance(options: FooterOptions): void {
  const { variant, unsubscribeUrl, postalAddress } = options;

  if (variant === 'marketing') {
    if (!safeUrl(unsubscribeUrl)) {
      throw new Error('Marketing email requires a working https unsubscribe URL (CAN-SPAM 7704(a)(3)).');
    }
    if (!postalAddress?.trim()) {
      throw new Error('Marketing email requires a physical postal address (CAN-SPAM 7704(a)(5)).');
    }
    return;
  }

  // A transactional receipt that offers opt-out teaches recipients to suppress
  // mail they need; an internal alarm dressed as marketing reads as noise.
  if (unsubscribeUrl) {
    throw new Error(`A ${variant} email must not carry an unsubscribe link.`);
  }
  if (postalAddress) {
    throw new Error(`A ${variant} email must not carry a marketing postal address.`);
  }
}

export function emailFooter(options: FooterOptions): string {
  assertFooterCompliance(options);
  const { variant } = options;

  if (variant === 'internal') {
    return `<p style="margin:24px 0 0;color:${BRAND.muted};font-size:12px;line-height:18px">`
      + `Automated ${escapeHtml(BRAND.name)} operations alert. Not for redistribution.`
      + `</p>`;
  }

  const preferences = safeUrl(options.preferencesUrl);
  const lines: string[] = [];

  if (variant === 'transactional') {
    lines.push('You are receiving this because of activity on your SomaTech account.');
    if (preferences) {
      lines.push(`<a href="${escapeHtml(preferences)}" style="color:${BRAND.muted}">Manage notification preferences</a>`);
    }
  } else {
    const unsubscribe = safeUrl(options.unsubscribeUrl)!;
    lines.push(
      `<a href="${escapeHtml(unsubscribe)}" style="color:${BRAND.muted};text-decoration:underline">Unsubscribe</a>`
      + (preferences ? ` &middot; <a href="${escapeHtml(preferences)}" style="color:${BRAND.muted}">Email preferences</a>` : ''),
    );
    lines.push(escapeHtml(options.postalAddress!.trim()));
  }

  return `<hr style="border:none;border-top:1px solid ${BRAND.hairline};margin:28px 0 16px" />`
    + lines.map(line => `<p style="margin:0 0 6px;color:${BRAND.muted};font-size:12px;line-height:18px">${line}</p>`).join('')
    + `<p style="margin:12px 0 0;color:${BRAND.muted};font-size:12px">`
    + `SomaTech is a research tool. Nothing in this email is investment advice.`
    + `</p>`;
}

/**
 * RFC 8058 one-click unsubscribe headers. Legitimate only because the endpoint
 * they point at actually processes the POST -- a header pointing at a dead URL
 * is worse than no header, because mailbox providers test it.
 */
export function listUnsubscribeHeaders(options: FooterOptions): Record<string, string> {
  assertFooterCompliance(options);
  const unsubscribe = safeUrl(options.unsubscribeUrl);
  if (options.variant !== 'marketing' || !unsubscribe) return {};
  return {
    'List-Unsubscribe': `<${unsubscribe}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

export function emailShell(options: ShellOptions): string {
  const footer = emailFooter(options);
  const heading = options.heading ? `<h1 style="margin:0 0 12px;color:${BRAND.ink};font-size:22px;line-height:30px;font-weight:600">${escapeHtml(options.heading)}</h1>` : '';
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(options.preheader)}</div>`
    : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />`
    + `<meta name="viewport" content="width=device-width,initial-scale=1" />`
    + `<meta name="color-scheme" content="light dark" />`
    + `</head>`
    + `<body style="margin:0;padding:0;background:${BRAND.canvas};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">`
    + preheader
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.canvas};padding:32px 16px">`
    + `<tr><td align="center">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${BRAND.hairline};border-radius:14px;padding:32px">`
    + `<tr><td>`
    + `<p style="margin:0 0 24px;font-size:15px;font-weight:700;letter-spacing:-0.01em;color:${BRAND.accent}">${escapeHtml(BRAND.name)}</p>`
    + heading
    + `<div style="color:${BRAND.ink};font-size:15px;line-height:23px">${options.bodyHtml}</div>`
    + footer
    + `</td></tr></table>`
    + `</td></tr></table></body></html>`;
}

/** Buttons are the one piece every template re-invents; give them one home. */
export function emailButton(label: string, url: string): string {
  const safe = safeUrl(url);
  if (!safe) return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="border-radius:8px;background:${BRAND.accent}">`
    + `<a href="${escapeHtml(safe)}" style="display:inline-block;padding:11px 20px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">${escapeHtml(label)}</a>`
    + `</td></tr></table>`;
}

export const EMAIL_BRAND = BRAND;
