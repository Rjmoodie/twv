import { describe, it, expect } from 'vitest';
import { computeValueScore, computeQualityScore, computeMoatScore, computeGrowthScore, computeEarningsQuality, detectFlags } from './scoringModels';
import type { NormalizedFinancials, AnnualFinancials } from '@/types/portfolio';

const year = (over: Partial<AnnualFinancials> = {}): AnnualFinancials => ({
  fiscal_year: 2025, period_end: '2025-12-31',
  revenue: 1_000_000_000, gross_profit: 400_000_000,
  operating_income: 200_000_000, net_income: 150_000_000,
  operating_cf: 180_000_000, capex: 30_000_000, free_cash_flow: 150_000_000,
  total_assets: 2_000_000_000, current_assets: 500_000_000, current_liabilities: 300_000_000,
  long_term_debt: 400_000_000, short_term_debt: 0, total_equity: 900_000_000,
  cash: 100_000_000, ppe_net: 800_000_000, shares_outstanding: 100_000_000,
  rd_expense: 50_000_000, interest_expense: 20_000_000, dividends_paid: 10_000_000,
  da_expense: 40_000_000, tax_expense: 40_000_000, pretax_income: 190_000_000,
  ...over,
});

const fin = (years: AnnualFinancials[], extra: Partial<NormalizedFinancials> = {}): NormalizedFinancials => ({
  ticker: 'TEST', cik: '000', company_name: 'Test Co', annual: years, ...extra,
});

describe('enterprise value', () => {
  it('includes short-term debt, so a levered company does not screen artificially cheap', () => {
    const noStd   = computeValueScore({ financials: fin([year({ short_term_debt: 0 })]),           market_cap: 1_000_000_000 });
    const withStd = computeValueScore({ financials: fin([year({ short_term_debt: 500_000_000 })]), market_cap: 1_000_000_000 });

    // More debt ⇒ larger EV ⇒ lower earnings yield ⇒ the stock is dearer, not cheaper
    expect(withStd.earnings_yield!).toBeLessThan(noStd.earnings_yield!);
    expect(withStd.ev_ebit!).toBeGreaterThan(noStd.ev_ebit!);
  });
});

describe('return on capital', () => {
  it('is computed after tax (NOPAT), not on raw pre-tax EBIT', () => {
    // EBIT 200M on 1,000M capital = 20% pre-tax. At a ~21% effective rate the
    // after-tax figure must be meaningfully lower.
    const v = computeValueScore({ financials: fin([year()]), market_cap: 1_000_000_000 });
    const preTax = 200_000_000 / 1_000_000_000;

    expect(v.return_on_capital!).toBeLessThan(preTax);
    expect(v.return_on_capital!).toBeCloseTo(preTax * (1 - 40 / 190), 4);
  });

  it('falls back to the statutory rate when tax data is missing', () => {
    const v = computeValueScore({
      financials: fin([year({ tax_expense: null, pretax_income: null })]),
      market_cap: 1_000_000_000,
    });
    expect(v.return_on_capital!).toBeCloseTo(0.20 * (1 - 0.21), 4);
  });
});

describe('FCF consistency', () => {
  it('scores against a fixed 10-year window, not the years that happen to exist', () => {
    // Two years, both positive. Previously scored 2/2 = 100%, tying a company
    // with a decade of positive FCF.
    const short = computeQualityScore(fin([year(), year({ fiscal_year: 2024 })]));
    expect(short.fcf_consistency).toBeNull();   // too little history to score

    const threeOfTen = computeQualityScore(fin([
      year(), year({ fiscal_year: 2024 }), year({ fiscal_year: 2023, free_cash_flow: -5_000_000 }),
    ]));
    expect(threeOfTen.fcf_consistency).toBeCloseTo(2 / 10, 4);
  });
});

describe('moat score', () => {
  it('requires after-tax ROIC above the threshold, not pre-tax', () => {
    // Pre-tax ROIC 12% clears a 10% bar; after 21% tax it is 9.5% and must not.
    const borderline = year({ operating_income: 120_000_000, tax_expense: null, pretax_income: null });
    const m = computeMoatScore(fin([borderline]));
    expect(m.roic_vs_wacc_years).toBe(0);
  });
});

