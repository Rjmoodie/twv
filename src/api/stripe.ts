import { supabase } from '@/integrations/supabase/client';
import { SubscriptionTier } from '@/types/subscription';

// In-flight guards — prevents duplicate Stripe sessions from double-clicks or race conditions.
let checkoutInFlight = false;
let portalInFlight = false;

export interface CreateCheckoutSessionParams {
  tier: SubscriptionTier;
  successUrl: string;
  cancelUrl: string;
}

export interface CreatePortalSessionParams {
  returnUrl: string;
}

export class StripeAPI {
  /**
   * Create a Stripe checkout session using Edge Function
   */
  static async createCheckoutSession({
    tier,
    successUrl,
    cancelUrl
  }: CreateCheckoutSessionParams) {
    try {
      // Get the current session (optional for guest checkout)
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const { data, error } = await supabase.functions.invoke('checkout', {
        body: {
          plan: tier, // Edge Function expects 'plan' not 'tier'
          success_url: successUrl,
          cancel_url: cancelUrl
        },
        headers
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Create a customer portal session using Edge Function
   */
  static async createPortalSession({
    returnUrl
  }: CreatePortalSessionParams) {
    try {
      // Get the current session to ensure we have authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('User not authenticated. Please log in to access billing portal.');
      }

      const { data, error } = await supabase.functions.invoke('billing-portal', {
        body: {
          return_url: returnUrl
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw error;
    }
  }

  /**
   * Redirect to Stripe checkout
   */
  static async redirectToCheckout({
    tier,
    successUrl,
    cancelUrl
  }: CreateCheckoutSessionParams) {
    if (checkoutInFlight) return;
    checkoutInFlight = true;
    try {
      const { sessionId, url } = await this.createCheckoutSession({
        tier,
        successUrl,
        cancelUrl
      });

      if (url) {
        window.location.href = url;
      } else {
        // Fallback: show a message that Stripe is not configured
        alert('Payment processing is not yet configured. Please contact support for subscription options.');
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error redirecting to checkout:', error);
      
      // Check if this is a local development environment
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        alert('🚧 Development Mode: Stripe checkout not configured.\n\nTo test payments:\n1. Deploy Edge Functions to Supabase\n2. Set environment variables in Supabase dashboard\n3. Configure Stripe Price IDs\n\nFor now, you can test with mock data.');
        return; // Don't throw error in development
      } else {
        // Production: show user-friendly message
        alert('Unable to process payment at this time. Please try again later or contact support.');
        throw error;
      }
    } finally {
      checkoutInFlight = false;
    }
  }

  /**
   * Redirect to customer portal
   */
  static async redirectToPortal({
    returnUrl
  }: CreatePortalSessionParams) {
    if (portalInFlight) return;
    portalInFlight = true;
    try {
      const { url } = await this.createPortalSession({
        returnUrl
      });

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No portal URL received');
      }
    } catch (error) {
      console.error('Error redirecting to portal:', error);
      throw error;
    } finally {
      portalInFlight = false;
    }
  }
}