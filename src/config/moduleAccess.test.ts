import { describe, it, expect } from 'vitest';
import { getModuleAccessStatus, moduleAccessRules } from './moduleAccess';
import { getSubscriptionFeatures } from '@/types/subscription';
import type { ModuleAccessContext } from './moduleAccess';
import type { User } from '@supabase/supabase-js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STUB_USER = { id: 'user-1', email: 'test@test.com' } as User;

function makeCtx(
  overrides: Partial<ModuleAccessContext> = {}
): ModuleAccessContext {
  return {
    user: null,
    authLoading: false,
    subscriptionLoading: false,
    hasFeature: () => false,
    subscriptionTier: 'free',
    isAdmin: false,
    ...overrides,
  };
}

function ctxForTier(tier: 'free' | 'tier1' | 'tier2' | 'tier3'): ModuleAccessContext {
  const features = getSubscriptionFeatures(tier);
  return makeCtx({
    user: STUB_USER,
    subscriptionTier: tier,
    hasFeature: (f) => features[f] ?? false,
  });
}

// ─── Loading state ────────────────────────────────────────────────────────────

describe('getModuleAccessStatus — loading', () => {
  it('returns loading when authLoading is true', () => {
    const ctx = makeCtx({ authLoading: true, user: STUB_USER });
    expect(getModuleAccessStatus('stock-analysis', ctx)).toBe('loading');
  });

  it('returns loading when subscriptionLoading is true', () => {
    const ctx = makeCtx({ subscriptionLoading: true, user: STUB_USER });
    expect(getModuleAccessStatus('stock-analysis', ctx)).toBe('loading');
  });
});

// ─── Unauthenticated ──────────────────────────────────────────────────────────

describe('getModuleAccessStatus — unauthenticated', () => {
  it('returns unauthenticated for auth-required modules when no user', () => {
    expect(getModuleAccessStatus('stock-analysis', makeCtx())).toBe('unauthenticated');
    expect(getModuleAccessStatus('pdufa', makeCtx())).toBe('unauthenticated');
    expect(getModuleAccessStatus('trades', makeCtx())).toBe('unauthenticated');
  });

  it('returns ok for modules with no access rule', () => {
    expect(getModuleAccessStatus('some-unknown-module', makeCtx())).toBe('ok');
  });
});

// ─── Admin bypass ─────────────────────────────────────────────────────────────

describe('getModuleAccessStatus — admin bypass', () => {
  it('admin always gets ok regardless of tier', () => {
    const ctx = makeCtx({ user: STUB_USER, isAdmin: true, subscriptionTier: 'free' });
    expect(getModuleAccessStatus('stock-analysis', ctx)).toBe('ok');
    expect(getModuleAccessStatus('courses', ctx)).toBe('ok');
    expect(getModuleAccessStatus('expanded-data-sources', ctx)).toBe('ok');
  });
});

// ─── Tier-based access ────────────────────────────────────────────────────────
// ─── Tier-based access ────────────────────────────────────────────────────────
//
// The tier model is two parallel paths, not a ladder:
//   tier1 Planner  → financial-coach, real-estate, business-valuation
//   tier2 Investor → stock-analysis, pdufa, earnings, portfolio, options, trades, lead-gen
//   tier3 Complete → both paths + courses
// A Planner does NOT get Investor modules and vice versa.

describe('getModuleAccessStatus — Investor path (tier2)', () => {
  const investorModules = [
    'stock-analysis', 'pdufa', 'earnings', 'portfolio',
    'options-dashboard', 'ai-tools', 'trades', 'trades-dashboard',
    'lead-gen', 'expanded-data-sources',
  ];

  for (const id of investorModules) {
    describe(id, () => {
      it('free  → upgrade', () => expect(getModuleAccessStatus(id, ctxForTier('free'))).toBe('upgrade'));
      it('tier1 → upgrade', () => expect(getModuleAccessStatus(id, ctxForTier('tier1'))).toBe('upgrade'));
      it('tier2 → ok',      () => expect(getModuleAccessStatus(id, ctxForTier('tier2'))).toBe('ok'));
      it('tier3 → ok',      () => expect(getModuleAccessStatus(id, ctxForTier('tier3'))).toBe('ok'));
    });
  }
});

