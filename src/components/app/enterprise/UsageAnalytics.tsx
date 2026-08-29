import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calculator, 
  Save, 
  Download, 
  TrendingUp, 
  Users, 
  DollarSign,
  BarChart3,
  Activity
} from "lucide-react";
import { useUsageTracking } from "@/hooks/useUsageTracking";
import { useSubscriptionGating } from "@/hooks/useSubscriptionGating";

interface UsageAnalyticsProps {
  onUpgrade?: () => void;
}

const UsageAnalytics = ({ onUpgrade }: UsageAnalyticsProps) => {
  const { usageStats, usageLimits, loading, getUsagePercentage } = useUsageTracking();
  const { subscription, hasFeature } = useSubscriptionGating();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-20 bg-muted"></CardHeader>
            <CardContent className="h-24 bg-muted/50"></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const usageMetrics = [
    {
      title: "Calculations",
      current: usageStats.monthly_calculations,
      limit: usageLimits.monthly_calculations,
      icon: Calculator,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      percentage: getUsagePercentage('calculation')
    },
    {
      title: "Saved Projects", 
      current: usageStats.saved_projects,
      limit: usageLimits.saved_projects,
      icon: Save,
      color: "text-accent",
      bgColor: "bg-accent/10",
      percentage: getUsagePercentage('save')
    },
    {
      title: "Export Reports",
      current: usageStats.export_reports,
      limit: usageLimits.export_reports,
      icon: Download,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      percentage: getUsagePercentage('export')
    }
  ];

  const isNearLimit = (percentage: number) => percentage > 80;
  const isAtLimit = (percentage: number) => percentage >= 100;

  return (
    <div className="space-y-6">
      {/* Usage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {usageMetrics.map((metric) => {
          const Icon = metric.icon;
          const isUnlimited = metric.limit === -1;
          
          return (
            <Card key={metric.title} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                <div className={`p-2 rounded-full ${metric.bgColor}`}>
                  <Icon className={`h-4 w-4 ${metric.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metric.current}
                  {!isUnlimited && (
                    <span className="text-sm font-normal text-muted-foreground">
                      / {metric.limit}
                    </span>
                  )}
                </div>
                {isUnlimited ? (
                  <Badge variant="outline" className="mt-2">Unlimited</Badge>
                ) : (
                  <>
                    <Progress 
                      value={metric.percentage} 
                      className="mt-2"
                      indicatorClassName={
                        isAtLimit(metric.percentage) ? "bg-destructive/100" :
                        isNearLimit(metric.percentage) ? "bg-yellow-500" : 
                        "bg-accent"
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round(metric.percentage)}% used
                      {isNearLimit(metric.percentage) && !isAtLimit(metric.percentage) && 
                        <span className="text-yellow-600 ml-1">• Near limit</span>
                      }
                      {isAtLimit(metric.percentage) && 
                        <span className="text-destructive ml-1">• Limit reached</span>
                      }
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Advanced Analytics (Premium Feature) */}
      {hasFeature('advanced_analytics') ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Efficiency Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">87%</div>
              <p className="text-xs text-muted-foreground">+12% from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ROI Analysis</CardTitle>
              <DollarSign className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$24.5K</div>
              <p className="text-xs text-muted-foreground">Avg. project value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,247</div>
              <p className="text-xs text-muted-foreground">+5% this week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Performance</CardTitle>
              <Activity className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">99.2%</div>
              <p className="text-xs text-muted-foreground">Uptime</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-2 border-dashed">
          <CardHeader className="text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle>Advanced Analytics</CardTitle>
            <CardDescription>
              Get detailed insights into your usage patterns, ROI analysis, and performance metrics.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={onUpgrade}>
              Upgrade to Professional
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current Plan: 
            <Badge variant={subscription?.subscribed ? "default" : "secondary"}>
              {subscription?.subscription_tier || 'Free'}
            </Badge>
          </CardTitle>
          {subscription?.subscription_end && (
            <CardDescription>
              Your subscription renews on {new Date(subscription.subscription_end).toLocaleDateString()}
            </CardDescription>
          )}
        </CardHeader>
        {!subscription?.subscribed && (
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Upgrade to unlock unlimited usage, advanced analytics, and priority support.
            </p>
            <Button onClick={onUpgrade}>Upgrade Now</Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default UsageAnalytics;