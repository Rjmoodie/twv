/**
 * Deciding when a new filing is worth interrupting someone for.
 *
 * The bar is deliberately high. A false "your thesis may be broken" costs more
 * trust than a missed alert costs value, and the claims are model-generated, so
 * every alert leads with the verbatim excerpt and the reader judges the filing.
 *
 * Everything below the bar still updates the story and shows the existing "New"
 * badge in the watchlist -- it just does not send anything.
 */

import type { ClaimCategory, NarrativeClaim } from './narrativeClaim.ts';

export type TrackingMode = 'price' | 'story' | 'thesis';

/**
 * The categories that move a thesis rather than merely describing a quarter.
 * Revenue and margin move constantly and are already visible on the card;
 * guidance, risk and cash-flow are where a filing says something changed.
 */
export const MAJOR_CATEGORIES: readonly ClaimCategory[] = ['guidance', 'risk', 'cash-flow'];

/**
 * A claim only clears the bar if the filing itself is confident and the news is
 * bad or ambiguous. A high-confidence positive claim is good news, and good
 * news does not need to interrupt anyone.
 */
export function isAlertable(claim: NarrativeClaim): boolean {
  return claim.confidence === 'high' && (claim.direction === 'negative' || claim.direction === 'mixed');
}

/**
 * Words a user is likely to reach for when writing down what would make them
 * wrong. Matching is deliberately category-level: we never claim the filing
 * "matches your thesis", only that it touches an area the thesis flagged.
 */
const CATEGORY_KEYWORDS: Record<ClaimCategory, string[]> = {
  'revenue': ['revenue', 'sales', 'top line', 'top-line', 'bookings', 'demand', 'growth rate', 'churn'],
  'margin': ['margin', 'pricing', 'cogs', 'cost of goods', 'unit economics', 'discount'],
  'cash-flow': ['cash flow', 'cashflow', 'free cash', 'fcf', 'burn', 'liquidity', 'runway', 'working capital'],
  'balance-sheet': ['debt', 'leverage', 'covenant', 'dilution', 'balance sheet', 'solvency', 'refinanc'],
  'guidance': ['guidance', 'outlook', 'forecast', 'guide', 'target', 'expectation'],
  'risk': ['risk', 'litigation', 'lawsuit', 'regulator', 'recall', 'investigation', 'competition', 'competitor', 'patent', 'approval'],
  'capital-allocation': ['buyback', 'repurchase', 'dividend', 'acquisition', 'capex', 'capital allocation', 'm&a'],
};

/**
 * Which categories a user's invalidation text refers to. Free text cannot be
 * matched to a claim honestly, but the area it talks about can be.
 */
export function flaggedCategories(thesisInvalidation: string | null | undefined): ClaimCategory[] {
  const text = (thesisInvalidation ?? '').toLowerCase();
  if (text.trim().length < 8) return [];
  return (Object.keys(CATEGORY_KEYWORDS) as ClaimCategory[])
    .filter(category => CATEGORY_KEYWORDS[category].some(keyword => text.includes(keyword)));
}

export type AlertTier = 'thesis_match' | 'major' | 'routine';

export interface StoryAlert {
  tier: AlertTier;
  /** The claims that cleared the bar, most severe first. Empty when routine. */
  claims: NarrativeClaim[];
  /** Distinct categories those claims fall in. */
  categories: ClaimCategory[];
}

export interface GradeInput {
  claims: NarrativeClaim[];
  trackingMode: TrackingMode;
  thesisInvalidation?: string | null;
}

const ROUTINE: StoryAlert = { tier: 'routine', claims: [], categories: [] };

// Negative outranks mixed, so the lead claim in an email is the worst news.
const severity = (claim: NarrativeClaim) => (claim.direction === 'negative' ? 0 : 1);

export function gradeStoryUpdate(input: GradeInput): StoryAlert {
  // Price-only tracking is a deliberate statement that the narrative is not
  // wanted. It is never alertable, whatever the filing says.
  if (input.trackingMode === 'price') return ROUTINE;

  const alertable = input.claims.filter(isAlertable).sort((a, b) => severity(a) - severity(b));
  if (!alertable.length) return ROUTINE;

  const flagged = input.trackingMode === 'thesis' ? flaggedCategories(input.thesisInvalidation) : [];
  const thesisHits = alertable.filter(claim => flagged.includes(claim.category));
  if (thesisHits.length) {
    return { tier: 'thesis_match', claims: thesisHits, categories: distinct(thesisHits) };
  }

  const majorHits = alertable.filter(claim => MAJOR_CATEGORIES.includes(claim.category));
  if (majorHits.length) {
    return { tier: 'major', claims: majorHits, categories: distinct(majorHits) };
  }

  return ROUTINE;
}

function distinct(claims: NarrativeClaim[]): ClaimCategory[] {
  return [...new Set(claims.map(claim => claim.category))];
}

