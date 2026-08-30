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

/**
 * The wordmark, inlined.
 *
 * Email clients block remote images by default, so a hosted logo shows as a
 * broken box until the reader opts in -- and most never do. A `data:` URI is
 * part of the message, so it renders on first open with no request.
 *
 * That only works if it stays small: Gmail clips a message past ~102KB and
 * hides everything after the cut. The source PNG is 537KB; this is the same
 * mark -- assets/brand/logo-master.png -- cropped to its ink and resized to
 * 280px, then written as an indexed PNG
 * whose palette is a single navy repeated 16 times, with a tRNS alpha ramp
 * carrying the anti-aliasing. That keeps the background transparent -- a white
 * matte read as a pasted rectangle against the card -- and lands at 3.3KB.
 * Regenerate it the same way if the mark changes; never paste the full-colour
 * export in.
 */
const LOGO_DATA_URI = 'data:image/png;base64,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';

const BRAND = {
  name: 'TW Ventures',
  accent: '#08223d',
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
    lines.push('You are receiving this because of activity on your TW Ventures account.');
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
    + `TW Ventures is an operations and underwriting tool. Nothing in this email is financial, legal, tax, or investment advice.`
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
    + `<img src="${LOGO_DATA_URI}" width="140" height="82" alt="${escapeHtml(BRAND.name)}" `
    +   `style="display:block;width:140px;height:82px;margin:0 0 28px;border:0;`
    +   `font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:600;letter-spacing:0.04em;color:${BRAND.accent}" />`
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
