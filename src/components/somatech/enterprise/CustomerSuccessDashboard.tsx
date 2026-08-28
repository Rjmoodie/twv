import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  TrendingUp, 
  Heart, 
  AlertTriangle,
  CheckCircle,
  Calendar,
  Mail,
  Phone,
  MessageSquare,
  Target,
  Star
} from "lucide-react";

interface CustomerMetric {
  id: string;
  name: string;
  email: string;
  health_score: number;
  last_login: string;
  subscription_tier: string;
  usage_trend: 'up' | 'down' | 'stable';
  risk_level: 'low' | 'medium' | 'high';
  onboarding_progress: number;
}

interface SuccessMetrics {
  customer_satisfaction: number;
  churn_risk: number;
  product_adoption: number;
  support_tickets: number;
  average_health_score: number;
}

const CustomerSuccessDashboard = () => {
  const [customers, setCustomers] = useState<CustomerMetric[]>([
    {
      id: '1',
      name: 'Acme Corp',
      email: 'admin@acme.com',
      health_score: 85,
      last_login: '2024-01-10',
      subscription_tier: 'enterprise',
      usage_trend: 'up',
      risk_level: 'low',
      onboarding_progress: 90
    },
    {
      id: '2',
      name: 'TechStart Inc',
      email: 'ceo@techstart.io',
      health_score: 62,
      last_login: '2024-01-05',
      subscription_tier: 'professional',
      usage_trend: 'down',
      risk_level: 'medium',
      onboarding_progress: 75
    },
    {
      id: '3',
      name: 'Global Finance',
      email: 'finance@global.com',
      health_score: 42,
      last_login: '2023-12-28',
      subscription_tier: 'professional',
      usage_trend: 'down',
      risk_level: 'high',
      onboarding_progress: 45
    }
  ]);

  const [metrics, setMetrics] = useState<SuccessMetrics>({
    customer_satisfaction: 4.2,
    churn_risk: 8.5,
    product_adoption: 73,
    support_tickets: 12,
    average_health_score: 78
  });

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-accent';
    if (score >= 60) return 'text-yellow-600';
    return 'text-destructive';
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'low':
        return <Badge className="bg-accent/10 text-accent">Low Risk</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800">Medium Risk</Badge>;
      case 'high':
        return <Badge className="bg-destructive/10 text-destructive">High Risk</Badge>;
      default:
        return null;
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return <Badge className="bg-purple-100 text-purple-800">Enterprise</Badge>;
      case 'professional':
        return <Badge className="bg-blue-100 text-blue-800">Professional</Badge>;
      case 'free':
        return <Badge className="bg-gray-100 text-gray-800">Free</Badge>;
      default:
        return null;
    }
  };

  const getTrendIcon = (trend: string) => {
    const className = trend === 'up' ? 'text-accent' : trend === 'down' ? 'text-destructive' : 'text-gray-600';
    return <TrendingUp className={`h-4 w-4 transform ${trend === 'down' ? 'rotate-180' : ''} ${className}`} />;
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.customer_satisfaction}/5</div>
            <p className="text-xs text-muted-foreground">Customer satisfaction score</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{metrics.churn_risk}%</div>
            <p className="text-xs text-muted-foreground">At-risk customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Adoption</CardTitle>
            <CheckCircle className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.product_adoption}%</div>
            <p className="text-xs text-muted-foreground">Product adoption rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Support</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.support_tickets}</div>
            <p className="text-xs text-muted-foreground">Open support tickets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <Heart className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.average_health_score}</div>
            <p className="text-xs text-muted-foreground">Average customer health</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="customers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="customers">
            <Users className="h-4 w-4 mr-2" />
            Customer Health
          </TabsTrigger>
          <TabsTrigger value="onboarding">
            <Target className="h-4 w-4 mr-2" />
            Onboarding
          </TabsTrigger>
          <TabsTrigger value="engagement">
            <TrendingUp className="h-4 w-4 mr-2" />
            Engagement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Health Overview</CardTitle>
              <CardDescription>
                Monitor customer health scores and identify at-risk accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {customers.map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <h3 className="font-medium">{customer.name}</h3>
                        <p className="text-sm text-muted-foreground">{customer.email}</p>
                      </div>
                      {getTierBadge(customer.subscription_tier)}
                      {getRiskBadge(customer.risk_level)}
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <div className={`text-lg font-bold ${getHealthScoreColor(customer.health_score)}`}>
                          {customer.health_score}%
                        </div>
                        <p className="text-xs text-muted-foreground">Health Score</p>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center space-x-1">
                          {getTrendIcon(customer.usage_trend)}
                          <span className="text-sm font-medium capitalize">{customer.usage_trend}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Usage Trend</p>
                      </div>

                      <div className="text-center">
                        <p className="text-sm">{customer.last_login}</p>
                        <p className="text-xs text-muted-foreground">Last Login</p>
                      </div>

                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Onboarding Progress</CardTitle>
              <CardDescription>
                Track customer onboarding completion and identify bottlenecks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {customers.map((customer) => (
                  <div key={customer.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{customer.name}</h4>
                        <p className="text-sm text-muted-foreground">{customer.email}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium">{customer.onboarding_progress}%</span>
                        <p className="text-xs text-muted-foreground">Complete</p>
                      </div>
                    </div>
                    <Progress value={customer.onboarding_progress} className="w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Analytics</CardTitle>
              <CardDescription>
                Customer engagement patterns and feature usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Engagement Analytics Coming Soon</h3>
                <p className="text-muted-foreground">
                  Detailed engagement tracking and feature usage analytics.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomerSuccessDashboard;