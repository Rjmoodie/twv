/**
 * geocode-real-estate-leads
 *
 * Fills in latitude/longitude for leads that have an address but no coordinates.
 * Uses the Mapbox Geocoding API (free tier: 100k requests/month).
 *
 * Targets: la_violations and hud_reo (both have addresses, neither has coords).
 * Can be called with { sources: ["la_violations"] } to target a specific source.
 *
 * Env vars required:
 *   MAPBOX_TOKEN          — secret-scoped Mapbox token
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   FETCH_TRIGGER_SECRET  — for server-to-server calls
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, corsError, CORS_HEADERS } from "../_shared/cors.ts";

// Sources that ship without coordinates
const GEOCODE_SOURCES = ["la_violations", "hud_reo"];

// Mapbox forward geocoding — returns best match for a US address
async function geocodeAddress(
  address: string,
  city: string,
  state: string,
  token: string,
): Promise<{ lat: number; lng: number } | null> {
  const query = [address, city, state, "US"].filter(Boolean).join(", ");
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${token}&country=US&types=address&limit=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const feature = json.features?.[0];
    if (!feature) return null;
    const [lng, lat] = feature.center;
    return { lat, lng };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return corsError("Unauthorized", 401);

  const token        = authHeader.replace("Bearer ", "");
  const triggerSecret = Deno.env.get("FETCH_TRIGGER_SECRET");
  const isServerTrigger = triggerSecret && token === triggerSecret;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (!isServerTrigger) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return corsError("Unauthorized", 401);
  }

  const mapboxToken = Deno.env.get("MAPBOX_TOKEN");
  if (!mapboxToken) return corsError("MAPBOX_TOKEN not configured", 500);

  const body    = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const sources: string[] = body.sources ?? GEOCODE_SOURCES;
  const limit   = Number(body.limit ?? 500);

  const summary: Record<string, { checked: number; geocoded: number; failed: number }> = {};

  for (const source of sources) {
    if (!GEOCODE_SOURCES.includes(source)) {
      summary[source] = { checked: 0, geocoded: 0, failed: 0 };
      continue;
    }

    // Load leads with address but missing coordinates
    const { data: leads, error } = await supabase
      .from("real_estate_leads")
      .select("id, property_address, city, state")
      .eq("data_source", source)
      .is("latitude", null)
      .not("property_address", "is", null)
      .limit(limit);

    if (error || !leads?.length) {
      summary[source] = { checked: 0, geocoded: 0, failed: 0 };
      continue;
    }

    let geocoded = 0;
    let failed   = 0;

    // Process in batches of 10 concurrent requests
    const BATCH = 10;
    for (let i = 0; i < leads.length; i += BATCH) {
      const batch = leads.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (lead) => {
          const coords = await geocodeAddress(
            lead.property_address ?? "",
            lead.city ?? "",
            lead.state ?? "",
            mapboxToken,
          );
          if (!coords) { failed++; return; }
          const { error: updateErr } = await supabase
            .from("real_estate_leads")
            .update({ latitude: coords.lat, longitude: coords.lng })
            .eq("id", lead.id);
          if (updateErr) { failed++; } else { geocoded++; }
        })
      );
      // Small delay to stay within Mapbox rate limits (300 req/min free tier)
      if (i + BATCH < leads.length) await new Promise(r => setTimeout(r, 250));
    }

    summary[source] = { checked: leads.length, geocoded, failed };
    console.log(`[${source}] geocoded ${geocoded}/${leads.length} leads`);
  }

  const totalGeocoded = Object.values(summary).reduce((a, s) => a + s.geocoded, 0);
  return corsResponse({ success: true, summary, totalGeocoded });
});
