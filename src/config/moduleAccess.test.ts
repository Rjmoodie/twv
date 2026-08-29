import { describe, it, expect } from 'vitest';
import {
  getModuleAccessStatus,
  getAccessRequirementLabel,
  getModuleRule,
  isModuleVisible,
  moduleAccessRules,
  personaLabels,
} from './moduleAccess';
import type { ModuleAccessContext } from './moduleAccess';
import type { PortalPersona } from '@/components/app/AuthProvider';
import type { User } from '@supabase/supabase-js';
import { modules } from '@/components/app/constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STUB_USER = { id: 'user-1', email: 'test@test.com' } as User;

function ctx(overrides: Partial<ModuleAccessContext> = {}): ModuleAccessContext {
  return {
    user: null,
    authLoading: false,
    accessLoading: false,
    personas: [],
    isSuperAdmin: false,
    ...overrides,
  };
}

/** A signed-in user holding exactly these personas. */
const as = (...personas: PortalPersona[]) => ctx({ user: STUB_USER, personas });

const INTERNAL_MODULES = ['crm', 'real-estate'];
const SHARED_MODULES = ['account', 'support', 'portfolio'];

// ─── Loading ──────────────────────────────────────────────────────────────────

describe('getModuleAccessStatus — loading', () => {
  it('waits for the session', () => {
    expect(getModuleAccessStatus('real-estate', ctx({ authLoading: true, user: STUB_USER }))).toBe('loading');
  });

  // Personas land on a second round trip. Deciding before they arrive would
  // flash a denial at someone who does have access.
  it('waits for personas even once the session has resolved', () => {
    expect(getModuleAccessStatus('real-estate', ctx({ user: STUB_USER, accessLoading: true }))).toBe('loading');
  });

  it('waits before answering for a module with no rule at all', () => {
    expect(getModuleAccessStatus('unknown-module', ctx({ accessLoading: true }))).toBe('loading');
  });
});

// ─── Unauthenticated ──────────────────────────────────────────────────────────

describe('getModuleAccessStatus — unauthenticated', () => {
  it('asks anyone signed out to sign in', () => {
    for (const id of [...INTERNAL_MODULES, ...SHARED_MODULES]) {
      expect(getModuleAccessStatus(id, ctx()), `module "${id}"`).toBe('unauthenticated');
    }
  });

  it('returns ok for a module with no access rule', () => {
    expect(getModuleAccessStatus('dashboard', ctx())).toBe('ok');
  });
});

// ─── Personas ─────────────────────────────────────────────────────────────────

describe('internal modules', () => {
  for (const id of INTERNAL_MODULES) {
    describe(id, () => {
      it('admin → ok', () => expect(getModuleAccessStatus(id, as('admin'))).toBe('ok'));
      it('project manager → ok', () => expect(getModuleAccessStatus(id, as('project_manager'))).toBe('ok'));
      it('investor → forbidden', () => expect(getModuleAccessStatus(id, as('investor'))).toBe('forbidden'));
      it('client → forbidden', () => expect(getModuleAccessStatus(id, as('client'))).toBe('forbidden'));
      it('no persona → forbidden', () => expect(getModuleAccessStatus(id, as())).toBe('forbidden'));
    });
  }
});

describe('shared modules', () => {
  // Portfolio is the screen an investor or client signs in for. Row-level
  // security decides what is inside it, so the module itself stays open to every
  // persona — gating it would lock them out of the whole product.
  for (const id of SHARED_MODULES) {
    describe(id, () => {
      for (const persona of ['admin', 'project_manager', 'investor', 'client'] as PortalPersona[]) {
        it(`${persona} → ok`, () => expect(getModuleAccessStatus(id, as(persona))).toBe('ok'));
      }
      it('signed in with no persona yet → ok', () => expect(getModuleAccessStatus(id, as())).toBe('ok'));
    });
  }
});

describe('super admin', () => {
  it('reaches every module regardless of persona', () => {
    const context = ctx({ user: STUB_USER, isSuperAdmin: true });
    for (const id of [...INTERNAL_MODULES, ...SHARED_MODULES]) {
      expect(getModuleAccessStatus(id, context), `module "${id}"`).toBe('ok');
    }
  });
});

// ─── Requirement label ────────────────────────────────────────────────────────

describe('getAccessRequirementLabel', () => {
  it('names the personas a denial can be resolved with', () => {
    expect(getAccessRequirementLabel(getModuleRule('crm'))).toBe('Administrator or Project Manager');
  });

  it('returns null for an auth-only module, which has no role to name', () => {
    expect(getAccessRequirementLabel(getModuleRule('account'))).toBeNull();
  });

  it('returns null for an unknown module', () => {
    expect(getAccessRequirementLabel(getModuleRule('nope'))).toBeNull();
  });
});

// ─── Rule consistency ─────────────────────────────────────────────────────────

