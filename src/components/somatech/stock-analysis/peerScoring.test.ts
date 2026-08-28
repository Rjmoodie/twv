import { describe, expect, it } from "vitest";
import { rankPeers, scorePeer } from "../../../../supabase/functions/_shared/peerScoring";

const target = { ticker: "AAA", name: "Target", industry: "Application Software", sector: "Technology", sic: "7372", marketCapitalization: 10_000, revenueTTM: 2_000, profitMarginTTM: 0.2, quarterlyRevenueGrowthYOY: 0.1 };

describe("peer suggestion scoring", () => {
  it("rejects a company that shares only a broad sector", () => {
    expect(scorePeer(target, { ticker: "CHIP", name: "Chip", industry: "Semiconductors", sector: "Technology" })).toBeNull();
  });

  it("ranks classification and scale matches above incomplete candidates", () => {
    const ranked = rankPeers(target, [
      { ticker: "GOOD", name: "Good", industry: "Application Software", sector: "Technology", sic: "7372", marketCapitalization: 9_000, revenueTTM: 2_200, profitMarginTTM: 0.18, quarterlyRevenueGrowthYOY: 0.12 },
      { ticker: "THIN", name: "Thin", industry: "Application Software", sector: "Technology" },
    ]);
    expect(ranked.map((peer) => peer.ticker)).toEqual(["GOOD", "THIN"]);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("deduplicates candidates and excludes the target", () => {
    const candidate = { ticker: "GOOD", name: "Good", industry: "Application Software", sector: "Technology", sic: "7372" };
    expect(rankPeers(target, [target, candidate, candidate]).map((peer) => peer.ticker)).toEqual(["GOOD"]);
  });

  it("excludes another share class of the same issuer", () => {
    expect(scorePeer({ ...target, cik: "123" }, { ticker: "AAA.B", cik: "123", name: "Target class B", industry: target.industry, sector: target.sector })).toBeNull();
  });
});
