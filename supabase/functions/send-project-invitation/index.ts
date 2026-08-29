import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS } from '../_shared/cors.ts';
import { renderEmail } from '../_shared/emailTemplates.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
});

type Delivery = {
  invitation_id: string;
  invite_email: string;
  invite_role: string;
  project_name: string;
  expires_at: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('NOTIFICATION_FROM_EMAIL');
  const siteUrl = Deno.env.get('SITE_URL');
  if (!url || !anonKey || !serviceKey) return json({ error: 'Service configuration unavailable' }, 503);
  if (!resendKey || !from || !siteUrl) return json({ error: 'Invitation email delivery is not configured' }, 503);

  let token = '';
  try {
    const body = await req.json() as { invitationToken?: unknown };
    token = typeof body.invitationToken === 'string' ? body.invitationToken.trim() : '';
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: 'Invalid invitation token' }, 400);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Authentication required' }, 401);

  const { data: claimed, error: claimError } = await userClient.rpc('claim_project_invitation_delivery', {
    invitation_token: token,
  });
  if (claimError) return json({ error: 'Invitation could not be authorized' }, 403);
  const delivery = (Array.isArray(claimed) ? claimed[0] : claimed) as Delivery | null;
  if (!delivery) return json({ error: 'Invitation is unavailable, already sent, or currently processing' }, 409);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const clearClaim = async () => {
    await admin.from('project_invitations').update({ email_claimed_at: null }).eq('id', delivery.invitation_id).is('email_sent_at', null);
  };

  const { data: suppression } = await admin.from('email_suppressions')
    .select('reason').eq('email', delivery.invite_email.toLowerCase()).maybeSingle();
  if (suppression) {
    await clearClaim();
    return json({ error: 'This address is suppressed because of a prior delivery failure or complaint' }, 422);
  }

  const actionPath = `/invite/${encodeURIComponent(token)}`;
  const rendered = renderEmail('project_invitation', {
    invitation_id: delivery.invitation_id,
    project_name: delivery.project_name,
    invite_role: delivery.invite_role,
    expires_at: new Date(delivery.expires_at).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' }),
    action_url: actionPath,
  }, {
    variant: 'transactional',
    siteUrl,
    preferencesUrl: `${siteUrl}/?module=account`,
  });
  if (!rendered) {
    await clearClaim();
    return json({ error: 'Invitation email template is unavailable' }, 500);
  }

  const slot = await admin.rpc('consume_email_rate_slot', { p_recipient: delivery.invite_email });
  if (slot.error || slot.data !== true) {
    await clearClaim();
    return json({ error: 'Email delivery is temporarily rate limited' }, 429);
  }

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [delivery.invite_email],
        subject: rendered.subject,
        html: rendered.html,
        headers: rendered.headers,
      }),
    });
  } catch {
    await clearClaim();
    return json({ error: 'Email provider is temporarily unavailable' }, 503);
  }

  const providerBody = await response.text();
  if (!response.ok) {
    await clearClaim();
    return json({ error: response.status === 429 || response.status >= 500 ? 'Email provider is temporarily unavailable' : 'Email provider rejected the invitation' }, response.status === 429 ? 429 : 502);
  }

  let providerMessageId: string | null = null;
  try { providerMessageId = (JSON.parse(providerBody) as { id?: string }).id ?? null; } catch { providerMessageId = null; }
  const { error: completionError } = await admin.from('project_invitations').update({
    email_sent_at: new Date().toISOString(),
    email_provider_message_id: providerMessageId,
  }).eq('id', delivery.invitation_id).is('email_sent_at', null);
  if (completionError) return json({ error: 'Email sent but delivery state could not be recorded' }, 500);

  return json({ sent: true, invitationId: delivery.invitation_id });
});
