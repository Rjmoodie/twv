// ────────────────────────────────────────────────────────────────────────────────
// sources/companyRSS.ts — Company newsroom RSS (watchlist)
// ────────────────────────────────────────────────────────────────────────────────
import { SourceDef } from "../types";
import { rss, asISO, sniffDecision, stableId } from "../util";

export const companyRSS: SourceDef = {
  id: "company_rss",
  label: "Company Newsroom RSS",
  weight: 0.7,
  enabled: true,
  async run(ctx) {
    const map = ctx.watchlist.tickerToFeeds ?? {};
    const items: any[] = [];
    for (const [ticker, feedUrl] of Object.entries(map)) {
      const feed = await rss(feedUrl, ctx).catch(() => null);
      const entries = feed?.rss?.channel?.item ?? [];
      for (const e of entries) {
        const headline: string = e.title ?? "";
        const it = {
          id: "",
          source: "company_rss" as const,
          capturedAt: new Date().toISOString(),
          eventDate: asISO(new Date(e.pubDate)),
          headline,
          url: e.link,
          ticker,
          decisionType: sniffDecision(headline),
          confidence: 0.7,
        };
        it.id = stableId(it);
        items.push(it);
      }
    }
    return items;
  },
};

