import React, { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionTier } from '@/types/subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Zap, Star, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { tierLabels } from '@/config/moduleAccess';
import { formatMonthlyPrice } from '@/config/pricing';

interface SubscriptionManagerProps {
  showUpgradeOptions?: boolean;
  showCurrentStatus?: boolean;
  compact?: boolean;
}

export function SubscriptionManager({ 
  showUpgradeOptions = true, 
  showCurrentStatus = true,
  compact = false 
}: SubscriptionManagerProps) {
  const {
    subscriptionTier,
    subscriptionStatus,
    isActive,
    features,
    loading,
    error,
    subscribeToTier,
    openCustomerPortal,
    upgradeOptions
  } = useSubscription();

  const [subscribing, setSubscribing] = useState<SubscriptionTier | null>(null);

  const handleSubscribe = async (tier: SubscriptionTier) => {
    try {
      setSubscribing(tier);
      await subscribeToTier(tier);
      toast.success(`Redirecting to checkout for ${tier}...`);
    } catch (error) {
      toast.error('Failed to start subscription process');
      console.error('Subscription error:', error);
    } finally {
      setSubscribing(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      await openCustomerPortal();
      toast.success('Opening subscription management...');
    } catch (error) {
      toast.error('Failed to open subscription management');
      console.error('Portal error:', error);
    }
  };

  const getTierIcon = (tier: SubscriptionTier) => {
    switch (tier) {
      case 'tier1': return <Zap className="h-4 w-4" />;
      case 'tier2': return <Star className="h-4 w-4" />;
      case 'tier3': return <Crown className="h-4 w-4" />;
      default: return null;
    }
  };

  const getTierColor = (tier: SubscriptionTier) => {
    switch (tier) {
      case 'tier1': return 'bg-blue-100 text-blue-800';
      case 'tier2': return 'bg-purple-100 text-purple-800';
      case 'tier3': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-destructive">Error loading subscription: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {showCurrentStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Current Subscription
              {getTierIcon(subscriptionTier)}
            </CardTitle>
            <CardDescription>
              Your current plan and features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Badge className={getTierColor(subscriptionTier)}>
                  {tierLabels[subscriptionTier] || tierLabels.free}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">
                  Status: {subscriptionStatus}
                </p>
              </div>
              {isActive && (
                <Button variant="outline" onClick={handleManageSubscription}>
                  Manage Subscription
                </Button>
              )}
            </div>

            {!compact && (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(features).map(([feature, enabled]) => (
                  <div key={feature} className="flex items-center gap-2">
                    <Check className={`h-4 w-4 ${enabled ? 'text-accent' : 'text-gray-400'}`} />
                    <span className={`text-sm ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showUpgradeOptions && upgradeOptions && upgradeOptions.availableUpgrades.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Upgrade Options
            </CardTitle>
            <CardDescription>
              Unlock more features with a premium subscription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upgradeOptions.availableUpgrades.map((upgrade) => (
                <Card key={upgrade.tier} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getTierIcon(upgrade.tier)}
                        {upgrade.name}
                      </CardTitle>
                      <Badge className={getTierColor(upgrade.tier)}>
                        {formatMonthlyPrice(upgrade.tier)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ul className="space-y-2">
                      {upgrade.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-accent" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      onClick={() => handleSubscribe(upgrade.tier)}
                      disabled={subscribing === upgrade.tier}
                    >
                      {subscribing === upgrade.tier ? 'Processing...' : `Upgrade to ${upgrade.name}`}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showUpgradeOptions && upgradeOptions && upgradeOptions.availableUpgrades.length === 0 && (
        <Card>
          <CardContent className="p-4 text-center">
            <Crown className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
            <p className="text-sm text-muted-foreground">
              You're already on the highest tier!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}