// ────────────────────────────────────────────────────────────────────────────────
// sources/orangePurple.ts — Orange Book & Purple Book nightly fetchers (recon)
// ────────────────────────────────────────────────────────────────────────────────
import { SourceDef } from "../types";

export const orangeBook: SourceDef = {
  id: "orange_book",
  label: "Orange Book (daily products.txt)",
  weight: 0.9,
  enabled: true, // enable for more comprehensive data
  async run(ctx) {
    // Example file (subject to change): https://www.fda.gov/media/76860/download
    // Implement TSV parsing and diff vs prior snapshot.
    return [];
  },
};

export const purpleBook: SourceDef = {
  id: "purple_book",
  label: "Purple Book (licensed biologics)",
  weight: 0.9,
  enabled: true,
  async run(ctx) {
    // Implement CSV/JSON parsing for Purple Book dataset.
    return [];
  },
};
