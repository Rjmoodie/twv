import { describe, expect, it } from 'vitest';
import { filingDocumentUrl, parseModelJson, validClaim } from './narrativeExtraction.ts';

const SECTION = 'Item 7. Management\'s Discussion and Analysis. '
  + 'We are withdrawing our previously issued full-year revenue guidance because of demand softness. '
  + 'Free cash flow declined as working capital absorbed cash during the period.';

const modelClaim = (overrides: Record<string, unknown> = {}) => ({
  category: 'guidance',
  headline: 'Full-year guidance withdrawn',
  explanation: 'Management withdrew prior guidance, citing demand softness.',
  classification: 'company-reported',
  direction: 'negative',
  confidence: 'high',
  excerpt: 'We are withdrawing our previously issued full-year revenue guidance',
  watchNext: 'Whether guidance is reinstated next quarter.',
  ...overrides,
});

describe('filingDocumentUrl', () => {
  it('builds the archive path EDGAR actually serves', () => {
    expect(filingDocumentUrl('0000320193', '0000320193-26-000042', 'aapl-20260630.htm'))
      .toBe('https://www.sec.gov/Archives/edgar/data/320193/000032019326000042/aapl-20260630.htm');
  });

  it('escapes a document name rather than pasting it into the path', () => {
    expect(filingDocumentUrl('0000320193', '0000320193-26-000042', 'a b.htm')).toContain('a%20b.htm');
  });
});

describe('parseModelJson', () => {
  it('reads a bare JSON object', () => {
    expect(parseModelJson('{"claims":[]}')).toEqual({ claims: [] });
  });

  it('reads a fenced block, because models emit them', () => {
    expect(parseModelJson('```json\n{"claims":[]}\n```')).toEqual({ claims: [] });
    expect(parseModelJson('```\n{"claims":[]}\n```')).toEqual({ claims: [] });
  });

  it('throws on prose rather than returning something half-parsed', () => {
    expect(() => parseModelJson('I could not find any claims.')).toThrow();
  });
});

describe('validClaim', () => {
  it('accepts a claim whose excerpt is genuinely in the filing', () => {
    const claim = validClaim(modelClaim(), SECTION, 0);
    expect(claim?.category).toBe('guidance');
    expect(claim?.id).toBe('narrative:0:full-year-guidance-withdrawn');
  });

  it('drops a claim whose excerpt is not in the filing', () => {
    expect(validClaim(modelClaim({ excerpt: 'The company expects to file for bankruptcy shortly.' }), SECTION, 0)).toBeNull();
  });

  it('drops an excerpt too short to be checkable', () => {
    expect(validClaim(modelClaim({ excerpt: 'We are' }), SECTION, 0)).toBeNull();
  });

  it('drops a claim in a category that is not in the contract', () => {
    expect(validClaim(modelClaim({ category: 'sentiment' }), SECTION, 0)).toBeNull();
    expect(validClaim(modelClaim({ direction: 'catastrophic' }), SECTION, 0)).toBeNull();
    expect(validClaim(modelClaim({ confidence: 'certain' }), SECTION, 0)).toBeNull();
    expect(validClaim(modelClaim({ classification: 'guessed' }), SECTION, 0)).toBeNull();
  });

  it('requires the fields a reader needs to act', () => {
    expect(validClaim(modelClaim({ headline: '' }), SECTION, 0)).toBeNull();
    expect(validClaim(modelClaim({ explanation: '  ' }), SECTION, 0)).toBeNull();
    expect(validClaim(modelClaim({ watchNext: '' }), SECTION, 0)).toBeNull();
  });

  it('clamps long text instead of storing whatever the model produced', () => {
    const claim = validClaim(modelClaim({ headline: 'x'.repeat(400) }), SECTION, 0);
    expect(claim?.headline).toHaveLength(180);
  });

  it('rejects a non-object', () => {
    expect(validClaim(null, SECTION, 0)).toBeNull();
    expect(validClaim('claims', SECTION, 0)).toBeNull();
  });
});
