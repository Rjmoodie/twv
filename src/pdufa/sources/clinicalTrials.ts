// ────────────────────────────────────────────────────────────────────────────────
// clinicalTrials.ts — clinical trial databases and regulatory submissions
// ────────────────────────────────────────────────────────────────────────────────
import { SourceDef, Item, IngestContext } from "../types";
import { html, rss, json } from "../util";

export const clinicalTrialsGov: SourceDef = {
  id: "clinical_trials_gov",
  label: "ClinicalTrials.gov Database",
  weight: 0.9,
  enabled: true,
  async run(ctx) {
    const items: Item[] = [];
    
    try {
      // ClinicalTrials.gov RSS for recently updated studies
      const ctRSS = await rss("https://clinicaltrials.gov/ct2/results/rss.xml?rcv_d=14&lup_d=14&sel_rss=mod14&ord=rcv_d", ctx);
      const ctItems = parseClinicalTrialsRSS(ctRSS);
      items.push(...ctItems);
    } catch (error) {
      console.error("Failed to scrape ClinicalTrials.gov RSS:", error);
    }

    try {
      // ClinicalTrials.gov API for Phase 3 studies
      const phase3Data = await json("https://clinicaltrials.gov/api/v2/studies?query.phase=PHASE3&query.overallStatus=RECRUITING", ctx);
      const phase3Items = parseClinicalTrialsAPI(phase3Data);
      items.push(...phase3Items);
    } catch (error) {
      console.error("Failed to scrape ClinicalTrials.gov API:", error);
    }

    return items;
  },
};

export const euClinicalTrials: SourceDef = {
  id: "eu_clinical_trials",
  label: "EU Clinical Trials Database",
  weight: 0.8,
  enabled: true,
  async run(ctx) {
    const items: Item[] = [];
    
    try {
      // EU Clinical Trials Database RSS
      const euRSS = await rss("https://www.clinicaltrialsregister.eu/ctr-search/search?query=&resultsstatus=trials-with-results", ctx);
      const euItems = parseEUClinicalTrialsRSS(euRSS);
      items.push(...euItems);
    } catch (error) {
      console.error("Failed to scrape EU Clinical Trials RSS:", error);
    }

    return items;
  },
};

export const whoTrials: SourceDef = {
  id: "who_trials",
  label: "WHO International Clinical Trials",
  weight: 0.75,
  enabled: true,
  async run(ctx) {
    const items: Item[] = [];
    
    try {
      // WHO ICTRP RSS
      const whoRSS = await rss("https://trialsearch.who.int/Trial2.aspx", ctx);
      const whoItems = parseWHOTrialsRSS(whoRSS);
      items.push(...whoItems);
    } catch (error) {
      console.error("Failed to scrape WHO Trials RSS:", error);
    }

    return items;
  },
};

export const isrctn: SourceDef = {
  id: "isrctn",
  label: "ISRCTN Registry",
  weight: 0.7,
  enabled: true,
  async run(ctx) {
    const items: Item[] = [];
    
    try {
      // ISRCTN RSS
      const isrctnRSS = await rss("https://www.isrctn.com/rss", ctx);
      const isrctnItems = parseISRCTNRSS(isrctnRSS);
      items.push(...isrctnItems);
    } catch (error) {
      console.error("Failed to scrape ISRCTN RSS:", error);
    }

    return items;
  },
};

// Parser functions for clinical trial sources
function parseClinicalTrialsRSS(rssData: any): Item[] {
  const items: Item[] = [];
  // Parse ClinicalTrials.gov RSS for recently updated studies
  // Look for Phase 3 studies that might be approaching PDUFA dates
  return items;
}

function parseClinicalTrialsAPI(apiData: any): Item[] {
  const items: Item[] = [];
  // Parse ClinicalTrials.gov API response for Phase 3 studies
  // Extract study completion dates and regulatory milestones
  return items;
}

function parseEUClinicalTrialsRSS(rssData: any): Item[] {
  const items: Item[] = [];
  // Parse EU Clinical Trials Database RSS
  return items;
}

function parseWHOTrialsRSS(rssData: any): Item[] {
  const items: Item[] = [];
  // Parse WHO ICTRP RSS
  return items;
}

function parseISRCTNRSS(rssData: any): Item[] {
  const items: Item[] = [];
  // Parse ISRCTN Registry RSS
  return items;
}

