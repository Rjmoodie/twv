/**
 * The endpoint the List-Unsubscribe header points at. Setting that header is
 * only legitimate because this works: mailbox providers test it, and a header
 * pointing at a dead URL is worse than no header at all.
 *
 * POST performs the unsubscribe -- both the RFC 8058 one-click POST from a
 * mailbox provider and the confirm button below. GET only renders that button,
 * because link scanners and "safe links" prefetchers follow GETs and would
 * otherwise unsubscribe people who never clicked.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]!
));

const page = (heading: string, body: string, status = 200) => new Response(
  `<!doctype html><html lang="en"><head><meta charset="utf-8" />`
  + `<meta name="viewport" content="width=device-width,initial-scale=1" />`
  + `<title>${escapeHtml(heading)}</title></head>`
  + `<body style="margin:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">`
  + `<div style="max-width:520px;margin:64px auto;padding:32px;background:#fff;border:1px solid #e4e7ec;border-radius:14px">`
  + `<p style="margin:0 0 20px;font-size:15px;font-weight:700;color:#2563eb">SomaTech</p>`
  + `<h1 style="margin:0 0 12px;font-size:21px;color:#0f172a">${escapeHtml(heading)}</h1>`
  + body
  + `</div></body></html>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
);

Deno.serve(async req => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://somatech.pro';
  if (!url || !serviceKey) return page('Unavailable', '<p>This service is temporarily unavailable.</p>', 503);

  const requestUrl = new URL(req.url);
  let token = requestUrl.searchParams.get('token') ?? '';

  if (req.method === 'POST' && !token) {
    // A one-click POST may carry the token in the form body instead.
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = new URLSearchParams(await req.text());
      token = form.get('token') ?? '';
    }
  }

  if (!token) return page('Link not recognised', '<p style="color:#667085">This unsubscribe link is missing its token. Please use the link from a recent email.</p>', 400);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    // Confirm the token exists before promising anything, but change nothing.
    const { data: row } = await supabase
      .from('user_email_preferences').select('user_id').eq('unsubscribe_token', token).maybeSingle();
    if (!row) return page('Link not recognised', '<p style="color:#667085">This unsubscribe link is no longer valid.</p>', 404);

    return page('Unsubscribe from SomaTech updates',
      `<p style="color:#475467;font-size:15px;line-height:23px">This stops product updates and announcements. `
      + `Security notices and the reminders you set yourself will still be sent.</p>`
      + `<form method="POST" style="margin-top:24px">`
      + `<input type="hidden" name="token" value="${escapeHtml(token)}" />`
      + `<button type="submit" style="padding:11px 20px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Confirm unsubscribe</button>`
      + `</form>`
      + `<p style="margin-top:24px;font-size:13px"><a href="${escapeHtml(siteUrl)}/?module=account" style="color:#667085">Manage individual preferences instead</a></p>`);
  }

  if (req.method !== 'POST') return page('Method not allowed', '<p>Unsupported request.</p>', 405);

  const { data: updated, error } = await supabase
    .from('user_email_preferences')
    .update({
      unsubscribed: true,
      unsubscribed_at: new Date().toISOString(),
      marketing_enabled: false,
      updates_enabled: false,
      digest_enabled: false,
    })
    .eq('unsubscribe_token', token)
    .select('user_id');

  if (error) {
    console.error('Unsubscribe failed', error.message);
    return page('Something went wrong', '<p>Please try again shortly.</p>', 500);
  }
  if (!updated?.length) return page('Link not recognised', '<p style="color:#667085">This unsubscribe link is no longer valid.</p>', 404);

  return page('You are unsubscribed',
    `<p style="color:#475467;font-size:15px;line-height:23px">You will no longer receive product updates or announcements. `
    + `Security notices and reminders you set yourself are unaffected.</p>`
    + `<p style="margin-top:24px;font-size:13px"><a href="${escapeHtml(siteUrl)}/?module=account" style="color:#667085">Change your email preferences</a></p>`);
});
