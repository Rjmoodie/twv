import React from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionFeatures, UserRole } from '@/types/subscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Crown, Zap, Star, Shield } from 'lucide-react';
import { SubscriptionManager } from './SubscriptionManager';
import { useAuth } from './AuthProvider';

interface FeatureGuardProps {
  feature: keyof SubscriptionFeatures;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
  requiredTier?: string;
  adminOverride?: boolean; // Allow admin access regardless of subscription
}

export function FeatureGuard({ 
  feature, 
  children, 
  fallback,
  showUpgrade = true,
  requiredTier,
  adminOverride = true
}: FeatureGuardProps) {
  const { hasFeature, subscriptionTier, loading } = useSubscription();
  const { userProfile } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check if user has access through subscription OR admin role
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
  const hasSubscriptionAccess = hasFeature(feature);
  const hasAccess = hasSubscriptionAccess || (adminOverride && isAdmin);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'tier1': return <Zap className="h-5 w-5" />;
      case 'tier2': return <Star className="h-5 w-5" />;
      case 'tier3': return <Crown className="h-5 w-5" />;
      default: return <Lock className="h-5 w-5" />;
    }
  };

  const getTierName = (tier: string) => {
    switch (tier) {
      case 'tier1': return 'Tier 1';
      case 'tier2': return 'Tier 2';
      case 'tier3': return 'Tier 3';
      default: return 'Premium';
    }
  };

  const getFeatureDescription = (feature: keyof SubscriptionFeatures) => {
    switch (feature) {
      case 'optionsTradingDiscord':
        return 'Access to our exclusive Options Trading Discord community';
      case 'discordChat':
        return 'Participate in Discord chat discussions';
      case 'advancedAnalytics':
        return 'Advanced analytics and reporting tools';
      case 'courseAccess':
        return 'Access to our comprehensive course library';
      case 'liveSessions':
        return 'Join live trading sessions and webinars';
      case 'backtestingTool':
        return 'Advanced backtesting and strategy analysis tools';
      case 'aiTools':
        return 'AI-powered trading insights and recommendations';
      default:
        return 'This feature requires a premium subscription';
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          {getTierIcon(requiredTier || 'premium')}
        </div>
        <CardTitle className="text-xl">
          {getTierName(requiredTier || 'premium')} Feature
        </CardTitle>
        <CardDescription>
          {getFeatureDescription(feature)}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          You're currently on <strong>{subscriptionTier.toUpperCase()}</strong>. 
          {isAdmin && (
            <span className="block mt-2 text-blue-600 font-medium">
              <Shield className="inline h-4 w-4 mr-1" />
              Admin access available
            </span>
          )}
          {!isAdmin && ' Upgrade to access this feature.'}
        </p>
        
        {showUpgrade && (
          <div className="pt-4">
            <SubscriptionManager 
              showCurrentStatus={false}
              showUpgradeOptions={true}
              compact={true}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Convenience components for common features
export function OptionsTradingGuard({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <FeatureGuard feature="optionsTradingDiscord" requiredTier="tier1" fallback={fallback}>
      {children}
    </FeatureGuard>
  );
}

export function DiscordChatGuard({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <FeatureGuard feature="discordChat" requiredTier="tier2" fallback={fallback}>
      {children}
    </FeatureGuard>
  );
}

export function AdvancedAnalyticsGuard({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <FeatureGuard feature="advancedAnalytics" requiredTier="tier2" fallback={fallback}>
      {children}
    </FeatureGuard>
  );
}

export function CourseAccessGuard({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <FeatureGuard feature="courseAccess" requiredTier="tier3" fallback={fallback}>
      {children}
    </FeatureGuard>
  );
}

export function LiveSessionsGuard({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <FeatureGuard feature="liveSessions" requiredTier="tier3" fallback={fallback}>
      {children}
    </FeatureGuard>
  );
}

export function BacktestingGuard({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <FeatureGuard feature="backtestingTool" requiredTier="tier3" fallback={fallback}>
      {children}
    </FeatureGuard>
  );
}

export function AIToolsGuard({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <FeatureGuard feature="aiTools" requiredTier="tier3" fallback={fallback}>
      {children}
    </FeatureGuard>
  );
}
