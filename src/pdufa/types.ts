// PDUFA Scanner — Source Ingestion Map (TypeScript)
// Drop this folder under: src/pdufa/
// Uses the project's fast-xml-parser, cheerio, and zod dependencies.
// Usage example:
//   import { runIngest } from "./pdufa/ingest";
//   const res = await runIngest({ tickers: ["PFE","BMY"], ciks: ["0000078003"], feeds: {...} });
//   console.table(res.items.map(i => ({ date: i.eventDate, src: i.source, head: i.headline })));

// ────────────────────────────────────────────────────────────────────────────────
// types.ts
// ────────────────────────────────────────────────────────────────────────────────
export type ISODate = string; // YYYY-MM-DD

export type SourceId =
  | "fda_press"
  | "fda_adcom_calendar"
  | "federal_register"
  | "cder_whats_new"
  | "dailymed_rss"
  | "sec_edgar"
  | "company_rss"
  | "orange_book"
  | "purple_book";

export type DecisionType = "pdufa" | "adcom" | "approval" | "crl" | "other";

export interface Item {
  id: string; // stable hash
  source: SourceId;
  capturedAt: string; // ISO timestamp
  eventDate?: ISODate; // meeting date or target action date if known
  headline: string;
  url: string;
  ticker?: string;
  sponsor?: string;
  drug?: string;
  indication?: string;
  decisionType?: DecisionType;
  priority?: "priority" | "standard";
  notes?: string;
  confidence: number; // 0..1
}

export interface IngestContext {
  watchlist: {
    tickers?: string[];
    ciks?: string[]; // numeric as string (no leading 0 required)
    keywords?: string[]; // e.g., ["pdufa","complete response","priority review"]
    tickerToFeeds?: Record<string, string>; // company specific RSS
  };
  fetcher?: typeof fetch; // override for tests
  userAgent?: string;
}

export interface SourceDef {
  id: SourceId;
  label: string;
  weight: number; // base confidence weight
  enabled: boolean;
  // Fetch and parse return items (un-deduped)
  run(ctx: IngestContext): Promise<Item[]>;
  tags?: string[];
}
