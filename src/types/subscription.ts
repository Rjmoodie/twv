export type SubscriptionTier = 'free' | 'tier1' | 'tier2' | 'tier3';
export type UserRole = 'user' | 'admin' | 'super_admin';

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  discordAccess: boolean;
  lmsAccess: boolean;
  stripePriceId: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  subscriptionTier: SubscriptionTier;
  role: UserRole;
  stripeCustomerId?: string;
  discordId?: string;
  discordUsername?: string;
  createdAt: string;
  updatedAt: string;
  subscriptionStatus: 'active' | 'canceled' | 'past_due' | 'unpaid';
  subscriptionEndsAt?: string;
}

export interface SubscriptionFeatures {
  // Planner path (tier1)
  financialCoach: boolean;
  realEstate: boolean;
  businessValuation: boolean;
  // Investor path (tier2)
  stockAnalysis: boolean;
  pdufaCalendar: boolean;
  earningsCalendar: boolean;
  portfolio: boolean;
  optionsDashboard: boolean;
  aiTools: boolean;
  advancedAnalytics: boolean;
  tradesDashboard: boolean;
  optionsTradingDiscord: boolean;
  discordChat: boolean;
  // Complete (tier3)
  courseAccess: boolean;
  liveSessions: boolean;
  backtestingTool: boolean;
  // Free / always available
  retirementCalculator: boolean;
  watchlist: boolean;
  plaidConnect: boolean;
  plaidConnectionLimit: number; // free=2, planner=5, investor=5, complete=15
  // Admin
  adminAccess: boolean;
  userManagement: boolean;
  systemSettings: boolean;
  analyticsAccess: boolean;
  courseManagement: boolean;
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
    discordAccess: false,
    lmsAccess: false,
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
    discordAccess: false,
    lmsAccess: false,
    stripePriceId: process.env.STRIPE_TIER1_PRICE_ID || ''
  },
  tier2: {
    id: 'tier2',
    name: 'Investor',
    price: 35,
    interval: 'month',
    features: [
      'Everything in Free',
      'Stock Analysis & research tools',
      'PDUFA & Earnings calendars',
      'Portfolio management',
      'Options Dashboard (greeks, flow, strategies)',
      'AI Tools (thesis builder, screener, risk scan)',
      'Trades Dashboard',
      'Plaid bank connect (up to 5 accounts)',
      'Discord community access',
    ],
    discordAccess: true,
    lmsAccess: false,
    stripePriceId: process.env.STRIPE_TIER2_PRICE_ID || ''
  },
  tier3: {
    id: 'tier3',
    name: 'Complete',
    price: 50,
    interval: 'month',
    features: [
      'Everything in Planner + Investor',
      'Full course library access',
      'Live sessions & cohorts',
      'Backtesting tool',
      'Plaid bank connect (up to 15 accounts)',
    ],
    discordAccess: true,
    lmsAccess: true,
    stripePriceId: process.env.STRIPE_TIER3_PRICE_ID || ''
  }
};

export const getSubscriptionFeatures = (tier: SubscriptionTier, role: UserRole = 'user'): SubscriptionFeatures => {
  const base: SubscriptionFeatures = {
    // Free — always on
    retirementCalculator: true,
    watchlist: true,
    plaidConnect: true,
    plaidConnectionLimit: 2,
    // Planner features
    financialCoach: false,
    realEstate: false,
    businessValuation: false,
    // Investor features
    stockAnalysis: false,
    pdufaCalendar: false,
    earningsCalendar: false,
    portfolio: false,
    optionsDashboard: false,
    aiTools: false,
    advancedAnalytics: false,
    tradesDashboard: false,
    optionsTradingDiscord: false,
    discordChat: false,
    // Complete
    courseAccess: false,
    liveSessions: false,
    backtestingTool: false,
    // Admin
    adminAccess: false,
    userManagement: false,
    systemSettings: false,
    analyticsAccess: false,
    courseManagement: false,
  };

  const planner: SubscriptionFeatures = {
    ...base,
    financialCoach: true,
    realEstate: true,
    businessValuation: true,
    plaidConnectionLimit: 5,
  };

  const investor: SubscriptionFeatures = {
    ...base,
    stockAnalysis: true,
    pdufaCalendar: true,
    earningsCalendar: true,
    portfolio: true,
    optionsDashboard: true,
    aiTools: true,
    advancedAnalytics: true,
    tradesDashboard: true,
    optionsTradingDiscord: true,
    discordChat: true,
    plaidConnectionLimit: 5,
  };

  // Complete = Planner ∪ Investor + course features.
  //
  // NOTE: do not write this as `{ ...planner, ...investor }`. Both objects are
  // built from `base`, so `investor` carries explicit `false` values for every
  // planner feature and spreading it second silently clobbers them back off —
  // which previously left Complete subscribers locked out of the AI coach,
  // real estate, and business valuation they had paid for.
  // OR the flags explicitly so neither path can cancel the other.
  const complete: SubscriptionFeatures = {
    ...base,
    // planner path
    financialCoach:      planner.financialCoach     || investor.financialCoach,
    realEstate:          planner.realEstate         || investor.realEstate,
    businessValuation:   planner.businessValuation  || investor.businessValuation,
    // investor path
    stockAnalysis:       planner.stockAnalysis      || investor.stockAnalysis,
    pdufaCalendar:       planner.pdufaCalendar      || investor.pdufaCalendar,
    earningsCalendar:    planner.earningsCalendar   || investor.earningsCalendar,
    portfolio:           planner.portfolio          || investor.portfolio,
    optionsDashboard:    planner.optionsDashboard   || investor.optionsDashboard,
    aiTools:             planner.aiTools            || investor.aiTools,
    advancedAnalytics:   planner.advancedAnalytics  || investor.advancedAnalytics,
    tradesDashboard:     planner.tradesDashboard    || investor.tradesDashboard,
    optionsTradingDiscord: planner.optionsTradingDiscord || investor.optionsTradingDiscord,
    discordChat:         planner.discordChat        || investor.discordChat,
    // complete-only
    plaidConnectionLimit: 15,
    courseAccess:  true,
    liveSessions:  true,
    backtestingTool: true,
  };

  const tierMap: Record<SubscriptionTier, SubscriptionFeatures> = {
    free: base,
    tier1: planner,
    tier2: investor,
    tier3: complete,
  };

  let features = { ...tierMap[tier] };

  if (role === 'admin' || role === 'super_admin') {
    features = { ...features, adminAccess: true, userManagement: true, analyticsAccess: true, courseManagement: true };
  }
  if (role === 'super_admin') {
    features = { ...features, systemSettings: true };
  }

  return features;
};
