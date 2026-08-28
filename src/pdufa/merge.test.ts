import { describe, it, expect } from 'vitest';
import { mergeAndScore } from './merge';
import type { Item } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<Item> & { id: string }): Item {
  return {
    source: 'fda_press',
    capturedAt: new Date().toISOString(),
    headline: overrides.id, // use id as headline so stableId can distinguish items
    url: `https://example.com/${overrides.id}`,
    confidence: 0.5,
    ...overrides,
  };
}

// ─── Basic deduplication ──────────────────────────────────────────────────────

describe('mergeAndScore', () => {
  it('returns empty result for empty input', () => {
    const { items, rawCount, dedupedCount } = mergeAndScore([]);
    expect(items).toHaveLength(0);
    expect(rawCount).toBe(0);
    expect(dedupedCount).toBe(0);
  });

  it('passes through a single item unchanged', () => {
    const item = makeItem({ id: 'a', confidence: 0.7 });
    const { items, rawCount, dedupedCount } = mergeAndScore([item]);
    expect(rawCount).toBe(1);
    expect(dedupedCount).toBe(1);
    expect(items[0].confidence).toBe(0.7);
  });

  it('deduplicates items with the same stable id, keeping highest confidence', () => {
    const low  = makeItem({ id: 'dup', headline: 'Pfizer PDUFA', url: 'https://x.com/1', confidence: 0.4 });
    const high = makeItem({ id: 'dup', headline: 'Pfizer PDUFA', url: 'https://x.com/1', confidence: 0.9, source: 'sec_edgar' });
    const { items, rawCount, dedupedCount } = mergeAndScore([low, high]);
    expect(rawCount).toBe(2);
    expect(dedupedCount).toBe(1);
    expect(items[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('applies corroboration bonus when multiple distinct sources agree', () => {
    // Same headline from 2 different sources
    const a = makeItem({ id: 'x', headline: 'Biotech PDUFA', url: 'https://x.com', source: 'fda_press',   confidence: 0.6 });
    const b = makeItem({ id: 'x', headline: 'Biotech PDUFA', url: 'https://x.com', source: 'sec_edgar',   confidence: 0.6 });
    const { items } = mergeAndScore([a, b]);
    // 2 distinct sources → +0.1 bonus
    expect(items[0].confidence).toBeCloseTo(0.7, 5);
  });

  it('corroboration bonus is capped at 0.3 (total confidence at most 1.0)', () => {
    // 4 distinct sources, each contributing +0.1 → cap at 0.3
    const sources = ['fda_press', 'sec_edgar', 'orange_book', 'company_rss'] as const;
    const items = sources.map((s) =>
      makeItem({ id: 'cap-test', headline: 'Cap test', url: 'https://x.com', source: s, confidence: 0.8 })
    );
    const { items: merged } = mergeAndScore(items);
    expect(merged[0].confidence).toBeLessThanOrEqual(1.0);
  });

  it('confidence never exceeds 1.0', () => {
    const sources = ['fda_press', 'sec_edgar', 'orange_book', 'company_rss', 'dailymed_rss',
                     'federal_register', 'fda_adcom_calendar', 'cder_whats_new'] as const;
    const items = sources.map((s) =>
      makeItem({ id: 'overflow', headline: 'Overflow test', url: 'https://x.com', source: s, confidence: 1.0 })
    );
    const { items: merged } = mergeAndScore(items);
    expect(merged[0].confidence).toBeLessThanOrEqual(1.0);
  });

  // ─── Sorting ──────────────────────────────────────────────────────────────

  it('sorts items with eventDate before those without', () => {
    const noDate   = makeItem({ id: 'no-date',   headline: 'No date item' });
    const withDate = makeItem({ id: 'with-date', headline: 'Dated item', eventDate: '2025-06-15' });
    const { items } = mergeAndScore([noDate, withDate]);
    expect(items[0].eventDate).toBe('2025-06-15');
    expect(items[1].eventDate).toBeUndefined();
  });

  it('sorts by eventDate ascending when both items have dates', () => {
    const later  = makeItem({ id: 'later',  headline: 'Later',  eventDate: '2025-09-01' });
    const earlier = makeItem({ id: 'earlier', headline: 'Earlier', eventDate: '2025-06-01' });
    const { items } = mergeAndScore([later, earlier]);
    expect(items[0].eventDate).toBe('2025-06-01');
    expect(items[1].eventDate).toBe('2025-09-01');
  });

  it('sorts alphabetically by headline when dates tie', () => {
    const b = makeItem({ id: 'b', headline: 'Beta Corp PDUFA', eventDate: '2025-06-01' });
    const a = makeItem({ id: 'a', headline: 'Alpha Corp PDUFA', eventDate: '2025-06-01' });
    const { items } = mergeAndScore([b, a]);
    expect(items[0].headline).toBe('Alpha Corp PDUFA');
  });

  // ─── rawCount / dedupedCount ──────────────────────────────────────────────

  it('reports correct rawCount and dedupedCount', () => {
    const items = [
      makeItem({ id: 'one', headline: 'One' }),
      makeItem({ id: 'two', headline: 'Two' }),
      makeItem({ id: 'one', headline: 'One', source: 'sec_edgar' }), // duplicate of 'one'
    ];
    const result = mergeAndScore(items);
    expect(result.rawCount).toBe(3);
    expect(result.dedupedCount).toBe(2);
  });
});
