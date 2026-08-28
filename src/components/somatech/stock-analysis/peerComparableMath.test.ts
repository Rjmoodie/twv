import { describe, expect, it } from "vitest";
import { comparisonLabel, isComparableObservation, isValidTicker, median, metricsFromStock } from "./peerComparableMath";

describe("peer comparable math", () => {
  it("excludes unavailable, zero, negative and non-finite observations", () => {
    expect(median([null, -4, 0, Number.NaN, 10, 20])).toBe(15);
  });

  it("does not issue a valuation conclusion with fewer than three valid peers", () => {
    expect(comparisonLabel(12, 10, 2)).toBe("Need 3 comparable peers");
    expect(comparisonLabel(-1, 10, 5)).toBe("Not meaningful");
  });

  it("validates supported US ticker syntax", () => {
    expect(isValidTicker("BRK.B")).toBe(true);
    expect(isValidTicker(" bad ticker ")).toBe(false);
  });

  it("calculates P/FCF only from four complete standalone quarters", () => {
    const base = { marketCap: 1_000, quarterlyFinancials: [
      { fiscalYear: 2026, fiscalQuarter: 2, freeCashFlow: 10 },
      { fiscalYear: 2026, fiscalQuarter: 1, freeCashFlow: 20 },
      { fiscalYear: 2025, fiscalQuarter: 4, freeCashFlow: 30 },
      { fiscalYear: 2025, fiscalQuarter: 3, freeCashFlow: 40 },
    ] };
    const complete = base.quarterlyFinancials.map((period) => ({ ...period, periodType: "quarter", periodEnd: `${period.fiscalYear}-0${period.fiscalQuarter}-30` }));
    expect(metricsFromStock({ ...base, quarterlyFinancials: complete } as never).pFcf.value).toBe(10);
    expect(metricsFromStock({ ...base, quarterlyFinancials: complete.slice(0, 3) } as never).pFcf.value).toBeNull();
    expect(metricsFromStock({ ...base, quarterlyFinancials: complete.map((period) => ({ ...period, freeCashFlow: -10 })) } as never).pFcf.value).toBeNull();
    expect(metricsFromStock({ ...base, quarterlyFinancials: complete.map((period, index) => index === 2 ? { ...period, fiscalQuarter: 2 } : period) } as never).pFcf.value).toBeNull();
  });

  it("excludes observations with materially mismatched quote or filing dates", () => {
    const observation = { value: 10, numerator: 100, denominator: 10, numeratorLabel: "n", denominatorLabel: "d", formula: "n/d", basis: "ttm" as const, quoteAsOf: "2026-08-20", fundamentalsAsOf: "2026-06-30", source: "test", currency: "USD" };
    expect(isComparableObservation(observation, { ...observation, quoteAsOf: "2026-08-18", fundamentalsAsOf: "2026-03-31" })).toBe(true);
    expect(isComparableObservation(observation, { ...observation, quoteAsOf: "2026-07-01" })).toBe(false);
    expect(isComparableObservation(observation, { ...observation, fundamentalsAsOf: "2025-12-31" })).toBe(false);
    expect(isComparableObservation(observation, { ...observation, quoteAsOf: null })).toBe(false);
    expect(isComparableObservation(observation, { ...observation, currency: "EUR" })).toBe(false);
  });
});
