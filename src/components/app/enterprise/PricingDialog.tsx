import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, X, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import type { SubscriptionTier } from "@/types/subscription";
import type { UseSubscriptionReturn } from "@/hooks/useSubscription";
import { PRICING_PLAN_ORDER, PRICING_PLANS } from "@/config/pricing";
import { useAuth } from "@/components/app/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

interface PricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: UseSubscriptionReturn;
}

// Feature comparison rows: label → which tiers have it
const FEATURE_ROWS: { label: string; tiers: SubscriptionTier[] }[] = [
  { label: "Rates and operations dashboard",       tiers: ["free", "tier1"] },
  { label: "Account and security controls",        tiers: ["free", "tier1"] },
  { label: "BRRRR underwriting",                   tiers: ["tier1"] },
  { label: "Traditional rental analysis",          tiers: ["tier1"] },
  { label: "Saved deals and comparison",           tiers: ["tier1"] },
  { label: "Amortization modeling",                tiers: ["tier1"] },
  { label: "Property sourcing and maps",           tiers: ["tier1"] },
];

const tierOrder: Record<SubscriptionTier, number> = { free: 0, tier1: 1, tier2: 2, tier3: 3 };

const PricingDialog: React.FC<PricingDialogProps> = ({
  open,
  onOpenChange,
  subscription,
}) => {
  const { subscriptionTier, subscribeToTier, openCustomerPortal } = subscription;
  const { sendLoginCode, verifyLoginCode } = useAuth();
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  // Step-up re-auth state
  const [stepUpTier, setStepUpTier] = useState<SubscriptionTier | null>(null);
  const [stepUpCode, setStepUpCode] = useState('');
  const [stepUpError, setStepUpError] = useState('');
  const [stepUpLoading, setStepUpLoading] = useState(false);

  // Modules no longer map to a billing tier — access follows persona — so the
  // dialog is purely a plan chooser. The "the module you wanted needs plan X"
  // banner that used to sit here was gated on a hardcoded null and could never
  // render; it went with the tier-gating it described.

  // 60 min matches Supabase's default access-token TTL — use JWT iat (issued-at) so that
  // token refreshes reset the clock rather than last_sign_in_at which never updates mid-session.
  const SESSION_FRESHNESS_MS = 60 * 60 * 1000;

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (tier === "free") { onOpenChange(false); return; }

    // Step-up auth: require password re-confirmation if the current access token is > 60 min old.
    // We decode the JWT iat claim rather than using last_sign_in_at, which only updates on explicit
    // sign-in events (not on token refresh) and would always trigger for active sessions.
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      try {
        const payload = JSON.parse(atob(session.access_token.split('.')[1]));
        const tokenAgeMs = Date.now() - payload.iat * 1000;
        if (tokenAgeMs > SESSION_FRESHNESS_MS) {
          setStepUpTier(tier);
          setStepUpCode('');
          setStepUpError('');
          // Sign-in is a one-time code now, so re-authentication is too: asking
          // for a password would ask for something no account has.
          const { data: { user: current } } = await supabase.auth.getUser();
          if (current?.email) void sendLoginCode(current.email);
          return;
        }
      } catch {
        // Malformed token — fall through and allow subscription (Supabase will validate server-side)
      }
    }

    await proceedWithSubscription(tier);
  };

  const proceedWithSubscription = async (tier: SubscriptionTier) => {
    try {
      setLoadingTier(tier);
      await subscribeToTier(tier);
    } catch (error) {
      console.error("Subscription error:", error);
    } finally {
      setLoadingTier(null);
    }
  };

  const handleStepUpConfirm = async () => {
    if (!stepUpTier || !/^\d{6}$/.test(stepUpCode.trim())) {
      setStepUpError('Enter the six-digit code we just emailed you.');
      return;
    }
    setStepUpLoading(true);
    setStepUpError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Could not identify account.');

      const { error } = await verifyLoginCode(user.email, stepUpCode.trim());
      if (error) {
        setStepUpError('That code is not right, or it has expired.');
        return;
      }
      // Re-auth succeeded — proceed
      const tier = stepUpTier;
      setStepUpTier(null);
      setStepUpCode('');
      await proceedWithSubscription(tier);
    } catch (err) {
      setStepUpError(err instanceof Error ? err.message : 'Re-authentication failed.');
    } finally {
      setStepUpLoading(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) setLoadingTier(null); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Choose the plan that matches your workflow
          </DialogTitle>
          <DialogDescription className="text-center">
            Upgrade once to unlock the currently available underwriting workspace.
          </DialogDescription>
        </DialogHeader>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRICING_PLAN_ORDER.map((tier) => {
            const plan = PRICING_PLANS[tier];
            const Icon = plan.icon;
            const isCurrentPlan = subscriptionTier === tier;
            const isRecommended = plan.highlight;
            const isLowerThan = tierOrder[tier] < tierOrder[subscriptionTier];

            return (
              <Card
                key={tier}
                className={`relative transition-all duration-200 hover:shadow-md ${
                  isRecommended ? "border-primary shadow-md ring-1 ring-primary" : "border-border"
                } ${isCurrentPlan ? "ring-2 ring-green-500" : ""}`}
              >
                {plan.badge && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs uppercase tracking-wide">
                      {plan.badge}
                    </Badge>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="bg-accent text-white px-3 py-1 text-xs">Current plan</Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4 space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-muted flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <div className="text-2xl font-bold">
                    {plan.price === 0 ? "Free" : `$${plan.price}`}
                    {plan.price > 0 && <span className="text-xs font-normal text-muted-foreground">/mo</span>}
                  </div>
                  <CardDescription className="text-xs">{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {plan.features.slice(0, 5).map((feature) => (
                      <li key={feature} className="flex items-start gap-1.5">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                    {plan.features.length > 5 && (
                      <li className="text-xs text-muted-foreground pl-5">+{plan.features.length - 5} more features</li>
                    )}
                  </ul>

                  <Button
                    className="w-full"
                    size="sm"
                    variant={isCurrentPlan ? "outline" : isLowerThan ? "ghost" : "default"}
                    onClick={() => isCurrentPlan ? openCustomerPortal() : handleSubscribe(tier)}
                    disabled={loadingTier !== null || isLowerThan}
                  >
                    {isCurrentPlan
                      ? "Manage"
                      : isLowerThan
                        ? "Downgrade"
                        : loadingTier === tier
                          ? "Redirecting…"
                          : `Upgrade to ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Feature comparison toggle */}
        <div className="mt-4 border-t border-border pt-4">
          <button
            onClick={() => setShowComparison((v) => !v)}
            className="text-sm text-primary underline-offset-2 hover:underline mx-auto block"
          >
            {showComparison ? "Hide" : "Show"} full feature comparison
          </button>

          {showComparison && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Feature</th>
                    {PRICING_PLAN_ORDER.map((tier) => (
                      <th key={tier} className="text-center py-2 px-2 font-medium">
                        <span className={subscriptionTier === tier ? "text-primary font-bold" : "text-foreground"}>
                          {PRICING_PLANS[tier].name}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_ROWS.map((row) => (
                    <tr key={row.label} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-4 text-muted-foreground">{row.label}</td>
                      {PRICING_PLAN_ORDER.map((tier) => (
                        <td key={tier} className="text-center py-2 px-2">
                          {row.tiers.includes(tier)
                            ? <Check className="h-4 w-4 text-accent mx-auto" />
                            : <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Step-up re-authentication dialog */}
    <Dialog open={!!stepUpTier} onOpenChange={(v) => { if (!v && !stepUpLoading) { setStepUpTier(null); setStepUpCode(''); setStepUpError(''); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Confirm your identity
          </DialogTitle>
          <DialogDescription>
            Enter the six-digit code we just emailed you to authorize the upgrade to{' '}
            <strong>{stepUpTier ? PRICING_PLANS[stepUpTier]?.name : ''}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="stepup-code" className="text-sm font-medium">Six-digit code</Label>
            <Input
              id="stepup-code"
              inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
              value={stepUpCode}
              onChange={(e) => { setStepUpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setStepUpError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleStepUpConfirm()}
              placeholder="000000"
              autoFocus
              disabled={stepUpLoading}
            />
          </div>
          {stepUpError && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{stepUpError}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setStepUpTier(null); setStepUpCode(''); setStepUpError(''); }}
              disabled={stepUpLoading}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleStepUpConfirm} disabled={stepUpLoading}>
              {stepUpLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              {stepUpLoading ? 'Verifying…' : 'Confirm'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default PricingDialog;
