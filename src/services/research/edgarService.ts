/**
 * Portfolio research data pipeline
 *
 * Uses the authenticated stock-analysis function for production fetches and
 * normalizes its SEC-backed response for the portfolio scoring engine.
 *
 * Endpoints used:
 *   https://www.sec.gov/files/company_tickers.json          — ticker → CIK lookup
 *   https://data.sec.gov/api/xbrl/companyfacts/CIK{n}.json — all XBRL facts
 */

import { supabase } from '@/integrations/supabase/client'
import type { NormalizedFinancials, AnnualFinancials } from '@/types/portfolio'
import type { StockAnalysisResponse } from '@/components/somatech/stock-analysis/stockAnalysisMapper'

// Proxied through Vite — data.sec.gov blocks CORS from localhost
const _EDGAR_BASE = '/edgar-api'
// Routed through our proxy server — www.sec.gov blocks CORS in the browser
const TICKERS_URL = '/proxy/sec-tickers'

/**
 * Returns days since data_as_of — used for UI freshness indicators.
 */
export function dataAgeDays(dataAsOf: string | null | undefined): number | null {
  if (!dataAsOf) return null
  return Math.floor((Date.now() - new Date(dataAsOf).getTime()) / 86_400_000)
}

/**
 * Returns true when data_as_of is old enough that a new 10-K may have dropped.
 */
export function isFilingDue(dataAsOf: string | null | undefined): boolean {
  const days = dataAgeDays(dataAsOf)
  return days != null && days > 365
}

