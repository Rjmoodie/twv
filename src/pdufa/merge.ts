// ────────────────────────────────────────────────────────────────────────────────
// merge.ts — merge/dedupe/score
// ────────────────────────────────────────────────────────────────────────────────
import { Item } from "./types";
import { stableId } from "./util";

export interface MergeResult { 
  items: Item[]; 
  rawCount: number; 
  dedupedCount: number 
}

export function mergeAndScore(all: Item[]): MergeResult {
  const buckets = new Map<string, Item[]>();
  for (const it of all) {
    const key = stableId(it);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(it);
  }
  const merged: Item[] = [];
  for (const [key, group] of buckets.entries()) {
    // base = highest confidence
    const base = group.reduce((a, b) => (a.confidence > b.confidence ? a : b));
    // corroboration bonus per additional distinct source
    const distinctSources = new Set(group.map((g) => g.source)).size;
    const bonus = Math.min(0.3, 0.1 * (distinctSources - 1));
    const conf = Math.min(1, base.confidence + bonus);
    merged.push({ ...base, id: key, confidence: conf });
  }
  // sort by eventDate (known first), then headline
  merged.sort((a, b) => {
    if (a.eventDate && b.eventDate) return a.eventDate.localeCompare(b.eventDate) || a.headline.localeCompare(b.headline);
    if (a.eventDate) return -1;
    if (b.eventDate) return 1;
    return a.headline.localeCompare(b.headline);
  });
  return { items: merged, rawCount: all.length, dedupedCount: merged.length };
}

