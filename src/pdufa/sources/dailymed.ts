// ────────────────────────────────────────────────────────────────────────────────
// sources/dailymed.ts — DailyMed RSS (NLM)
// ────────────────────────────────────────────────────────────────────────────────
import { SourceDef } from "../types";
import { rss, asISO, stableId } from "../util";

export const dailymedRSS: SourceDef = {
  id: "dailymed_rss",
  label: "DailyMed (Labels RSS)",
  weight: 0.6,
  enabled: true,
  async run(ctx) {
    const feed = await rss("https://dailymed.nlm.nih.gov/dailymed/rss.cfm", ctx);
    const items = (feed?.rss?.channel?.item ?? []).map((e: any) => {
      const headline = e.title as string;
      const url = e.link as string;
      const it = {
        id: "",
        source: "dailymed_rss" as const,
        capturedAt: new Date().toISOString(),
        eventDate: asISO(new Date(e.pubDate)),
        headline,
        url,
        decisionType: /label|labeling/i.test(headline) ? "other" as const : "other" as const,
        confidence: 0.6,
      };
      it.id = stableId(it);
      return it;
    });
    return items;
  },
};

