/**
 * delete-account
 *
 * Permanently deletes a Supabase Auth user. Must be called with a valid
 * user JWT (Authorization header) so we can confirm the requesting user
 * is deleting their own account. Uses the service-role key to perform the
 * admin deletion.
 *
 * POST body: { user_id: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, corsError, CORS_HEADERS } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return corsError("Missing Authorization header", 401);

    // Verify the requesting user via their JWT
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return corsError("Unauthorized", 401);

    const { user_id } = await req.json();

    // Confirm the JWT user matches the user_id being deleted
    if (user.id !== user_id) return corsError("Forbidden: cannot delete another user's account", 403);

    // Use service role to delete from auth.users
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
    if (deleteError) throw deleteError;

    return corsResponse({ success: true });
  } catch (err) {
    console.error("delete-account error:", err);
    return corsError(err instanceof Error ? err.message : "Internal error", 500);
  }
});
