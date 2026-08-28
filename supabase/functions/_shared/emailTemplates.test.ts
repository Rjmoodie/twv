import { describe, expect, it } from 'vitest';
import {
  REGISTERED_EVENT_TYPES,
  absoluteUrl,
  hasTemplate,
  renderContent,
  renderEmail,
} from './emailTemplates.ts';

const ctx = { variant: 'transactional' as const, siteUrl: 'https://somatech.pro' };

describe('registry', () => {
  it('renders nothing for an unregistered event type instead of inventing copy', () => {
    expect(renderContent('made_up_event', {})).toBeNull();
    expect(renderEmail('made_up_event', {}, ctx)).toBeNull();
    expect(hasTemplate('made_up_event')).toBe(false);
  });

  it('covers every event type the outbox currently emits', () => {
    expect(REGISTERED_EVENT_TYPES).toEqual(
      expect.arrayContaining(['research_published', 'calendar_reminder', 'watchlist_story_update']),
    );
  });
});

describe('insider_weekly_digest', () => {
  const payload = {
    week_start: '2026-08-17', transaction_count: 2, ticker_count: 1,
    transactions: [
      { ticker: 'AAPL', owner_name: 'DOE JANE', classification: 'open_market_purchase', shares: 1000, price_per_share: 42.5, transaction_date: '2026-08-19', filing_url: 'https://www.sec.gov/Archives/example.xml' },
      { ticker: 'AAPL', owner_name: '<script>x</script>', classification: 'open_market_sale', shares: 200, flagged_sale: true },
    ],
  };

  it('is registered with clear filed-fact copy', () => {
    const content = renderContent('insider_weekly_digest', payload)!;
    expect(content.title).toContain('2 filing items');
    expect(content.actionPath).toBe('/?module=watchlist');
  });

  it('renders an opt-in marketing email with filing links and escaped values', () => {
    const email = renderEmail('insider_weekly_digest', payload, {
      ...ctx,
      variant: 'marketing',
      unsubscribeUrl: 'https://somatech.pro/email/unsubscribe?token=t',
      postalAddress: 'SomaTech, 1 Market St, San Francisco, CA 94105',
    })!;
    expect(email.html).toContain('Open-market purchase');
    expect(email.html).toContain('https://www.sec.gov/Archives/example.xml');
    expect(email.html).not.toContain('<script>');
  });
});

describe('research_published', () => {
  it('builds title, action and a stable push tag from the payload', () => {
    const content = renderContent('research_published', {
      ticker: 'NVDA', title: 'Datacenter margins', slug: 'datacenter-margins', post_id: 'p1',
    })!;
    expect(content.title).toBe('New NVDA research: Datacenter margins');
    expect(content.actionPath).toBe('/research/datacenter-margins');
    expect(content.pushTag).toBe('research_published-p1');
  });

  it('degrades without a ticker or slug rather than rendering "undefined"', () => {
    const content = renderContent('research_published', {})!;
    expect(content.title).toBe('New research: a new analysis');
    expect(content.actionPath).toBeNull();
    expect(JSON.stringify(content)).not.toContain('undefined');
  });
});

describe('calendar_reminder', () => {
  it('keys the push tag by reminder so a retry replaces rather than stacks', () => {
    const content = renderContent('calendar_reminder', { title: 'PDUFA: XYZ', reminder_id: 'r7' })!;
    expect(content.title).toBe('Reminder: PDUFA: XYZ');
    expect(content.pushTag).toBe('calendar_reminder-r7');
    expect(content.category).toBe('calendar');
  });
});

