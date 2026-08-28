import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Star, Zap, Crown, Rocket, Home, User, Settings } from 'lucide-react';
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '@/types/subscription';
import { useAuth } from '@/components/somatech/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import AuthDialog from '@/components/somatech/AuthDialog';
import SomaTechLogo from '@/components/somatech/SomaTechLogo';
import TrustSignals from '@/components/somatech/TrustSignals';
import FinancialDisclaimer from '@/components/somatech/FinancialDisclaimer';

const PricingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (tier === 'free') {
      if (!user) {
        // For free tier, open auth dialog to sign up
        setShowAuthDialog(true);
      } else {
        toast({
          title: "Success",
          description: "You already have access to free features!",
        });
      }
      return;
    }

    setLoading(tier);
    try {
      // Use Supabase Edge Function for checkout
      const { data, error } = await supabase.functions.invoke('checkout', {
        body: {
          plan: tier,
          success_url: `${window.location.origin}/somatech?module=dashboard&subscription=success&tier=${tier}`,
          cancel_url: `${window.location.origin}/pricing?canceled=true`
        }
      });

      if (error) {
        console.error('Checkout error:', error);
        
        // If Edge Function fails, try direct Stripe integration
        if (error.message?.includes('function') || error.message?.includes('not found')) {
          console.log('Edge Function not available, trying direct Stripe...');
          
          // Load Stripe.js dynamically
          const stripeScript = document.createElement('script');
          stripeScript.src = 'https://js.stripe.com/v3/';
          stripeScript.onload = () => {
            const Stripe = (window as any).Stripe;
            if (!Stripe) {
              throw new Error('Stripe.js failed to load');
            }
            
            // Use demo mode with setup instructions
            const setupMessage = `🚧 Payment Setup Required

To enable payments, you need to:

1. Go to Stripe Dashboard (https://dashboard.stripe.com)
2. Create products for each tier:
   - Tier 1: $35/month
   - Tier 2: $45/month  
   - Tier 3: $75/month
3. Copy the Price IDs
4. Add to your .env file:
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
   VITE_STRIPE_TIER1_PRICE_ID=price_tier1_id
   VITE_STRIPE_TIER2_PRICE_ID=price_tier2_id
   VITE_STRIPE_TIER3_PRICE_ID=price_tier3_id

For now, this is a demo. Click OK to continue.`;
            
            if (confirm(setupMessage)) {
              // Simulate successful subscription for demo
              toast({
                title: "Demo Mode",
                description: `You would be subscribed to ${tier.toUpperCase()} in production!`,
              });
              
              // Navigate to success page
              setTimeout(() => {
                navigate(`/somatech?module=dashboard&subscription=success&tier=${tier}`);
              }, 2000);
            }
          };
          stripeScript.onerror = () => {
            throw new Error('Failed to load Stripe.js');
          };
          document.head.appendChild(stripeScript);
          return;
        }
        
        throw error;
      }

      if (data?.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
      
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start checkout process. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const getTierIcon = (tier: SubscriptionTier) => {
    switch (tier) {
      case 'free':
        return <Star className="h-6 w-6" />;
      case 'tier1':
        return <Zap className="h-6 w-6" />;
      case 'tier2':
        return <Crown className="h-6 w-6" />;
      case 'tier3':
        return <Rocket className="h-6 w-6" />;
    }
  };

  const getTierColor = (tier: SubscriptionTier) => {
    switch (tier) {
      case 'free':   return '';
      case 'tier1':  return 'border-primary/40 ring-1 ring-primary/20';
      case 'tier2':  return '';
      case 'tier3':  return '';
    }
  };

  const getTierBadge = (tier: SubscriptionTier) => {
    switch (tier) {
      case 'tier1':
        return <Badge variant="secondary">Most Popular</Badge>;
      case 'tier2':
        return <Badge variant="secondary">Advanced</Badge>;
      case 'tier3':
        return <Badge variant="secondary">Premium</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b relative z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <button
                onClick={() => navigate('/')}
                className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
              >
                <div className="h-8 w-8">
                  <SomaTechLogo width={32} height={32} />
                </div>
                <span className="text-xl font-bold text-gray-900">SomaTech</span>
              </button>
              <div className="hidden md:flex space-x-6">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Dashboard button clicked, user:', user);
                    if (user) {
                      navigate('/?module=dashboard');
                    } else {
                      navigate('/');
                    }
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Account button clicked');
                      navigate('/?module=account');
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <User className="h-4 w-4" />
                    Account
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Go to App button clicked');
                      navigate('/?module=dashboard');
                    }}
                    className="cursor-pointer"
                  >
                    Go to App
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Sign In button clicked');
                      setShowAuthDialog(true);
                    }}
                    className="cursor-pointer"
                  >
                    Sign In
                  </Button>
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Get Started button clicked');
                      setShowAuthDialog(true);
                    }}
                    className="cursor-pointer"
                  >
                    Get Started
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="py-12">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-3">
              Subscription Plans
            </h1>
            <p className="text-base text-muted-foreground max-w-xl mx-auto">
              Professional-grade financial analysis tools. Start free, upgrade when you're ready.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {Object.values(SUBSCRIPTION_PLANS).map((plan) => (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${getTierColor(plan.id)}`}
              >
                {getTierBadge(plan.id) && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    {getTierBadge(plan.id)}
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-muted rounded-md text-muted-foreground">
                      {getTierIcon(plan.id)}
                    </div>
                    <CardTitle className="text-lg font-semibold">
                      {plan.name}
                    </CardTitle>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold tabular-nums">
                      ${plan.price}
                    </span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>

                  <CardDescription className="mt-1">
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 gap-5">
                  <ul className="space-y-2.5 flex-1">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={loading === plan.id}
                    variant={plan.id === 'tier1' ? 'default' : 'outline'}
                    className="w-full"
                  >
                    {loading === plan.id ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                        Processing…
                      </>
                    ) : plan.id === 'free' ? 'Get Started' : 'Subscribe'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Trust signals */}
          <div className="mt-12">
            <TrustSignals
              layout="strip"
              signals={['ssl', 'payments', 'cancel', 'guarantee', 'privacy']}
              className="justify-center"
            />
          </div>

          {/* Disclaimer */}
          <div className="mt-8 max-w-3xl mx-auto">
            <FinancialDisclaimer compact />
          </div>
        </div>
      </div>

      {/* Auth Dialog */}
      <AuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onAuthSuccess={() => {
          setShowAuthDialog(false);
          toast({
            title: "Welcome to SomaTech",
            description: "Your account is ready. Start exploring the platform.",
          });
          // Redirect to dashboard after successful sign in
          setTimeout(() => {
            navigate('/?module=dashboard');
          }, 500);
        }}
      />
    </div>
  );
};

export default PricingPage;