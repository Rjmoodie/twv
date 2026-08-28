// SomaTech Discord Role Sync Worker
// Processes Discord role management jobs from the queue

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISCORD_API = "https://discord.com/api";
const BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const GUILD_ID = Deno.env.get("DISCORD_GUILD_ID")!;

// Tier-specific role IDs
const ROLE_TIER1 = Deno.env.get("DISCORD_ROLE_TIER1_ID")!;
const ROLE_TIER2 = Deno.env.get("DISCORD_ROLE_TIER2_ID")!;
const ROLE_TIER3 = Deno.env.get("DISCORD_ROLE_TIER3_ID")!;

// Fallback to single role if tier-specific ones aren't set
const ROLE_PRO = Deno.env.get("DISCORD_ROLE_PRO_ID") || ROLE_TIER3;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function discord(method: string, path: string, body?: unknown) {
  const res = await fetch(`${DISCORD_API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Discord ${method} ${path} -> ${res.status}: ${errorText}`);
  }
  
  return res;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, 
      Deno.env.get("SUPABASE_SERVICE_ROLE")!
    );

    // Fetch up to 25 jobs due now
    const { data: jobs, error: jobsError } = await supabase
      .from("discord_role_jobs")
      .select("id, user_id, action, attempts, subscription_tier")
      .lte("run_after", new Date().toISOString())
      .order("id", { ascending: true })
      .limit(25);

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch jobs' }), 
        { 
          status: 500,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    if (!jobs?.length) {
      return new Response(
        JSON.stringify({ message: "no-jobs" }), 
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    console.log(`Processing ${jobs.length} Discord role jobs`);

    for (const job of jobs) {
      try {
        // Get Discord user ID for this Supabase user
        const { data: link, error: linkError } = await supabase
          .from("discord_links")
          .select("discord_user_id")
          .eq("user_id", job.user_id)
          .maybeSingle();

        if (linkError) {
          console.error(`Error fetching Discord link for user ${job.user_id}:`, linkError);
          continue;
        }

        if (!link?.discord_user_id) {
          console.log(`No Discord link found for user ${job.user_id}, skipping`);
          // Remove job since user hasn't linked Discord
          await supabase
            .from("discord_role_jobs")
            .delete()
            .eq("id", job.id);
          continue;
        }

        // Determine which role to use based on subscription tier
        let roleId = ROLE_PRO; // fallback
        if (job.subscription_tier) {
          switch (job.subscription_tier) {
            case 'tier1':
              roleId = ROLE_TIER1;
              break;
            case 'tier2':
              roleId = ROLE_TIER2;
              break;
            case 'tier3':
              roleId = ROLE_TIER3;
              break;
            default:
              roleId = ROLE_PRO;
          }
        }

        // Perform Discord role action
        if (job.action === "grant") {
          await discord(
            "PUT", 
            `/guilds/${GUILD_ID}/members/${link.discord_user_id}/roles/${roleId}`
          );
          console.log(`Granted Discord role (${job.subscription_tier || 'default'}) to user ${job.user_id} (${link.discord_user_id})`);
        } else {
          await discord(
            "DELETE", 
            `/guilds/${GUILD_ID}/members/${link.discord_user_id}/roles/${roleId}`
          );
          console.log(`Revoked Discord role (${job.subscription_tier || 'default'}) from user ${job.user_id} (${link.discord_user_id})`);
        }

        // Remove completed job
        await supabase
          .from("discord_role_jobs")
          .delete()
          .eq("id", job.id);

      } catch (e) {
        console.error(`Error processing job ${job.id}:`, e);
        
        // Backoff retry with exponential delay
        const attempts = (job.attempts ?? 0) + 1;
        const delayMs = Math.min(60_000 * Math.pow(2, attempts - 1), 300_000); // Max 5 minutes
        const runAfter = new Date(Date.now() + delayMs).toISOString();
        
        await supabase
          .from("discord_role_jobs")
          .update({ 
            attempts,
            run_after: runAfter
          })
          .eq("id", job.id);

        // If too many attempts, remove the job
        if (attempts >= 5) {
          console.error(`Job ${job.id} failed after ${attempts} attempts, removing`);
          await supabase
            .from("discord_role_jobs")
            .delete()
            .eq("id", job.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: "ok", 
        processed: jobs.length 
      }), 
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Discord role sync error:', error);
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