describe('missing evidence', () => {
  /**
   * The AAPL case from the research tab: both revenue CAGRs unavailable, an
   * enormous ROIIC, and a displayed Growth score of 10.0/10. The two nulls were
   * dropped from the mean, so one saturated metric became a perfect score.
   */
  const roiicOnly = () => {
    // Four years so ROIIC computes, but revenue absent in the older periods so
    // neither CAGR can be formed.
    // investedCapital is NWC + ppe_net, so ppe_net has to move for ROIIC to form.
    const years = [
      year({ operating_income: 900_000_000, ppe_net: 2_000_000_000 }),
      year({ revenue: undefined as never }),
      year({ revenue: undefined as never }),
      year({ operating_income: 100_000_000, ppe_net: 800_000_000, revenue: undefined as never }),
    ];
    return computeGrowthScore(fin(years));
  };

  it('does not award a perfect growth score from one saturated metric', () => {
    const g = roiicOnly();
    expect(g.revenue_cagr_3yr).toBeNull();
    expect(g.revenue_cagr_5yr).toBeNull();
    expect(g.roiic).not.toBeNull();
    expect(g.composite).toBeLessThan(10);
  });

  it('reports how much of the score is actually evidenced', () => {
    // One of three growth inputs available.
    expect(roiicOnly().coverage).toBeCloseTo(1 / 3, 5);
  });

  it('scores a company with no annual facts as neutral on value, not as zero', () => {
    // The only scorer that answered 0 for an empty case. A ticker EDGAR has
    // nothing for is unknown, not cheap and not dear -- and Value carries up to
    // 40% of the goal-weighted composite, so 0 versus 5 moved a full two points.
    const empty = computeValueScore({ financials: fin([]), market_cap: 1_000_000_000 })
    expect(empty.composite).toBe(5)
    expect(empty.coverage).toBe(0)
    expect(empty.earnings_yield).toBeNull()
  })

  it('does not let the empty case outrank a company with real but poor metrics', () => {
    // The point of neutral: an unknown must sit above nothing and below evidence
    // of strength, never below a company we can actually see is weak.
    const empty = computeValueScore({ financials: fin([]), market_cap: 1_000_000_000 })
    const strong = computeValueScore({ financials: fin([year()]), market_cap: 1_000_000_000, dcf_upside_pct: 0.8 })
    expect(empty.composite).toBeLessThan(strong.composite)
  })

  it('scores a company with no growth data as neutral, not as zero', () => {
    // Absence of evidence is not evidence of weakness — a 0 here would rank an
    // unknown company below a genuinely shrinking one.
    const g = computeGrowthScore(fin([year({ revenue: undefined as never })]));
    expect(g.composite).toBe(5);
    expect(g.coverage).toBe(0);
  });

  it('still allows a full set of strong metrics to reach the top', () => {
    // Growing revenue strongly across six years, so nothing is held at neutral.
    const years = Array.from({ length: 6 }, (_, i) =>
      year({ revenue: 1_000_000_000 / Math.pow(1.4, i),
             operating_income: 200_000_000 / Math.pow(1.4, i),
             ppe_net: 800_000_000 / Math.pow(1.2, i) }));
    const g = computeGrowthScore(fin(years));
    expect(g.coverage).toBe(1);
    expect(g.composite).toBeGreaterThan(9);
  });

  it('penalises a partial value score relative to the same metrics fully covered', () => {
    // LMT showed Value 7.3 with FCF yield and DCF upside both blank.
    const withAll = computeValueScore({
      financials: fin([year()]), market_cap: 1_000_000_000, dcf_upside_pct: 0.8,
    });
    const partial = computeValueScore({
      financials: fin([year({ operating_cf: undefined as never, free_cash_flow: undefined as never })]),
      market_cap: 1_000_000_000,
    });
    expect(partial.coverage!).toBeLessThan(withAll.coverage!);
  });
});

