/**
 * A registry keyed by event type. The dispatch worker looks a message up and
 * renders it; it never learns a type name, so adding a notification is a new
 * entry here plus a row in notification_channel_policies -- never a new branch
 * in the drain.
 */

import {
  EMAIL_BRAND,
  emailButton,
  emailShell,
  escapeHtml,
  listUnsubscribeHeaders,
  safeUrl,
  type EmailVariant,
} from './email-brand.ts';

export type Payload = Record<string, unknown>;

/** The channel-independent content of one notification. */
export interface NotificationContent {
  title: string;
  message: string;
  /** Site-relative path, or null when there is nowhere useful to land. */
  actionPath: string | null;
  actionLabel: string;
  category: string;
  /**
   * Collapses redundant push notifications on the device. Keyed by the thing
   * the message is about, so a retry replaces rather than stacks.
   */
  pushTag: string;
}

export interface EmailRenderContext {
  variant: EmailVariant;
  siteUrl: string;
  unsubscribeUrl?: string;
  postalAddress?: string;
  preferencesUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  headers: Record<string, string>;
}

const str = (value: unknown, fallback = ''): string => {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  return text.trim() || fallback;
};

/** A subject line containing CR or LF is a header-injection attempt. */
const subjectSafe = (value: string) => value.replace(/[\r\n]+/g, ' ').slice(0, 200);

export const absoluteUrl = (siteUrl: string, path: string | null): string | null => {
  if (!path) return null;
  try {
    return new URL(path, siteUrl).toString();
  } catch {
    return null;
  }
};

interface Template {
  content: (payload: Payload) => NotificationContent;
  body: (content: NotificationContent, actionUrl: string | null, payload: Payload) => string;
}