/** Only tier-2/tier-3 subscribers may use Company Story, so only they may be alerted. */
export function isEntitledToStoryAlerts(
  profile: { subscription_tier?: string | null; subscription_status?: string | null; role?: string | null } | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.role === 'admin' || profile.role === 'super_admin') return true;
  return ['tier2', 'tier3'].includes(profile.subscription_tier ?? '')
    && !['canceled', 'unpaid'].includes(profile.subscription_status ?? '');
}

// ---------------------------------------------------------------------------
// Fan-out. Turning one graded filing into outbox rows is decision logic, not
// plumbing -- which channels a tier has earned, and which filings are new
// enough to be worth anyone's attention -- so it lives here where it can be
// tested without a database or a network.
// ---------------------------------------------------------------------------

/** Why the poller should not grade a filing it just read. */
export type FilingSkipReason =
  | 'unchanged'  // already graded on an earlier run
  | 'baseline'   // first time this ticker was polled; see below
  | 'stale';     // old enough that "new filing" would be a lie

export interface FilingFreshnessInput {
  accession: string;
  filingDate: string;
  /** The accession recorded by the last successful poll, if any. */
  priorAccession: string | null | undefined;
  now: Date;
  maxAgeDays: number;
}

/**
 * The first poll of a ticker must never alert. Without prior state every
 * company's newest filing looks new, so switching the poller on -- or a user
 * enabling story tracking -- would fire an alert about a filing that may be
 * months old. The first run records where we are; alerts start from the next
 * filing. `stale` is the same guard for a poller that was off for a long time.
 */
export function filingSkipReason(input: FilingFreshnessInput): FilingSkipReason | null {
  const prior = (input.priorAccession ?? '').trim();
  if (prior && prior === input.accession) return 'unchanged';
  if (!prior) return 'baseline';
  const filedAt = Date.parse(`${input.filingDate}T00:00:00Z`);
  if (!Number.isFinite(filedAt)) return 'stale';
  const ageDays = (input.now.getTime() - filedAt) / 86_400_000;
  return ageDays > input.maxAgeDays ? 'stale' : null;
}

/**
 * Email is reserved for thesis matches. A major-category alert is worth a push
 * and a badge; it is not worth an inbox, because the claim is model-generated
 * and the user did not tell us that area would make them wrong.
 */
export function channelsFor(tier: AlertTier): string[] {
  return tier === 'thesis_match' ? ['in_app', 'push', 'email'] : ['in_app', 'push'];
}

/** "guidance", "guidance and risk", "guidance, risk and cash flow". */
export function categoriesLabel(categories: ClaimCategory[]): string {
  const words = categories.map(category => category.replace('-', ' '));
  if (words.length <= 1) return words[0] ?? 'this area';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

export interface StoryWatcher {
  watchlist_id: string;
  user_id: string;
  tracking_mode: string;
  thesis_invalidation: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  role: string | null;
}

export interface AlertFiling {
  form: string;
  accession: string;
  filingDate: string;
  documentUrl: string;
}

/** One row of the array `enqueue_story_alerts` expects. */
export interface StoryAlertRow {
  user_id: string;
  dedupe_key: string;
  channels: string[];
  payload: Record<string, unknown>;
}

/** Three is what the email renders; carrying more only bloats every outbox row. */
const MAX_PAYLOAD_CLAIMS = 3;

export interface FanOutInput {
  ticker: string;
  filing: AlertFiling;
  claims: NarrativeClaim[];
  watchers: StoryWatcher[];
}

/**
 * Grade one filing for every watcher of the ticker. Entitlement is checked
 * here rather than by the caller so that no future caller can forget it.
 */
export function buildStoryAlertRows(input: FanOutInput): StoryAlertRow[] {
  return input.watchers.flatMap(watcher => {
    if (!isEntitledToStoryAlerts(watcher)) return [];
    const alert = gradeStoryUpdate({
      claims: input.claims,
      trackingMode: watcher.tracking_mode as TrackingMode,
      thesisInvalidation: watcher.thesis_invalidation,
    });
    if (alert.tier === 'routine') return [];
    return [{
      user_id: watcher.user_id,
      // Per watchlist row, not per user: someone tracking a ticker twice
      // still gets one alert for each, and re-polling gets none.
      dedupe_key: `watchlist_story_update:${watcher.watchlist_id}:${input.filing.accession}`,
      channels: channelsFor(alert.tier),
      payload: {
        watchlist_id: watcher.watchlist_id,
        ticker: input.ticker,
        form: input.filing.form,
        filing_date: input.filing.filingDate,
        accession: input.filing.accession,
        document_url: input.filing.documentUrl,
        tier: alert.tier,
        categories_label: categoriesLabel(alert.categories),
        claims: alert.claims.slice(0, MAX_PAYLOAD_CLAIMS).map(claim => ({
          category: claim.category,
          headline: claim.headline,
          excerpt: claim.excerpt,
          watchNext: claim.watchNext,
        })),
      },
    }];
  });
}
