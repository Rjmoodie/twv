import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-DONATION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Processing donation request");
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { 
      campaign_id, 
      amount, 
      donor_name, 
      donor_email, 
      message, 
      is_anonymous 
    } = await req.json();

    logStep("Donation data received", { campaign_id, amount, donor_email: donor_email || 'anonymous' });

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('funding_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      throw new Error("Campaign not found");
    }

    logStep("Campaign found", { title: campaign.title });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Create Stripe customer if email provided and not anonymous
    let customerId = undefined;
    if (donor_email && !is_anonymous) {
      const existingCustomers = await stripe.customers.list({
        email: donor_email,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: donor_email,
          name: donor_name || undefined,
        });
        customerId = customer.id;
      }
      logStep("Customer processed", { customerId });
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : (donor_email || undefined),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Donation to ${campaign.title}`,
              description: message || "Thank you for your support!",
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/somatech?donation=success&campaign=${campaign_id}`,
      cancel_url: `${req.headers.get("origin")}/somatech?donation=cancelled&campaign=${campaign_id}`,
      metadata: {
        campaign_id,
        donor_name: donor_name || "",
        donor_email: donor_email || "",
        message: message || "",
        is_anonymous: is_anonymous.toString(),
      }
    });

    logStep("Checkout session created", { sessionId: session.id });

    // Store pending donation record
    const { error: donationError } = await supabaseClient
      .from('donations')
      .insert({
        campaign_id,
        donor_name: is_anonymous ? null : donor_name,
        donor_email: is_anonymous ? null : donor_email,
        amount,
        message,
        is_anonymous,
        stripe_payment_intent_id: session.id,
      });

    if (donationError) {
      logStep("Error creating donation record", donationError);
      throw new Error("Failed to create donation record");
    }

    logStep("Donation record created successfully");

    return new Response(JSON.stringify({ 
      checkout_url: session.url,
      session_id: session.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR processing donation", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});