import { supabase } from '@/integrations/supabase/client';
import { SubscriptionTier, UserRole, UserProfile, getSubscriptionFeatures, SubscriptionFeatures, SUBSCRIPTION_PLANS } from '@/types/subscription';
import { StripeAPI } from '@/api/stripe';

// A single render pass fans out into ~6 getUserProfile calls (AuthProvider,
// useSubscriptionGating, and useSubscription's parallel status/profile/upgrades
// fetch). They all want the same row, so collapse them onto one request.
const PROFILE_CACHE_TTL_MS = 5_000;
const profileCache = new Map<string, { at: number; promise: Promise<UserProfile | null> }>();

export class SubscriptionService {
  /**
   * Fetch user's real profile from user_profiles table.
   * Falls back to a free/user profile if no row exists yet (e.g. before the
   * on_auth_user_created trigger fires on first sign-up).
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    const cached = profileCache.get(userId);
    if (cached && Date.now() - cached.at < PROFILE_CACHE_TTL_MS) {
      return cached.promise;
    }

    const promise = this.fetchUserProfile(userId).catch((error) => {
      profileCache.delete(userId);
      throw error;
    });
    profileCache.set(userId, { at: Date.now(), promise });
    return promise;
  }

  /** Drop the cached profile so the next read hits the DB (e.g. after checkout). */
  static clearUserProfileCache(userId?: string): void {
    if (userId) profileCache.delete(userId);
    else profileCache.clear();
  }

  private static async fetchUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      // maybeSingle(), not single(): single() asks PostgREST for
      // `application/vnd.pgrst.object+json`, which answers 406 when the row is
      // missing. That's a normal state here (profile row not created yet), and
      // the 406 shows up as a failed request in the browser console.
      const { data, error } = await supabase
        .from('user_profiles')
        .select(
          'id, email, name, subscription_tier, role, stripe_customer_id, discord_id, discord_username, subscription_status, subscription_ends_at, created_at, updated_at'
        )
        .eq('id', userId)
        .maybeSingle();

