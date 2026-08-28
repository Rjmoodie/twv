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
    expect(getModuleAccessStatus('real-estate', ctx)).toBe('loading');
  });

  it('returns loading when subscriptionLoading is true', () => {
    const ctx = makeCtx({ subscriptionLoading: true, user: STUB_USER });
    expect(getModuleAccessStatus('real-estate', ctx)).toBe('loading');
  });
});

// ─── Unauthenticated ──────────────────────────────────────────────────────────

describe('getModuleAccessStatus — unauthenticated', () => {
  it('returns unauthenticated for auth-required modules when no user', () => {
    expect(getModuleAccessStatus('real-estate', makeCtx())).toBe('unauthenticated');
    expect(getModuleAccessStatus('lead-gen', makeCtx())).toBe('unauthenticated');
    expect(getModuleAccessStatus('account', makeCtx())).toBe('unauthenticated');
  });

  it('returns ok for modules with no access rule', () => {
    expect(getModuleAccessStatus('some-unknown-module', makeCtx())).toBe('ok');
  });
});

// ─── Admin bypass ─────────────────────────────────────────────────────────────

describe('getModuleAccessStatus — admin bypass', () => {
  it('admin always gets ok regardless of tier', () => {
    const ctx = makeCtx({ user: STUB_USER, isAdmin: true, subscriptionTier: 'free' });
    expect(getModuleAccessStatus('real-estate', ctx)).toBe('ok');
    expect(getModuleAccessStatus('lead-gen', ctx)).toBe('ok');
    expect(getModuleAccessStatus('expanded-data-sources', ctx)).toBe('ok');
  });
});

// ─── Tier-based access ────────────────────────────────────────────────────────
//
// The tier model is two parallel paths, not a ladder:
//   tier1 Planner  → real-estate
//   tier2 Investor → lead-gen, expanded-data-sources
//   tier3 Complete → both paths
// A Planner does NOT get Investor modules and vice versa.
//
// This model is inherited from somatech and is due to be replaced by the
// Investor / PM / Admin role split before any domain table lands. Until then
// these tests guard the behaviour that ships.

describe('getModuleAccessStatus — Investor path (tier2)', () => {
  const investorModules = ['lead-gen', 'expanded-data-sources'];

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
  const plannerModules = ['real-estate'];

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
  it('account needs a user but no paid tier', () => {
    expect(getModuleAccessStatus('account', makeCtx())).toBe('unauthenticated');
    expect(getModuleAccessStatus('account', ctxForTier('free'))).toBe('ok');
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

  // Every gated module must still exist in the registry (or be a sub-surface
  // rendered inside one). A rule for a deleted module silently gates nothing.
  it('names no module that was removed with the non-real-estate cut', () => {
    const cut = [
      'stock-analysis', 'options-dashboard', 'pdufa', 'earnings', 'watchlist',
      'portfolio', 'business-valuation', 'cash-flow', 'retirement-planning',
      'financial-coach', 'ai-tools', 'journey', 'community', 'personal-finance',
      'courses', 'trades', 'trades-dashboard',
    ];
    for (const id of cut) {
      expect(moduleAccessRules[id], `Rule "${id}" survives for a deleted module`).toBeUndefined();
    }
  });
});
