// ────────────────────────────────────────────────────────────────────────────────
// sources/fdaAdcomCalendar.ts — Advisory Committee Calendar (HTML)
// ────────────────────────────────────────────────────────────────────────────────
import { SourceDef } from "../types";
import { html, asISO, stableId } from "../util";
import * as cheerio from "cheerio";

export const fdaAdcomCalendar: SourceDef = {
  id: "fda_adcom_calendar",
  label: "FDA Advisory Committee Calendar",
  weight: 0.85,
  enabled: true,
  async run(ctx) {
    const body = await html(
      "https://www.fda.gov/advisory-committees/advisory-committee-calendar",
      ctx
    );
    const $ = cheerio.load(body);
    const items: any[] = [];
    $("table tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 2) return;
      const dateTxt = $(tds[0]).text().trim();
      const headline = $(tds[1]).text().trim() || "Advisory Committee Meeting";
      const link = $(tr).find("a").attr("href");
      const url = link?.startsWith("http") ? link : link ? new URL(link, "https://www.fda.gov").toString() : "https://www.fda.gov";
      const it = {
        id: "",
        source: "fda_adcom_calendar" as const,
        capturedAt: new Date().toISOString(),
        eventDate: asISO(new Date(dateTxt)),
        headline,
        url,
        decisionType: "adcom" as const,
        confidence: 0.85,
      };
      it.id = stableId(it);
      items.push(it);
    });
    return items;
  },
};

