import Anthropic from 'npm:@anthropic-ai/sdk@0.124.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS } from '../_shared/cors.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

// Structured outputs, so the response parses without a repair pass. The field
// limits below mirror the check constraints on pm_portfolio_entries; the slices
// further down stay as a backstop in case a draft still runs long.
const STORY_FORMAT = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      excerpt: { type: 'string' },
      body: { type: 'string' },
      seo_title: { type: 'string' },
      seo_description: { type: 'string' },
    },
    additionalProperties: false,
    required: ['title', 'excerpt', 'body', 'seo_title', 'seo_description'],
  },
};

const INSTRUCTIONS = [
  'You are the editorial assistant for a real-estate project manager portfolio.',
  'Write an engaging, credible case-study article using only supplied facts.',
  'photo_captions describe photographs taken on this project and may be referenced as visible work; do not infer scope, cost, or quality beyond what a caption literally states.',
  'Never invent costs, dates, clients, addresses, metrics, awards, quotes, permits, or outcomes.',
  'If details are sparse, write concisely.',
  'Write body as plain prose paragraphs separated by a blank line: no Markdown headings, bullet lists, bold, italics or other markup, because the article is rendered as plain paragraphs.',
  'Hard limits, stay under them: title 180 characters, excerpt 500, seo_title 70, seo_description 170.',
].join(' ');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!supabaseUrl || !anonKey || !anthropicKey) return json({ error: 'AI drafting is not configured' }, 503);
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return json({ error: 'Authentication required' }, 401);
  const body = await req.json().catch(() => ({})) as { entryId?: unknown };
  if (typeof body.entryId !== 'string') return json({ error: 'A portfolio entry is required' }, 400);
  const { data: entry, error } = await client.from('pm_portfolio_entries').select('id, title, project_type, location_public, completed_on, summary, challenge, work_completed, outcomes, services, gallery').eq('id', body.entryId).eq('user_id', userData.user.id).single();
  if (error || !entry) return json({ error: 'Portfolio entry not found' }, 404);

  // Photo captions are the only record of what each image shows ("Rear exterior
  // before", "12 ft rear extension after"). They are facts about the project, so
  // the draft may describe them — the no-invention rule still applies.
  const { gallery, ...facts } = entry as Record<string, unknown> & { gallery?: unknown };
  const photoCaptions = Array.isArray(gallery)
    ? gallery.map((photo) => (photo as { caption?: unknown }).caption).filter((caption): caption is string => typeof caption === 'string' && caption.trim().length > 0).slice(0, 24)
    : [];

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let message;
  try {
    message = await anthropic.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      // A policy decline would otherwise end the request; this reruns it on the
      // fallback model inside the same call.
      betas: ['server-side-fallback-2026-06-01'],
      fallbacks: [{ model: 'claude-opus-4-8' }],
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: STORY_FORMAT },
      system: INSTRUCTIONS,
      messages: [{ role: 'user', content: JSON.stringify({ ...facts, photo_captions: photoCaptions }) }],
    });
  } catch (cause) {
    const status = cause instanceof Anthropic.APIError ? cause.status : undefined;
    if (status === 429) return json({ error: 'AI drafting is rate limited — try again shortly' }, 429);
    return json({ error: 'AI drafting is temporarily unavailable' }, 502);
  }

  // A refusal that survives the fallback chain returns 200 with no usable draft.
  if (message.stop_reason === 'refusal') return json({ error: 'AI declined to draft this project. Review the project facts and try again.' }, 422);

  const text = message.content.filter((block) => block.type === 'text').map((block) => block.text).join('');
  let draft: Record<string, string>;
  try { draft = JSON.parse(text || '{}'); } catch { return json({ error: 'AI returned an invalid draft' }, 502); }
  const payload = { article_title: draft.title?.slice(0, 180), article_excerpt: draft.excerpt?.slice(0, 500), article_body: draft.body?.slice(0, 30000), seo_title: draft.seo_title?.slice(0, 70), seo_description: draft.seo_description?.slice(0, 170), ai_generated_at: new Date().toISOString() };
  if (!payload.article_title || !payload.article_body) return json({ error: 'AI returned an incomplete draft' }, 502);
  const { error: saveError } = await client.from('pm_portfolio_entries').update(payload).eq('id', entry.id).eq('user_id', userData.user.id);
  if (saveError) return json({ error: 'Draft could not be saved' }, 500);
  return json({ draft: payload });
});
