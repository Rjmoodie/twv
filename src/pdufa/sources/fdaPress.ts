// ────────────────────────────────────────────────────────────────────────────────
// sources/fdaPress.ts — FDA Press Announcements (RSS)
// ────────────────────────────────────────────────────────────────────────────────
import { SourceDef } from "../types";
import { rss, asISO, sniffDecision, stableId } from "../util";

export const fdaPress: SourceDef = {
  id: "fda_press",
  label: "FDA Press Announcements",
  weight: 0.9,
  enabled: true,
  async run(ctx) {
    const feed = await rss(
      "https://www.fda.gov/news-events/fda-newsroom/press-announcements/rss.xml",
      ctx
    );
    const entries = feed?.rss?.channel?.item ?? [];
    const items = entries.map((e: any) => {
      const headline = e.title ?? "FDA announcement";
      const url = e.link;
      const pubDate = asISO(new Date(e.pubDate));
      const decision = sniffDecision(headline);
      const it = {
        id: "",
        source: "fda_press" as const,
        capturedAt: new Date().toISOString(),
        eventDate: pubDate,
        headline,
        url,
        decisionType: decision,
        confidence: 0.9,
      };
      it.id = stableId(it);
      return it;
    });
    return items;
  },
};

