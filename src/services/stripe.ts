import Stripe from 'stripe';
import { supabase } from '@/integrations/supabase/client';
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '@/types/subscription';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })
  : null;

const requireStripe = () => {
  if (!stripe) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY before enabling billing features.');
  }
  return stripe;
};

export interface CreateCheckoutSessionParams {
  userId: string;
  userEmail: string;
  tier: SubscriptionTier;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCustomerPortalSessionParams {
  userId: string;
  returnUrl: string;
}

export class StripeService {
  /**
   * Create a Stripe checkout session for subscription
   */
  static async createCheckoutSession({
    userId,
    userEmail,
    tier,
    successUrl,
    cancelUrl
  }: CreateCheckoutSessionParams) {
    const plan = SUBSCRIPTION_PLANS[tier];
    
    if (tier === 'free') {
      throw new Error('Cannot create checkout session for free tier');
    }

    if (!plan.stripePriceId) {
      throw new Error(`Stripe price ID not configured for tier: ${tier}`);
    }

    const stripeClient = requireStripe();

    try {
      // Check if customer already exists
      let customerId: string;
      const existingCustomers = await stripeClient.customers.list({
        email: userEmail,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        // Create new customer
        const customer = await stripeClient.customers.create({
          email: userEmail,
          metadata: {
            userId: userId
          }
        });
        customerId = customer.id;
      }

      const session = await stripeClient.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: userId,
          tier: tier
        },
        subscription_data: {
          metadata: {
            userId: userId,
            tier: tier
          }
        }
      });

      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Create a customer portal session for subscription management
   */
  static async createCustomerPortalSession({
    userId,
    returnUrl
  }: CreateCustomerPortalSessionParams) {
    try {
      // Get user's Stripe customer ID from database
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();

      if (!profile?.stripe_customer_id) {
        throw new Error('No Stripe customer found for user');
      }

      const stripeClient = requireStripe();

        const session = await stripeClient.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: returnUrl,
      });

      return session;
    } catch (error) {
      console.error('Error creating customer portal session:', error);
      throw error;
    }
  }

  /**
   * Get subscription details from Stripe
   */
  static async getSubscription(subscriptionId: string) {
    try {
      const stripeClient = requireStripe();
      const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      console.error('Error retrieving subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(subscriptionId: string, immediately = false) {
    try {
      const stripeClient = requireStripe();
      if (immediately) {
        await stripeClient.subscriptions.cancel(subscriptionId);
      } else {
        await stripeClient.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        });
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription tier
   */
  static async updateSubscription(subscriptionId: string, newTier: SubscriptionTier) {
    try {
      const plan = SUBSCRIPTION_PLANS[newTier];
      const stripeClient = requireStripe();
      
      if (!plan.stripePriceId) {
        throw new Error(`Stripe price ID not configured for tier: ${newTier}`);
      }

      const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
      
      await stripeClient.subscriptions.update(subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: plan.stripePriceId,
        }],
        proration_behavior: 'create_prorations'
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(payload: string, signature: string) {
    try {
      const stripeClient = requireStripe();
      const event = stripeClient.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
      return event;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw error;
    }
  }

  /**
   * Get customer by ID
   */
  static async getCustomer(customerId: string) {
    try {
      const stripeClient = requireStripe();
      const customer = await stripeClient.customers.retrieve(customerId);
      return customer;
    } catch (error) {
      console.error('Error retrieving customer:', error);
      throw error;
    }
  }

  /**
   * List customer subscriptions
   */
  static async getCustomerSubscriptions(customerId: string) {
    try {
      const stripeClient = requireStripe();
      const subscriptions = await stripeClient.subscriptions.list({
        customer: customerId,
        status: 'all'
      });
      return subscriptions;
    } catch (error) {
      console.error('Error retrieving customer subscriptions:', error);
      throw error;
    }
  }
}

