import { describe, expect, it } from "vitest";
import { isFreshPeerResult, pendingPeerTickers, shouldStopPeerBatch } from "./peerComparableWorkflow";

const now = Date.parse("2026-08-24T12:00:00Z");

describe("peer request workflow", () => {
  it("rejects stale, invalid and future timestamps", () => {
    expect(isFreshPeerResult("2026-08-24T11:00:00Z", now)).toBe(true);
    expect(isFreshPeerResult("2026-08-22T11:00:00Z", now)).toBe(false);
    expect(isFreshPeerResult("invalid", now)).toBe(false);
    expect(isFreshPeerResult("2026-08-25T11:00:00Z", now)).toBe(false);
  });

  it("retries failed or stale peers but reuses current results", () => {
    expect(pendingPeerTickers(["A", "B", "C"], [
      { ticker: "A", fetchedAt: "2026-08-24T11:00:00Z" },
      { ticker: "B", fetchedAt: "2026-08-20T11:00:00Z" },
      { ticker: "C", fetchedAt: "2026-08-24T11:00:00Z" },
    ], [{ ticker: "C" }], now)).toEqual(["B", "C"]);
  });

  it("stops a batch on provider throttling but not ordinary symbol failures", () => {
    expect(shouldStopPeerBatch("Daily market-data refresh limit reached")).toBe(true);
    expect(shouldStopPeerBatch("SEC ticker lookup failed (429)")).toBe(true);
    expect(shouldStopPeerBatch("No quote found for BAD")).toBe(false);
  });
});
