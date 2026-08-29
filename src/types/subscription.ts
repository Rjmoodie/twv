export type SubscriptionTier = 'free' | 'tier1' | 'tier2' | 'tier3';
export type UserRole = 'user' | 'admin' | 'super_admin';

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  stripePriceId: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  subscriptionTier: SubscriptionTier;
  role: UserRole;
  stripeCustomerId?: string | null;
  createdAt: string;
  updatedAt: string;
  subscriptionStatus: 'active' | 'canceled' | 'past_due' | 'unpaid';
  subscriptionEndsAt?: string | null;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: [
      'Rates and operations dashboard',
      'Account and security controls',
      'Notification preferences',
      'TW Ventures support resources',
    ],
    stripePriceId: ''
  },
  tier1: {
    id: 'tier1',
    name: 'Underwriting',
    price: 15,
    interval: 'month',
    features: [
      'Everything in Free',
      'BRRRR and traditional rental analysis',
      'Saved deals and side-by-side comparison',
      'Amortization modeling',
      'Property sourcing and maps',
    ],
    stripePriceId: process.env.STRIPE_TIER1_PRICE_ID || ''
  },
  tier2: {
    id: 'tier2',
    name: 'Investor',
    price: 35,
    interval: 'month',
    // Legacy entitlement carried over from the source platform so imported
    // account rows still resolve to a plan. Not offered here, and deliberately
    // free of the modules it used to advertise -- none of them exist in this
    // workspace, and `PRICING_PLAN_ORDER` never renders this tier.
    features: [
      'Legacy entitlement from the source platform',
      'Not offered in the TW Ventures workspace',
    ],
    stripePriceId: process.env.STRIPE_TIER2_PRICE_ID || ''
  },
  tier3: {
    id: 'tier3',
    name: 'Complete',
    price: 50,
    interval: 'month',
    // Legacy entitlement -- see tier2.
    features: [
      'Legacy entitlement from the source platform',
      'Not offered in the TW Ventures workspace',
    ],
    stripePriceId: process.env.STRIPE_TIER3_PRICE_ID || ''
  }
};
