// SomaTech Stripe Checkout Edge Function
// Creates Stripe Checkout Sessions for subscription plans

import Stripe from "npm:stripe@16.6.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

// Price mapping for different subscription plans
const PRICE_MAP: Record<string, string> = {
  tier1: Deno.env.get("STRIPE_TIER1_PRICE_ID")!,
  tier2: Deno.env.get("STRIPE_TIER2_PRICE_ID")!,
  tier3: Deno.env.get("STRIPE_TIER3_PRICE_ID")!,
  // Legacy aliases — remove once all clients are updated
  pro_monthly: Deno.env.get("PRICE_PRO_MONTHLY")!,
  pro_annual: Deno.env.get("PRICE_PRO_ANNUAL")!,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  // Create the Supabase client once — used throughout the handler
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE")!
  );

  // Require authentication — guest checkout is not supported for subscriptions
  // to prevent orphaned Stripe customers with no matching user record.
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Authentication required to start a subscription" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = auth.replace("Bearer ", "");
  const { data: userInfo, error: userErr } = await supabase.auth.getUser(token);

  if (userErr || !userInfo.user) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired session" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const userId = userInfo.user.id;
  const userEmail = userInfo.user.email;

  try {
    const body = await req.json().catch(() => ({}));
    const plan = String(body.plan ?? "");
    const price = PRICE_MAP[plan];

    if (!price) {
      return new Response(
        JSON.stringify({ error: `Invalid plan: ${plan}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find or create Stripe customer for this user
    const { data: bc } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    let customerId = bc?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;

      await supabase.from("billing_customers").upsert({
        user_id: userId,
        stripe_customer_id: customerId,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      success_url:
        body.success_url ??
        `${Deno.env.get("APP_URL")}/dashboard?checkout=success`,
      cancel_url:
        body.cancel_url ??
        `${Deno.env.get("APP_URL")}/pricing?checkout=canceled`,
      metadata: {
        supabase_user_id: userId,
        plan,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