describe('DCF feeds the value score', () => {
  /**
   * scoreCompany computed the DCF for its display panel but passed
   * computeValueScore a dcf_upside_pct that no caller ever supplied, so the
   * input was null for every ticker. A card could show a −43% base case beside
   * a mid-range Value score and the two never disagreed on purpose.
   */
  const base = () => fin([year()]);

  it('changes the value score, so the input is not inert', () => {
    const without = computeValueScore({ financials: base(), market_cap: 1_000_000_000 });
    const with_   = computeValueScore({ financials: base(), market_cap: 1_000_000_000, dcf_upside_pct: 0.8 });
    expect(with_.composite).not.toBe(without.composite);
  });

  it('marks a stock down when the DCF says it is expensive', () => {
    const cheap = computeValueScore({ financials: base(), market_cap: 1_000_000_000, dcf_upside_pct: 0.8 });
    const dear  = computeValueScore({ financials: base(), market_cap: 1_000_000_000, dcf_upside_pct: -0.43 });
    expect(dear.composite).toBeLessThan(cheap.composite);
    expect(dear.dcf_upside_pct).toBeCloseTo(-0.43, 5);
  });

  it('counts the DCF toward coverage once supplied', () => {
    const without = computeValueScore({ financials: base(), market_cap: 1_000_000_000 });
    const with_   = computeValueScore({ financials: base(), market_cap: 1_000_000_000, dcf_upside_pct: 0.1 });
    expect(with_.coverage!).toBeGreaterThan(without.coverage!);
  });
});

describe('insider interaction flags', () => {
  it('requires a discretionary executive cluster and joins it to accruals deterioration', () => {
    const financials = fin([year({ net_income: 400_000_000, operating_cf: 100_000_000 })])
    const quality = computeQualityScore(financials)
    const earnings = computeEarningsQuality(financials)
    const transaction = (owner_cik: string, overrides = {}) => ({
      owner_cik, is_officer: true, transaction_date: new Date().toISOString().slice(0, 10),
      classification: 'open_market_sale', shares: 20, shares_owned_after: 80,
      plan_10b5_1: false, price_suspect: false, ...overrides,
    })
    const flags = detectFlags(financials, quality, earnings, [transaction('1'), transaction('2')])
    expect(flags).toContain('INSIDER_SELLING')
    expect(flags).toContain('INSIDER_FUNDAMENTALS_DIVERGENCE')
    expect(detectFlags(financials, quality, earnings, [transaction('1'), transaction('2', { plan_10b5_1: true })]))
      .not.toContain('INSIDER_SELLING')
  })
});

describe('cash conversion below zero', () => {
  it('does not award a top score to a company burning more cash than it loses', () => {
    // OCF/NI inverts through zero: a $100M loss with $200M of cash burn gives
    // -200/-100 = +2.0, which normalize(0, 2) reads as perfect cash conversion.
    const burning = computeEarningsQuality(fin([
      year({ net_income: -100_000_000, operating_cf: -200_000_000, free_cash_flow: -230_000_000 }),
      year({ fiscal_year: 2024 }),
    ]))
    const healthy = computeEarningsQuality(fin([year(), year({ fiscal_year: 2024 })]))
    expect(burning.ocf_to_ni).toBeNull()
    expect(burning.coverage!).toBeLessThan(healthy.coverage!)
    expect(burning.composite).toBeLessThan(healthy.composite)
  })
});

describe('non-finite guards', () => {
  it('does not let a revenue sign flip poison the growth composite', () => {
    // cagr() guards a non-positive START but not a non-positive END, and
    // Math.pow(negative, 1/3) is NaN. NaN survives the `!= null` filter in
    // compositeOf, so one bad input would take the whole score with it.
    const years = [
      year({ fiscal_year: 2025, revenue: -50_000_000 }),
      year({ fiscal_year: 2024 }), year({ fiscal_year: 2023 }),
      year({ fiscal_year: 2022, revenue: 800_000_000 }),
    ]
    const growth = computeGrowthScore(fin(years))
    expect(Number.isFinite(growth.composite)).toBe(true)
    expect(growth.revenue_cagr_3yr).toBeNull()
  })
});
