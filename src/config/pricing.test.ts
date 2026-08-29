import { describe, expect, it } from 'vitest';

import { PRICING_PLAN_ORDER, PRICING_PLANS } from './pricing';

describe('TW Ventures pricing surface', () => {
  it('offers only plans backed by a currently shipped workflow', () => {
    expect(PRICING_PLAN_ORDER).toEqual(['free', 'tier1']);
  });

  it('does not advertise modules removed from this workspace', () => {
    const offeredCopy = PRICING_PLAN_ORDER
      .flatMap((tier) => [
        PRICING_PLANS[tier].name,
        PRICING_PLANS[tier].description,
        ...PRICING_PLANS[tier].features,
      ])
      .join(' ')
      .toLowerCase();

    expect(offeredCopy).not.toMatch(/stock|pdufa|earnings|watchlist|financial coach|retirement/);
  });
});
