export interface FilingCandidate {
  accessionNumber: string;
  filingDate: string;
  reportDate: string | null;
  form: string;
  primaryDocument: string;
}

const ENTITY_MAP: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', ldquo: '“', rdquo: '”',
};

export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, raw: string) => {
      const code = raw.toLowerCase().startsWith('x') ? Number.parseInt(raw.slice(1), 16) : Number.parseInt(raw, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
    })
    .replace(/&([a-z]+);/gi, (_, name: string) => ENTITY_MAP[name.toLowerCase()] ?? ' ')
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function positions(text: string, pattern: RegExp): number[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const global = new RegExp(pattern.source, flags);
  return [...text.matchAll(global)].map((match) => match.index ?? -1).filter((index) => index >= 0);
}

export function extractMdaSection(text: string, form: string): string | null {
  const normalizedForm = form.replace('/A', '');
  const startPattern = normalizedForm === '10-K'
    ? /\bitem\s+7\s*[.:\-–—]?\s*management(?:['’]s)?\s+discussion\s+and\s+analysis\b/gi
    : /\bitem\s+2\s*[.:\-–—]?\s*management(?:['’]s)?\s+discussion\s+and\s+analysis\b/gi;
  const endPattern = normalizedForm === '10-K'
    ? /\bitem\s+(?:7a|8)\s*[.:\-–—]/gi
    : /\bitem\s+(?:3|4)\s*[.:\-–—]/gi;
  const starts = positions(text, startPattern);
  const ends = positions(text, endPattern);
  const candidates = starts.flatMap((start) => {
    const end = ends.find((position) => position > start + 500);
    if (!end) return [];
    const value = text.slice(start, end).trim();
    return value.length >= 1_500 ? [value] : [];
  });
  if (!candidates.length) return null;
  // A table of contents often creates an early short match. The actual MD&A is
  // generally the longest bounded candidate, so select by content length.
  return candidates.sort((a, b) => b.length - a.length)[0];
}

export function recentFilingCandidates(submissions: unknown): FilingCandidate[] {
  const recent = (submissions as { filings?: { recent?: Record<string, unknown[]> } })?.filings?.recent;
  if (!recent) return [];
  const accessions = recent.accessionNumber ?? [];
  return accessions.flatMap((accession, index) => {
    const form = String(recent.form?.[index] ?? '');
    const filingDate = String(recent.filingDate?.[index] ?? '');
    const primaryDocument = String(recent.primaryDocument?.[index] ?? '');
    if (!/^(10-K|10-Q)(\/A)?$/.test(form) || !/^\d{4}-\d{2}-\d{2}$/.test(filingDate) || !primaryDocument || !accession) return [];
    return [{ accessionNumber: String(accession), filingDate, reportDate: recent.reportDate?.[index] ? String(recent.reportDate[index]) : null, form, primaryDocument }];
  });
}

export function normalizeExcerpt(value: string): string {
  return value.toLowerCase().replace(/[“”‘’]/g, "'").replace(/[^a-z0-9%$.'-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function excerptExists(section: string, excerpt: string): boolean {
  const needle = normalizeExcerpt(excerpt);
  return needle.length >= 24 && normalizeExcerpt(section).includes(needle);
}

