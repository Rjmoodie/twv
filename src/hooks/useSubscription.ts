import { useState, useEffect } from 'react';
import { useAuth } from '@/components/app/AuthProvider';
import { SubscriptionService } from '@/services/subscription';
import { SubscriptionTier, SubscriptionFeatures, getSubscriptionFeatures } from '@/types/subscription';

export interface UseSubscriptionReturn {
  // User data
  userProfile: any | null;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: string;
  isActive: boolean;
  
  // Features
  features: SubscriptionFeatures;
  
  // Loading states
  loading: boolean;
  error: string | null;
  
  // Actions
  subscribeToTier: (tier: SubscriptionTier) => Promise<void>;
  openCustomerPortal: () => Promise<void>;
  canAccessModule: (module: string) => Promise<boolean>;
  hasFeature: (feature: keyof SubscriptionFeatures) => boolean;
  refreshSubscription: () => Promise<void>;
  
  // Upgrade options
  upgradeOptions: {
    currentTier: SubscriptionTier;
    availableUpgrades: Array<{
      tier: SubscriptionTier;
      name: string;
      price: number;
      features: string[];
    }>;
  } | null;
}

export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive');
  const [isActive, setIsActive] = useState<boolean>(false);
  // Default to free-tier features while loading — never over-grant access
  const [features, setFeatures] = useState<SubscriptionFeatures>(getSubscriptionFeatures('free'));
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOptions, setUpgradeOptions] = useState<any>(null);

  const loadSubscriptionData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Parallel fetch — all three are independent
      const [status, profile, upgrades] = await Promise.all([
        SubscriptionService.getSubscriptionStatus(user.id),
        SubscriptionService.getUserProfile(user.id),
        SubscriptionService.getUpgradeOptions(user.id),
      ]);

      setSubscriptionTier(status.tier);
      setSubscriptionStatus(status.status);
      setIsActive(status.isActive);
      setFeatures(status.features);
      setUserProfile(profile);
      setUpgradeOptions(upgrades);

    } catch (err) {
      console.error('Error loading subscription data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToTier = async (tier: SubscriptionTier) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const successUrl = `${window.location.origin}/dashboard?subscription=success`;
      const cancelUrl = `${window.location.origin}/pricing?subscription=cancelled`;
      
      await SubscriptionService.subscribeToTier(tier, successUrl, cancelUrl);
    } catch (err) {
      console.error('Error subscribing to tier:', err);
      throw err;
    }
  };

  const openCustomerPortal = async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const returnUrl = `${window.location.origin}/dashboard`;
      await SubscriptionService.openCustomerPortal(returnUrl);
    } catch (err) {
      console.error('Error opening customer portal:', err);
      throw err;
    }
  };

  const canAccessModule = async (module: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      return await SubscriptionService.canAccessModule(user.id, module);
    } catch (err) {
      console.error('Error checking module access:', err);
      return false;
    }
  };

  const hasFeature = (feature: keyof SubscriptionFeatures): boolean => {
    return features[feature];
  };

  const refreshSubscription = async () => {
    await loadSubscriptionData();
  };

  useEffect(() => {
    loadSubscriptionData();
  }, [user?.id]); // use id — avoids re-firing on token refresh when user object ref changes

  // Re-sync when the user returns to the tab. Stripe webhooks may have fired while the tab was
  // in the background (e.g. after completing a checkout flow in another tab).
  useEffect(() => {
    if (!user?.id) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadSubscriptionData();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user?.id]);

  return {
    userProfile,
    subscriptionTier,
    subscriptionStatus,
    isActive,
    features,
    loading,
    error,
    subscribeToTier,
    openCustomerPortal,
    canAccessModule,
    hasFeature,
    refreshSubscription,
    upgradeOptions
  };
}