const TEMPLATES: Record<string, Template> = {
  research_published: {
    content: payload => {
      const ticker = str(payload.ticker);
      const title = str(payload.title, 'a new analysis');
      return {
        title: ticker ? `New ${ticker} research: ${title}` : `New research: ${title}`,
        message: ticker
          ? `A new community analysis for ${ticker} is available.`
          : 'A new community analysis is available.',
        actionPath: payload.slug ? `/research/${str(payload.slug)}` : null,
        actionLabel: 'Read analysis',
        category: 'analysis',
        pushTag: `research_published-${str(payload.post_id, 'unknown')}`,
      };
    },
    body: (content, actionUrl, payload) => {
      const ticker = str(payload.ticker);
      return `<p style="margin:0 0 12px">${escapeHtml(content.message)}</p>`
        + (ticker ? `<p style="margin:0 0 4px;color:#667085;font-size:13px">Following ${escapeHtml(ticker)}</p>` : '')
        + (actionUrl ? emailButton(content.actionLabel, actionUrl) : '')
        + `<p style="margin:16px 0 0;color:#667085;font-size:13px">Community analyses are written by other SomaTech users and are not reviewed by SomaTech.</p>`;
    },
  },

  calendar_reminder: {
    content: payload => {
      const eventTitle = str(payload.title, 'Upcoming event');
      return {
        title: `Reminder: ${eventTitle}`,
        message: str(payload.message, 'You have an upcoming calendar event.'),
        actionPath: str(payload.action_url, '/?module=financial-calendar'),
        actionLabel: 'Open calendar',
        category: 'calendar',
        pushTag: `calendar_reminder-${str(payload.reminder_id, str(payload.event_key, 'unknown'))}`,
      };
    },
    body: (content, actionUrl, payload) => {
      const eventDate = str(payload.event_date);
      const eventType = str(payload.event_type);
      return `<p style="margin:0 0 12px">${escapeHtml(content.message)}</p>`
        + (eventDate
          ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e4e7ec;border-radius:10px;padding:14px 16px">`
            + `<tr><td style="font-size:13px;color:#667085">Date</td><td style="padding-left:18px;font-size:13px;font-weight:600">${escapeHtml(eventDate)}</td></tr>`
            + (eventType ? `<tr><td style="font-size:13px;color:#667085;padding-top:6px">Type</td><td style="padding-left:18px;padding-top:6px;font-size:13px;font-weight:600">${escapeHtml(eventType)}</td></tr>` : '')
            + `</table>`
          : '')
        + (actionUrl ? emailButton(content.actionLabel, actionUrl) : '')
        + `<p style="margin:16px 0 0;color:#667085;font-size:13px">You set this reminder in SomaTech. Provider dates can change after a reminder is scheduled.</p>`;
    },
  },

  brokerage_reauthorization: {
    content: payload => {
      const expired = payload.expired === true;
      return {
        title: expired ? 'Reconnect Schwab to resume updates' : 'Schwab reconnect needed soon',
        message: expired
          ? 'Your Schwab authorization expired. Saved data is still available, but it is no longer current.'
          : 'Your Schwab authorization is nearing expiry. Reconnect now to keep portfolio and trade data current.',
        actionPath: '/?module=portfolio&portfolio_tab=brokerage',
        actionLabel: 'Reconnect Schwab',
        category: 'brokerage',
        pushTag: `brokerage-reauthorization-${str(payload.authorization_id, 'schwab')}`,
      };
    },
    body: (content, actionUrl) =>
      `<p style="margin:0 0 12px">${escapeHtml(content.message)}</p>`
      + (actionUrl ? emailButton(content.actionLabel, actionUrl) : '')
      + `<p style="margin:16px 0 0;color:#667085;font-size:13px">Schwab requires periodic interactive authorization. SomaTech never places Schwab orders, and this message contains no account, position, or trade details.</p>`,
  },

  brokerage_sync_failed: {
    content: payload => ({
      title: 'Schwab portfolio update needs attention',
      message: 'Automatic retries could not refresh your Schwab data. Existing values were preserved and are labeled with their last successful update time.',
      actionPath: '/?module=portfolio&portfolio_tab=brokerage',
      actionLabel: 'Review connection',
      category: 'brokerage',
      pushTag: `brokerage-sync-failed-${str(payload.connection_id, 'schwab')}`,
    }),
    body: (content, actionUrl) =>
      `<p style="margin:0 0 12px">${escapeHtml(content.message)}</p>`
      + (actionUrl ? emailButton(content.actionLabel, actionUrl) : ''),
  },

  watchlist_story_update: {
    content: payload => {
      const ticker = str(payload.ticker, 'A tracked company');
      const form = str(payload.form, 'filing');
      const claims = Array.isArray(payload.claims) ? payload.claims as Payload[] : [];
      const lead = claims[0] ?? {};
      const headline = str(lead.headline, 'a material change in the narrative');
      const thesis = str(payload.tier) === 'thesis_match';
      return {
        title: thesis
          ? `${ticker} ${form} touches your thesis: ${headline}`
          : `${ticker} ${form}: ${headline}`,
        message: thesis
          ? `${ticker}'s new ${form} says something in an area you flagged as thesis-breaking.`
          : `${ticker}'s new ${form} reports a material change worth reading.`,
        actionPath: '/?module=watchlist',
        actionLabel: 'Open watchlist',
        category: 'watchlist',
        // Keyed by the filing, so re-running the poller replaces rather than stacks.
        pushTag: `watchlist_story_update-${str(payload.accession, str(payload.ticker, 'unknown'))}`,
      };
    },
    body: (content, actionUrl, payload) => {
      const claims = Array.isArray(payload.claims) ? payload.claims as Payload[] : [];
      const thesis = str(payload.tier) === 'thesis_match';
      const filingUrl = safeUrl(str(payload.document_url) || undefined);
      const filingDate = str(payload.filing_date);

      // The claims are model-generated, so the verbatim filing text leads and
      // the summary follows. The reader judges the filing, not the model.
      const quoted = claims.slice(0, 3).map(claim => {
        const excerpt = str(claim.excerpt);
        if (!excerpt) return '';
        return `<div style="margin:0 0 16px">`
          + `<p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:${EMAIL_BRAND.muted}">${escapeHtml(str(claim.category, 'filing'))}</p>`
          + `<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:${EMAIL_BRAND.ink}">${escapeHtml(str(claim.headline))}</p>`
          + `<blockquote style="margin:0;padding:10px 14px;border-left:3px solid ${EMAIL_BRAND.hairline};color:#475467;font-size:14px;line-height:22px">${escapeHtml(excerpt)}</blockquote>`
          + (str(claim.watchNext) ? `<p style="margin:8px 0 0;font-size:13px;color:${EMAIL_BRAND.muted}">Watch next: ${escapeHtml(str(claim.watchNext))}</p>` : '')
          + `</div>`;
      }).join('');

      return `<p style="margin:0 0 16px">${escapeHtml(content.message)}</p>`
        + (thesis
          ? `<p style="margin:0 0 16px;padding:10px 14px;background:#fff7ed;border-radius:8px;font-size:13px;color:#9a3412">`
            + `This is flagged because your invalidation note for ${escapeHtml(str(payload.ticker, 'this company'))} mentions `
            + `${escapeHtml(str(payload.categories_label, 'this area'))}. It is not a judgement that your thesis is broken -- read the filing and decide.`
            + `</p>`
          : '')
        + quoted
        + (actionUrl ? emailButton(content.actionLabel, actionUrl) : '')
        + (filingUrl
          ? `<p style="margin:12px 0 0;font-size:13px"><a href="${escapeHtml(filingUrl)}" style="color:${EMAIL_BRAND.accent}">Read the ${escapeHtml(str(payload.form, 'filing'))}${filingDate ? ` filed ${escapeHtml(filingDate)}` : ''}</a></p>`
          : '')
        + `<p style="margin:16px 0 0;color:${EMAIL_BRAND.muted};font-size:13px">Claims are extracted from the filing's MD&amp;A by an automated reader and quoted verbatim above. They are not investment advice.</p>`;
    },
  },

  watchlist_insider_buy: {
    content: payload => {
      const ticker = str(payload.ticker, 'A tracked company');
      const count = Math.max(1, Number(payload.insider_count) || 1);
      return {
        title: `${count} insider${count === 1 ? '' : 's'} bought ${ticker}`,
        message: `${count} independent filer group${count === 1 ? '' : 's'} reported open-market purchases in SEC Form 4 filings.`,
        actionPath: '/?module=watchlist',
        actionLabel: 'Review insider activity',
        category: 'watchlist',
        pushTag: `watchlist-insider-${str(payload.first_accession, ticker)}`,
      };
    },
    body: (content, actionUrl, payload) => {
      const transactions = Array.isArray(payload.transactions) ? payload.transactions as Payload[] : [];
      const rows = transactions.slice(0, 8).map(transaction => {
        const price = Number(transaction.price_per_share);
        const priceText = Number.isFinite(price) && price > 0 ? ` at $${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '';
        return `<li style="margin:0 0 8px">${escapeHtml(str(transaction.owner_name, 'Named insider'))} bought ${escapeHtml(Number(transaction.shares || 0).toLocaleString('en-US'))} shares${escapeHtml(priceText)} on ${escapeHtml(str(transaction.transaction_date))}.</li>`;
      }).join('');
      return `<p style="margin:0 0 12px">${escapeHtml(content.message)}</p>`
        + (rows ? `<ul style="margin:12px 0 16px;padding-left:20px">${rows}</ul>` : '')
        + (actionUrl ? emailButton(content.actionLabel, actionUrl) : '')
        + `<p style="margin:16px 0 0;color:${EMAIL_BRAND.muted};font-size:13px">Filed facts from SEC Form 4. This is not a forecast or investment advice.</p>`;
    },
  },

  insider_weekly_digest: {
    content: payload => {
      const transactionCount = Math.max(1, Number(payload.transaction_count) || 1);
      const tickerCount = Math.max(1, Number(payload.ticker_count) || 1);
      return {
        title: `Weekly insider activity: ${transactionCount} filing ${transactionCount === 1 ? 'item' : 'items'}`,
        message: `${transactionCount} effective SEC Form 4 transaction ${transactionCount === 1 ? 'was' : 'were'} filed across ${tickerCount} tracked ${tickerCount === 1 ? 'company' : 'companies'}.`,
        actionPath: '/?module=watchlist',
        actionLabel: 'Review tracked companies',
        category: 'watchlist',
        pushTag: `insider-weekly-digest-${str(payload.week_start, 'week')}`,
      };
    },
    body: (content, actionUrl, payload) => {
      const transactions = Array.isArray(payload.transactions) ? payload.transactions as Payload[] : [];
      const label = (classification: string) => ({
        open_market_purchase: 'Open-market purchase',
        open_market_sale: 'Open-market sale',
        grant: 'Grant',
        option_exercise: 'Option exercise',
        tax_withholding: 'Tax withholding',
        gift: 'Gift',
        other: 'Other transaction',
      }[classification] ?? 'Filed transaction');
      const rows = transactions.slice(0, 50).map(transaction => {
        const ticker = str(transaction.ticker, 'Tracked company');
        const owner = str(transaction.owner_name, 'Named filer');
        const classification = str(transaction.classification, 'other');
        const shares = Number(transaction.shares);
        const price = Number(transaction.price_per_share);
        const filingUrl = safeUrl(str(transaction.filing_url) || undefined);
        const details = `${Number.isFinite(shares) ? shares.toLocaleString('en-US') : 'Filed'} shares`
          + (Number.isFinite(price) && price > 0 ? ` at $${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '')
          + (str(transaction.transaction_date) ? ` on ${str(transaction.transaction_date)}` : '');
        return `<li style="margin:0 0 12px">`
          + `<strong>${escapeHtml(ticker)} · ${escapeHtml(label(classification))}</strong><br>`
          + `<span style="color:${EMAIL_BRAND.muted}">${escapeHtml(owner)} · ${escapeHtml(details)}</span>`
          + (transaction.flagged_sale === true
            ? `<br><span style="color:#9a3412;font-size:12px">Large discretionary executive sale relative to the filed post-transaction holding.</span>`
            : '')
          + (filingUrl ? `<br><a href="${escapeHtml(filingUrl)}" style="color:${EMAIL_BRAND.accent};font-size:12px">Open SEC filing</a>` : '')
          + `</li>`;
      }).join('');
      return `<p style="margin:0 0 12px">${escapeHtml(content.message)}</p>`
        + `<p style="margin:0 0 16px;color:${EMAIL_BRAND.muted};font-size:13px">Purchases are listed first, followed by notable discretionary sales and other filed activity. Compensation mechanics are labeled separately.</p>`
        + (rows ? `<ul style="margin:12px 0 16px;padding-left:20px">${rows}</ul>` : '')
        + (payload.truncated === true ? `<p style="margin:0 0 16px;color:${EMAIL_BRAND.muted};font-size:13px">Only the first 50 items are shown.</p>` : '')
        + (actionUrl ? emailButton(content.actionLabel, actionUrl) : '')
        + `<p style="margin:16px 0 0;color:${EMAIL_BRAND.muted};font-size:13px">Filed facts from SEC Form 4. This opt-in summary is not a forecast or investment advice.</p>`;
    },
  },

};

