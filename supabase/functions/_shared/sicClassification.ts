/**
 * SIC classification — what kind of business is this, according to its filings?
 *
 * The valuation ladder was applying enterprise-value multiples to banks. That is
 * not a tuning problem, it is a category error: enterprise value subtracts net
 * debt on the theory that debt is a financing choice layered over an operating
 * business, and for a bank borrowing IS the business. BAC, C and JPM were being
 * valued on EV/Sales; GS, MS and WFC landed on Price/Book, which is right, but
 * only because EV/Sales happened to fail for them. Luck, not design.
 *
 * Fixing it needs to know what a company is, and nothing in the pipeline knew:
 * `sector` was read by the mapper but never populated, so it was null for every
 * cached ticker. Sector strings existed only inside the hardcoded peer universe,
 * attached to peers for matching and never to the company being analysed.
 *
 * SEC submissions carry a SIC code — JPM 6021 "National Commercial Banks", PLD
 * 6798 "Real Estate Investment Trusts". It is filed rather than vendor-assigned,
 * free, on a host we already call, and it is the classification the registrant
 * itself declared. That fits this codebase's preference for filed facts over
 * bought ones better than any sector feed would.
 *
 * The taxonomy below is deliberately coarse. It exists to answer one question —
 * which valuation instruments are appropriate — not to be a market map. A class
 * is only introduced where it changes what we do.
 */

export type BusinessClass =
  | 'bank'
  | 'insurer'
  | 'reit'
  | 'financial-other'
  | 'general';

export interface SicClassification {
  /** Four-digit code as filed, normalised; null when unusable. */
  sic: string | null;
  description: string | null;
  businessClass: BusinessClass;
}

/**
 * SIC major groups, from the SEC's own division structure.
 *
 * 6798 is checked before the 6700s because REITs sit inside the holding-and-
 * investment-office group but need their own treatment: depreciation dominates
 * their income statement, so free cash flow understates them badly and funds
 * from operations is the industry's measure.
 */
export function classifySic(rawSic: string | number | null | undefined): BusinessClass {
  const code = normalizeSic(rawSic);
  if (code == null) return 'general';

  // Real estate investment trusts — checked first, see above.
  if (code === 6798) return 'reit';

  // Depository institutions and non-depository credit. Enterprise value is
  // meaningless here: deposits and borrowings are raw material, not leverage.
  if (code >= 6000 && code <= 6199) return 'bank';

  // Security and commodity brokers, dealers, exchanges.
  if (code >= 6200 && code <= 6299) return 'financial-other';

  // Insurance carriers. Agencies and brokers (6400-6411) are fee-based operating
  // businesses and must not inherit carrier-specific book-value treatment.
  if (code >= 6300 && code <= 6399) return 'insurer';

  // Holding and other investment offices, excluding the REIT code above.
  if (code >= 6700 && code <= 6799) return 'financial-other';

  return 'general';
}

/**
 * Parses a SIC code from whatever EDGAR supplies.
 *
 * Submissions returns it as a string, occasionally empty, and a caller may hand
 * us a number. Codes are four digits but a few legacy registrants carry shorter
 * ones, so this range-checks rather than length-checks: anything outside a
 * plausible SIC range is treated as unusable rather than silently classified.
 */
export function normalizeSic(rawSic: string | number | null | undefined): number | null {
  if (rawSic == null) return null;
  const text = String(rawSic).trim();
  if (!text) return null;
  // Reject anything that is not purely digits: a code like "6021 " is fine after
  // trimming, but "6021-A" or "N/A" must not parse to 6021 via parseInt.
  if (!/^\d+$/.test(text)) return null;
  const code = Number(text);
  if (!Number.isInteger(code) || code < 100 || code > 9999) return null;
  return code;
}

/** Human label for the class, for the reason strings a reader actually sees. */
export function businessClassLabel(businessClass: BusinessClass): string {
  switch (businessClass) {
    case 'bank': return 'a bank or credit institution';
    case 'insurer': return 'an insurer';
    case 'reit': return 'a real estate investment trust';
    case 'financial-other': return 'a financial institution';
    case 'general': return 'an operating company';
  }
}

/** Convenience: the whole classification from a submissions payload. */
export function classifyFiler(
  rawSic: string | number | null | undefined,
  description: string | null | undefined,
): SicClassification {
  const code = normalizeSic(rawSic);
  return {
    sic: code == null ? null : String(code),
    description: description?.trim() || null,
    businessClass: classifySic(rawSic),
  };
}
