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
 * mark cropped to its ink, resized to 360px, and re-encoded as an indexed PNG
 * on a 16-step white-to-navy ramp -- 4.2KB, which survives inlining. Regenerate
 * it the same way if the mark changes; do not paste the full-colour export.
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
    + `<img src="${LOGO_DATA_URI}" width="180" height="105" alt="${escapeHtml(BRAND.name)}" `
    +   `style="display:block;width:180px;height:105px;margin:0 0 20px;border:0;`
    +   `font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:600;letter-spacing:0.04em;color:${BRAND.accent}" />`
    + `<div style="height:1px;background:${BRAND.hairline};margin:0 0 24px"></div>`
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
