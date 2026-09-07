#!/usr/bin/env node
/**
 * Loads completed project work into pm_portfolio_entries: resizes and uploads every
 * photo, geocodes the address through Mapbox, and creates one entry per project.
 *
 * Photos are resized with `sips` (macOS built-in) so the script needs no image
 * dependency. Entries are created as drafts — nothing is published, and the
 * article is drafted separately in the studio so it can be reviewed first.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… MAPBOX_TOKEN=… \
 *     node scripts/seed-portfolio.mjs docs/data/portfolio-seed.json [--dry-run]
 *
 * Re-running is safe: a project whose `slug` already exists is skipped.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'pm-portfolio';
const MAX_DIMENSION = 2200;

const [, , configPath, ...flags] = process.argv;
const dryRun = flags.includes('--dry-run');
// Photos may be loaded before a Mapbox token is to hand; this backfills the
// coordinates and neighbourhood onto entries that already exist.
const geocodeOnly = flags.includes('--geocode-only');
const fail = (message) => { console.error(`✖ ${message}`); process.exit(1); };

if (!configPath) fail('Usage: node scripts/seed-portfolio.mjs <seed.json> [--dry-run]');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MAPBOX_TOKEN } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
if (!MAPBOX_TOKEN) console.warn('⚠ MAPBOX_TOKEN not set — entries will be created without coordinates and will not appear on the map.');

const config = JSON.parse(readFileSync(configPath, 'utf8'));
const { user_id: userId, organization_id: organizationId, photo_dir: photoDir, projects } = config;
if (!userId || !organizationId || !photoDir) fail('Seed file needs user_id, organization_id, and photo_dir.');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);

const pixelSize = (source) => {
  const output = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', source], { encoding: 'utf8' });
  return { width: Number(/pixelWidth:\s*(\d+)/.exec(output)?.[1]), height: Number(/pixelHeight:\s*(\d+)/.exec(output)?.[1]) };
};

/**
 * Only downscale what is actually oversized. These exports are already
 * web-compressed, so re-encoding one that is within bounds inflates it — a 315KB
 * facade came back at 680KB. Falls back to the original whenever the processed
 * file is not smaller.
 */
const shrink = (source, workDir) => {
  const { width, height } = pixelSize(source);
  if (!(Math.max(width, height) > MAX_DIMENSION)) return source;
  const target = path.join(workDir, `${path.basename(source).replace(/\.[^.]+$/, '')}.jpg`);
  execFileSync('sips', ['-Z', String(MAX_DIMENSION), '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', source, '--out', target], { stdio: 'pipe' });
  return statSync(target).size < statSync(source).size ? target : source;
};

const geocode = async (address) => {
  if (!MAPBOX_TOKEN) return { latitude: null, longitude: null, neighborhood: null };
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&country=US&limit=1&types=address`;
  const response = await fetch(url);
  if (!response.ok) { console.warn(`⚠ Geocoding failed for ${address} (${response.status})`); return { latitude: null, longitude: null, neighborhood: null }; }
  const body = await response.json();
  const match = body.features?.[0];
  if (!match) { console.warn(`⚠ No geocoding match for ${address}`); return { latitude: null, longitude: null, neighborhood: null }; }
  const neighborhood = match.context?.find((item) => item.id?.startsWith('neighborhood'))?.text ?? null;
  return { longitude: match.center[0], latitude: match.center[1], neighborhood };
};

const uploadPhoto = async (filePath, workDir) => {
  const prepared = shrink(filePath, workDir);
  const before = statSync(filePath).size;
  const after = statSync(prepared).size;
  const safeName = path.basename(prepared).replace(/[^a-zA-Z0-9._-]+/g, '-');
  const storagePath = `${userId}/${crypto.randomUUID()}-${safeName}`;
  console.log(`    ${path.basename(filePath)} — ${(before / 1024).toFixed(0)}KB${prepared === filePath ? ' (already web-sized)' : ` → ${(after / 1024).toFixed(0)}KB`}`);
  if (dryRun) return `https://example.invalid/${storagePath}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, readFileSync(prepared), { contentType: 'image/jpeg' });
  if (error) throw new Error(`Upload failed for ${filePath}: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
};

const workDir = mkdtempSync(path.join(tmpdir(), 'tw-portfolio-'));
let created = 0;
let skipped = 0;

try {
  for (const project of projects) {
    const slug = project.slug ?? slugify(project.title);
    console.log(`\n▸ ${project.title}`);

    let existing = null;
    if (!dryRun) {
      ({ data: existing } = await supabase.from('pm_portfolio_entries').select('id').eq('slug', slug).maybeSingle());
      if (existing && !geocodeOnly) { console.log('  already loaded — skipping'); skipped += 1; continue; }
      if (!existing && geocodeOnly) { console.log('  not loaded yet — skipping'); skipped += 1; continue; }
    }

    const { latitude, longitude, neighborhood } = await geocode(project.geocode_address ?? project.title);
    const locationPublic = project.location_public ?? (neighborhood ? `${neighborhood}, Philadelphia, PA` : 'Philadelphia, PA');
    console.log(`  ${locationPublic}${latitude ? ` (${latitude.toFixed(5)}, ${longitude.toFixed(5)})` : ' — no coordinates'}`);

    if (geocodeOnly) {
      if (dryRun) { console.log('  would backfill coordinates'); created += 1; continue; }
      const { error } = await supabase.from('pm_portfolio_entries').update({ latitude, longitude, location_public: locationPublic }).eq('id', existing.id);
      if (error) throw new Error(`Backfill failed for ${project.title}: ${error.message}`);
      console.log('  coordinates backfilled');
      created += 1;
      continue;
    }

    const gallery = [];
    for (const photo of project.photos) {
      const filePath = path.join(photoDir, photo.file);
      if (!existsSync(filePath)) throw new Error(`Missing photo: ${filePath}`);
      gallery.push({ url: await uploadPhoto(filePath, workDir), caption: photo.caption ?? null, alt: photo.alt ?? null });
    }

    const featuredIndex = project.photos.findIndex((photo) => photo.featured);
    const row = {
      user_id: userId,
      organization_id: organizationId,
      slug,
      title: project.title,
      project_type: project.project_type,
      location_public: locationPublic,
      completed_on: project.completed_on ?? null,
      summary: project.summary,
      challenge: project.challenge ?? null,
      work_completed: project.work_completed,
      outcomes: project.outcomes ?? null,
      services: project.services ?? [],
      featured_image_url: gallery[featuredIndex >= 0 ? featuredIndex : 0]?.url ?? null,
      gallery,
      latitude,
      longitude,
      status: 'draft',
    };

    if (dryRun) { console.log(`  would create draft with ${gallery.length} photos`); created += 1; continue; }
    const { error } = await supabase.from('pm_portfolio_entries').insert(row);
    if (error) throw new Error(`Insert failed for ${project.title}: ${error.message}`);
    console.log(`  created draft with ${gallery.length} photos`);
    created += 1;
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

console.log(`\n${dryRun ? 'Dry run: ' : ''}${created} created, ${skipped} skipped.`);
console.log('Entries are drafts. Open the portfolio studio to generate each article, review it, then publish.');
