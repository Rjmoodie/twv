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
  free: "Get started with budgeting, journey planning, and personal finance basics.",
  tier1: "For people focused on their financial life — coaching, real estate, and business valuation tools.",
  tier2: "For active investors — stocks, options, AI tools, earnings, PDUFA, and portfolio management.",
  tier3: "Everything in Planner and Investor, plus courses and live sessions.",
};

const planIcons: Record<SubscriptionTier, LucideIcon> = {
  free: Star,
  tier1: Zap,
  tier2: Sparkles,
  tier3: Crown,
};

export const PRICING_PLAN_ORDER: SubscriptionTier[] = ["free", "tier1", "tier2", "tier3"];

export const PRICING_PLANS: Record<SubscriptionTier, PricingPlanDetails> = PRICING_PLAN_ORDER.reduce(
  (acc, tier) => {
    const plan = SUBSCRIPTION_PLANS[tier];
    acc[tier] = {
      tier,
      name: plan.name,
      price: plan.price,
      interval: plan.interval,
      description: baseDescriptions[tier],
      icon: planIcons[tier],
      highlight: tier === "tier2",
      badge: tier === "tier2" ? "Most Popular" : undefined,
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
