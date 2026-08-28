// ────────────────────────────────────────────────────────────────────────────────
// ingest.ts — orchestrator with per-source health checks & stale-data fallback
// ────────────────────────────────────────────────────────────────────────────────
import { IngestContext, Item, SourceId } from "./types";
import { SOURCES } from "./sources";
import { mergeAndScore, MergeResult } from "./merge";

export interface RunArgs {
  tickers?: string[];
  ciks?: string[];
  keywords?: string[];
  feeds?: Record<string, string>; // ticker → rss url
  userAgent?: string;
  /**
   * Optional path to a JSON cache file.
   * - On a successful run (>0 items), results are written here.
   * - On a zero-item run, stale data from this file is returned instead,
   *   with `isStale: true` in the returned health report.
   */
  cacheFile?: string;
}

export interface SourceHealth {
  id: SourceId;
  status: "ok" | "error" | "empty";
  itemCount: number;
  /** Error message if status === 'error' */
  error?: string;
  /** ms taken to fetch */
  durationMs: number;
}

export interface IngestResult extends MergeResult {
  sourceHealth: SourceHealth[];
  /** True when the returned items came from a stale cache (all sources returned 0) */
  isStale: boolean;
  /** ISO timestamp of the cache used (undefined if not stale) */
  cachedAt?: string;
}

export async function runIngest(args: RunArgs): Promise<IngestResult> {
  const ctx: IngestContext = {
    watchlist: {
      tickers: args.tickers ?? [],
      ciks: args.ciks ?? [],
      keywords: args.keywords ?? [
        "pdufa",
        "target action",
        "advisory committee",
        "complete response",
        "approval",
        "priority review",
      ],
      tickerToFeeds: args.feeds ?? {
        BMY: "https://news.bms.com/cpress/rss/index.xml",
        PFE: "https://www.pfizer.com/news/press-releases/rss.xml",
      },
    },
    userAgent: args.userAgent ?? "somatech-pdufa/1.0",
  };

  const enabled = SOURCES.filter((s) => s.enabled);

  // Run all sources concurrently; track per-source health
  const settled = await Promise.allSettled(
    enabled.map(async (s) => {
      const start = Date.now();
      const items = await s.run(ctx);
      return { id: s.id, items, durationMs: Date.now() - start };
    })
  );

  const flat: Item[] = [];
  const sourceHealth: SourceHealth[] = [];

  settled.forEach((r, i) => {
    const sourceId = enabled[i].id;
    if (r.status === "fulfilled") {
      const { items, durationMs } = r.value;
      flat.push(...items);
      const status = items.length === 0 ? "empty" : "ok";
      if (status === "empty") {
        console.warn(`[PDUFA] Source "${sourceId}" returned 0 items — may be broken`);
      }
      sourceHealth.push({ id: sourceId, status, itemCount: items.length, durationMs });
    } else {
      const err = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.error(`[PDUFA] Source "${sourceId}" failed:`, err);
      sourceHealth.push({ id: sourceId, status: "error", itemCount: 0, error: err, durationMs: 0 });
    }
  });

  const merged = mergeAndScore(flat);

  // ── File-based stale-data fallback (only available in Node environments) ──
  if (args.cacheFile && typeof process !== "undefined") {
    try {
      const { readFileSync, writeFileSync } = await import("fs");

      if (merged.items.length > 0) {
        // Write last-known-good cache
        const cachePayload = JSON.stringify({
          cachedAt: new Date().toISOString(),
          ...merged,
        });
        writeFileSync(args.cacheFile, cachePayload, "utf-8");
      } else {
        // No items — attempt stale fallback
        try {
          const raw = readFileSync(args.cacheFile, "utf-8");
          const cached = JSON.parse(raw) as MergeResult & { cachedAt: string };
          if (cached.items?.length > 0) {
            console.warn(
              `[PDUFA] All sources returned 0 items. Serving stale cache from ${cached.cachedAt}.`
            );
            return {
              ...cached,
              sourceHealth,
              isStale: true,
              cachedAt: cached.cachedAt,
            };
          }
        } catch {
          // No cache exists yet — return empty result
        }
      }
    } catch (fsErr) {
      console.error("[PDUFA] Cache I/O error:", fsErr);
    }
  }

  return { ...merged, sourceHealth, isStale: false };
}

// ────────────────────────────────────────────────────────────────────────────────
// OPTIONAL: extension heuristics — detect 3‑month PDUFA extensions
// ────────────────────────────────────────────────────────────────────────────────
import { MAJOR_AMENDMENT_PATTERNS } from "./util";

export function detectExtension(text: string): boolean {
  return MAJOR_AMENDMENT_PATTERNS.some((p) => p.test(text));
}
