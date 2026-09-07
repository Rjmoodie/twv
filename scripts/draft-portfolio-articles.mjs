#!/usr/bin/env node
/**
 * Drafts the AI article for every portfolio entry that does not have one yet.
 *
 * This is the bulk equivalent of pressing "generate" on each entry in the
 * portfolio studio: same model, same instructions, same JSON schema as the
 * generate-portfolio-story edge function. Entries stay drafts — review each
 * article in the studio and publish from there.
 *
 * Put SUPABASE_SERVICE_ROLE_KEY and ANTHROPIC_API_KEY in .env.local (gitignored)
 * alongside the VITE_ vars, then:
 *
 *   node --env-file=.env.local scripts/draft-portfolio-articles.mjs [--dry-run] [--limit N]
 *
 * Reading them from a file rather than the command line keeps live credentials
 * out of shell history.
 *
 * Requires: npm i -D @anthropic-ai/sdk
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const flags = process.argv.slice(2);
const dryRun = flags.includes('--dry-run');
const limitIndex = flags.indexOf('--limit');
const limit = limitIndex === -1 ? null : Number(flags[limitIndex + 1]);

// VITE_SUPABASE_URL is already in .env.local, so accept it rather than making
// the project URL a second thing to copy.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const { SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY } = process.env;
const missing = [
  !SUPABASE_URL && 'SUPABASE_URL (or VITE_SUPABASE_URL)',
  !SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
  !ANTHROPIC_API_KEY && 'ANTHROPIC_API_KEY',
].filter(Boolean);
if (missing.length) {
  console.error(`✖ Missing: ${missing.join(', ')}`);
  console.error('  Add them to .env.local, then run:');
  console.error('    node --env-file=.env.local scripts/draft-portfolio-articles.mjs --dry-run');
  process.exit(1);
}

// Kept in step with supabase/functions/generate-portfolio-story/index.ts.
const STORY_FORMAT = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' }, excerpt: { type: 'string' }, body: { type: 'string' },
      seo_title: { type: 'string' }, seo_description: { type: 'string' },
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

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const { data: entries, error } = await db
  .from('pm_portfolio_entries')
  .select('id, title, project_type, location_public, completed_on, summary, challenge, work_completed, outcomes, services, gallery')
  .is('article_title', null)
  .order('title');
if (error) { console.error(`✖ Could not read entries: ${error.message}`); process.exit(1); }

const queue = limit ? entries.slice(0, limit) : entries;
if (!queue.length) { console.log('Every entry already has an article draft.'); process.exit(0); }
console.log(`${queue.length} ${queue.length === 1 ? 'entry needs' : 'entries need'} a draft.\n`);

let drafted = 0;
for (const entry of queue) {
  const { id, gallery, ...facts } = entry;
  const photo_captions = (Array.isArray(gallery) ? gallery : [])
    .map((photo) => photo?.caption)
    .filter((caption) => typeof caption === 'string' && caption.trim().length > 0)
    .slice(0, 24);

  let message;
  try {
    message = await anthropic.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-06-01'],
      fallbacks: [{ model: 'claude-opus-4-8' }],
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: STORY_FORMAT },
      system: INSTRUCTIONS,
      messages: [{ role: 'user', content: JSON.stringify({ ...facts, photo_captions }) }],
    });
  } catch (cause) {
    console.log(`✖ ${entry.title}: ${cause.message}`);
    continue;
  }

  if (message.stop_reason === 'refusal') { console.log(`✖ ${entry.title}: model declined`); continue; }

  let draft;
  try {
    draft = JSON.parse(message.content.filter((b) => b.type === 'text').map((b) => b.text).join('') || '{}');
  } catch { console.log(`✖ ${entry.title}: unparseable draft`); continue; }

  const payload = {
    article_title: draft.title?.slice(0, 180),
    article_excerpt: draft.excerpt?.slice(0, 500),
    article_body: draft.body?.slice(0, 30000),
    seo_title: draft.seo_title?.slice(0, 70),
    seo_description: draft.seo_description?.slice(0, 170),
    ai_generated_at: new Date().toISOString(),
  };
  if (!payload.article_title || !payload.article_body) { console.log(`✖ ${entry.title}: incomplete draft`); continue; }

  if (dryRun) {
    console.log(`· ${entry.title.padEnd(20)} would draft "${payload.article_title.slice(0, 56)}"`);
    drafted += 1;
    continue;
  }
  const { error: saveError } = await db.from('pm_portfolio_entries').update(payload).eq('id', id);
  if (saveError) { console.log(`✖ ${entry.title}: ${saveError.message}`); continue; }
  console.log(`✓ ${entry.title.padEnd(20)} "${payload.article_title.slice(0, 56)}"`);
  drafted += 1;
}

console.log(`\n${dryRun ? 'Dry run: ' : ''}${drafted}/${queue.length} drafted.`);
console.log('Entries remain drafts — review each article in the portfolio studio, then publish.');
