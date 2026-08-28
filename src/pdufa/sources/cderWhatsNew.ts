// ────────────────────────────────────────────────────────────────────────────────
// sources/cderWhatsNew.ts — CDER/CBER "What's New"
// (uses CDER page as HTML; you may adapt per actual structure)
// ────────────────────────────────────────────────────────────────────────────────
import { SourceDef } from "../types";
import { html, stableId } from "../util";
import * as cheerio from "cheerio";

export const cderWhatsNew: SourceDef = {
  id: "cder_whats_new",
  label: "CDER — What's New",
  weight: 0.7,
  enabled: true,
  async run(ctx) {
    const body = await html("https://www.fda.gov/drugs/drug-safety-and-availability/whats-new-drug-safety", ctx);
    const $ = cheerio.load(body);
    const items: any[] = [];
    $(".view-content a").each((_, a) => {
      const headline = $(a).text().trim();
      if (!headline) return;
      const href = $(a).attr("href") || "";
      const url = href.startsWith("http") ? href : new URL(href, "https://www.fda.gov").toString();
      const it = {
        id: "",
        source: "cder_whats_new" as const,
        capturedAt: new Date().toISOString(),
        headline,
        url,
        confidence: 0.7,
      };
      it.id = stableId(it);
      items.push(it);
    });
    return items;
  },
};

