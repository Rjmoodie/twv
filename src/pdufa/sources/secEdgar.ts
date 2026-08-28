// ────────────────────────────────────────────────────────────────────────────────
// sources/secEdgar.ts — SEC submissions JSON (per CIK)
// ────────────────────────────────────────────────────────────────────────────────
import { SourceDef } from "../types";
import { json, stableId } from "../util";

export const secEdgar: SourceDef = {
  id: "sec_edgar",
  label: "SEC EDGAR Submissions",
  weight: 0.85,
  enabled: true,
  async run(ctx) {
    const ciks = ctx.watchlist.ciks ?? [];
    const items: any[] = [];
    for (const cikRaw of ciks) {
      const cik = cikRaw.toString().padStart(10, "0");
      const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
      const data: any = await json(url, ctx).catch(() => null);
      if (!data) continue;
      const recent = data.filings?.recent ?? {};
      const forms: string[] = recent.form ?? [];
      const acc: string[] = recent.accessionNumber ?? [];
      const doc: string[] = recent.primaryDocument ?? [];
      const date: string[] = recent.filingDate ?? [];
      for (let i = 0; i < forms.length; i++) {
        if (forms[i] !== "8-K") continue;
        const headline = `SEC 8-K ${acc[i]} (${date[i]})`;
        const docUrl = `https://www.sec.gov/ixviewer/doc?action=display&source=content&accno=${acc[i]}`;
        const it = {
          id: "",
          source: "sec_edgar" as const,
          capturedAt: new Date().toISOString(),
          headline,
          url: docUrl,
          confidence: 0.85,
        };
        it.id = stableId(it);
        items.push(it);
      }
    }
    return items;
  },
};

