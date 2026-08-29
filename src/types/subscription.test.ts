import { describe, it, expect } from 'vitest';
import { SUBSCRIPTION_PLANS } from './subscription';
import type { SubscriptionTier } from './subscription';

/**
 * What is left of the tier model after the feature flags were removed.
 *
 * `SubscriptionFeatures` and `getSubscriptionFeatures` were the source
 * platform's product catalogue -- options dashboards, PDUFA calendars, course
 * access, Discord. They drove nothing: `hasFeature` was never called with a
 * key and `canAccessModule` had no callers. Module access is decided by
 * persona in `config/moduleAccess.ts`. Stripe still bills, so the plans
 * themselves stay.
 *
 * tier2 and tier3 remain in the record only so imported account rows resolve
 * to a plan. `PRICING_PLAN_ORDER` never offers them -- see `config/pricing.ts`.
 */

// ─── SUBSCRIPTION_PLANS ───────────────────────────────────────────────────────

describe('SUBSCRIPTION_PLANS', () => {
  it('free plan has price 0', () => {
    expect(SUBSCRIPTION_PLANS.free.price).toBe(0);
  });

  it('paid tiers have increasing prices', () => {
    expect(SUBSCRIPTION_PLANS.tier1.price).toBeGreaterThan(0);
    expect(SUBSCRIPTION_PLANS.tier2.price).toBeGreaterThan(SUBSCRIPTION_PLANS.tier1.price);
    expect(SUBSCRIPTION_PLANS.tier3.price).toBeGreaterThan(SUBSCRIPTION_PLANS.tier2.price);
  });

  it('free tier has no stripePriceId', () => {
    expect(SUBSCRIPTION_PLANS.free.stripePriceId).toBe('');
  });

  // The offered plans are guarded in config/pricing.test.ts. This is the
  // stronger claim: no tier in the record -- offered or not -- still carries
  // the source platform's product copy, so none of it can reach a surface
  // that renders a plan by tier.
  it('no tier advertises a module this platform does not have', () => {
    const allCopy = (['free', 'tier1', 'tier2', 'tier3'] as SubscriptionTier[])
      .flatMap((tier) => [SUBSCRIPTION_PLANS[tier].name, ...SUBSCRIPTION_PLANS[tier].features])
      .join(' ')
      .toLowerCase();

    expect(allCopy).not.toMatch(
      /discord|plaid|stock|pdufa|earnings|options|backtest|course|watchlist|retirement|trades|coach/,
    );
  });
});