// XBRL tag candidates per line item — ordered by preference (most standard first)
const XBRL_TAGS = {
  revenue: [
    'Revenues',
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'SalesRevenueNet',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
  ],
  gross_profit: ['GrossProfit'],
  operating_income: ['OperatingIncomeLoss'],
  net_income: ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
  operating_cf: ['NetCashProvidedByUsedInOperatingActivities'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
  total_assets: ['Assets'],
  current_assets: ['AssetsCurrent'],
  current_liabilities: ['LiabilitiesCurrent'],
  long_term_debt: ['LongTermDebt', 'LongTermDebtNoncurrent', 'LongTermNotesPayable'],
  // Current portion of debt — excluded from EV, enterprise value came out
  // understated and every leveraged company screened cheaper than it was.
  short_term_debt: [
    'DebtCurrent',
    'ShortTermBorrowings',
    'LongTermDebtCurrent',
    'OtherShortTermBorrowings',
  ],
  total_equity: [
    'StockholdersEquity',
    'StockholdersEquityAttributableToParent',
    // LiabilitiesAndStockholdersEquity intentionally excluded — it's total L+E, not equity
  ],
  cash: [
    'CashAndCashEquivalentsAtCarryingValue',
    'CashCashEquivalentsAndShortTermInvestments',
    'CashAndCashEquivalentsAndShortTermInvestments',
  ],
  ppe_net: ['PropertyPlantAndEquipmentNet'],
  shares_outstanding: [
    'CommonStockSharesOutstanding',
    'EntityCommonStockSharesOutstanding',
  ],
  rd_expense: ['ResearchAndDevelopmentExpense'],
  interest_expense: ['InterestExpense', 'InterestAndDebtExpense'],
  dividends_paid: ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock'],
  da_expense: ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization'],
  // Needed to turn pre-tax EBIT into NOPAT for ROIC
  tax_expense: ['IncomeTaxExpenseBenefit'],
  pretax_income: [
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
    'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
  ],
}

// ─── Ticker → CIK lookup (module-level cache, deduped) ────────────────────────

let tickerMap: Map<string, { cik: string; name: string }> | null = null
let tickerMapPromise: Promise<Map<string, { cik: string; name: string }>> | null = null

async function getTickerMap(): Promise<Map<string, { cik: string; name: string }>> {
  if (tickerMap) return tickerMap
  // Dedupe concurrent callers: all await the same in-flight promise
  if (tickerMapPromise) return tickerMapPromise
  tickerMapPromise = (async () => {
    const res = await fetch(TICKERS_URL, {
      headers: { 'User-Agent': 'Somatech research@somatech.pro' },
    })
    if (!res.ok) throw new Error(`EDGAR ticker fetch failed: ${res.status}`)
    const data = await res.json()
    tickerMap = new Map()
    for (const entry of Object.values(data) as { cik_str: number; ticker: string; title: string }[]) {
      tickerMap.set(entry.ticker.toUpperCase(), {
        cik: String(entry.cik_str).padStart(10, '0'),
        name: entry.title,
      })
    }
    tickerMapPromise = null
    return tickerMap
  })()
  return tickerMapPromise
}

export async function resolveCIK(ticker: string): Promise<{ cik: string; name: string } | null> {
  const map = await getTickerMap()
  return map.get(ticker.toUpperCase()) ?? null
}

// ─── XBRL fact extraction helpers ─────────────────────────────────────────────

interface XBRLUnit {
  accn: string
  cik: number
  entityName: string
  loc: string
  end: string
  start?: string
  val: number
  form: string
  filed: string
  frame?: string
}

interface CompanyFacts {
  cik: number
  entityName: string
  facts: {
    'us-gaap'?: Record<string, { label: string; description?: string; units: Record<string, XBRLUnit[]> }>
    dei?: Record<string, { label: string; units: Record<string, XBRLUnit[]> }>
  }
}

interface ExtractionResult {
  values: Map<number, number>
  periodEnds: Map<number, string>   // fiscal_year → actual XBRL period end date
}

function extractAnnualValues(
  facts: CompanyFacts,
  tagCandidates: string[],
  unit: 'USD' | 'shares' = 'USD',
): ExtractionResult {
  const gaap = facts.facts['us-gaap'] ?? {}
  const dei  = facts.facts['dei']      ?? {}

  for (const tag of tagCandidates) {
    const concept = gaap[tag] ?? dei[tag]
    if (!concept) continue
    const entries: XBRLUnit[] = concept.units[unit] ?? []

    // Filter: annual 10-K filings with a period spanning ~12 months
    const annual = entries.filter((e) => {
      if (e.form !== '10-K') return false
      if (!e.start) return false
      const diffDays = (new Date(e.end).getTime() - new Date(e.start).getTime()) / 86_400_000
      return diffDays >= 340 && diffDays <= 390
    })

    if (annual.length === 0) continue

    const byYear = new Map<number, XBRLUnit>()
    for (const e of annual) {
      const yr = new Date(e.end).getFullYear()
      const existing = byYear.get(yr)
      if (!existing || new Date(e.filed) > new Date(existing.filed)) {
        byYear.set(yr, e)
      }
    }

    return {
      values:     new Map([...byYear.entries()].map(([yr, e]) => [yr, e.val])),
      periodEnds: new Map([...byYear.entries()].map(([yr, e]) => [yr, e.end])),
    }
  }

  return { values: new Map(), periodEnds: new Map() }
}

function extractInstantValues(
  facts: CompanyFacts,
  tagCandidates: string[],
  unit: 'USD' | 'shares' = 'USD',
): ExtractionResult {
  const gaap = facts.facts['us-gaap'] ?? {}
  const dei  = facts.facts['dei']      ?? {}

  for (const tag of tagCandidates) {
    const concept = gaap[tag] ?? dei[tag]
    if (!concept) continue
    const entries: XBRLUnit[] = concept.units[unit] ?? []

    const annual = entries.filter((e) => e.form === '10-K' && !e.start)
    if (annual.length === 0) continue

    const byYear = new Map<number, XBRLUnit>()
    for (const e of annual) {
      const yr = new Date(e.end).getFullYear()
      const existing = byYear.get(yr)
      if (!existing || new Date(e.filed) > new Date(existing.filed)) {
        byYear.set(yr, e)
      }
    }

    return {
      values:     new Map([...byYear.entries()].map(([yr, e]) => [yr, e.val])),
      periodEnds: new Map([...byYear.entries()].map(([yr, e]) => [yr, e.end])),
    }
  }

  return { values: new Map(), periodEnds: new Map() }
}

// ─── Normalization ─────────────────────────────────────────────────────────────

function _normalizeFacts(facts: CompanyFacts, ticker: string, cik: string): NormalizedFinancials {
  const { values: revenue,     periodEnds: revenueEndDates } = extractAnnualValues(facts, XBRL_TAGS.revenue)
  const { values: grossProfit }  = extractAnnualValues(facts, XBRL_TAGS.gross_profit)
  const { values: opIncome }     = extractAnnualValues(facts, XBRL_TAGS.operating_income)
  const { values: netIncome }    = extractAnnualValues(facts, XBRL_TAGS.net_income)
  const { values: operatingCF }  = extractAnnualValues(facts, XBRL_TAGS.operating_cf)
  const { values: capex }        = extractAnnualValues(facts, XBRL_TAGS.capex)
  const { values: rdExpense }    = extractAnnualValues(facts, XBRL_TAGS.rd_expense)
  const { values: interest }     = extractAnnualValues(facts, XBRL_TAGS.interest_expense)
  const { values: dividends }    = extractAnnualValues(facts, XBRL_TAGS.dividends_paid)
  const { values: da }           = extractAnnualValues(facts, XBRL_TAGS.da_expense)
  const { values: taxExpense }   = extractAnnualValues(facts, XBRL_TAGS.tax_expense)
  const { values: pretaxIncome } = extractAnnualValues(facts, XBRL_TAGS.pretax_income)

  const { values: totalAssets,  periodEnds: assetEndDates } = extractInstantValues(facts, XBRL_TAGS.total_assets)
  const { values: currentAssets }  = extractInstantValues(facts, XBRL_TAGS.current_assets)
  const { values: currentLiab }    = extractInstantValues(facts, XBRL_TAGS.current_liabilities)
  const { values: ltDebt }         = extractInstantValues(facts, XBRL_TAGS.long_term_debt)
  const { values: stDebt }         = extractInstantValues(facts, XBRL_TAGS.short_term_debt)
  const { values: equity }         = extractInstantValues(facts, XBRL_TAGS.total_equity)
  const { values: cash }           = extractInstantValues(facts, XBRL_TAGS.cash)
  const { values: ppe }            = extractInstantValues(facts, XBRL_TAGS.ppe_net)
  const { values: shares }         = extractInstantValues(facts, XBRL_TAGS.shares_outstanding, 'shares')

  // Build a map of fiscal_year → actual period_end date from the most data-rich source
  // Prefer revenue (income stmt) then totalAssets (balance sheet) for the authoritative period end
  const periodEndByYear = new Map<number, string>()
  for (const [yr, entry] of [...revenueEndDates.entries(), ...assetEndDates.entries()]) {
    if (!periodEndByYear.has(yr)) periodEndByYear.set(yr, entry)
  }

  // Union all years with data
  const allYears = new Set<number>([
    ...revenue.keys(), ...netIncome.keys(), ...operatingCF.keys(),
    ...totalAssets.keys(),
  ])

  const annual: AnnualFinancials[] = [...allYears]
    .sort((a, b) => b - a)
    .slice(0, 10)
    .map((yr) => {
      const ocf  = operatingCF.get(yr) ?? null
      // CapEx from EDGAR is always reported as a positive outflow ("Payments to Acquire...")
      // but some filers use negative values — normalise to positive so FCF = OCF - |CapEx|
      const cxRaw = capex.get(yr) ?? null
      const cx    = cxRaw != null ? Math.abs(cxRaw) : null
      const ni    = netIncome.get(yr) ?? null
      return {
        fiscal_year:        yr,
        period_end:         periodEndByYear.get(yr) ?? `${yr}-12-31`,
        revenue:            revenue.get(yr) ?? null,
        gross_profit:       grossProfit.get(yr) ?? null,
        operating_income:   opIncome.get(yr) ?? null,
        net_income:         ni,
        operating_cf:       ocf,
        capex:              cx,
        free_cash_flow:     ocf != null && cx != null ? ocf - cx : null,   // cx already abs-valued above
        total_assets:       totalAssets.get(yr) ?? null,
        current_assets:     currentAssets.get(yr) ?? null,
        current_liabilities: currentLiab.get(yr) ?? null,
        long_term_debt:     ltDebt.get(yr) ?? null,
        short_term_debt:    stDebt.get(yr) ?? null,
        total_equity:       equity.get(yr) ?? null,
        cash:               cash.get(yr) ?? null,
        ppe_net:            ppe.get(yr) ?? null,
        shares_outstanding: shares.get(yr) ?? null,
        rd_expense:         rdExpense.get(yr) ?? null,
        interest_expense:   interest.get(yr) ?? null,
        dividends_paid:     dividends.get(yr) ?? null,
        da_expense:         da.get(yr) ?? null,
        tax_expense:        taxExpense.get(yr) ?? null,
        pretax_income:      pretaxIncome.get(yr) ?? null,
      }
    })

  return {
    ticker: ticker.toUpperCase(),
    cik,
    company_name: facts.entityName,
    annual,
  }
}

// ─── Main fetch function ───────────────────────────────────────────────────────

async function fetchFromEDGAR(ticker: string): Promise<NormalizedFinancials> {
  const { data, error } = await supabase.functions.invoke<StockAnalysisResponse>('stock-analysis', {
    body: { ticker },
  })
  if (error) throw new Error(`Research provider failed for ${ticker}: ${error.message}`)
  if (!data?.fundamentals?.annual?.length) throw new Error(`No annual filings were available for ${ticker}`)

  const profile = data.fundamentals.profile
  return {
    ticker: data.ticker.toUpperCase(),
    cik: data.cik,
    company_name: data.companyName,
    annual: data.fundamentals.annual.map((period): AnnualFinancials => ({
      fiscal_year: period.fiscalYear,
      period_end: period.periodEnd,
      revenue: period.revenue,
      gross_profit: period.grossProfit,
      operating_income: period.operatingIncome,
      net_income: period.netIncome,
      operating_cf: period.operatingCashFlow,
      capex: period.capex,
      free_cash_flow: period.freeCashFlow,
      total_assets: period.totalAssets,
      current_assets: period.currentAssets,
      current_liabilities: period.currentLiabilities,
      long_term_debt: period.longTermDebt,
      short_term_debt: period.shortTermDebt,
      total_equity: period.shareholderEquity,
      cash: period.cash,
      ppe_net: null,
      shares_outstanding: period.sharesOutstanding,
      rd_expense: period.researchAndDevelopment ?? null,
      interest_expense: period.interestExpense ?? null,
      dividends_paid: period.dividendsPaid ?? null,
      da_expense: period.depreciationAmortization ?? null,
      tax_expense: period.incomeTaxExpense ?? null,
      pretax_income: period.pretaxIncome ?? null,
    })),
    market_cap: profile?.marketCapitalization ?? undefined,
    current_price: data.quote.price > 0 ? data.quote.price : undefined,
    beta: profile?.beta ?? undefined,
    sector: profile?.sector ?? undefined,
    industry: profile?.industry ?? undefined,
    week52_high: profile?.week52High ?? undefined,
    week52_low: profile?.week52Low ?? undefined,
    ma_200day: profile?.ma200 ?? undefined,
    analyst_target: profile?.analystTargetPrice ?? undefined,
    // The server already reports when each half was true, and the quote source
    // states outright that it is not real-time. Dropping that here is what let
    // the screen render a day-old price as the current one.
    price_as_of: data.sources?.quote?.asOf ?? data.sources?.quote?.fetchedAt ?? undefined,
    price_provider: data.sources?.quote?.provider ?? undefined,
    market_stats_as_of: data.sources?.fundamentals?.fetchedAt ?? undefined,
  }
}

// ─── Cached public API ─────────────────────────────────────────────────────────

/**
 * Fetches normalized financials for a ticker.
 * Checks the portfolio score cache first, then calls the server data pipeline.
 */
export async function getFinancials(ticker: string): Promise<NormalizedFinancials> {
  const upper = ticker.toUpperCase()
  // The authenticated server function owns caching and validation. Never trust
  // a browser-writable shared row as the source of financial truth.
  return fetchFromEDGAR(upper)
}

/**
 * Batch fetch financials for multiple tickers.
 * Respects EDGAR's recommended 10 req/sec rate limit.
 */
export async function getBatchFinancials(
  tickers: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, NormalizedFinancials>> {
  const results = new Map<string, NormalizedFinancials>()
  for (let i = 0; i < tickers.length; i++) {
    try {
      const fin = await getFinancials(tickers[i])
      results.set(tickers[i].toUpperCase(), fin)
    } catch {
      // skip failed tickers, don't block batch
    }
    onProgress?.(i + 1, tickers.length)
    // Respect EDGAR rate limit — 100ms between requests
    if (i < tickers.length - 1) await new Promise((r) => setTimeout(r, 100))
  }
  return results
}
