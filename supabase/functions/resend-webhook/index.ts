/**
 * Provider delivery feedback. Without this, "the provider accepted it" is the
 * only signal the system ever records -- which is not the same as "it arrived"
 * -- and a dead address is retried forever.
 *
 * Unauthenticated by design (the provider has no user session), so the Svix
 * signature IS the authorization. Verified before anything is written.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { shouldSuppress, verifySvixSignature } from '../_shared/svix.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !url || !serviceKey) return json({ error: 'Service configuration unavailable' }, 503);

  // The signature covers the exact bytes, so the body must be read raw and
  // parsed only after it verifies.
  const raw = await req.text();
  const verification = await verifySvixSignature({
    secret,
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signatureHeader: req.headers.get('svix-signature'),
    body: raw,
  });
  if (!verification.valid) {
    console.error('Rejected webhook', verification.reason);
    return json({ error: 'Invalid signature' }, 401);
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: 'Malformed payload' }, 400);
  }

  const type = String(event?.type ?? '');
  const data = event?.data ?? {};
  const providerMessageId = data.email_id ?? data.id ?? null;
  const recipient = String(Array.isArray(data.to) ? data.to[0] : data.to ?? '').toLowerCase();
  if (!type || !recipient) return json({ error: 'Payload missing type or recipient' }, 400);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Tie the event back to the queue row we sent, when we can.
  let outboxId: string | null = null;
  if (providerMessageId) {
    const { data: outbox } = await supabase
      .from('notification_outbox').select('id').eq('provider_message_id', providerMessageId).maybeSingle();
    outboxId = outbox?.id ?? null;
  }

  // The unique index on (provider_message_id, event) makes a redelivered
  // webhook a no-op rather than a duplicate row.
  const { error: insertError } = await supabase.from('email_delivery_events').upsert({
    outbox_id: outboxId,
    provider_message_id: providerMessageId,
    email: recipient,
    event: type,
    occurred_at: event?.created_at ?? new Date().toISOString(),
    payload: data,
  }, { onConflict: 'provider_message_id,event', ignoreDuplicates: true });
  if (insertError) console.error('Could not record delivery event', insertError.message);

  if (shouldSuppress(type, data?.bounce?.type ?? data?.bounce?.subType ?? null)) {
    const { error: suppressError } = await supabase.from('email_suppressions').upsert({
      email: recipient,
      reason: type === 'email.complained' ? 'complaint' : 'hard_bounce',
      provider_event: type,
    }, { onConflict: 'email' });
    if (suppressError) console.error('Could not suppress address', suppressError.message);
  }

  return json({ received: true });
});