describe('getModuleAccessStatus — Planner path (tier1)', () => {
  const plannerModules = ['financial-coach', 'real-estate', 'business-valuation'];

  for (const id of plannerModules) {
    describe(id, () => {
      it('free  → upgrade', () => expect(getModuleAccessStatus(id, ctxForTier('free'))).toBe('upgrade'));
      it('tier1 → ok',      () => expect(getModuleAccessStatus(id, ctxForTier('tier1'))).toBe('ok'));
      it('tier2 → upgrade', () => expect(getModuleAccessStatus(id, ctxForTier('tier2'))).toBe('upgrade'));
      // Regression guard: Complete must include the Planner path. Building
      // `complete` as { ...planner, ...investor } silently reset these to false.
      it('tier3 → ok',      () => expect(getModuleAccessStatus(id, ctxForTier('tier3'))).toBe('ok'));
    });
  }
});

describe('getModuleAccessStatus — Complete path (tier3)', () => {
  describe('courses', () => {
    it('tier1 → upgrade', () => expect(getModuleAccessStatus('courses', ctxForTier('tier1'))).toBe('upgrade'));
    it('tier2 → upgrade', () => expect(getModuleAccessStatus('courses', ctxForTier('tier2'))).toBe('upgrade'));
    it('tier3 → ok',      () => expect(getModuleAccessStatus('courses', ctxForTier('tier3'))).toBe('ok'));
  });

  it('tier3 unlocks every gated module', () => {
    for (const id of Object.keys(moduleAccessRules)) {
      const rule = moduleAccessRules[id];
      if (!rule.requiredFeature) continue;   // auth-only modules
      expect(getModuleAccessStatus(id, ctxForTier('tier3')), `module "${id}" locked for Complete`).toBe('ok');
    }
  });
});

// ─── Auth-only modules ────────────────────────────────────────────────────────

describe('auth-only modules', () => {
  it('watchlist and account need a user but no paid tier', () => {
    expect(getModuleAccessStatus('watchlist', makeCtx())).toBe('unauthenticated');
    expect(getModuleAccessStatus('watchlist', ctxForTier('free'))).toBe('ok');
    expect(getModuleAccessStatus('account',   ctxForTier('free'))).toBe('ok');
  });
});

// ─── Rule consistency ─────────────────────────────────────────────────────────

describe('moduleAccessRules consistency', () => {
  it('every rule with a minimumTier above free also names a requiredFeature', () => {
    for (const [id, rule] of Object.entries(moduleAccessRules)) {
      if (rule.minimumTier && rule.minimumTier !== 'free') {
        expect(rule.requiredFeature, `Rule "${id}" has minimumTier but no requiredFeature`).toBeDefined();
      }
    }
  });

  it('trades is gated on tradesDashboard, not advancedAnalytics', () => {
    expect(moduleAccessRules['trades'].requiredFeature).toBe('tradesDashboard');
  });

  it('every rule requiring auth carries a description for the upgrade prompt', () => {
    for (const [id, rule] of Object.entries(moduleAccessRules)) {
      if (rule.requiredFeature) {
        expect(rule.description, `Rule "${id}" has no description`).toBeTruthy();
      }
    }
  });

  it('every requiredFeature is a real feature flag', () => {
    const free = getSubscriptionFeatures('free');
    for (const [id, rule] of Object.entries(moduleAccessRules)) {
      if (rule.requiredFeature) {
        expect(rule.requiredFeature in free, `Rule "${id}" names unknown feature "${rule.requiredFeature}"`).toBe(true);
      }
    }
  });
});
