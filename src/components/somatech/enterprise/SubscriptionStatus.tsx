import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Crown, 
  Star, 
  TrendingUp, 
  Calendar,
  Settings,
  BarChart3,
  Zap,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface SubscriptionFeatures {
  advanced_analytics: boolean;
  unlimited_saves: boolean;
  priority_support: boolean;
  white_label: boolean;
}

interface UsageLimits {
  monthly_calculations: number;
  saved_projects: number;
  export_reports: number;
}

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier: 'free' | 'professional' | 'enterprise';
  subscription_end?: string;
  features_enabled: SubscriptionFeatures;
  usage_limits: UsageLimits;
}

interface SubscriptionStatusProps {
  onUpgradeClick: () => void;
}

const SubscriptionStatus = ({ onUpgradeClick }: SubscriptionStatusProps) => {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptionStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) throw error;
      
      setSubscription(data);
      
      // Fetch current month usage
      const { data: usageData, error: usageError } = await supabase
        .from('usage_tracking')
        .select('feature_type, usage_count')
        .eq('month_year', new Date().toISOString().slice(0, 7)); // YYYY-MM format
        
      if (!usageError && usageData) {
        const usageMap = usageData.reduce((acc, item) => {
          acc[item.feature_type] = (acc[item.feature_type] || 0) + item.usage_count;
          return acc;
        }, {});
        setUsage(usageMap);
      }
    } catch (error) {
      console.error('Subscription check error:', error);
      toast({
        title: "Error",
        description: "Failed to check subscription status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Portal error:', error);
      toast({
        title: "Error",
        description: "Failed to open customer portal",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscription) return null;

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'enterprise': return Crown;
      case 'professional': return TrendingUp;
      default: return Star;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'text-purple-600';
      case 'professional': return 'text-accent';
      default: return 'text-blue-600';
    }
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'professional': return 'bg-accent/10 text-accent border-accent/20';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const Icon = getTierIcon(subscription.subscription_tier);
  const isUnlimited = (limit: number) => limit === -1;

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-background`}>
                <Icon className={`h-5 w-5 ${getTierColor(subscription.subscription_tier)}`} />
              </div>
              <div>
                <CardTitle className="capitalize">{subscription.subscription_tier} Plan</CardTitle>
                <CardDescription>
                  {subscription.subscribed && subscription.subscription_end 
                    ? `Renews on ${new Date(subscription.subscription_end).toLocaleDateString()}`
                    : 'Your current subscription tier'
                  }
                </CardDescription>
              </div>
            </div>
            <Badge className={getTierBadgeColor(subscription.subscription_tier)}>
              {subscription.subscribed ? 'Active' : 'Free Tier'}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Usage Limits */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Usage This Month
            </h4>
            
            {[
              { 
                key: 'calculations', 
                label: 'Calculations', 
                limit: subscription.usage_limits.monthly_calculations,
                used: usage?.calculations || 0
              },
              { 
                key: 'projects', 
                label: 'Saved Projects', 
                limit: subscription.usage_limits.saved_projects,
                used: usage?.saved_projects || 0
              },
              { 
                key: 'exports', 
                label: 'Export Reports', 
                limit: subscription.usage_limits.export_reports,
                used: usage?.export_reports || 0
              }
            ].map(({ key, label, limit, used }) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="text-muted-foreground">
                    {isUnlimited(limit) ? `${used} used` : `${used} / ${limit}`}
                  </span>
                </div>
                {!isUnlimited(limit) && (
                  <Progress 
                    value={(used / limit) * 100} 
                    className="h-2"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Feature Status */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Available Features
            </h4>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { key: 'advanced_analytics', label: 'Advanced Analytics' },
                { key: 'unlimited_saves', label: 'Unlimited Saves' },
                { key: 'priority_support', label: 'Priority Support' },
                { key: 'white_label', label: 'White Label' }
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    subscription.features_enabled[key as keyof SubscriptionFeatures] 
                      ? 'bg-accent' 
                      : 'bg-gray-300'
                  }`} />
                  <span className={
                    subscription.features_enabled[key as keyof SubscriptionFeatures] 
                      ? 'text-foreground' 
                      : 'text-muted-foreground'
                  }>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            {subscription.subscription_tier === 'free' ? (
              <Button onClick={onUpgradeClick} className="flex-1">
                <TrendingUp className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleManageSubscription}
                  className="flex-1"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Plan
                </Button>
                {subscription.subscription_tier !== 'enterprise' && (
                  <Button onClick={onUpgradeClick} className="flex-1">
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade
                  </Button>
                )}
              </>
            )}
            
            <Button 
              variant="outline" 
              size="icon"
              onClick={fetchSubscriptionStatus}
              title="Refresh status"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionStatus;