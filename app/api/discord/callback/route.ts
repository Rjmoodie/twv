import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  
  if (error) {
    console.error("Discord OAuth error:", error);
    return NextResponse.redirect(
      new URL(`/discord/link?error=${encodeURIComponent(error)}`, req.url)
    );
  }
  
  if (!code) {
    return NextResponse.redirect(
      new URL("/discord/link?error=missing_code", req.url)
    );
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("Discord token exchange failed:", errorText);
      return NextResponse.redirect(
        new URL("/discord/link?error=token_exchange_failed", req.url)
      );
    }

    const tokenJson = await tokenRes.json();
    
    // Get Discord user information
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { 
        Authorization: `${tokenJson.token_type} ${tokenJson.access_token}` 
      },
    });

    if (!userRes.ok) {
      const errorText = await userRes.text();
      console.error("Discord user fetch failed:", errorText);
      return NextResponse.redirect(
        new URL("/discord/link?error=user_fetch_failed", req.url)
      );
    }

    const userJson = await userRes.json(); // { id, username, discriminator, ... }

    // Get Supabase user
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error("Supabase user error:", userError);
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Save Discord link
    const { error: linkError } = await supabase
      .from("discord_links")
      .upsert({ 
        user_id: user.id, 
        discord_user_id: userJson.id 
      });

    if (linkError) {
      console.error("Discord link save error:", linkError);
      return NextResponse.redirect(
        new URL("/discord/link?error=link_save_failed", req.url)
      );
    }

    // Check if user has an active subscription and enqueue role job
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .single();

    if (subscription && ["active", "trialing", "past_due"].includes(subscription.status)) {
      // Enqueue Discord role grant job
      await supabase
        .from("discord_role_jobs")
        .insert({ 
          user_id: user.id, 
          action: "grant",
          run_after: new Date().toISOString()
        });
    }

    return NextResponse.redirect(
      new URL("/discord/link?success=linked", req.url)
    );

  } catch (error) {
    console.error("Discord callback error:", error);
    return NextResponse.redirect(
      new URL("/discord/link?error=callback_failed", req.url)
    );
  }
}

