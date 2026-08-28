# Portfolio & Research Engine — Standards Reference

> Engineering reference for Somatech's investing-focused portfolio management and research engine.
> Goal-based design, institutional-grade scoring models, and portfolio-aligned research filtering.

---

## Part 1: Portfolio Design Standards

### The Framework: Goal-Based Investing (CFA Institute / Vanguard methodology)

A portfolio is defined by three axes that constrain everything:

```
goal_type × time_horizon × risk_capacity → allocation policy
```

**Goal types (industry standard):**

| Goal | Characteristics | Primary metric |
|---|---|---|
| Total Return | Maximize long-term wealth | CAGR vs benchmark |
| Quality Growth | Compound via reinvestment | ROIC, revenue growth |
| Dividend Income | Yield + sustainability | FCF yield, payout ratio |
| Capital Preservation | Limit drawdown | Max drawdown, Sharpe |
| Deep Value | Reversion to intrinsic value | DCF upside, EV/EBIT |
| Balanced | Risk parity across environments | Correlation, vol-weighted |

**Time horizon matters for research filters** — a 2yr horizon filters differently than 10yr:
- Short: earnings quality, near-term catalysts, balance sheet safety
- Long: moat durability, reinvestment rate, TAM, management quality

---

### Allocation Policy Statement (the engineering contract)

Standard institutional practice — each portfolio produces an **IPS (Investment Policy Statement)** equivalent as a data object:

```typescript
interface AllocationPolicy {
  goal: GoalType
  horizon_years: number
  risk_tolerance: 1 | 2 | 3 | 4 | 5      // 1=conservative, 5=aggressive
  risk_capacity: 1 | 2 | 3 | 4 | 5        // separate from tolerance
  target_allocations: AllocationTarget[]   // by bucket
  constraints: PolicyConstraints           // max position, sector limits
  rebalance_threshold_pct: number          // drift tolerance before trigger
  min_conviction_score: number             // floor for research to surface
}

interface AllocationTarget {
  bucket: AssetBucket                      // US_EQUITY, INTL_EQUITY, FIXED_INCOME, etc.
  target_pct: number
  min_pct: number
  max_pct: number
}

interface PolicyConstraints {
  max_single_position_pct: number          // e.g. 10%
  max_sector_concentration_pct: number     // e.g. 30%
  min_positions: number
  max_positions: number
  exclude_sectors?: string[]
}
```

---

### Portfolio Type Definitions

| Type | Typical Horizon | Risk | Allocation Bias |
|---|---|---|---|
| Total Return | 7–15yr | 3–5 | Heavy equity, minimal fixed income |
| Quality Growth | 10yr+ | 3–4 | US + International equity, quality tilt |
| Dividend Income | 5–10yr | 2–3 | Dividend equity, REITs, investment-grade bonds |
| Capital Preservation | 1–5yr | 1–2 | Fixed income, low-beta equity, cash |
| Deep Value | 3–7yr | 3–5 | Concentrated equity, contrarian |
| Balanced | 5–10yr | 2–3 | 60/40 base, risk parity adjusted |

---

### Asset Buckets (standard allocation categories)

```typescript
type AssetBucket =
  | 'US_EQUITY_LARGE'
  | 'US_EQUITY_SMALL'
  | 'INTL_EQUITY_DEVELOPED'
  | 'INTL_EQUITY_EMERGING'
  | 'FIXED_INCOME_INVESTMENT_GRADE'
  | 'FIXED_INCOME_HIGH_YIELD'
  | 'REAL_ASSETS'           // REITs, commodities
  | 'ALTERNATIVES'
  | 'CASH'
```

---

### Risk: Tolerance vs Capacity (CFA distinction)

These are **separate inputs** — a user may have high tolerance but low capacity (short horizon, dependents):

- **Tolerance**: willingness to accept volatility (subjective, questionnaire-driven)
- **Capacity**: ability to absorb loss without derailing financial goals (objective: income, expenses, horizon, liquidity needs)

The binding constraint is `min(tolerance, capacity)`.

---

## Part 2: Research Engine — Standards & Sources

### Scoring Models (computed per company)

---

#### 1. Quality Score — Piotroski F-Score (+ extensions)

9 binary signals, scored 0–9. Score ≥ 7 = strong. Score ≤ 2 = weak.

| Signal | Source | Pass condition |
|---|---|---|
| ROA > 0 | Income stmt + assets | Positive net income relative to assets |
| Operating CF > 0 | Cash flow stmt | Operations generating cash |
| ROA improving YoY | Trailing 2 years | ROA(t) > ROA(t-1) |
| Accruals (CF/NI ratio) | CF vs income | OCF/Assets > ROA (cash > accrual earnings) |
| Leverage decreasing | Balance sheet | Long-term debt ratio fell YoY |
| Liquidity improving | Balance sheet | Current ratio rose YoY |
| No dilution | Equity stmt | Shares outstanding flat or decreased |
| Gross margin improving | Income stmt | GM(t) > GM(t-1) |
| Asset turnover improving | Income stmt + assets | Revenue/Assets(t) > (t-1) |

