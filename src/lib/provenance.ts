/**
 * Data provenance vocabulary.
 *
 * The codebase had accumulated nine different ways of saying the same thing —
 * "SEC", "EDGAR", "SEC EDGAR", "SEC EDGAR XBRL", "EDGAR-backed", "SEC annual
 * statements" — used interchangeably across modules. They are not synonyms:
 *
 *   SEC    the regulator. A *filing* is the legal document submitted to it.
 *   EDGAR  the SEC's system that stores and serves those filings. It is a
 *          retrieval channel, not a separate authority.
 *
 * So "SEC" vs "EDGAR" is not a meaningful split for a reader — both describe
 * the same origin. What a reader actually needs to know about any number on
 * screen is which of these it is:
 *
 *   filed   reported by the company in a statutory filing. Audited, primary,
 *           slow (annual/quarterly). We retrieve it from EDGAR.
 *   market  priced by the market and supplied by a data vendor. Fast, delayed,
 *           not audited.
 *   model   computed by Somatech from the above. Ours, not anybody's fact —
 *           the distinction that matters most for trust.
 *
 * Keep the wording here and nowhere else, so provenance cannot drift again.
 */

export type ProvenanceKind = 'filed' | 'market' | 'model';

export interface ProvenanceMeta {
  /** Short marker for inline use. Two syllables max — this sits beside numbers. */
  label: string;
  /** Precise one-line attribution, for tooltips and footers. */
  detail: string;
  /** Where a reader can verify it themselves, when that is possible. */
  href?: string;
}

export const PROVENANCE: Record<ProvenanceKind, ProvenanceMeta> = {
  filed: {
    label: 'Filed',
    detail: 'As reported by the company in SEC filings, retrieved from EDGAR XBRL company facts.',
    href: 'https://www.sec.gov/search-filings',
  },
  market: {
    label: 'Market',
    detail: 'Market data from Alpha Vantage. Delayed, and not part of any statutory filing.',
  },
  model: {
    label: 'Model',
    detail: 'Calculated by Somatech from filed and market inputs. An estimate, not a reported figure.',
  },
};

/** Canonical attribution strings. Use these instead of writing "SEC EDGAR" inline. */
export const SOURCE_NAMES = {
  /** The filing authority — use when referring to the obligation or the document. */
  filingAuthority: 'SEC',
  /** The retrieval system — use when referring to where we fetched it from. */
  filingSystem: 'EDGAR',
  /** Full form for footers and disclaimers. */
  filingsFull: 'SEC filings via EDGAR',
  /** The specific EDGAR dataset behind the fundamentals. */
  filingsDataset: 'EDGAR XBRL company facts',
  /** Market data vendor. */
  marketVendor: 'Alpha Vantage',
} as const;

/**
 * Which provenance a given financial field carries.
 * Anything absent here is a Somatech computation — i.e. 'model'.
 */
const FILED_FIELDS = new Set([
  'revenue', 'gross_profit', 'operating_income', 'net_income',
  'operating_cf', 'capex', 'free_cash_flow', 'total_assets',
  'current_assets', 'current_liabilities', 'long_term_debt',
  'short_term_debt', 'total_equity', 'cash', 'ppe_net',
  'shares_outstanding', 'rd_expense', 'interest_expense',
  'dividends_paid', 'da_expense', 'tax_expense', 'pretax_income',
]);

const MARKET_FIELDS = new Set([
  'current_price', 'market_cap', 'beta', 'week52_high', 'week52_low',
  'ma_200day', 'analyst_target', 'sector', 'industry',
]);

export function provenanceOf(field: string): ProvenanceKind {
  if (FILED_FIELDS.has(field)) return 'filed';
  if (MARKET_FIELDS.has(field)) return 'market';
  return 'model';
}
