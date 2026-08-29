import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS } from '../_shared/cors.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!supabaseUrl || !anonKey || !openaiKey) return json({ error: 'AI drafting is not configured' }, 503);
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return json({ error: 'Authentication required' }, 401);
  const body = await req.json().catch(() => ({})) as { entryId?: unknown };
  if (typeof body.entryId !== 'string') return json({ error: 'A portfolio entry is required' }, 400);
  const { data: entry, error } = await client.from('pm_portfolio_entries').select('id, title, project_type, location_public, completed_on, summary, challenge, work_completed, outcomes, services').eq('id', body.entryId).eq('user_id', userData.user.id).single();
  if (error || !entry) return json({ error: 'Portfolio entry not found' }, 404);

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_CONTENT_MODEL') ?? 'gpt-5-mini',
      instructions: 'You are the editorial assistant for a real-estate project manager portfolio. Write an engaging, credible case-study article using only supplied facts. Never invent costs, dates, clients, addresses, metrics, awards, quotes, permits, or outcomes. If details are sparse, write concisely. Return JSON only.',
      input: JSON.stringify(entry),
      text: { format: { type: 'json_schema', name: 'portfolio_story', strict: true, schema: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, excerpt: { type: 'string' }, body: { type: 'string' }, seo_title: { type: 'string' }, seo_description: { type: 'string' } }, required: ['title', 'excerpt', 'body', 'seo_title', 'seo_description'] } } },
    }),
  });
  if (!response.ok) return json({ error: 'AI drafting is temporarily unavailable' }, 502);
  const generated = await response.json() as { output_text?: string };
  let draft: Record<string, string>;
  try { draft = JSON.parse(generated.output_text ?? '{}'); } catch { return json({ error: 'AI returned an invalid draft' }, 502); }
  const payload = { article_title: draft.title?.slice(0, 180), article_excerpt: draft.excerpt?.slice(0, 500), article_body: draft.body?.slice(0, 30000), seo_title: draft.seo_title?.slice(0, 70), seo_description: draft.seo_description?.slice(0, 170), ai_generated_at: new Date().toISOString() };
  const { error: saveError } = await client.from('pm_portfolio_entries').update(payload).eq('id', entry.id).eq('user_id', userData.user.id);
  if (saveError) return json({ error: 'Draft could not be saved' }, 500);
  return json({ draft: payload });
});
