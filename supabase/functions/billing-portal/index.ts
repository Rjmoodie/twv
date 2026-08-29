// TW Ventures Stripe Billing Portal Edge Function
// Creates Stripe Billing Portal sessions for subscription management

import Stripe from "npm:stripe@16.6.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { 
  apiVersion: "2024-06-20" 
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { 
      status: 405,
      headers: corsHeaders 
    });
  }

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { 
      status: 401,
      headers: corsHeaders 
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, 
      Deno.env.get("SUPABASE_SERVICE_ROLE")!
    );
    
    const token = auth.replace("Bearer ", "");
    const { data: userInfo } = await supabase.auth.getUser(token);
    const userId = userInfo.user?.id;
    
    if (!userId) {
      return new Response("Unauthorized", { 
        status: 401,
        headers: corsHeaders 
      });
    }

    const { data: bc } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (!bc?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: "No customer found" }), 
        { 
          status: 400,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: bc.stripe_customer_id,
      return_url: `${Deno.env.get("APP_URL")}/account`,
    });

    return new Response(
      JSON.stringify({ url: portal.url }), 
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Billing portal error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
