/**
 * plaid-link
 *
 * Handles two actions:
 *   create_link_token  — returns a short-lived token to initialize Plaid Link widget
 *   exchange_token     — exchanges the public_token after user connects a bank,
 *                        saves access_token to plaid_secrets (server-only),
 *                        saves metadata to plaid_connections (user-readable)
 *
 * POST body: { action: 'create_link_token' | 'exchange_token', public_token?: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsResponse, corsError, CORS_HEADERS } from "../_shared/cors.ts";

const PLAID_ENV  = Deno.env.get("PLAID_ENV") ?? "production";
const PLAID_BASE = {
  sandbox:    "https://sandbox.plaid.com",
  development:"https://development.plaid.com",
  production: "https://production.plaid.com",
}[PLAID_ENV] ?? "https://production.plaid.com";

async function plaidPost(endpoint: string, body: object): Promise<Record<string, unknown>> {
  const res = await fetch(`${PLAID_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PLAID-CLIENT-ID": Deno.env.get("PLAID_CLIENT_ID")!,
      "PLAID-SECRET":    Deno.env.get("PLAID_SECRET")!,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error_message ?? `Plaid ${endpoint} → ${res.status}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return corsError("Method not allowed", 405);

  // ── Auth ───────────────────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return corsError("Authentication required", 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    auth.replace("Bearer ", "")
  );
  if (authErr || !user) return corsError("Invalid or expired session", 401);

  const clientId = Deno.env.get("PLAID_CLIENT_ID");
  const secret   = Deno.env.get("PLAID_SECRET");
  if (!clientId || !secret) return corsError("Plaid credentials not configured", 500);

  try {
    const body = await req.json();
    const { action } = body;

    // ── create_link_token ───────────────────────────────────────────────────
    if (action === "create_link_token") {
      const data = await plaidPost("/link/token/create", {
        user: { client_user_id: user.id },
        client_name: "TW Ventures",
        products: ["transactions"],
        country_codes: ["US"],
        language: "en",
        webhook: `${Deno.env.get("SUPABASE_URL")}/functions/v1/plaid-sync`,
      });

      return corsResponse({ link_token: data.link_token });
    }

    // ── exchange_token ──────────────────────────────────────────────────────
    if (action === "exchange_token") {
      const { public_token } = body;
      if (!public_token) return corsError("public_token is required", 400);

      // Enforce per-user connection limit before exchanging the token
      const [{ count }, profileRow] = await Promise.all([
        supabase.from("plaid_connections").select("*", { count: "exact", head: true }).eq("user_id", user.id).then(r => ({ count: r.count ?? 0 })),
        supabase.from("financial_profiles").select("max_plaid_connections").eq("user_id", user.id).maybeSingle(),
      ]);
      const maxAllowed = (profileRow.data as any)?.max_plaid_connections ?? 1;
      if (count >= maxAllowed) {
        return corsError(
          `Connection limit reached (${count}/${maxAllowed}). Disconnect an existing bank to add a new one.`,
          403
        );
      }

      // Exchange for permanent access token
      const exchangeData = await plaidPost("/item/public_token/exchange", { public_token });
      const accessToken = exchangeData.access_token as string;
      const itemId      = exchangeData.item_id as string;

      // Fetch institution + account metadata (never store balances here)
      const [itemData, accountsData] = await Promise.all([
        plaidPost("/item/get",      { access_token: accessToken }),
        plaidPost("/accounts/get",  { access_token: accessToken }),
      ]);

      const institution = (itemData.item as any).institution_id
        ? await plaidPost("/institutions/get_by_id", {
            institution_id: (itemData.item as any).institution_id,
            country_codes: ["US"],
          }).catch(() => null)
        : null;

      const accounts = ((accountsData.accounts as any[]) ?? []).map((a: any) => ({
        id:      a.account_id,
        name:    a.name,
        mask:    a.mask,
        type:    a.type,
        subtype: a.subtype,
      }));

      // Store access_token in service-only table
      await supabase.from("plaid_secrets").upsert({
        item_id:      itemId,
        access_token: accessToken,
      }, { onConflict: "item_id" });

      // Store metadata in user-readable table
      await supabase.from("plaid_connections").upsert({
        user_id:          user.id,
        item_id:          itemId,
        institution_id:   (itemData.item as any).institution_id ?? null,
        institution_name: (institution?.institution as any)?.name ?? "Your Bank",
        accounts,
        last_synced_at:   null,
        sync_cursor:      null,
      }, { onConflict: "user_id,item_id" });

      return corsResponse({
        connected:        true,
        item_id:          itemId,
        institution_id:   (itemData.item as any).institution_id ?? null,
        institution_name: (institution?.institution as any)?.name ?? "Your Bank",
        accounts,
      });
    }

    return corsError(`Unknown action: ${action}`, 400);
  } catch (err) {
    console.error("plaid-link error:", err);
    return corsError(err instanceof Error ? err.message : "Internal error", 500);
  }
});
