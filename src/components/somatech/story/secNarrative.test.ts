import { describe, expect, it } from 'vitest';
import { excerptExists, extractMdaSection, htmlToText, recentFilingCandidates } from '../../../../supabase/functions/_shared/secNarrative';

describe('SEC narrative extraction', () => {
  it('removes scripts and decodes filing text safely', () => {
    expect(htmlToText('<style>bad</style><p>Revenue &amp; margin</p><script>worse</script>')).toBe('Revenue & margin');
  });

  it('selects the substantive 10-K MD&A rather than a table-of-contents match', () => {
    const toc = 'Item 7. Management’s Discussion and Analysis\nItem 7A. Quantitative';
    const body = `Item 7. Management's Discussion and Analysis\n${'Operating results and demand improved. '.repeat(80)}\nItem 7A. Quantitative and Qualitative Disclosures`;
    const result = extractMdaSection(`${toc}\n${body}`, '10-K');
    expect(result).toContain('Operating results and demand improved');
    expect(result!.length).toBeGreaterThan(1_500);
  });

  it('extracts 10-Q Item 2 and rejects incomplete boundaries', () => {
    const valid = `ITEM 2. MANAGEMENT'S DISCUSSION AND ANALYSIS\n${'Quarterly demand and product mix changed. '.repeat(70)}\nITEM 3. QUANTITATIVE AND QUALITATIVE DISCLOSURES`;
    expect(extractMdaSection(valid, '10-Q')).toContain('Quarterly demand');
    expect(extractMdaSection('Item 2. Management Discussion and Analysis short Item 3.', '10-Q')).toBeNull();
  });

  it('retains only eligible filing forms with complete identifiers', () => {
    const filings = recentFilingCandidates({ filings: { recent: {
      accessionNumber: ['1', '2', '3'], filingDate: ['2026-08-01', '2026-07-01', 'bad'], reportDate: ['2026-06-30', '', ''],
      form: ['8-K', '10-Q', '10-K'], primaryDocument: ['a.htm', 'q.htm', 'k.htm'],
    } } });
    expect(filings).toEqual([{ accessionNumber: '2', filingDate: '2026-07-01', reportDate: null, form: '10-Q', primaryDocument: 'q.htm' }]);
  });

  it('requires a sufficiently specific verbatim excerpt after normalization', () => {
    const source = 'The company reported that international revenue increased because of favorable product mix.';
    expect(excerptExists(source, 'international revenue increased because of favorable product mix')).toBe(true);
    expect(excerptExists(source, 'revenue increased')).toBe(false);
    expect(excerptExists(source, 'international revenue declined because of pricing')).toBe(false);
  });
});
