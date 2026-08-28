import React, { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Crown, LogIn, ShieldCheck } from 'lucide-react';
import type { UseSubscriptionReturn } from '@/hooks/useSubscription';
import { getModuleAccessStatus, getModuleRule, getRequiredTierLabel, tierLabels } from '@/config/moduleAccess';
import { formatMonthlyPrice, getPlanDetails } from '@/config/pricing';
import type { ModuleAccessStatus } from '@/config/moduleAccess';
import { modules } from './constants';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { track } from '@/lib/analytics';

interface ModuleAccessGateProps {
  moduleId: string;
  user: User | null;
  authLoading: boolean;
  subscription: UseSubscriptionReturn;
  onRequestAuth: () => void;
  onRequestUpgrade: (moduleId: string) => void;
  children: React.ReactNode;
}

const statusIcons: Record<ModuleAccessStatus, React.ReactNode> = {
  ok: null,
  loading: (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    </div>
  ),
  unauthenticated: (
    <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
      <LogIn className="h-7 w-7 text-primary" />
    </div>
  ),
  upgrade: (
    <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
      <Crown className="h-7 w-7 text-primary" />
    </div>
  ),
};

const upgradeBenefits: Record<string, string[]> = {
  'watchlist': [
    'Sync your watchlist across devices',
    'Unlock sentiment tagging and premium alerts',
    'Export signals into the options dashboard',
  ],
  'options-dashboard': [
    'Intraday Greeks, IV rank, and risk analytics',
    'Institutional flow heat maps updated hourly',
    'Strategy playbooks tailored to your tier',
  ],
  'courses': [
    'Full access to the SomaTech academy library',
    'Weekly cohort sessions with live Q&A',
    'Earn certificates and track mastery scores',
  ],
};

const ModuleAccessGate: React.FC<ModuleAccessGateProps> = ({
  moduleId,
  user,
  authLoading,
  subscription,
  onRequestAuth,
  onRequestUpgrade,
  children,
}) => {
  const { hasFeature, subscriptionTier, loading: subscriptionLoading, userProfile } = subscription;
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';

  const accessStatus = getModuleAccessStatus(moduleId, {
    user,
    authLoading,
    subscriptionLoading,
    hasFeature,
    subscriptionTier,
    isAdmin,
  });

  // Where does the paywall actually bite? Fires once per gate impression, not
  // per render, so the count is of people blocked rather than of re-renders.
  useEffect(() => {
    if (accessStatus === 'unauthenticated' || accessStatus === 'upgrade') {
      track('gate_encountered', {
        module: moduleId,
        reason: accessStatus,
        tier: subscriptionTier,
        required_feature: getModuleRule(moduleId)?.requiredFeature ?? null,
      });
    }
  }, [accessStatus, moduleId, subscriptionTier]);

  if (accessStatus === 'ok') {
    return <>{children}</>;
  }

  if (accessStatus === 'loading') {
    return <>{statusIcons.loading}</>;
  }

  const rule = getModuleRule(moduleId);
  const tierLabel = getRequiredTierLabel(rule);
  const requiredTier = rule?.highlightTier || rule?.minimumTier;
  const requiredPlan = getPlanDetails(requiredTier);
  const planPriceLabel = requiredTier ? formatMonthlyPrice(requiredTier) : null;
  const currentTierLabel = tierLabels[subscriptionTier] || tierLabels.free;
  const moduleMeta = modules.find(module => module.id === moduleId);
  const benefits = requiredPlan?.features || upgradeBenefits[moduleId] || [
    'Priority support and concierge onboarding',
    'Advanced analytics tailored to your workflow',
    'Seamless exports to PDF, CSV, and Slack',
  ];

  return (
    <Card className="border-dashed border-2 border-muted/60 bg-muted/30 backdrop-blur">
      <CardHeader className="text-center space-y-2">
        <div className="flex items-center justify-center">
          {statusIcons[accessStatus]}
        </div>
        <CardTitle className="text-xl font-semibold flex items-center justify-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          Premium Feature
        </CardTitle>
        <CardDescription className="text-base">
          {rule?.description || 'This area requires an active subscription.'}
        </CardDescription>
        {moduleMeta && (
          <Badge variant="secondary" className="uppercase tracking-wide">
            {moduleMeta.name}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Current plan: <span className="font-medium text-foreground">{currentTierLabel}</span>
          {isAdmin && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="h-3 w-3" /> Admin override active
            </span>
          )}
        </p>
        {tierLabel && !isAdmin && (
          <div className="rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary space-y-1">
            <div>
              Upgrade to <span className="font-semibold">{tierLabel}</span>
              {planPriceLabel && (
                <span className="ml-1 text-xs font-medium text-primary/80">({planPriceLabel})</span>
              )}
              {' '}to unlock this experience.
            </div>
            {requiredPlan?.description && (
              <p className="text-xs text-primary/80">
                {requiredPlan.description}
              </p>
            )}
          </div>
        )}
        <div className="text-left space-y-2">
          <Separator className="my-2" />
          <p className="text-xs font-semibold uppercase text-muted-foreground">Unlock this upgrade to:</p>
          <ul className="grid gap-2 text-sm text-muted-foreground">
            {benefits.map((benefit) => (
              <li key={benefit} className="rounded-md bg-background/60 px-3 py-2">
                • {benefit}
              </li>
            ))}
          </ul>
        </div>
        {accessStatus === 'unauthenticated' ? (
          <Button onClick={() => onRequestAuth()} className="w-full sm:w-auto">
            <LogIn className="mr-2 h-4 w-4" />
            Sign in to continue
          </Button>
        ) : (
          <Button
            onClick={() => {
              track('upgrade_started', {
                module: moduleId,
                from_tier: subscriptionTier,
                to_tier: requiredTier ?? null,
              });
              onRequestUpgrade(moduleId);
            }}
            className="w-full sm:w-auto"
          >
            <Crown className="mr-2 h-4 w-4" />
            View upgrade options
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          Need help choosing a plan? Email <a href="mailto:hello@somatech.ai" className="text-primary underline">hello@somatech.ai</a>
        </p>
      </CardContent>
    </Card>
  );
};

export default ModuleAccessGate;
