/**
 * useSubscriptionGating
 *
 * Provides subscription-based feature gating for enterprise components.
 * Maps legacy feature names to the canonical SubscriptionFeatures system
 * so callers don't need to be updated.
 *
 * Uses SubscriptionService (reads from user_profiles DB) — no Stripe calls.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/app/AuthProvider';
import { SubscriptionService } from '@/services/subscription';
import { getSubscriptionFeatures, type SubscriptionFeatures } from '@/types/subscription';

/** Legacy feature names used by enterprise components */
export interface LegacySubscriptionFeatures {
  advanced_analytics: boolean;
  unlimited_saves: boolean;
  priority_support: boolean;
  white_label: boolean;
}

export interface SubscriptionData {
  subscribed: boolean;
  /** Canonical tier name ('free' | 'tier1' | 'tier2' | 'tier3') */
  subscription_tier: 'free' | 'tier1' | 'tier2' | 'tier3';
  subscription_end?: string;
  features_enabled: LegacySubscriptionFeatures;
  usage_limits: {
    monthly_calculations: number;
    saved_projects: number;
    export_reports: number;
  };
}

/** Map canonical SubscriptionFeatures to the legacy shape enterprise components expect */
function toLegacyFeatures(f: SubscriptionFeatures): LegacySubscriptionFeatures {
  return {
    advanced_analytics: f.advancedAnalytics,  // Tier 2+
    unlimited_saves: f.advancedAnalytics,       // Tier 2+
    priority_support: f.courseAccess,           // Tier 3+
    white_label: f.aiTools,                     // Tier 3+
  };
}

function toUsageLimits(f: SubscriptionFeatures) {
  if (f.aiTools) {
    return { monthly_calculations: -1, saved_projects: -1, export_reports: -1 };
  }
  if (f.advancedAnalytics) {
    return { monthly_calculations: 1000, saved_projects: 100, export_reports: 50 };
  }
  return { monthly_calculations: 100, saved_projects: 10, export_reports: 5 };
}

const FREE_DATA: SubscriptionData = {
  subscribed: false,
  subscription_tier: 'free',
  features_enabled: { advanced_analytics: false, unlimited_saves: false, priority_support: false, white_label: false },
  usage_limits: { monthly_calculations: 100, saved_projects: 10, export_reports: 5 },
};

export const useSubscriptionGating = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSubscription = async () => {
    try {
      setLoading(true);

      if (!user) {
        setSubscription(FREE_DATA);
        return;
      }

      const profile = await SubscriptionService.getUserProfile(user.id);

      if (!profile) {
        setSubscription(FREE_DATA);
        return;
      }

      const features = getSubscriptionFeatures(profile.subscriptionTier, profile.role);
      const isActive =
        profile.subscriptionStatus === 'active' || profile.subscriptionStatus === 'past_due';

      setSubscription({
        subscribed: isActive && profile.subscriptionTier !== 'free',
        subscription_tier: profile.subscriptionTier,
        subscription_end: profile.subscriptionEndsAt ?? undefined,
        features_enabled: toLegacyFeatures(features),
        usage_limits: toUsageLimits(features),
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscription(FREE_DATA);
    } finally {
      setLoading(false);
    }
  };

  const hasFeature = (feature: keyof LegacySubscriptionFeatures): boolean =>
    subscription?.features_enabled[feature] ?? false;

  const canAccessFeature = (requiredTier: 'free' | 'tier1' | 'tier2' | 'tier3' | 'professional' | 'enterprise'): boolean => {
    if (!subscription) return false;
    const tierOrder: Record<string, number> = {
      free: 0, tier1: 1, professional: 1, tier2: 2, tier3: 3, enterprise: 3,
    };
    return (tierOrder[subscription.subscription_tier] ?? 0) >= (tierOrder[requiredTier] ?? 0);
  };

  const isWithinUsageLimit = (
    featureType: 'monthly_calculations' | 'saved_projects' | 'export_reports',
    currentUsage: number
  ): boolean => {
    if (!subscription) return false;
    const limit = subscription.usage_limits[featureType];
    return limit === -1 || currentUsage < limit;
  };

  useEffect(() => {
    checkSubscription();
  }, [user]);

  return {
    subscription,
    loading,
    hasFeature,
    canAccessFeature,
    isWithinUsageLimit,
    refreshSubscription: checkSubscription,
  };
};