describe('moduleAccessRules consistency', () => {
  it('every persona-gated rule carries a description for the denial screen', () => {
    for (const [id, rule] of Object.entries(moduleAccessRules)) {
      if (rule.requiredPersonas?.length) {
        expect(rule.description, `Rule "${id}" has no description`).toBeTruthy();
      }
    }
  });

  it('every named persona is a real one', () => {
    for (const [id, rule] of Object.entries(moduleAccessRules)) {
      for (const persona of rule.requiredPersonas ?? []) {
        expect(persona in personaLabels, `Rule "${id}" names unknown persona "${persona}"`).toBe(true);
      }
    }
  });

  it('a persona-gated rule always requires auth — personas imply a session', () => {
    for (const [id, rule] of Object.entries(moduleAccessRules)) {
      if (rule.requiredPersonas?.length) {
        expect(rule.requiresAuth, `Rule "${id}" gates on persona without requiring auth`).toBe(true);
      }
    }
  });

  // Regression guard for the model swap: access follows what someone is to the
  // firm, not what they have paid. A rule reintroducing a billing concept would
  // put the firm's own staff back behind a paywall.
  it('names no subscription concept', () => {
    for (const [id, rule] of Object.entries(moduleAccessRules)) {
      const keys = Object.keys(rule);
      for (const banned of ['requiredFeature', 'minimumTier', 'highlightTier']) {
        expect(keys, `Rule "${id}" still gates on billing via "${banned}"`).not.toContain(banned);
      }
    }
  });

  // The rule set drifted once already: rules for lead-gen and
  // expanded-data-sources outlived the modules themselves, so they gated
  // nothing while looking like policy. Tie every rule to the registry.
  it('every rule names a module that is actually registered', () => {
    const registered = new Set(modules.map((module) => module.id));
    for (const id of Object.keys(moduleAccessRules)) {
      expect(registered.has(id), `Rule "${id}" has no module in the registry`).toBe(true);
    }
  });

  it('names no module removed with the non-real-estate cut', () => {
    const cut = [
      'stock-analysis', 'options-dashboard', 'pdufa', 'earnings', 'watchlist',
      'business-valuation', 'cash-flow', 'retirement-planning', 'financial-coach',
      'ai-tools', 'journey', 'community', 'personal-finance', 'courses',
      'trades', 'trades-dashboard',
    ];
    for (const id of cut) {
      expect(moduleAccessRules[id], `Rule "${id}" survives for a deleted module`).toBeUndefined();
    }
  });
});

// ─── Navigation visibility ────────────────────────────────────────────────────
//
// What each viewer is shown, as distinct from what they may open. Persona-gated
// modules are hidden rather than padlocked, because a padlock reads as an
// invitation and nothing a client or a visitor can do will ever open CRM.

/** Every module id that would appear in navigation for this viewer. */
const visibleTo = (context: ModuleAccessContext) =>
  modules.filter((module) => isModuleVisible(module.id, context)).map((module) => module.id);

describe('isModuleVisible — the three views', () => {
  it('anonymous: no internal module names, shared ones stay (locked in the UI)', () => {
    const shown = visibleTo(ctx());
    expect(shown).toContain('dashboard');
    for (const id of SHARED_MODULES) expect(shown).toContain(id);
    for (const id of INTERNAL_MODULES) expect(shown).not.toContain(id);
  });

  it('client: sees the shared surface only', () => {
    const shown = visibleTo(as('client'));
    for (const id of SHARED_MODULES) expect(shown).toContain(id);
    for (const id of INTERNAL_MODULES) expect(shown).not.toContain(id);
  });

  it('investor: same as client — neither can ever hold an internal persona', () => {
    expect(visibleTo(as('investor'))).toEqual(visibleTo(as('client')));
  });

  it('project manager: sees everything', () => {
    const shown = visibleTo(as('project_manager'));
    for (const id of [...SHARED_MODULES, ...INTERNAL_MODULES]) expect(shown).toContain(id);
  });

  it('admin persona sees everything too', () => {
    const shown = visibleTo(as('admin'));
    for (const id of INTERNAL_MODULES) expect(shown).toContain(id);
  });

  it('super admin sees everything without holding any persona', () => {
    const shown = visibleTo(ctx({ user: STUB_USER, isSuperAdmin: true }));
    for (const id of INTERNAL_MODULES) expect(shown).toContain(id);
  });

  it('hides internal modules while personas are still resolving', () => {
    // Revealing then retracting would flash `CRM` at a client mid-load.
    const shown = visibleTo(ctx({ user: STUB_USER, accessLoading: true }));
    for (const id of INTERNAL_MODULES) expect(shown).not.toContain(id);
  });

  it('visibility never widens what may actually be opened', () => {
    for (const persona of ['client', 'investor', 'project_manager', 'admin'] as PortalPersona[]) {
      const context = as(persona);
      for (const module of modules) {
        if (isModuleVisible(module.id, context) && moduleAccessRules[module.id]?.requiredPersonas) {
          expect(getModuleAccessStatus(module.id, context)).toBe('ok');
        }
      }
    }
  });
});