      // No row yet, or the table/columns aren't migrated on this environment.
      // 42P01 = undefined_table, 42703 = undefined_column.
      if (!data && (!error || error.code === '42P01' || error.code === '42703')) {
        if (error) console.warn('user_profiles unavailable, using free tier:', error.message);
        const { data: authUser } = await supabase.auth.getUser();
        return {
          id: userId,
          email: authUser?.user?.email ?? '',
          name: authUser?.user?.user_metadata?.full_name ?? '',
          subscriptionTier: 'free',
          role: 'user',
          stripeCustomerId: null,
          discordId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          subscriptionStatus: 'active',
          subscriptionEndsAt: null
        };
      }

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return {
        id: data.id,
        email: data.email,
        name: data.name ?? '',
        subscriptionTier: (data.subscription_tier ?? 'free') as SubscriptionTier,
        role: (data.role ?? 'user') as UserRole,
        stripeCustomerId: data.stripe_customer_id ?? null,
        discordId: data.discord_id ?? null,
        discordUsername: data.discord_username ?? undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        subscriptionStatus: (data.subscription_status ?? 'active') as UserProfile['subscriptionStatus'],
        subscriptionEndsAt: data.subscription_ends_at ?? null
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Derive feature flags from the user's real tier + role.
   */
  static async getUserFeatures(userId: string): Promise<SubscriptionFeatures> {
    const profile = await this.getUserProfile(userId);
    if (!profile) return getSubscriptionFeatures('free', 'user');

    // Subscriptions that are past_due still retain access during grace period;
    // canceled/unpaid subscriptions fall back to free.
    const effectiveTier: SubscriptionTier =
      profile.subscriptionStatus === 'canceled' || profile.subscriptionStatus === 'unpaid'
        ? 'free'
        : profile.subscriptionTier;

    return getSubscriptionFeatures(effectiveTier, profile.role);
  }

  /**
   * Check if user has access to a specific feature.
   */
  static async hasFeature(userId: string, feature: keyof SubscriptionFeatures): Promise<boolean> {
    try {
      const features = await this.getUserFeatures(userId);
      return features[feature] ?? false;
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  /**
   * Initiate a Stripe Checkout session for the given tier.
   */
  static async subscribeToTier(
    tier: SubscriptionTier,
    successUrl: string,
    cancelUrl: string
  ): Promise<void> {
    if (tier === 'free') {
      throw new Error('Cannot subscribe to free tier');
    }

    try {
      await StripeAPI.redirectToCheckout({ tier, successUrl, cancelUrl });
    } catch (error) {
      console.error('Error subscribing to tier:', error);
      throw error;
    }
  }

  /**
   * Open the Stripe Customer Portal for subscription management.
   */
  static async openCustomerPortal(returnUrl: string): Promise<void> {
    try {
      await StripeAPI.redirectToPortal({ returnUrl });
    } catch (error) {
      console.error('Error opening customer portal:', error);
      throw error;
    }
  }

  /**
   * Get subscription status for display in UI.
   */
  static async getSubscriptionStatus(userId: string): Promise<{
    tier: SubscriptionTier;
    status: string;
    isActive: boolean;
    features: SubscriptionFeatures;
  }> {
    const profile = await this.getUserProfile(userId);
    const features = await this.getUserFeatures(userId);

    if (!profile) {
      return {
        tier: 'free',
        status: 'inactive',
        isActive: false,
        features: getSubscriptionFeatures('free')
      };
    }

    const isActive =
      (profile.subscriptionStatus === 'active' || profile.subscriptionStatus === 'past_due') &&
      profile.subscriptionTier !== 'free';

    return {
      tier: profile.subscriptionTier,
      status: profile.subscriptionStatus,
      isActive,
      features
    };
  }

  /**
   * Check if user can access a specific module.
   */
  static async canAccessModule(userId: string, module: string): Promise<boolean> {
    const features = await this.getUserFeatures(userId);

    switch (module) {
      case 'stock-analysis':
        return features.stockAnalysis;
      case 'retirement-calculator':
      case 'watchlist':
      case 'earnings-calendar':
      case 'personal-finance':
      case 'net-worth':
      case 'cash-flow-personal':
        return true; // Free tier features
      case 'pdufa':
      case 'pdufa-calendar':
        return features.pdufaCalendar;
      case 'trades-dashboard':
        return features.tradesDashboard;
      case 'options-trading-discord':
        return features.optionsTradingDiscord;
      case 'discord-chat':
        return features.discordChat;
      case 'advanced-analytics':
        return features.advancedAnalytics;
      case 'course-access':
      case 'lms':
        return features.courseAccess;
      case 'live-sessions':
        return features.liveSessions;
      case 'backtesting-tool':
        return features.backtestingTool;
      case 'ai-tools':
      case 'thesis':
      case 'risk-scan':
      case 'screener':
        return features.aiTools;
      default:
        return false;
    }
  }

  /**
   * Get available upgrade options for the user's current tier.
   */
  static async getUpgradeOptions(userId: string): Promise<{
    currentTier: SubscriptionTier;
    availableUpgrades: Array<{
      tier: SubscriptionTier;
      name: string;
      price: number;
      features: string[];
    }>;
  }> {
    const profile = await this.getUserProfile(userId);
    const currentTier = profile?.subscriptionTier ?? 'free';

    const upgradeMap: Record<SubscriptionTier, SubscriptionTier[]> = {
      free: ['tier1', 'tier2', 'tier3'],
      tier1: ['tier2', 'tier3'],
      tier2: ['tier3'],
      tier3: []
    };

    const availableUpgrades = upgradeMap[currentTier].map(tier => {
      const plan = SUBSCRIPTION_PLANS[tier];
      return { tier, name: plan.name, price: plan.price, features: plan.features };
    });

    return { currentTier, availableUpgrades };
  }

  /**
   * Force-refresh a user's subscription by invalidating cached data.
   * Typically called after a successful Stripe checkout redirect.
   */
  static async syncUserProfile(userId: string): Promise<void> {
    // Profile is read live from the DB; nothing to sync client-side beyond
    // dropping the short-lived read cache so the new tier is picked up at once.
    // The Stripe webhook (stripe-webhook edge function) is the authoritative writer.
    this.clearUserProfileCache(userId);
  }
}
