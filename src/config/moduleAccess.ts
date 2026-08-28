import type { User } from '@supabase/supabase-js';
import type { SubscriptionTier, SubscriptionFeatures } from '@/types/subscription';
import type { Module } from '@/components/somatech/types';

export interface ModuleAccessRule {
  requiresAuth?: boolean;
  requiredFeature?: keyof SubscriptionFeatures;
  minimumTier?: SubscriptionTier;
  description?: string;
  highlightTier?: SubscriptionTier;
}

export const tierLabels: Record<SubscriptionTier, string> = {
  free: 'Free',
  tier1: 'Planner',
  tier2: 'Investor',
  tier3: 'Complete',
};

const tierOrder: Record<SubscriptionTier, number> = {
  free: 0,
  tier1: 1,
  tier2: 2,
  tier3: 3,
};

export type ModuleAccessStatus = 'ok' | 'loading' | 'unauthenticated' | 'upgrade';

export interface ModuleAccessContext {
  user: User | null;
  authLoading: boolean;
  subscriptionLoading: boolean;
  hasFeature: (feature: keyof SubscriptionFeatures) => boolean;
  subscriptionTier: SubscriptionTier;
  isAdmin: boolean;
}

export const moduleAccessRules: Record<string, ModuleAccessRule> = {
  // ── Auth only (free tier) ────────────────────────────────────────────────
  account: {
    requiresAuth: true,
    description: 'Sign in to update your profile, security preferences, and notification settings.',
  },
  watchlist: {
    requiresAuth: true,
    description: 'Sign in to sync your personalized watchlist across devices.',
  },

  // ── Planner path ─────────────────────────────────────────────────────────
  'real-estate': {
    requiresAuth: true,
    requiredFeature: 'realEstate',
    highlightTier: 'tier1',
    description: 'Access the BRRRR calculator, deal sourcing, and rental analysis tools — included in the Planner plan.',
  },
  'financial-coach': {
    requiresAuth: true,
    requiredFeature: 'financialCoach',
    highlightTier: 'tier1',
    description: 'Get personalised AI financial coaching based on academic research — included in the Planner plan.',
  },
  'business-valuation': {
    requiresAuth: true,
    requiredFeature: 'businessValuation',
    highlightTier: 'tier1',
    description: 'Access professional business valuation and DCF analysis tools — included in the Planner plan.',
  },

  // ── Investor path ─────────────────────────────────────────────────────────
  'stock-analysis': {
    requiresAuth: true,
    requiredFeature: 'stockAnalysis',
    highlightTier: 'tier2',
    description: 'Unlock comprehensive stock research and technical analysis — included in the Investor plan.',
  },
  pdufa: {
    requiresAuth: true,
    requiredFeature: 'pdufaCalendar',
    highlightTier: 'tier2',
    description: 'Track FDA decision dates and get automated alerts — included in the Investor plan.',
  },
  earnings: {
    requiresAuth: true,
    requiredFeature: 'earningsCalendar',
    highlightTier: 'tier2',
    description: 'Monitor earnings announcements and analyst estimates — included in the Investor plan.',
  },
  portfolio: {
    requiresAuth: true,
    requiredFeature: 'portfolio',
    highlightTier: 'tier2',
    description: 'Build and score goal-based portfolios with EDGAR-backed research — included in the Investor plan.',
  },
  'options-dashboard': {
    requiresAuth: true,
    requiredFeature: 'optionsDashboard',
    highlightTier: 'tier2',
    description: 'Unlock real-time greeks, institutional flow, and options strategy tools — included in the Investor plan.',
  },
  'ai-tools': {
    requiresAuth: true,
    requiredFeature: 'aiTools',
    highlightTier: 'tier2',
    description: 'AI-powered thesis builder, portfolio risk scan, and stock screener — included in the Investor plan.',
  },

  // ── Complete ──────────────────────────────────────────────────────────────
  courses: {
    requiresAuth: true,
    requiredFeature: 'courseAccess',
    highlightTier: 'tier3',
    description: 'Full course library and live cohorts — included in the Complete plan.',
  },

  // ── Legacy / internal ─────────────────────────────────────────────────────
  'trades-dashboard': {
    requiresAuth: true,
    requiredFeature: 'tradesDashboard',
    highlightTier: 'tier2',
    description: 'Monitor your trades with entry/exit analysis and performance metrics — included in the Investor plan.',
  },
  trades: {
    requiresAuth: true,
    requiredFeature: 'tradesDashboard',
    highlightTier: 'tier2',
    description: 'Unlock the trades dashboard and broker connections — included in the Investor plan.',
  },
  'lead-gen': {
    requiresAuth: true,
    requiredFeature: 'advancedAnalytics',
    highlightTier: 'tier2',
    description: 'Access live real estate intelligence and property lead exports — included in the Investor plan.',
  },
  'expanded-data-sources': {
    requiresAuth: true,
    requiredFeature: 'aiTools',
    highlightTier: 'tier2',
    description: 'Unlock premium data integrations and AI-powered sourcing workflows — included in the Investor plan.',
  },
};

export const getModuleAccessStatus = (
  moduleId: string,
  context: ModuleAccessContext,
): ModuleAccessStatus => {
  const rule = moduleAccessRules[moduleId];
  const { user, authLoading, subscriptionLoading, hasFeature, subscriptionTier, isAdmin } = context;

  if (!rule) {
    if (authLoading || subscriptionLoading) {
      return 'loading';
    }
    return 'ok';
  }

  if (authLoading || subscriptionLoading) {
    return 'loading';
  }

  if (rule.requiresAuth && !user && !isAdmin) {
    return 'unauthenticated';
  }

  if (isAdmin) {
    return 'ok';
  }

  if (rule.requiredFeature) {
    if (hasFeature(rule.requiredFeature)) {
      return 'ok';
    }
    return 'upgrade';
  }

  if (rule.minimumTier && tierOrder[subscriptionTier] < tierOrder[rule.minimumTier]) {
    return 'upgrade';
  }

  return 'ok';
};

export const getModuleRule = (moduleId: string): ModuleAccessRule | undefined =>
  moduleAccessRules[moduleId];

export const getRequiredTierLabel = (rule?: ModuleAccessRule): string | null => {
  if (!rule) return null;
  if (rule.highlightTier) {
    return tierLabels[rule.highlightTier];
  }
  if (rule.minimumTier) {
    return tierLabels[rule.minimumTier];
  }
  return null;
};

export const moduleRequiresAccessControl = (module: Module): boolean =>
  Boolean(moduleAccessRules[module.id]);

