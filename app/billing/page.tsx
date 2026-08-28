"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Settings, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface Subscription {
  plan: string;
  status: string;
  current_period_end: string;
}

export default function BillingPage() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState<string>("");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .single();
        setSubscription(sub);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const startCheckout = async (plan: "pro_monthly" | "pro_annual" | "tier1" | "tier2" | "tier3") => {
    setLoading(plan);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        toast.error("Please log in to continue");
        return;
      }

      const res = await fetch("/functions/v1/checkout", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ plan }),
      });
      
      const data = await res.json();
      setLoading("");
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Checkout error");
      }
    } catch (error) {
      setLoading("");
      toast.error("Failed to start checkout");
      console.error("Checkout error:", error);
    }
  };

  const openPortal = async () => {
    setLoading("portal");
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        toast.error("Please log in to continue");
        return;
      }

      const res = await fetch("/functions/v1/billing-portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await res.json();
      setLoading("");
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Failed to open billing portal");
      }
    } catch (error) {
      setLoading("");
      toast.error("Failed to open billing portal");
      console.error("Portal error:", error);
    }
  };

  const getPlanDisplayName = (plan: string) => {
    switch (plan) {
      case "pro_monthly": return "Pro Monthly";
      case "pro_annual": return "Pro Annual";
      case "tier1": return "Tier 1";
      case "tier2": return "Tier 2";
      case "tier3": return "Tier 3";
      default: return plan;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "trialing": return "bg-blue-100 text-blue-800";
      case "past_due": return "bg-yellow-100 text-yellow-800";
      case "canceled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Billing & Subscriptions</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing preferences
        </p>
      </div>

      {/* Current Subscription */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Current Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{getPlanDisplayName(subscription.plan)}</p>
                <p className="text-sm text-muted-foreground">
                  Next billing: {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              </div>
              <Badge className={getStatusColor(subscription.status)}>
                {subscription.status}
              </Badge>
            </div>
            <Button 
              onClick={openPortal} 
              disabled={loading === "portal"}
              className="w-full"
            >
              {loading === "portal" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Settings className="h-4 w-4 mr-2" />
              )}
              Manage Billing
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tier 1</CardTitle>
            <CardDescription>Basic features and access</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              disabled={!!loading}
              onClick={() => startCheckout("tier1")}
            >
              {loading === "tier1" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Subscribe to Tier 1
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tier 2</CardTitle>
            <CardDescription>Advanced features and priority support</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              disabled={!!loading}
              onClick={() => startCheckout("tier2")}
            >
              {loading === "tier2" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Subscribe to Tier 2
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tier 3</CardTitle>
            <CardDescription>Premium features and exclusive access</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              disabled={!!loading}
              onClick={() => startCheckout("tier3")}
            >
              {loading === "tier3" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Subscribe to Tier 3
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pro Monthly</CardTitle>
            <CardDescription>Professional features with monthly billing</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              disabled={!!loading}
              onClick={() => startCheckout("pro_monthly")}
            >
              {loading === "pro_monthly" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Subscribe Monthly
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pro Annual</CardTitle>
            <CardDescription>Professional features with annual billing (save 20%)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              disabled={!!loading}
              onClick={() => startCheckout("pro_annual")}
            >
              {loading === "pro_annual" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Subscribe Annually
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Discord Integration */}
      <Card>
        <CardHeader>
          <CardTitle>Discord Integration</CardTitle>
          <CardDescription>
            Connect your Discord account to get exclusive role access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href="/discord/link">
              Connect Discord Account
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

