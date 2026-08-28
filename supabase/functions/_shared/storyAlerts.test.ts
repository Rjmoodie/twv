import { describe, expect, it } from 'vitest';
import {
  buildStoryAlertRows,
  categoriesLabel,
  channelsFor,
  filingSkipReason,
  flaggedCategories,
  gradeStoryUpdate,
  isAlertable,
  isEntitledToStoryAlerts,
  type GradeInput,
  type StoryWatcher,
} from './storyAlerts.ts';
import type { ClaimCategory, NarrativeClaim } from './narrativeClaim.ts';

const claim = (overrides: Partial<NarrativeClaim> = {}): NarrativeClaim => ({
  id: 'c1',
  category: 'guidance',
  headline: 'Full-year guidance withdrawn',
  explanation: 'Management withdrew prior guidance.',
  classification: 'company-reported',
  direction: 'negative',
  confidence: 'high',
  excerpt: 'We are withdrawing our previously issued full-year revenue guidance.',
  watchNext: 'Whether guidance is reinstated next quarter.',
  ...overrides,
});

const grade = (overrides: Partial<GradeInput> = {}) => gradeStoryUpdate({
  claims: [claim()],
  trackingMode: 'story',
  ...overrides,
});

describe('the alert bar', () => {
  it('alerts on a high-confidence negative claim in a major category', () => {
    const result = grade();
    expect(result.tier).toBe('major');
    expect(result.categories).toEqual(['guidance']);
  });

  it('stays silent on good news, however confident', () => {
    expect(grade({ claims: [claim({ direction: 'positive' })] }).tier).toBe('routine');
  });

  it('stays silent on a low-confidence negative claim', () => {
    expect(grade({ claims: [claim({ confidence: 'low' })] }).tier).toBe('routine');
    expect(grade({ claims: [claim({ confidence: 'medium' })] }).tier).toBe('routine');
  });

  it('stays silent on a neutral claim', () => {
    expect(grade({ claims: [claim({ direction: 'neutral' })] }).tier).toBe('routine');
  });

  it('alerts on a mixed reading, because ambiguity is worth reading', () => {
    expect(grade({ claims: [claim({ direction: 'mixed' })] }).tier).toBe('major');
  });

  it('stays silent on bad news outside the major categories', () => {
    expect(grade({ claims: [claim({ category: 'revenue' })] }).tier).toBe('routine');
    expect(grade({ claims: [claim({ category: 'margin' })] }).tier).toBe('routine');
  });

  it('covers all three major categories', () => {
    for (const category of ['guidance', 'risk', 'cash-flow'] as ClaimCategory[]) {
      expect(grade({ claims: [claim({ category })] }).tier).toBe('major');
    }
  });

  it('never alerts price-only tracking, whatever the filing says', () => {
    expect(grade({ trackingMode: 'price' }).tier).toBe('routine');
  });

  it('returns no claims when routine, so a caller cannot render an empty alert', () => {
    const result = grade({ claims: [claim({ direction: 'positive' })] });
    expect(result.claims).toEqual([]);
    expect(result.categories).toEqual([]);
  });

  it('reports the worst news first', () => {
    const result = grade({
      claims: [claim({ id: 'mixed', direction: 'mixed' }), claim({ id: 'bad', direction: 'negative' })],
    });
    expect(result.claims[0].id).toBe('bad');
  });

  it('is silent when there are no claims at all', () => {
    expect(grade({ claims: [] }).tier).toBe('routine');
  });
});

describe('thesis matching', () => {
  const invalidation = 'I am wrong if gross margin compresses below 60% or if they lose the patent case.';

  it('widens the bar to any category the invalidation text flags', () => {
    // margin is not a major category, but this user asked to be told about it.
    const result = gradeStoryUpdate({
      claims: [claim({ category: 'margin' })],
      trackingMode: 'thesis',
      thesisInvalidation: invalidation,
    });
    expect(result.tier).toBe('thesis_match');
    expect(result.categories).toEqual(['margin']);
  });

  it('prefers a thesis match over a plain major claim', () => {
    const result = gradeStoryUpdate({
      claims: [claim({ id: 'guide', category: 'guidance' }), claim({ id: 'marg', category: 'margin' })],
      trackingMode: 'thesis',
      thesisInvalidation: invalidation,
    });
    expect(result.tier).toBe('thesis_match');
    expect(result.claims.map(c => c.id)).toEqual(['marg']);
  });

  it('still applies the confidence and direction bar to a flagged category', () => {
    const result = gradeStoryUpdate({
      claims: [claim({ category: 'margin', direction: 'positive' })],
      trackingMode: 'thesis',
      thesisInvalidation: invalidation,
    });
    expect(result.tier).toBe('routine');
  });

  it('falls back to the major bar when the thesis text says nothing usable', () => {
    for (const text of [null, '', '   ', 'idk']) {
      const result = gradeStoryUpdate({
        claims: [claim({ category: 'guidance' })],
        trackingMode: 'thesis',
        thesisInvalidation: text,
      });
      expect(result.tier).toBe('major');
    }
  });

  it('does not treat story mode as thesis mode even with invalidation text present', () => {
    const result = gradeStoryUpdate({
      claims: [claim({ category: 'margin' })],
      trackingMode: 'story',
      thesisInvalidation: invalidation,
    });
    expect(result.tier).toBe('routine');
  });
});

describe('flaggedCategories', () => {
  it('reads categories out of ordinary prose', () => {
    expect(flaggedCategories('if free cash flow turns negative')).toEqual(['cash-flow']);
    expect(flaggedCategories('a competitor wins the recall litigation')).toEqual(['risk']);
    expect(flaggedCategories('if they cut the dividend')).toEqual(['capital-allocation']);
  });

  it('can flag several areas at once', () => {
    expect(flaggedCategories('margin compression or rising debt covenants'))
      .toEqual(expect.arrayContaining(['margin', 'balance-sheet']));
  });

  it('ignores text too short to mean anything', () => {
    expect(flaggedCategories('risk')).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(flaggedCategories('If GUIDANCE is withdrawn')).toEqual(['guidance']);
  });
});

describe('isAlertable', () => {
  it('requires both high confidence and bad or ambiguous direction', () => {
    expect(isAlertable(claim())).toBe(true);
    expect(isAlertable(claim({ confidence: 'medium' }))).toBe(false);
    expect(isAlertable(claim({ direction: 'positive' }))).toBe(false);
  });
});

describe('entitlement', () => {
  it('allows paid story tiers in good standing', () => {
    expect(isEntitledToStoryAlerts({ subscription_tier: 'tier2', subscription_status: 'active' })).toBe(true);
    expect(isEntitledToStoryAlerts({ subscription_tier: 'tier3', subscription_status: 'active' })).toBe(true);
  });

  it('refuses lapsed and lower tiers', () => {
    expect(isEntitledToStoryAlerts({ subscription_tier: 'tier1', subscription_status: 'active' })).toBe(false);
    expect(isEntitledToStoryAlerts({ subscription_tier: 'tier2', subscription_status: 'canceled' })).toBe(false);
    expect(isEntitledToStoryAlerts({ subscription_tier: 'tier2', subscription_status: 'unpaid' })).toBe(false);
    expect(isEntitledToStoryAlerts(null)).toBe(false);
  });

  it('always allows admins', () => {
    expect(isEntitledToStoryAlerts({ role: 'admin' })).toBe(true);
    expect(isEntitledToStoryAlerts({ role: 'super_admin' })).toBe(true);
  });
});

describe('filing freshness', () => {
  const now = new Date('2026-08-26T12:00:00Z');
  const fresh = { accession: '0001-26-000200', filingDate: '2026-08-24', now, maxAgeDays: 30 };

  it('grades a filing that is new since the last successful poll', () => {
    expect(filingSkipReason({ ...fresh, priorAccession: '0001-26-000100' })).toBeNull();
  });

  it('skips the filing it already graded', () => {
    expect(filingSkipReason({ ...fresh, priorAccession: '0001-26-000200' })).toBe('unchanged');
  });

  it('never alerts on the first poll of a ticker, however recent the filing', () => {
    expect(filingSkipReason({ ...fresh, priorAccession: null })).toBe('baseline');
    expect(filingSkipReason({ ...fresh, priorAccession: '' })).toBe('baseline');
  });

  it('will not call a months-old filing news after an outage', () => {
    expect(filingSkipReason({ ...fresh, filingDate: '2026-05-01', priorAccession: 'x' })).toBe('stale');
  });

  it('treats an unreadable filing date as stale rather than guessing', () => {
    expect(filingSkipReason({ ...fresh, filingDate: 'not-a-date', priorAccession: 'x' })).toBe('stale');
  });
});