export function hasTemplate(eventType: string): boolean {
  return Object.hasOwn(TEMPLATES, eventType);
}

/**
 * Returns null for an unregistered event type rather than inventing copy. A
 * message nobody wrote is a message nobody reviewed.
 */
export function renderContent(eventType: string, payload: Payload): NotificationContent | null {
  const template = TEMPLATES[eventType];
  return template ? template.content(payload ?? {}) : null;
}

export function renderEmail(
  eventType: string,
  payload: Payload,
  context: EmailRenderContext,
): RenderedEmail | null {
  const template = TEMPLATES[eventType];
  if (!template) return null;

  const content = template.content(payload ?? {});
  const actionUrl = safeUrl(absoluteUrl(context.siteUrl, content.actionPath) ?? undefined);

  // emailShell throws if the variant and the material disagree, so a
  // non-compliant message cannot reach the provider.
  const html = emailShell({
    variant: context.variant,
    unsubscribeUrl: context.unsubscribeUrl,
    postalAddress: context.postalAddress,
    preferencesUrl: context.preferencesUrl,
    heading: content.title,
    preheader: content.message,
    bodyHtml: template.body(content, actionUrl, payload ?? {}),
  });

  return {
    subject: subjectSafe(content.title),
    html,
    headers: listUnsubscribeHeaders({
      variant: context.variant,
      unsubscribeUrl: context.unsubscribeUrl,
      postalAddress: context.postalAddress,
    }),
  };
}

export const REGISTERED_EVENT_TYPES = Object.keys(TEMPLATES);
