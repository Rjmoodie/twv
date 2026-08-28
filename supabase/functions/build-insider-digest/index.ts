import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS } from '../_shared/cors.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
});

const validWeekStart = (value: unknown): string | null => {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
  return parsed.getUTCDay() === 1 ? value : null;
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const expected = Deno.env.get('NOTIFICATION_DISPATCH_SECRET');
  if (!expected || request.headers.get('x-dispatch-secret') !== expected) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Service configuration unavailable' }, 503);
  // Do not create a one-shot, deduplicated weekly job until it can actually be
  // delivered with the legally required marketing-email footer.
  if (!Deno.env.get('RESEND_API_KEY') || !Deno.env.get('EMAIL_POSTAL_ADDRESS')?.trim()) {
    return json({ error: 'Digest email delivery is not configured' }, 503);
  }

  const body = await request.json().catch(() => ({})) as { week_start?: unknown };
  const weekStart = validWeekStart(body.week_start);
  if (body.week_start != null && weekStart == null) {
    return json({ error: 'week_start must be a valid Monday in YYYY-MM-DD format' }, 400);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc('enqueue_weekly_insider_digests', {
    p_week_start: weekStart,
  });
  if (error) {
    console.error('Could not enqueue weekly insider digests', error);
    return json({ error: 'Could not build insider digests' }, 500);
  }

  return json({ enqueued: Number(data) || 0, week_start: weekStart ?? 'previous_week' });
});
