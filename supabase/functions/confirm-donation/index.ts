import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONFIRM-DONATION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Confirming donation payment");
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { session_id } = await req.json();
    logStep("Session ID received", { session_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id);
    logStep("Session retrieved", { 
      payment_status: session.payment_status,
      status: session.status 
    });

    if (session.payment_status === 'paid' && session.status === 'complete') {
      // Extract metadata
      const {
        campaign_id,
        donor_name,
        donor_email,
        message,
        is_anonymous
      } = session.metadata || {};

      const amount = (session.amount_total || 0) / 100; // Convert from cents

      // Update or create the donation record
      const { data: existingDonation } = await supabaseClient
        .from('donations')
        .select('id')
        .eq('stripe_payment_intent_id', session_id)
        .single();

      if (existingDonation) {
        // Update existing record
        const { error } = await supabaseClient
          .from('donations')
          .update({
            amount,
            donor_name: is_anonymous === 'true' ? null : donor_name,
            donor_email: is_anonymous === 'true' ? null : donor_email,
            message,
            is_anonymous: is_anonymous === 'true',
          })
          .eq('stripe_payment_intent_id', session_id);

        if (error) {
          throw new Error("Failed to update donation record");
        }
      } else {
        // Create new donation record
        const { error } = await supabaseClient
          .from('donations')
          .insert({
            campaign_id,
            donor_name: is_anonymous === 'true' ? null : donor_name,
            donor_email: is_anonymous === 'true' ? null : donor_email,
            amount,
            message,
            is_anonymous: is_anonymous === 'true',
            stripe_payment_intent_id: session_id,
          });

        if (error) {
          throw new Error("Failed to create donation record");
        }
      }

      logStep("Donation confirmed and recorded");

      return new Response(JSON.stringify({ 
        success: true,
        donation: {
          campaign_id,
          amount,
          donor_name: is_anonymous === 'true' ? 'Anonymous' : donor_name,
          message
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      logStep("Payment not completed", { 
        payment_status: session.payment_status,
        status: session.status 
      });
      
      return new Response(JSON.stringify({ 
        success: false,
        error: "Payment not completed" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR confirming donation", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});