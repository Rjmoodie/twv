import { describe, it, expect } from 'vitest';
import { getSubscriptionFeatures, SUBSCRIPTION_PLANS } from './subscription';
import type { SubscriptionTier } from './subscription';

/**
 * Tier model under test — NOT a strict ladder.
 *
 *   free   → base utilities only
 *   tier1  → Planner  (coach, real estate, valuation)      ┐ parallel paths:
 *   tier2  → Investor (research, portfolio, options, …)    ┘ neither contains the other
 *   tier3  → Complete (Planner ∪ Investor + courses)
 *
 * tier1 and tier2 are siblings, not steps. Only tier3 is a superset of both.
 */

describe('getSubscriptionFeatures', () => {
  describe('free tier', () => {
    it('grants base utilities', () => {
      const f = getSubscriptionFeatures('free');
      expect(f.retirementCalculator).toBe(true);
      expect(f.watchlist).toBe(true);
      expect(f.plaidConnect).toBe(true);
      expect(f.plaidConnectionLimit).toBe(2);
    });

    it('denies all paid features', () => {
      const f = getSubscriptionFeatures('free');
      expect(f.financialCoach).toBe(false);
      expect(f.realEstate).toBe(false);
      expect(f.businessValuation).toBe(false);
      expect(f.stockAnalysis).toBe(false);
      expect(f.pdufaCalendar).toBe(false);
      expect(f.earningsCalendar).toBe(false);
      expect(f.portfolio).toBe(false);
      expect(f.tradesDashboard).toBe(false);
      expect(f.optionsTradingDiscord).toBe(false);
      expect(f.discordChat).toBe(false);
      expect(f.advancedAnalytics).toBe(false);
      expect(f.courseAccess).toBe(false);
      expect(f.liveSessions).toBe(false);
      expect(f.backtestingTool).toBe(false);
      expect(f.aiTools).toBe(false);
    });

    it('denies admin features', () => {
      const f = getSubscriptionFeatures('free');
      expect(f.adminAccess).toBe(false);
      expect(f.userManagement).toBe(false);
      expect(f.systemSettings).toBe(false);
    });
  });

  describe('tier1 — Planner', () => {
    it('grants the planner path on top of free', () => {
      const f = getSubscriptionFeatures('tier1');
      expect(f.retirementCalculator).toBe(true);
      expect(f.watchlist).toBe(true);
      expect(f.financialCoach).toBe(true);
      expect(f.realEstate).toBe(true);
      expect(f.businessValuation).toBe(true);
      expect(f.plaidConnectionLimit).toBe(5);
    });

    it('does NOT grant the investor path', () => {
      const f = getSubscriptionFeatures('tier1');
      expect(f.stockAnalysis).toBe(false);
      expect(f.pdufaCalendar).toBe(false);
      expect(f.earningsCalendar).toBe(false);
      expect(f.portfolio).toBe(false);
      expect(f.optionsDashboard).toBe(false);
      expect(f.aiTools).toBe(false);
      expect(f.advancedAnalytics).toBe(false);
      expect(f.tradesDashboard).toBe(false);
      expect(f.discordChat).toBe(false);
    });

    it('does not include complete-tier features', () => {
      const f = getSubscriptionFeatures('tier1');
      expect(f.courseAccess).toBe(false);
      expect(f.liveSessions).toBe(false);
      expect(f.backtestingTool).toBe(false);
    });
  });

  describe('tier2 — Investor', () => {
    it('grants the investor path on top of free', () => {
      const f = getSubscriptionFeatures('tier2');
      expect(f.stockAnalysis).toBe(true);
      expect(f.pdufaCalendar).toBe(true);
      expect(f.earningsCalendar).toBe(true);
      expect(f.portfolio).toBe(true);
      expect(f.optionsDashboard).toBe(true);
      expect(f.aiTools).toBe(true);
      expect(f.advancedAnalytics).toBe(true);
      expect(f.tradesDashboard).toBe(true);
      expect(f.optionsTradingDiscord).toBe(true);
      expect(f.discordChat).toBe(true);
      expect(f.plaidConnectionLimit).toBe(5);
    });

    it('does NOT grant the planner path', () => {
      const f = getSubscriptionFeatures('tier2');
      expect(f.financialCoach).toBe(false);
      expect(f.realEstate).toBe(false);
      expect(f.businessValuation).toBe(false);
    });

    it('does not include complete-tier features', () => {
      const f = getSubscriptionFeatures('tier2');
      expect(f.courseAccess).toBe(false);
      expect(f.liveSessions).toBe(false);
      expect(f.backtestingTool).toBe(false);
    });
  });

  describe('tier3 — Complete', () => {
    it('is a superset of both parallel paths', () => {
      const f = getSubscriptionFeatures('tier3');
      // planner path
      expect(f.financialCoach).toBe(true);
      expect(f.realEstate).toBe(true);
      expect(f.businessValuation).toBe(true);
      // investor path
      expect(f.stockAnalysis).toBe(true);
      expect(f.pdufaCalendar).toBe(true);
      expect(f.earningsCalendar).toBe(true);
      expect(f.portfolio).toBe(true);
      expect(f.tradesDashboard).toBe(true);
      expect(f.discordChat).toBe(true);
      expect(f.advancedAnalytics).toBe(true);
      expect(f.aiTools).toBe(true);
      // complete-only
      expect(f.courseAccess).toBe(true);
      expect(f.liveSessions).toBe(true);
      expect(f.backtestingTool).toBe(true);
      expect(f.plaidConnectionLimit).toBe(15);
    });
  });

  describe('admin role', () => {
    it('grants admin features on top of tier features', () => {
      const f = getSubscriptionFeatures('free', 'admin');
      expect(f.adminAccess).toBe(true);
      expect(f.userManagement).toBe(true);
      expect(f.analyticsAccess).toBe(true);
      expect(f.courseManagement).toBe(true);
    });

    it('does not grant systemSettings to admin (only super_admin)', () => {
      const f = getSubscriptionFeatures('free', 'admin');
      expect(f.systemSettings).toBe(false);
    });

    it('grants systemSettings to super_admin', () => {
      const f = getSubscriptionFeatures('free', 'super_admin');
      expect(f.systemSettings).toBe(true);
    });

    it('admin on tier3 has all features', () => {
      const f = getSubscriptionFeatures('tier3', 'admin');
      expect(f.aiTools).toBe(true);
      expect(f.adminAccess).toBe(true);
    });
  });

  describe('tier invariants', () => {
    it('tier3 is a superset of every other tier for paid features', () => {
      const paidFeatures = [
        'financialCoach', 'realEstate', 'businessValuation',
        'stockAnalysis', 'pdufaCalendar', 'earningsCalendar', 'portfolio',
        'optionsDashboard', 'aiTools', 'advancedAnalytics', 'tradesDashboard',
        'optionsTradingDiscord', 'discordChat',
      ] as const;

      const complete = getSubscriptionFeatures('tier3');
      for (const tier of ['free', 'tier1', 'tier2'] as SubscriptionTier[]) {
        const f = getSubscriptionFeatures(tier);
        for (const feature of paidFeatures) {
          if (f[feature]) expect(complete[feature]).toBe(true);
        }
      }
    });

    it('planner and investor are disjoint on their exclusive features', () => {
      const planner = getSubscriptionFeatures('tier1');
      const investor = getSubscriptionFeatures('tier2');
      // no feature is true in both, other than the shared free base
      expect(planner.financialCoach && investor.financialCoach).toBe(false);
      expect(planner.stockAnalysis && investor.stockAnalysis).toBe(false);
    });

    it('every tier keeps the free base intact', () => {
      for (const tier of ['free', 'tier1', 'tier2', 'tier3'] as SubscriptionTier[]) {
        const f = getSubscriptionFeatures(tier);
        expect(f.retirementCalculator).toBe(true);
        expect(f.watchlist).toBe(true);
        expect(f.plaidConnect).toBe(true);
      }
    });
  });
});

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
});
