/**
 * discord-oauth-callback
 *
 * Handles Discord OAuth2 code exchange after user authorizes the bot.
 * Saves discord_id + discord_username to user_profiles and redirects back to /account.
 *
 * Expected query params: ?code=<discord_code>&state=<supabase_jwt>
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISCORD_API = "https://discord.com/api/v10";
const APP_URL = Deno.env.get("APP_URL") ?? "https://somatech.pro";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // Supabase JWT passed as state

  const redirectError = (msg: string) =>
    Response.redirect(`${APP_URL}/account?discord_error=${encodeURIComponent(msg)}`, 302);

  if (!code) return redirectError("No authorization code received from Discord");
  if (!state) return redirectError("Missing state — please try connecting again");

  const clientId = Deno.env.get("DISCORD_CLIENT_ID");
  const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const redirectUri = `${supabaseUrl}/functions/v1/discord-oauth-callback`;

  if (!clientId || !clientSecret) return redirectError("Discord app not configured");

  try {
    // ── Exchange code for Discord access token ───────────────────────────────
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Discord token exchange failed:", err);
      return redirectError("Discord authorization failed — please try again");
    }

    const { access_token } = await tokenRes.json();

    // ── Get Discord user identity ────────────────────────────────────────────
    const meRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!meRes.ok) return redirectError("Could not fetch Discord user info");

    const discordUser: { id: string; username: string; discriminator: string } = await meRes.json();

    // ── Verify Supabase session from state ───────────────────────────────────
    const supabase = createClient(supabaseUrl!, serviceRoleKey!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(state);

    if (authErr || !user) return redirectError("Session expired — please sign in again");

    // ── Persist Discord identity ─────────────────────────────────────────────
    const discordUsername =
      discordUser.discriminator === "0"
        ? discordUser.username                                    // new username system
        : `${discordUser.username}#${discordUser.discriminator}`; // legacy

    const { error: updateErr } = await supabase
      .from("user_profiles")
      .update({ discord_id: discordUser.id, discord_username: discordUsername })
      .eq("id", user.id);

    if (updateErr) {
      console.error("Failed to save Discord identity:", updateErr);
      return redirectError("Could not save Discord connection — please try again");
    }

    // Trigger role sync for this user
    await supabase.functions.invoke("discord-role-sync", {
      body: { user_id: user.id },
    }).catch((e) => console.error("Role sync error (non-fatal):", e));

    return Response.redirect(`${APP_URL}/account?discord_connected=1`, 302);
  } catch (err) {
    console.error("discord-oauth-callback error:", err);
    return redirectError("Unexpected error — please try again");
  }
});
