// ────────────────────────────────────────────────────────────────────────────────
// financialNews.ts — financial news sites with PDUFA calendars
// ────────────────────────────────────────────────────────────────────────────────
import { SourceDef, Item, IngestContext } from "../types";
import { html, rss } from "../util";

export const financialNews: SourceDef = {
  id: "financial_news",
  label: "Financial News Sites (RTT, Benzinga, etc.)",
  weight: 0.75,
  enabled: true,
  async run(ctx) {
    const items: Item[] = [];
    
    try {
      // RTT News FDA Calendar
      const rttBody = await html("https://www.rttnews.com/corpinfo/fdacalendar.aspx", ctx);
      const rttItems = parseRTTNews(rttBody);
      items.push(...rttItems);
    } catch (error) {
      console.error("Failed to scrape RTT News:", error);
    }

    try {
      // Benzinga FDA Calendar
      const benzingaBody = await html("https://www.benzinga.com/fda-calendar", ctx);
      const benzingaItems = parseBenzinga(benzingaBody);
      items.push(...benzingaItems);
    } catch (error) {
      console.error("Failed to scrape Benzinga:", error);
    }

    try {
      // FDA Tracker
      const fdaTrackerBody = await html("https://www.fdatracker.com/fda-calendar", ctx);
      const trackerItems = parseFDATracker(fdaTrackerBody);
      items.push(...trackerItems);
    } catch (error) {
      console.error("Failed to scrape FDA Tracker:", error);
    }

    return items;
  },
};

function parseRTTNews(html: string): Item[] {
  const items: Item[] = [];
  // Parse RTT News FDA calendar table
  // This would need to be implemented based on their current HTML structure
  return items;
}

function parseBenzinga(html: string): Item[] {
  const items: Item[] = [];
  // Parse Benzinga FDA calendar
  // This would need to be implemented based on their current HTML structure
  return items;
}

function parseFDATracker(html: string): Item[] {
  const items: Item[] = [];
  // Parse FDA Tracker calendar
  // This would need to be implemented based on their current HTML structure
  return items;
}

