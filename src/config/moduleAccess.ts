import type { User } from '@supabase/supabase-js';
import type { SubscriptionTier } from '@/types/subscription';
import type { PortalPersona } from '@/components/app/AuthProvider';
import type { Module } from '@/components/app/types';

/**
 * Who may open a module.
 *
 * This used to gate on subscription feature flags inherited from the somatech
 * codebase, which meant the firm's own principals were asked to buy a plan
 * before they could open the underwriting calculator. TW Ventures is an
 * internal operations platform: access follows what someone is to the firm, not
 * what they have paid.
 *
 * Personas come from real `organization_members` and `project_members` rows via
 * AuthProvider, and are the same ones the portals and CRM already enforce.
 * Stripe stays — it bills fee engagements — but it no longer decides who sees
 * what.
 */
export interface ModuleAccessRule {
  requiresAuth?: boolean;
  /** Holding any one of these grants access. Omit for auth-only modules. */
  requiredPersonas?: PortalPersona[];
  description?: string;
}

export const personaLabels: Record<PortalPersona, string> = {
  admin: 'Administrator',
  project_manager: 'Project Manager',
  investor: 'Investor',
  client: 'Client',
};

/** Billing plan names. Used by the pricing surface, never by module access. */
export const tierLabels: Record<SubscriptionTier, string> = {
  free: 'Free',
  tier1: 'Underwriting',
  tier2: 'Investor',
  tier3: 'Complete',
};

export type ModuleAccessStatus = 'ok' | 'loading' | 'unauthenticated' | 'forbidden';

export interface ModuleAccessContext {
  user: User | null;
  authLoading: boolean;
  accessLoading: boolean;
  personas: PortalPersona[];
  /** Platform-owner bypass from `user_profiles.role`, distinct from the admin persona. */
  isSuperAdmin: boolean;
}

const INTERNAL: PortalPersona[] = ['admin', 'project_manager'];

export const moduleAccessRules: Record<string, ModuleAccessRule> = {
  // ── Signed in, any persona ───────────────────────────────────────────────
  // Portfolio is the shared surface. Every persona sees it and row-level
  // security decides what is inside, so gating the module itself would hide the
  // one screen an investor or client signs in for.
  account:   { requiresAuth: true },
  support:   { requiresAuth: true },
  portfolio: { requiresAuth: true },

  // ── Internal only ────────────────────────────────────────────────────────
  crm: {
    requiresAuth: true,
    requiredPersonas: INTERNAL,
    description: 'Contacts and communication history are internal to the firm.',
  },
  'real-estate': {
    requiresAuth: true,
    requiredPersonas: INTERNAL,
    description: 'Underwriting is internal — it exposes deal economics before a deal is won.',
  },
};

export const getModuleAccessStatus = (
  moduleId: string,
  context: ModuleAccessContext,
): ModuleAccessStatus => {
  const rule = moduleAccessRules[moduleId];
  const { user, authLoading, accessLoading, personas, isSuperAdmin } = context;

  if (!rule) {
    return authLoading || accessLoading ? 'loading' : 'ok';
  }

  // Personas arrive on a second round trip after the session resolves. Deciding
  // before they land would flash a denial at someone who does have access.
  if (authLoading || accessLoading) {
    return 'loading';
  }

  if (rule.requiresAuth && !user && !isSuperAdmin) {
    return 'unauthenticated';
  }

  if (isSuperAdmin) {
    return 'ok';
  }

  if (rule.requiredPersonas?.length) {
    return rule.requiredPersonas.some((persona) => personas.includes(persona)) ? 'ok' : 'forbidden';
  }

  return 'ok';
};

export const getModuleRule = (moduleId: string): ModuleAccessRule | undefined =>
  moduleAccessRules[moduleId];

/** "Administrator or Project Manager" — what a denial tells the reader they need. */
export const getAccessRequirementLabel = (rule?: ModuleAccessRule): string | null => {
  if (!rule?.requiredPersonas?.length) return null;
  return rule.requiredPersonas.map((persona) => personaLabels[persona]).join(' or ');
};

export const moduleRequiresAccessControl = (module: Module): boolean =>
  Boolean(moduleAccessRules[module.id]);
