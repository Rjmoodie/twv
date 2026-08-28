/**
 * The claim contract produced by the filing analyser and consumed by both the
 * on-demand story enrichment and the background alert poller. Defined once so
 * the two cannot drift on what a claim is.
 */

export type ClaimCategory =
  | 'revenue' | 'margin' | 'cash-flow' | 'balance-sheet'
  | 'guidance' | 'risk' | 'capital-allocation';

export type ClaimDirection = 'positive' | 'negative' | 'mixed' | 'neutral';
export type ClaimConfidence = 'high' | 'medium' | 'low';

export interface NarrativeClaim {
  id: string;
  category: ClaimCategory;
  headline: string;
  explanation: string;
  classification: 'company-reported' | 'inferred';
  direction: ClaimDirection;
  confidence: ClaimConfidence;
  /** Verbatim text from the filing. The reader judges the filing, not the model. */
  excerpt: string;
  watchNext: string;
}

export const CLAIM_CATEGORIES: readonly ClaimCategory[] = [
  'revenue', 'margin', 'cash-flow', 'balance-sheet', 'guidance', 'risk', 'capital-allocation',
];

/**
 * A claim is only storable if it carries a long-enough verbatim excerpt: the
 * excerpt is what lets a reader check the model's work against the filing.
 */
export function isStoredClaim(value: unknown): value is NarrativeClaim {
  if (!value || typeof value !== 'object') return false;
  const claim = value as Partial<NarrativeClaim>;
  return typeof claim.id === 'string'
    && typeof claim.headline === 'string'
    && typeof claim.explanation === 'string'
    && typeof claim.excerpt === 'string' && claim.excerpt.length >= 24
    && typeof claim.watchNext === 'string'
    && ['company-reported', 'inferred'].includes(claim.classification ?? '')
    && ['positive', 'negative', 'mixed', 'neutral'].includes(claim.direction ?? '')
    && ['high', 'medium', 'low'].includes(claim.confidence ?? '');
}
