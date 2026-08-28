// ────────────────────────────────────────────────────────────────────────────────
// sources/federalRegister.ts — FR Notices (API JSON)
// ────────────────────────────────────────────────────────────────────────────────
import { SourceDef } from "../types";
import { json, asISO, stableId } from "../util";

export const federalRegister: SourceDef = {
  id: "federal_register",
  label: "Federal Register — FDA Notices",
  weight: 0.8,
  enabled: true,
  async run(ctx) {
    const url =
      "https://www.federalregister.gov/api/v1/documents.json?per_page=50&order=newest&conditions[agencies][]=food-and-drug-administration&conditions[type]=NOTICE";
    const data: any = await json(url, ctx);
    const items = (data?.results ?? []).map((doc: any) => {
      const headline = doc.title as string;
      const url = doc.html_url as string;
      const it = {
        id: "",
        source: "federal_register" as const,
        capturedAt: new Date().toISOString(),
        eventDate: asISO(doc.publication_date),
        headline,
        url,
        decisionType: /advisory|committee|meeting/i.test(headline) ? "adcom" as const : "other" as const,
        confidence: 0.8,
      };
      it.id = stableId(it);
      return it;
    });
    return items;
  },
};

