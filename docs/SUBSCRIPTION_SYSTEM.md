# 🎯 Subscription System Implementation Guide

## **📋 Overview**

This guide covers the complete implementation of the Somatech subscription system with Stripe integration, Discord role syncing, and LMS access control.

## **🏗️ Architecture**

### **Components Implemented:**

1. **Database Schema** ✅
   - `profiles` - User profiles with subscription tiers
   - `subscriptions` - Stripe subscription data
   - `discord_role_mappings` - Discord role configuration
   - `lms_course_mappings` - LMS course access

2. **Supabase SQL Functions** ✅
   - `create_stripe_checkout_session` - Handle Stripe checkout
   - `create_stripe_portal_session` - Customer portal access
   - `handle_stripe_webhook` - Process Stripe events
   - `get_user_subscription_status` - Get subscription status
   - `get_user_subscription_features` - Get available features
   - `user_can_access_feature` - Check feature access

3. **Client-Side Services** ✅
   - `StripeService` - Server-side Stripe operations
   - `SubscriptionService` - Business logic
   - `StripeAPI` - Client-side API calls

4. **React Components** ✅
   - `SubscriptionManager` - Manage subscriptions
   - `FeatureGuard` - Protect premium features
   - `useSubscription` - React hook

## **🚀 Setup Instructions**

### **1. Environment Variables**

Create a `.env.local` file with:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (create these in Stripe Dashboard)
STRIPE_TIER1_PRICE_ID=price_...
STRIPE_TIER2_PRICE_ID=price_...
STRIPE_TIER3_PRICE_ID=price_...

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Discord Bot (for role syncing)
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
DISCORD_ROLE_IDS={"free":"...","tier1":"...","tier2":"...","tier3":"..."}

# LMS Configuration (for Tier 3)
LMS_BASE_URL=https://lms.somatech.com
LMS_API_KEY=...
```

### **2. Stripe Setup**

1. **Create Products in Stripe Dashboard:**
   ```
   Tier 1 - $35/month
   Tier 2 - $45/month  
   Tier 3 - $75/month
   ```

2. **Get Price IDs:**
   - Copy the price IDs from Stripe Dashboard
   - Add them to your environment variables

3. **Configure Webhooks:**
   - Endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_*`

### **3. Deploy Supabase SQL Functions**

```bash
# Deploy SQL functions
npx supabase db push

# Or run the deployment script
.\deploy-subscription-functions.ps1
```

**Then run the SQL functions script:**
1. Go to: https://supabase.com/dashboard/project/[your-project]/sql
2. Copy and run: `subscription-sql-functions.sql`

### **4. Database Setup**

Run the security fix script to create tables:

```sql
-- Run: fix-security-issues-conflict-free.sql
-- This creates all subscription tables with RLS policies
```

## **💻 Usage Examples**

### **1. Basic Subscription Management**

```tsx
import { useSubscription } from '@/hooks/useSubscription';

function Dashboard() {
  const { 
    subscriptionTier, 
    isActive, 
    subscribeToTier, 
    openCustomerPortal 
  } = useSubscription();

  return (
    <div>
      <p>Current tier: {subscriptionTier}</p>
      <p>Status: {isActive ? 'Active' : 'Inactive'}</p>
      
      <button onClick={() => subscribeToTier('tier1')}>
        Upgrade to Tier 1
      </button>
      
      <button onClick={openCustomerPortal}>
        Manage Subscription
      </button>
    </div>
  );
}
```

### **2. Feature Protection**

```tsx
import { FeatureGuard, OptionsTradingGuard } from '@/components/somatech/FeatureGuard';

function TradingPage() {
  return (
    <OptionsTradingGuard>
      <div>
        <h1>Options Trading Discord</h1>
        <p>Welcome to our exclusive community!</p>
      </div>
    </OptionsTradingGuard>
  );
}
```

### **3. Subscription Manager Component**

```tsx
import { SubscriptionManager } from '@/components/somatech/SubscriptionManager';

function SettingsPage() {
  return (
    <div>
      <h1>Subscription Settings</h1>
      <SubscriptionManager 
        showCurrentStatus={true}
        showUpgradeOptions={true}
      />
    </div>
  );
}
```

## **🔄 Subscription Flow**

### **1. User Subscribes:**
1. User clicks "Subscribe" on pricing page
2. `StripeAPI.redirectToCheckout()` called
3. User redirected to Stripe checkout
4. Payment processed by Stripe

### **2. Webhook Processing:**
1. Stripe sends webhook to your webhook endpoint
2. Call `handle_stripe_webhook` SQL function with event data
3. Function updates database with subscription data
4. User profile updated with new tier
5. Discord role sync triggered (TODO)

### **3. Feature Access:**
1. User accesses protected feature
2. `FeatureGuard` checks subscription tier
3. Access granted or upgrade prompt shown

## **🎯 Next Steps**

### **Immediate (High Priority):**
1. **Set up Stripe products and get price IDs**
2. **Deploy Supabase Edge Functions**
3. **Configure webhook endpoints**
4. **Test subscription flow**

### **Short Term:**
1. **Implement Discord bot for role syncing**
2. **Add LMS integration for Tier 3**
3. **Create admin dashboard for subscription management**
4. **Add email notifications for subscription events**

### **Long Term:**
1. **Analytics and reporting**
2. **A/B testing for pricing**
3. **Referral system**
4. **Enterprise features**

## **🧪 Testing**

### **Test Subscription Flow:**
1. Create test user account
2. Navigate to pricing page
3. Subscribe to Tier 1
4. Verify webhook processing
5. Check database updates
6. Test feature access

### **Test Webhook:**
```bash
# Use Stripe CLI for local testing
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

## **📊 Monitoring**

### **Key Metrics to Track:**
- Subscription conversion rates
- Churn rates by tier
- Feature usage by subscription level
- Revenue per user
- Webhook processing success rates

### **Logs to Monitor:**
- Stripe webhook processing
- Database update errors
- Discord role sync failures
- LMS access issues

## **🔒 Security Considerations**

1. **Webhook Signature Verification** ✅
2. **RLS Policies on All Tables** ✅
3. **Environment Variable Security** ✅
4. **Input Validation** ✅
5. **Rate Limiting** (TODO)

## **📚 Resources**

- [Stripe Documentation](https://stripe.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Discord Bot API](https://discord.com/developers/docs)
- [React Hook Patterns](https://reactjs.org/docs/hooks-intro.html)

---

**🎉 Your subscription system is ready to go! Follow the setup instructions and start testing the flow.**
