// TW Ventures Stripe Webhook Handler
// Processes Stripe webhook events and updates subscription status

import Stripe from "npm:stripe@16.6.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

/** Map a Stripe price ID to our internal tier name. Returns null if unrecognised. */
function priceIdToTier(priceId: string): string | null {
  const map: Record<string, string> = {
    [Deno.env.get("STRIPE_TIER1_PRICE_ID") ?? ""]: "tier1",
    [Deno.env.get("STRIPE_TIER2_PRICE_ID") ?? ""]: "tier2",
    [Deno.env.get("STRIPE_TIER3_PRICE_ID") ?? ""]: "tier3",
    // Legacy price IDs — keep until all customers are migrated
    [Deno.env.get("PRICE_PRO_MONTHLY") ?? ""]: "tier1",
    [Deno.env.get("PRICE_PRO_ANNUAL") ?? ""]: "tier2",
  };
  return map[priceId] ?? null;
}

/**
 * Sync subscription state to BOTH the subscriptions table and the
 * denormalised user_profiles columns so the frontend reads fast.
 *
 * When a subscription is deleted/canceled we downgrade the profile to 'free'.
 */
async function upsertSub(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  sub: Stripe.Subscription,
  tier: string,
  status: string
) {
  const isCanceled = status === "canceled" || status === "unpaid";
  const effectiveTier = isCanceled ? "free" : tier;
  const profileStatus = status === "past_due"
    ? "past_due"
    : status === "active" || status === "trialing"
      ? "active"
      : status === "unpaid" || status === "incomplete" || status === "incomplete_expired"
        ? "unpaid"
        : "canceled";
  const priceId = sub.items.data[0]?.price?.id ?? null;

  // 1. Write to subscriptions table (source of truth for Stripe data)
  const { error: subscriptionError } = await supabase.from("subscriptions").upsert({
    user_id: userId,
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    plan: effectiveTier,
    status,
    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_subscription_id" });
  if (subscriptionError) throw subscriptionError;

  // 2. Denormalise onto user_profiles for fast frontend reads
  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({
      subscription_tier: effectiveTier,
      subscription_status: profileStatus,
      subscription_ends_at: isCanceled
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      stripe_customer_id: String(sub.customer),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (profileError) throw profileError;
}

/**
 * Idempotency guard — returns true if this event has already been processed.
 * On first call it records the event so retries are skipped.
 */
async function isAlreadyProcessed(
  supabase: ReturnType<typeof createClient>,
  eventId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("processed_webhook_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function markProcessed(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  eventType: string,
) {
  const { error } = await supabase
    .from("processed_webhook_events")
    .insert({ event_id: eventId, event_type: eventType });
  // A concurrent delivery can finish the same idempotent updates first.
  if (error && error.code !== "23505") throw error;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const raw = await req.text();
    const sig = req.headers.get("stripe-signature") ?? "";

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(raw, sig, endpointSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Idempotency — skip if already processed (Stripe retries for up to 3 days)
    if (await isAlreadyProcessed(supabase, event.id)) {
      console.log(`Skipping already-processed event: ${event.id}`);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing webhook event: ${event.type} (${event.id})`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;

        // Look up the user via billing_customers
        let { data: bc } = await supabase
          .from("billing_customers")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        // Guest checkout fallback: try to match by email and create the record
        if (!bc?.user_id && session.customer_details?.email) {
          const email = session.customer_details.email;
          const { data: authUsers } = await supabase
            .from("user_profiles")
            .select("id")
            .eq("email", email)
            .maybeSingle();

          if (authUsers?.id) {
            await supabase.from("billing_customers").upsert({
              user_id: authUsers.id,
              stripe_customer_id: customerId,
            });
            bc = { user_id: authUsers.id };
          }
        }

        if (!bc?.user_id) {
          console.error("No user found for customer:", customerId, "— cannot fulfil subscription");
          break;
        }

        if (!session.subscription) {
          console.error("No subscription in checkout session:", session.id);
          break;
        }

        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = sub.items.data[0]?.price?.id ?? "";
        const tier = priceIdToTier(priceId);

        if (!tier) {
          console.error("Unrecognised price ID:", priceId);
          break;
        }

        await upsertSub(supabase, bc.user_id, sub, tier, sub.status);
        console.log(`Checkout completed: user=${bc.user_id} tier=${tier}`);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { data: bc } = await supabase
          .from("billing_customers")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (!bc?.user_id) {
          console.error("No user found for customer:", customerId);
          break;
        }

        const priceId = sub.items.data[0]?.price?.id ?? "";
        const tier = priceIdToTier(priceId);

        if (!tier) {
          console.error("Unrecognised price ID:", priceId);
          break;
        }

        await upsertSub(supabase, bc.user_id, sub, tier, sub.status);
        console.log(`Subscription updated: user=${bc.user_id} tier=${tier} status=${sub.status}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { data: bc } = await supabase
          .from("billing_customers")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (!bc?.user_id) {
          console.error("No user found for customer:", customerId);
          break;
        }

        // Deletion always means downgrade to free
        await upsertSub(supabase, bc.user_id, sub, "free", "canceled");
        console.log(`Subscription deleted: user=${bc.user_id} → downgraded to free`);
        break;
      }

      case "invoice.payment_succeeded": {
        // Re-activate a past_due subscription when payment clears
        const inv = event.data.object as Stripe.Invoice;
        const subId = inv.subscription as string;
        if (!subId) break;

        const sub = await stripe.subscriptions.retrieve(subId);
        const customerId = sub.customer as string;

        const { data: bc } = await supabase
          .from("billing_customers")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (!bc?.user_id) break;

        const priceId = sub.items.data[0]?.price?.id ?? "";
        const tier = priceIdToTier(priceId);
        if (!tier) break;

        await upsertSub(supabase, bc.user_id, sub, tier, "active");
        console.log(`Payment succeeded: user=${bc.user_id} tier=${tier} re-activated`);
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = inv.subscription as string;
        if (!subId) break;

        const sub = await stripe.subscriptions.retrieve(subId);
        const customerId = sub.customer as string;

        const { data: bc } = await supabase
          .from("billing_customers")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (!bc?.user_id) {
          console.error("No user found for customer:", customerId);
          break;
        }

        // Mark as past_due — keep access during Stripe's retry window (7 days by default)
        // Access is fully revoked only when customer.subscription.deleted fires
        await supabase
          .from("user_profiles")
          .update({ subscription_status: "past_due", updated_at: new Date().toISOString() })
          .eq("id", bc.user_id);

        await supabase
          .from("subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("user_id", bc.user_id);

        console.log(`Payment failed: user=${bc.user_id} marked past_due (access retained)`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
        break;
    }

    await markProcessed(supabase, event.id, event.type);

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