describe('renderEmail', () => {
  it('produces an absolute action URL from a site-relative path', () => {
    const email = renderEmail('calendar_reminder', { title: 'X', action_url: '/?module=financial-calendar' }, ctx)!;
    expect(email.html).toContain('https://somatech.pro/?module=financial-calendar');
  });

  it('escapes payload text so a title cannot inject markup', () => {
    const email = renderEmail('research_published', { ticker: '<img src=x onerror=1>', title: 'T', slug: 's' }, ctx)!;
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).toContain('&lt;img');
  });

  it('strips CRLF from the subject so headers cannot be injected', () => {
    const email = renderEmail('calendar_reminder', { title: 'A\r\nBcc: victim@example.com' }, ctx)!;
    expect(email.subject).not.toMatch(/[\r\n]/);
  });

  it('refuses to render marketing without an opt-out', () => {
    expect(() => renderEmail('research_published', { title: 'T' }, { ...ctx, variant: 'marketing' }))
      .toThrow(/unsubscribe/i);
  });

  it('carries one-click headers only when the variant is marketing', () => {
    expect(renderEmail('research_published', { title: 'T' }, ctx)!.headers).toEqual({});
    const marketing = renderEmail('research_published', { title: 'T' }, {
      ...ctx,
      variant: 'marketing',
      unsubscribeUrl: 'https://somatech.pro/email/unsubscribe?token=t',
      postalAddress: 'SomaTech, 1 Market St, San Francisco, CA 94105',
    })!;
    expect(marketing.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });
});

describe('absoluteUrl', () => {
  it('returns null for a null path', () => {
    expect(absoluteUrl('https://somatech.pro', null)).toBeNull();
  });
});


describe('watchlist_story_update', () => {
  const claim = {
    category: 'guidance',
    headline: 'Full-year guidance withdrawn',
    excerpt: 'We are withdrawing our previously issued full-year revenue guidance.',
    watchNext: 'Whether guidance is reinstated next quarter.',
  };
  const base = {
    ticker: 'VRTX', form: '10-Q', filing_date: '2026-08-20', accession: '0001-25-000123',
    document_url: 'https://www.sec.gov/Archives/edgar/data/875320/x.htm',
    claims: [claim],
  };

  it('names the company and the finding in a major alert', () => {
    const content = renderContent('watchlist_story_update', { ...base, tier: 'major' })!;
    expect(content.title).toBe('VRTX 10-Q: Full-year guidance withdrawn');
    expect(content.actionPath).toBe('/?module=watchlist');
    expect(content.category).toBe('watchlist');
  });

  it('says plainly that a thesis alert is not a verdict', () => {
    const email = renderEmail('watchlist_story_update',
      { ...base, tier: 'thesis_match', categories_label: 'margin' }, ctx)!;
    expect(email.subject).toBe('VRTX 10-Q touches your thesis: Full-year guidance withdrawn');
    expect(email.html).toContain('not a judgement that your thesis is broken');
  });

  it('leads with the verbatim filing text so the reader judges the filing', () => {
    const email = renderEmail('watchlist_story_update', { ...base, tier: 'major' }, ctx)!;
    expect(email.html).toContain('We are withdrawing our previously issued full-year revenue guidance.');
    expect(email.html).toContain('blockquote');
    expect(email.html).toContain('Whether guidance is reinstated next quarter.');
  });

  it('links the filing itself', () => {
    const email = renderEmail('watchlist_story_update', { ...base, tier: 'major' }, ctx)!;
    expect(email.html).toContain('https://www.sec.gov/Archives/edgar/data/875320/x.htm');
  });

  it('keys the push tag by filing so a re-poll replaces rather than stacks', () => {
    const content = renderContent('watchlist_story_update', { ...base, tier: 'major' })!;
    expect(content.pushTag).toBe('watchlist_story_update-0001-25-000123');
  });

  it('escapes filing text rather than trusting it', () => {
    const email = renderEmail('watchlist_story_update', {
      ...base, tier: 'major',
      claims: [{ ...claim, excerpt: '<script>alert(1)</script> and more than twenty-four characters' }],
    }, ctx)!;
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('degrades to a readable message when the payload is thin', () => {
    const content = renderContent('watchlist_story_update', {})!;
    expect(content.title).toBe('A tracked company filing: a material change in the narrative');
    expect(JSON.stringify(content)).not.toContain('undefined');
  });

  it('drops a claim with no excerpt rather than rendering an empty quote', () => {
    const email = renderEmail('watchlist_story_update', {
      ...base, tier: 'major', claims: [{ category: 'risk', headline: 'H', excerpt: '' }],
    }, ctx)!;
    expect(email.html).not.toContain('blockquote');
  });
});
