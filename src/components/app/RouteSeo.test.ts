import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * `/investors` is the public investor page and must be indexed.
 * `/investor`  is the private portal and must never be.
 *
 * One character apart, opposite policies, and two independent mechanisms decide
 * the outcome — the prefix matcher in RouteSeo and the `X-Robots-Tag` rules in
 * vercel.json. Either one over-matching would silently deindex the page the
 * whole investor funnel depends on, with nothing failing and no error anywhere.
 * These assertions are cheap; discovering it from a traffic graph is not.
 */

const source = fs.readFileSync(path.resolve('src/components/app/RouteSeo.tsx'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf8')) as {
  headers?: { source: string; headers: { key: string; value: string }[] }[];
};

// Mirrors the resolution order in RouteSeo: exact match first, then prefix.
const PREFIXES = ['/investor', '/pm', '/client', '/invite'];
const matchesPrefix = (pathname: string) =>
  PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

describe('RouteSeo — public vs private investor routes', () => {
  it('registers /investors as an exact, indexable route', () => {
    expect(source).toContain("'/investors': {");
    const entry = source.slice(source.indexOf("'/investors': {"));
    expect(entry.slice(0, entry.indexOf('},'))).toContain('index: true');
  });

  it('keeps the private /investor portal noindexed', () => {
    const entry = source.slice(source.indexOf("['/investor',"));
    expect(entry.slice(0, entry.indexOf(']'))).toContain('index: false');
  });

  it('does not let the /investor prefix swallow /investors', () => {
    expect(matchesPrefix('/investors')).toBe(false);
    expect(matchesPrefix('/investor')).toBe(true);
    expect(matchesPrefix('/investor/summary')).toBe(true);
  });
});

describe('vercel headers — public vs private investor routes', () => {
  const noindexSources = (vercel.headers ?? [])
    .filter((entry) => entry.headers.some((header) => header.key === 'X-Robots-Tag'))
    .map((entry) => entry.source);

  it('noindexes the private portal', () => {
    expect(noindexSources).toContain('/investor/:path*');
  });

  it('never noindexes the public page', () => {
    expect(noindexSources).not.toContain('/investors');
    expect(noindexSources).not.toContain('/investors/:path*');
    // A bare `/investor:path*` would match /investors too. path-to-regexp only
    // treats a parameter as a whole segment when a separator precedes it.
    for (const pattern of noindexSources) {
      expect(pattern, `"${pattern}" can match /investors`).not.toMatch(/^\/investor[^/]/);
    }
  });
});