**Extensions on top of Piotroski:**
- ROIC trend (5yr) — sustained excess return over WACC
- FCF consistency — how many of last 10 years had positive FCF
- FCF/Net Income ratio — earnings quality multiplier

---

#### 2. Value Score — Greenblatt Magic Formula + DCF

| Signal | Formula | Notes |
|---|---|---|
| Earnings Yield | EBIT / EV | Higher = cheaper |
| Return on Capital | EBIT / (NWC + Fixed Assets) | Greenblatt ROIC definition |
| DCF upside % | (Intrinsic − Price) / Price | Uses existing Somatech DCF engine |
| FCF yield | FCF / Market Cap | Cross-check on earnings yield |
| EV/EBIT | Enterprise Value / EBIT | Cleaner than P/E (capital structure neutral) |

Composite Value Score = rank across universe on each metric, average rank.

---

#### 3. Moat Score — Morningstar methodology (quantified)

| Signal | Proxy | Source |
|---|---|---|
| Pricing power | Gross margin stability (10yr std dev) | EDGAR XBRL |
| Excess returns | ROIC − WACC spread, sustained ≥ 5yr | EDGAR + rate data |
| Network/efficiency | Revenue per employee trend | EDGAR (10-K) |
| Customer concentration | Risk factor NLP (HHI proxy) | EDGAR 10-K text |
| Switching costs | Gross retention proxy (SaaS: NRR if disclosed) | 10-K / earnings |

Score: 0–5 (0=none, 1–2=narrow, 3–4=wide, 5=wide+high confidence)

---

#### 4. Earnings Quality Score — accruals-based

```
Earnings Quality Ratio  = Operating CF / Net Income        // target > 1.0
Accruals Ratio          = (Net Income − FCF) / Avg Total Assets  // target < 0.05
Revenue Quality         = Organic growth % vs reported total growth %
```

Red flags: accruals ratio spike YoY, large divergence between net income and OCF, aggressive revenue recognition.

---

#### 5. Growth Profile

| Metric | Formula | Notes |
|---|---|---|
| Revenue CAGR 3yr | (Rev_t / Rev_{t-3})^(1/3) − 1 | Organic preferred |
| Revenue CAGR 5yr | (Rev_t / Rev_{t-5})^(1/5) − 1 | Smooths cycles |
| Reinvestment rate | (CapEx + R&D − D&A) / Revenue | How much is plowed back |
| ROIIC | ΔOperating Income / ΔInvested Capital | Buffett's key metric — quality of growth |
| TAM signal | Revenue growth vs industry peers | Relative share gain |

---

### Data Sources

| Source | What it provides | Cost | Priority |
|---|---|---|---|
| **SEC EDGAR API** | 10-K, 10-Q, 8-K, DEF 14A, Form 4 (insider) | Free | Primary — authoritative |
| **SEC EDGAR XBRL API** | Structured financial facts (revenue, FCF, EPS, etc.) | Free | Primary — use for all financials |
| **Financial Modeling Prep (FMP)** | Pre-computed ratios, DCF, analyst estimates, earnings calendar | Freemium | Secondary — ratios + consensus |
| **Polygon.io** | Real-time + historical prices, fundamentals | Freemium | Prices + market cap |
| **Simfin** | Clean standardised fundamentals | Free tier | Backup for fundamentals |
| **FINRA** | Short interest data | Free | Sentiment signal |

**Source priority rule**: SEC EDGAR XBRL for all financial statement data (authoritative). FMP for pre-computed ratios and analyst consensus. Polygon for price and market data.

**Key EDGAR XBRL endpoints:**
```
https://data.sec.gov/api/xbrl/companyfacts/{CIK}.json   // all facts for a company
https://data.sec.gov/api/xbrl/frames/us-gaap/{tag}/{unit}/{period}.json  // cross-company
https://data.sec.gov/submissions/{CIK}.json              // filing index
```

---

### Research Filter Logic — Portfolio-Goal Aligned

Filters are derived from the portfolio's `AllocationPolicy`. Each `GoalType` maps to a `ResearchFilter`:

