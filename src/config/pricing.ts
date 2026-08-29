import { Crown, Sparkles, Star, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SUBSCRIPTION_PLANS, type SubscriptionTier } from "@/types/subscription";

export interface PricingPlanDetails {
  tier: SubscriptionTier;
  name: string;
  price: number;
  interval: "month" | "year";
  description: string;
  icon: LucideIcon;
  highlight?: boolean;
  badge?: string;
  features: string[];
  stripePriceId: string;
}

const baseDescriptions: Record<SubscriptionTier, string> = {
  free: "Review the rate environment and manage your TW Ventures account.",
  tier1: "Underwrite, save, source, and compare real estate opportunities.",
  tier2: "Legacy source-system entitlement; not offered in the TW Ventures workspace.",
  tier3: "Legacy source-system entitlement; not offered in the TW Ventures workspace.",
};

const planIcons: Record<SubscriptionTier, LucideIcon> = {
  free: Star,
  tier1: Zap,
  tier2: Sparkles,
  tier3: Crown,
};

// Only plans backed by a currently shipped TW Ventures workflow are offered.
// The two higher source-system tiers remain in the entitlement model solely so
// imported account data can be interpreted until the Investor / PM / Admin role
// migration replaces subscription tiers.
export const PRICING_PLAN_ORDER: SubscriptionTier[] = ["free", "tier1"];

const ALL_PRICING_PLAN_TIERS: SubscriptionTier[] = ["free", "tier1", "tier2", "tier3"];

export const PRICING_PLANS: Record<SubscriptionTier, PricingPlanDetails> = ALL_PRICING_PLAN_TIERS.reduce(
  (acc, tier) => {
    const plan = SUBSCRIPTION_PLANS[tier];
    acc[tier] = {
      tier,
      name: plan.name,
      price: plan.price,
      interval: plan.interval,
      description: baseDescriptions[tier],
      icon: planIcons[tier],
      highlight: tier === "tier1",
      badge: tier === "tier1" ? "Underwriting" : undefined,
      features: plan.features,
      stripePriceId: plan.stripePriceId,
    };
    return acc;
  },
  {} as Record<SubscriptionTier, PricingPlanDetails>
);

export const formatMonthlyPrice = (tier: SubscriptionTier): string => {
  const plan = PRICING_PLANS[tier];
  const price = plan.price === 0 ? "Free" : `$${plan.price.toFixed(0)}`;
  return plan.interval === "month" && plan.price > 0 ? `${price}/mo` : price;
};

export const getPlanDetails = (tier: SubscriptionTier | undefined) =>
  tier ? PRICING_PLANS[tier] : undefined;

export const getRecommendedUpgrade = (currentTier: SubscriptionTier): SubscriptionTier | null => {
  const currentIndex = PRICING_PLAN_ORDER.indexOf(currentTier);
  if (currentIndex === -1) return null;
  return PRICING_PLAN_ORDER[currentIndex + 1] ?? null;
};