describe('channels by tier', () => {
  it('reserves email for a thesis match', () => {
    expect(channelsFor('thesis_match')).toEqual(['in_app', 'push', 'email']);
  });

  it('keeps a major alert out of the inbox', () => {
    expect(channelsFor('major')).toEqual(['in_app', 'push']);
  });
});

describe('categoriesLabel', () => {
  it('reads as prose, not as slugs', () => {
    expect(categoriesLabel(['cash-flow'])).toBe('cash flow');
    expect(categoriesLabel(['guidance', 'risk'])).toBe('guidance and risk');
    expect(categoriesLabel(['guidance', 'risk', 'cash-flow'])).toBe('guidance, risk and cash flow');
  });

  it('degrades to something sayable when there is nothing to name', () => {
    expect(categoriesLabel([])).toBe('this area');
  });
});

describe('fan-out', () => {
  const watcher = (overrides: Partial<StoryWatcher> = {}): StoryWatcher => ({
    watchlist_id: 'w1',
    user_id: 'u1',
    tracking_mode: 'story',
    thesis_invalidation: null,
    subscription_tier: 'tier2',
    subscription_status: 'active',
    role: null,
    ...overrides,
  });

  const filing = {
    form: '10-Q',
    accession: '0001-26-000200',
    filingDate: '2026-08-24',
    documentUrl: 'https://www.sec.gov/Archives/edgar/data/320193/x.htm',
  };

  const fanOut = (watchers: StoryWatcher[], claims = [claim()]) =>
    buildStoryAlertRows({ ticker: 'AAPL', filing, claims, watchers });

  it('carries everything the template renders', () => {
    const [row] = fanOut([watcher()]);
    expect(row.payload).toMatchObject({
      ticker: 'AAPL', form: '10-Q', filing_date: '2026-08-24',
      accession: '0001-26-000200', document_url: filing.documentUrl, tier: 'major',
    });
    expect(row.payload.claims).toEqual([{
      category: 'guidance',
      headline: 'Full-year guidance withdrawn',
      excerpt: 'We are withdrawing our previously issued full-year revenue guidance.',
      watchNext: 'Whether guidance is reinstated next quarter.',
    }]);
  });

  it('keys dedupe by watchlist row and filing, so a re-poll enqueues nothing new', () => {
    const [row] = fanOut([watcher()]);
    expect(row.dedupe_key).toBe('watchlist_story_update:w1:0001-26-000200');
  });

  it('gives two tracked rows of the same ticker one alert each', () => {
    const rows = fanOut([watcher(), watcher({ watchlist_id: 'w2' })]);
    expect(rows.map(row => row.dedupe_key)).toEqual([
      'watchlist_story_update:w1:0001-26-000200',
      'watchlist_story_update:w2:0001-26-000200',
    ]);
  });

  it('mails a thesis watcher whose invalidation note names the area', () => {
    const [row] = fanOut([watcher({ tracking_mode: 'thesis', thesis_invalidation: 'If they pull guidance I am wrong' })]);
    expect(row.payload.tier).toBe('thesis_match');
    expect(row.payload.categories_label).toBe('guidance');
    expect(row.channels).toContain('email');
  });

  it('does not mail a story watcher', () => {
    expect(fanOut([watcher()])[0].channels).not.toContain('email');
  });

  it('drops a watcher who is not entitled to Company Story', () => {
    expect(fanOut([watcher({ subscription_tier: 'tier1' })])).toEqual([]);
    expect(fanOut([watcher({ subscription_status: 'canceled' })])).toEqual([]);
  });

  it('enqueues nothing when the filing is routine', () => {
    expect(fanOut([watcher()], [claim({ direction: 'positive' })])).toEqual([]);
  });

  it('alerts one watcher without alerting another on the same filing', () => {
    const rows = fanOut([
      watcher(),
      watcher({ watchlist_id: 'w2', user_id: 'u2', subscription_tier: 'tier1' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe('u1');
  });

  it('carries at most the three claims the email renders', () => {
    const many = ['guidance', 'risk', 'cash-flow', 'guidance', 'risk'].map((category, index) =>
      claim({ id: `c${index}`, category: category as ClaimCategory }));
    expect((fanOut([watcher()], many)[0].payload.claims as unknown[])).toHaveLength(3);
  });
});