```typescript
const RESEARCH_FILTERS: Record<GoalType, ResearchFilter> = {
  quality_growth: {
    min_piotroski: 6,
    min_roic_pct: 15,
    min_revenue_cagr_3yr: 0.08,
    min_moat_score: 3,
    earnings_quality_min: 0.85,
    horizon_boost: ['moat', 'roiic', 'growth_profile'],
  },
  deep_value: {
    min_piotroski: 7,
    max_ev_ebit: 12,
    min_dcf_upside_pct: 0.20,
    min_fcf_yield: 0.05,
    earnings_quality_min: 0.70,
    horizon_boost: ['value_score', 'balance_sheet'],
  },
  dividend_income: {
    min_dividend_yield: 0.03,
    max_fcf_payout_ratio: 0.70,
    min_dividend_growth_5yr: 0.03,
    min_piotroski: 5,
    chowder_rule_min: 12,            // yield + 5yr DGR >= 12
    earnings_quality_min: 0.80,
    horizon_boost: ['earnings_quality', 'leverage', 'dividend_safety'],
  },
  capital_preservation: {
    min_piotroski: 6,
    max_beta: 0.8,
    max_debt_to_equity: 0.5,
    min_current_ratio: 1.5,
    min_moat_score: 3,
    earnings_quality_min: 0.90,
    horizon_boost: ['balance_sheet', 'earnings_quality', 'low_volatility'],
  },
  total_return: {
    min_piotroski: 5,
    min_roic_pct: 10,
    min_dcf_upside_pct: 0.10,
    earnings_quality_min: 0.75,
    horizon_boost: ['roiic', 'moat', 'value_score'],
  },
  balanced: {
    min_piotroski: 5,
    max_beta: 1.1,
    earnings_quality_min: 0.80,
    horizon_boost: ['earnings_quality', 'value_score'],
  },
}
```

---

### Horizon Modifier (layered on top of goal filters)

```typescript
function applyHorizonModifier(
  filter: ResearchFilter,
  horizon_years: number
): ResearchFilter {
  if (horizon_years <= 3) {
    // Short horizon: tighten balance sheet + earnings quality; relax moat
    filter.min_piotroski = Math.max(filter.min_piotroski, 7)
    filter.earnings_quality_min = Math.max(filter.earnings_quality_min, 0.90)
    filter.max_debt_to_equity = Math.min(filter.max_debt_to_equity ?? 2, 0.6)
  } else if (horizon_years >= 10) {
    // Long horizon: moat + ROIIC dominate; relax short-term valuation
    filter.horizon_boost.push('moat', 'roiic', 'growth_profile')
    filter.min_dcf_upside_pct = Math.max(
      0,
      (filter.min_dcf_upside_pct ?? 0.10) - 0.05
    )
  }
  return filter
}
```

---

### Research Result Schema

```typescript
interface ResearchResult {
  ticker: string
  company_name: string
  composite_score: number          // 0–10, weighted by goal's boost factors
  quality_score: number            // 0–9 Piotroski
  value_score: number              // 0–10
  moat_score: number               // 0–5
  growth_score: number             // 0–10
  earnings_quality: number         // OCF/NI ratio
  dcf_upside_pct: number
  goal_alignment_pct: number       // how well it matches THIS portfolio's filters
  bucket: AssetBucket              // which allocation gap it fills
  flags: ResearchFlag[]            // red flags: dilution, accruals spike, etc.
  data_as_of: string               // ISO date of underlying data
  data_sources: string[]           // e.g. ['EDGAR 10-K 2024-12-31', 'FMP 2025-04-01']
}

type ResearchFlag =
  | 'ACCRUALS_SPIKE'
  | 'DILUTION_WARNING'
  | 'FCF_DIVERGENCE'
  | 'LEVERAGE_RISING'
  | 'MARGIN_COMPRESSION'
  | 'INSIDER_SELLING'
  | 'MOAT_EROSION'
  | 'DIVIDEND_AT_RISK'
```

---

## Engineering Build Order

| Phase | Deliverable | Depends on |
|---|---|---|
| 1 | `AllocationPolicy` TypeScript types + Supabase schema | — |
| 2 | EDGAR XBRL data pipeline — fetch + normalize financials | Phase 1 |
| 3 | Piotroski F-Score + Quality Score (EDGAR data only) | Phase 2 |
| 4 | Value Score — plug into existing Somatech DCF engine | Phase 2 |
| 5 | `ResearchFilter` engine (goal + horizon → ranked results) | Phase 3, 4 |
| 6 | Portfolio Design UI — IPS wizard (goal → horizon → risk → allocation targets) | Phase 1 |
| 7 | Research Queue UI — gap → scored candidates per bucket | Phase 5, 6 |
| 8 | Moat Score + Earnings Quality scoring | Phase 3 |
| 9 | Growth Profile + ROIIC scoring | Phase 3 |
| 10 | Monitoring layer — drift alerts, rebalancing queue, AI summary | Phase 6, 7 |
