import { describe, expect, it } from 'vitest';
import {
  REGISTERED_EVENT_TYPES,
  absoluteUrl,
  hasTemplate,
  renderContent,
  renderEmail,
} from './emailTemplates.ts';

const ctx = { variant: 'transactional' as const, siteUrl: 'https://somatech.pro' };

// The registry held seven templates. Six of them — research_published,
// watchlist_story_update, watchlist_insider_buy, insider_weekly_digest and the
// two brokerage_* alerts — were rendered for senders removed with the
// non-real-estate cut, so they went with them. calendar_reminder is the only
// event anything still enqueues, which is why the compliance and escaping
// tests below all run through it now.

describe('registry', () => {
  it('renders nothing for an unregistered event type instead of inventing copy', () => {
    expect(renderContent('made_up_event', {})).toBeNull();
    expect(renderEmail('made_up_event', {}, ctx)).toBeNull();
    expect(hasTemplate('made_up_event')).toBe(false);
  });

  it('covers every event type the outbox currently emits', () => {
    expect(REGISTERED_EVENT_TYPES).toEqual(['calendar_reminder']);
  });

  // A template for an event nothing sends is dead copy nobody reviews. The
  // dispatcher already dead-letters an unregistered type with a clear error, so
  // the safe direction is to delete the template with its sender.
  it('has no template for an event whose sender was removed', () => {
    for (const removed of [
      'research_published',
      'watchlist_story_update',
      'watchlist_insider_buy',
      'insider_weekly_digest',
      'brokerage_reauthorization',
      'brokerage_sync_failed',
    ]) {
      expect(hasTemplate(removed), `template "${removed}" outlived its sender`).toBe(false);
    }
  });
});

describe('calendar_reminder', () => {
  it('keys the push tag by reminder so a retry replaces rather than stacks', () => {
    const content = renderContent('calendar_reminder', { title: 'Permit expiry', reminder_id: 'r7' })!;
    expect(content.title).toBe('Reminder: Permit expiry');
    expect(content.pushTag).toBe('calendar_reminder-r7');
    expect(content.category).toBe('calendar');
  });

  it('degrades to readable copy rather than rendering "undefined"', () => {
    const content = renderContent('calendar_reminder', {})!;
    expect(content.title).toBe('Reminder: Upcoming event');
    expect(JSON.stringify(content)).not.toContain('undefined');
  });
});

describe('renderEmail', () => {
  it('produces an absolute action URL from a site-relative path', () => {
    const email = renderEmail('calendar_reminder', { title: 'X', action_url: '/?module=financial-calendar' }, ctx)!;
    expect(email.html).toContain('https://somatech.pro/?module=financial-calendar');
  });

  it('escapes payload text so it cannot inject markup', () => {
    const email = renderEmail('calendar_reminder', {
      title: 'T',
      message: '<img src=x onerror=1>',
    }, ctx)!;
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).toContain('&lt;img');
  });

  it('escapes the detail table as well as the message', () => {
    const email = renderEmail('calendar_reminder', {
      title: 'T',
      event_date: '<script>alert(1)</script>',
    }, ctx)!;
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('strips CRLF from the subject so headers cannot be injected', () => {
    const email = renderEmail('calendar_reminder', { title: 'A\r\nBcc: victim@example.com' }, ctx)!;
    expect(email.subject).not.toMatch(/[\r\n]/);
  });

  it('refuses to render marketing without an opt-out', () => {
    expect(() => renderEmail('calendar_reminder', { title: 'T' }, { ...ctx, variant: 'marketing' }))
      .toThrow(/unsubscribe/i);
  });

  it('carries one-click headers only when the variant is marketing', () => {
    expect(renderEmail('calendar_reminder', { title: 'T' }, ctx)!.headers).toEqual({});
    const marketing = renderEmail('calendar_reminder', { title: 'T' }, {
      ...ctx,
      variant: 'marketing',
      unsubscribeUrl: 'https://somatech.pro/email/unsubscribe?token=t',
      postalAddress: '1 Market St, San Francisco, CA 94105',
    })!;
    expect(marketing.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });
});

describe('absoluteUrl', () => {
  it('returns null for a null path', () => {
    expect(absoluteUrl('https://somatech.pro', null)).toBeNull();
  });
});
