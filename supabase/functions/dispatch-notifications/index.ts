/**
 * The drain. It owns the only mail credential in the system, so the retry
 * ladder, the rate limiter and the suppression list apply to every message by
 * construction rather than by everyone remembering to use them.
 *
 * It contains no knowledge of any individual notification type: routing comes
 * from notification_channel_policies and copy comes from the template
 * registry. Adding a notification means a row and a registry entry.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS } from '../_shared/cors.ts';
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7';
import {
  planEmail,
  planInApp,
  planPush,
  policyFor,
  type ChannelPolicy,
} from '../_shared/notificationPolicy.ts';
import { renderContent, renderEmail } from '../_shared/emailTemplates.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

type ProviderResult =
  | { outcome: 'sent'; id: string | null }
  | { outcome: 'retryable'; error: string }
  | { outcome: 'permanent'; error: string; suppress: boolean };

/**
 * A 4xx will be rejected identically five more times; all a retry buys is a
 * worse sender reputation. Only 5xx, 429 and transport failures are retried.
 */
async function sendViaResend(
  key: string,
  body: Record<string, unknown>,
): Promise<ProviderResult> {
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    return { outcome: 'retryable', error: `transport: ${cause instanceof Error ? cause.message : 'unknown'}` };
  }

  const text = await response.text();
  if (response.ok) {
    let id: string | null = null;
    try { id = (JSON.parse(text) as { id?: string }).id ?? null; } catch { id = null; }
    return { outcome: 'sent', id };
  }
  if (response.status === 429 || response.status >= 500) {
    return { outcome: 'retryable', error: `provider ${response.status}: ${text.slice(0, 300)}` };
  }
  // 422 is how Resend reports an address it will not accept. That address is
  // not going to become valid on the next tick.
  return {
    outcome: 'permanent',
    error: `provider ${response.status}: ${text.slice(0, 300)}`,
    suppress: response.status === 422 || response.status === 400,
  };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const expected = Deno.env.get('NOTIFICATION_DISPATCH_SECRET');
  if (!expected || req.headers.get('x-dispatch-secret') !== expected) return json({ error: 'Unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Service configuration unavailable' }, 503);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const siteUrl = Deno.env.get('SITE_URL') ?? '';
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('NOTIFICATION_FROM_EMAIL') ?? '';
  const postalAddress = Deno.env.get('EMAIL_POSTAL_ADDRESS') ?? undefined;
  const preferencesUrl = Deno.env.get('EMAIL_PREFERENCES_URL') ?? `${siteUrl}/?module=account`;
  // Edge Functions are served from the Supabase host, not the marketing
  // domain, so the opt-out link must not be built from SITE_URL.
  const unsubscribeBaseUrl = Deno.env.get('EMAIL_UNSUBSCRIBE_URL') ?? `${url}/functions/v1/email-unsubscribe`;
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');

  const { data: jobs, error } = await supabase.rpc('claim_notification_outbox', { batch_size: 25 });
  if (error) return json({ error: 'Could not claim notification work' }, 500);
  if (!jobs?.length) return json({ claimed: 0, delivered: 0, partial: 0, throttled: 0, failed: 0, dropped: 0 });

  // One lookup for the whole batch: routing is a join, not a per-job round trip.
  const eventTypes = [...new Set(jobs.map((job: any) => job.event_type))];
  const { data: policyRows } = await supabase
    .from('notification_channel_policies').select('*').in('event_type', eventTypes);
  const policies = new Map<string, ChannelPolicy>((policyRows ?? []).map((row: any) => [row.event_type, row]));

  const counts = { delivered: 0, partial: 0, throttled: 0, failed: 0, dropped: 0 };

  const reschedule = async (job: any, lastError: string, refundAttempt = false) => {
    const { data: retryAt } = await supabase
      .rpc('calculate_notification_retry_time', { attempt: job.attempt_count });
    await supabase.from('notification_outbox').update({
      status: 'pending',
      // A message held back by our own throttle must not spend a retry: rate
      // limited is not the same as failed.
      attempt_count: refundAttempt ? Math.max(0, (job.attempt_count ?? 1) - 1) : job.attempt_count,
      next_attempt_at: retryAt ?? new Date(Date.now() + 60_000).toISOString(),
      last_error: lastError.slice(0, 500),
    }).eq('id', job.id);
  };

  for (const job of jobs) {
    try {
      const payload = (job.payload ?? {}) as Record<string, unknown>;
      const policy = policyFor(job.event_type, policies.get(job.event_type));
      const content = renderContent(job.event_type, payload);

      // No registry entry means nobody wrote or reviewed this copy. Park it
      // rather than inventing a message.
      if (!content) {
        await supabase.from('notification_outbox').update({
          status: 'dead_letter',
          last_error: `No template registered for event_type "${job.event_type}"`,
        }).eq('id', job.id);
        counts.dropped++;
        continue;
      }

      const [{ data: settings }, { data: existingPreferences }, { data: subscriptions }, { data: userData }] =
        await Promise.all([
          supabase.from('system_settings').select('notification_preferences').eq('user_id', job.user_id).maybeSingle(),
          supabase.from('user_email_preferences').select('*').eq('user_id', job.user_id).maybeSingle(),
          supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', job.user_id),
          supabase.auth.admin.getUserById(job.user_id),
        ]);

      const devicePreferences = (settings?.notification_preferences ?? null) as Record<string, boolean> | null;
      const address = userData?.user?.email?.toLowerCase() ?? null;

      // The unsubscribe token only exists once the row does, and the row may
      // be missing for a user created before the trigger existed.
      let emailPreferences: any = existingPreferences;
      if (!emailPreferences && address) {
        const { data: ensured } = await supabase.rpc('ensure_email_preferences', { target_user: job.user_id });
        emailPreferences = Array.isArray(ensured) ? ensured[0] ?? null : ensured ?? null;
      }
      const requestedChannels: string[] = job.channels ?? [];
      const planInput = {
        policy,
        requestedChannels,
        devicePreferences,
        hasPushSubscription: Boolean(subscriptions?.length),
      };

      if (planInApp(planInput)) {
        const { error: insertError } = await supabase.from('notifications').upsert({
          outbox_id: job.id,
          user_id: job.user_id,
          title: content.title,
          message: content.message,
          type: job.event_type,
          category: content.category,
          action_url: content.actionPath,
          action_label: content.actionLabel,
          metadata: payload,
        }, { onConflict: 'outbox_id', ignoreDuplicates: true });
        if (insertError) throw insertError;
      }

      // ---- push -----------------------------------------------------------
      let pushDelivered: boolean | null = null;
      let pushAllowed = planPush(planInput);
      if (pushAllowed && policy.push_mode === 'rate_limited') {
        const slot = await supabase.rpc('consume_push_rate_slot', {
          p_user_id: job.user_id,
          p_key: policy.rate_limit_key,
          p_window_minutes: policy.rate_window_minutes,
          p_max: policy.max_pushes_per_window,
        });
        // Missing/malformed limiter configuration fails closed. In-app has
        // already landed, so do not requeue the whole event and create noise.
        pushAllowed = slot.error == null && slot.data === true;
      }
      if (pushAllowed) {
        if (!vapidPublic || !vapidPrivate || !vapidSubject) {
          pushDelivered = false;
        } else {
          webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
          const results = await Promise.allSettled((subscriptions ?? []).map(async (subscription: any) => {
            try {
              await webpush.sendNotification(
                { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
                JSON.stringify({
                  title: content.title,
                  body: content.message,
                  url: content.actionPath || '/',
                  tag: content.pushTag,
                }),
              );
            } catch (pushError: any) {
              // 404/410 mean the browser threw the subscription away.
              if (pushError?.statusCode === 404 || pushError?.statusCode === 410) {
                await supabase.from('push_subscriptions').delete().eq('id', subscription.id);
              } else throw pushError;
            }
          }));
          pushDelivered = results.length > 0 && results.every(result => result.status === 'fulfilled');
        }
      }

      // ---- email ----------------------------------------------------------
      const { data: suppression } = address
        ? await supabase.from('email_suppressions').select('email').eq('email', address).maybeSingle()
        : { data: null };

      const emailDecision = planEmail({
        ...planInput,
        preferences: emailPreferences,
        suppressed: Boolean(suppression),
        hasAddress: Boolean(address),
        pushDelivered,
      });

      let emailSettled = true;
      let providerMessageId: string | null = null;

      // Digest routing is a durable queue state, never a delivery claim. A
      // periodic builder can consume it (or, for insider summaries, build
      // directly from the source table) without the immediate drain losing it.
      if (!emailDecision.send && emailDecision.reason === 'deferred_to_digest') {
        await supabase.from('notification_outbox').update({
          status: 'deferred_digest',
          last_error: 'Deferred to digest builder',
        }).eq('id', job.id);
        counts.dropped++;
        continue;
      }

      if (emailDecision.send && (!resendKey || !siteUrl || !from
        || (emailDecision.variant === 'marketing' && !postalAddress?.trim()))) {
        // Configuration outages are recoverable and must not turn into a
        // permanent "partial" delivery claim. Refund the attempt so the job
        // remains pending until the operator restores compliant delivery.
        await reschedule(job, 'Email delivery configuration unavailable; re-queued', true);
        counts.failed++;
        continue;
      }

      if (emailDecision.send && resendKey && address) {
        const slot = await supabase.rpc('consume_email_rate_slot', { p_recipient: address });
        if (slot.data === false) {
          // Back to pending with a future retry time. Throttled must never be
          // a synonym for lost.
          await reschedule(job, 'Rate limited; re-queued', true);
          counts.throttled++;
          continue;
        }

        const unsubscribeUrl = emailDecision.variant === 'marketing' && emailPreferences?.unsubscribe_token
          ? `${unsubscribeBaseUrl}?token=${encodeURIComponent(emailPreferences.unsubscribe_token)}`
          : undefined;

        const rendered = renderEmail(job.event_type, payload, {
          variant: emailDecision.variant,
          siteUrl,
          unsubscribeUrl,
          postalAddress: emailDecision.variant === 'marketing' ? postalAddress : undefined,
          preferencesUrl,
        })!;

        const result = await sendViaResend(resendKey, {
          from,
          to: [address],
          subject: rendered.subject,
          html: rendered.html,
          headers: rendered.headers,
        });

        if (result.outcome === 'sent') {
          providerMessageId = result.id;
          // Logged only after the provider confirmed, so a failure stays
          // retryable instead of being silently marked delivered.
          await supabase.from('email_delivery_events').insert({
            outbox_id: job.id,
            provider_message_id: result.id,
            email: address,
            event: 'accepted',
            payload: { subject: rendered.subject },
          });
        } else if (result.outcome === 'retryable') {
          await reschedule(job, result.error);
          counts.failed++;
          continue;
        } else {
          if (result.suppress) {
            await supabase.from('email_suppressions').upsert(
              { email: address, reason: 'invalid', provider_event: result.error.slice(0, 200) },
              { onConflict: 'email' },
            );
          }
          emailSettled = false;
          console.error('Provider permanently rejected delivery', job.id, result.error);
        }
      }

      const pushSettled = pushDelivered !== false;
      const status = emailSettled && pushSettled ? 'delivered' : 'partial';
      await supabase.from('notification_outbox').update({
        status,
        delivered_at: new Date().toISOString(),
        provider_message_id: providerMessageId,
        last_error: status === 'partial'
          ? [!emailSettled && 'email', !pushSettled && 'push'].filter(Boolean).join(', ') + ' delivery unavailable'
          : null,
      }).eq('id', job.id);
      if (status === 'delivered') counts.delivered++; else counts.partial++;
    } catch (cause) {
      counts.failed++;
      await reschedule(job, cause instanceof Error ? cause.message : 'Delivery failed');
    }
  }

  return json({ claimed: jobs.length, ...counts });
});
