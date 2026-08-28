/**
 * Curated ticker universes per portfolio goal.
 *
 * These are the stocks the system considers when generating monthly buy recommendations.
 * All tickers are US-domiciled SEC filers (10-K) so EDGAR data is available.
 * Organized by goal → bucket for direct use by the recommendation engine.
 */

import type { GoalType, AssetBucket } from '@/types/portfolio'

export interface UniverseTicker {
  ticker: string
  bucket: AssetBucket
}

// ─── Individual universes ──────────────────────────────────────────────────────

const QUALITY_GROWTH: UniverseTicker[] = [
  // US Large Cap — high-ROIC compounders with durable moats
  { ticker: 'MSFT',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'AAPL',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'GOOGL', bucket: 'US_EQUITY_LARGE' },
  { ticker: 'AMZN',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'META',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'V',     bucket: 'US_EQUITY_LARGE' },
  { ticker: 'MA',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'UNH',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'COST',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'SPGI',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'MCO',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'ICE',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'CME',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'BLK',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'WM',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'RSG',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'IDXX',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'ISRG',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'TMO',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'DHR',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'FICO',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'ADBE',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'NOW',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'SNPS',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'CDNS',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'ANSS',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'VEEV',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'MKTX',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'FTNT',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'PANW',  bucket: 'US_EQUITY_LARGE' },
  // US Small Cap — smaller compounders with high returns on capital
  { ticker: 'EXPO',  bucket: 'US_EQUITY_SMALL' },
  { ticker: 'RBC',   bucket: 'US_EQUITY_SMALL' },
  { ticker: 'MSEX',  bucket: 'US_EQUITY_SMALL' },
  { ticker: 'FBIZ',  bucket: 'US_EQUITY_SMALL' },
  { ticker: 'CSWI',  bucket: 'US_EQUITY_SMALL' },
  // Intl Developed — US-listed ADRs with 10-K filings
  { ticker: 'TSM',   bucket: 'INTL_EQUITY_DEVELOPED' },
  { ticker: 'ASML',  bucket: 'INTL_EQUITY_DEVELOPED' },
  { ticker: 'NVO',   bucket: 'INTL_EQUITY_DEVELOPED' },
]

const TOTAL_RETURN: UniverseTicker[] = [
  { ticker: 'MSFT',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'AAPL',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'GOOGL', bucket: 'US_EQUITY_LARGE' },
  { ticker: 'AMZN',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'NVDA',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'V',     bucket: 'US_EQUITY_LARGE' },
  { ticker: 'MA',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'UNH',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'COST',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'BRK-B', bucket: 'US_EQUITY_LARGE' },
  { ticker: 'JPM',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'BAC',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'XOM',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'CVX',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'LLY',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'SPGI',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'MCO',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'TMO',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'DHR',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'ISRG',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'WM',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'NOW',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'ADBE',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'EXPO',  bucket: 'US_EQUITY_SMALL' },
  { ticker: 'CSWI',  bucket: 'US_EQUITY_SMALL' },
  { ticker: 'TSM',   bucket: 'INTL_EQUITY_DEVELOPED' },
  { ticker: 'NVO',   bucket: 'INTL_EQUITY_DEVELOPED' },
  { ticker: 'O',     bucket: 'REAL_ASSETS' },
  { ticker: 'AMT',   bucket: 'REAL_ASSETS' },
]

const DIVIDEND_INCOME: UniverseTicker[] = [
  // Dividend Aristocrats + Champions — 25+ years consecutive dividend growth
  { ticker: 'JNJ',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'PG',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'KO',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'MCD',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'WMT',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'PEP',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'CL',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'GIS',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'MKC',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'ABT',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'MDT',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'LLY',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'ADP',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'PAYX',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'AFL',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'CB',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'MMM',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'EMR',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'ITW',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'GPC',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'CAT',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'SWK',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'PPG',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'SHW',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'XOM',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'CVX',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'T',     bucket: 'US_EQUITY_LARGE' },
  { ticker: 'VZ',    bucket: 'US_EQUITY_LARGE' },
  // REITs — income-oriented real assets
  { ticker: 'O',     bucket: 'REAL_ASSETS' },
  { ticker: 'WPC',   bucket: 'REAL_ASSETS' },
  { ticker: 'NNN',   bucket: 'REAL_ASSETS' },
  { ticker: 'STAG',  bucket: 'REAL_ASSETS' },
  { ticker: 'VTR',   bucket: 'REAL_ASSETS' },
  { ticker: 'WELL',  bucket: 'REAL_ASSETS' },
  { ticker: 'DLR',   bucket: 'REAL_ASSETS' },
  { ticker: 'PSA',   bucket: 'REAL_ASSETS' },
  { ticker: 'EXR',   bucket: 'REAL_ASSETS' },
  { ticker: 'PLD',   bucket: 'REAL_ASSETS' },
  { ticker: 'AMT',   bucket: 'REAL_ASSETS' },
  { ticker: 'CCI',   bucket: 'REAL_ASSETS' },
]

const CAPITAL_PRESERVATION: UniverseTicker[] = [
  // Defensive, low-beta, strong balance sheets
  { ticker: 'BRK-B', bucket: 'US_EQUITY_LARGE' },
  { ticker: 'JNJ',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'PG',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'KO',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'WMT',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'PEP',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'MCD',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'COST',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'WM',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'RSG',   bucket: 'US_EQUITY_LARGE' },
  // Regulated utilities — most defensive equity bucket
  { ticker: 'NEE',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'SO',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'DUK',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'ED',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'D',     bucket: 'US_EQUITY_LARGE' },
  { ticker: 'WEC',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'AEP',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'XEL',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'AWK',   bucket: 'US_EQUITY_LARGE' },
  // Defensive REITs
  { ticker: 'O',     bucket: 'REAL_ASSETS' },
  { ticker: 'AMT',   bucket: 'REAL_ASSETS' },
  { ticker: 'CCI',   bucket: 'REAL_ASSETS' },
  { ticker: 'PSA',   bucket: 'REAL_ASSETS' },
]

const DEEP_VALUE: UniverseTicker[] = [
  // Large cap value — cheap on earnings/book, strong balance sheets
  { ticker: 'BRK-B', bucket: 'US_EQUITY_LARGE' },
  { ticker: 'JPM',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'BAC',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'WFC',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'C',     bucket: 'US_EQUITY_LARGE' },
  { ticker: 'GS',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'MS',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'USB',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'TFC',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'AIG',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'MET',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'PRU',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'AFL',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'XOM',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'CVX',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'COP',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'EOG',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'CF',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'MOS',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'NUE',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'STLD',  bucket: 'US_EQUITY_LARGE' },
  // Small cap value
  { ticker: 'ORI',   bucket: 'US_EQUITY_SMALL' },
  { ticker: 'RLI',   bucket: 'US_EQUITY_SMALL' },
  { ticker: 'FNF',   bucket: 'US_EQUITY_SMALL' },
  { ticker: 'VOYA',  bucket: 'US_EQUITY_SMALL' },
  { ticker: 'BRKL',  bucket: 'US_EQUITY_SMALL' },
]

const BALANCED: UniverseTicker[] = [
  // Blend of quality, income, and value across buckets
  { ticker: 'MSFT',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'AAPL',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'V',     bucket: 'US_EQUITY_LARGE' },
  { ticker: 'UNH',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'COST',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'BRK-B', bucket: 'US_EQUITY_LARGE' },
  { ticker: 'JPM',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'JNJ',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'PG',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'KO',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'XOM',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'WM',    bucket: 'US_EQUITY_LARGE' },
  { ticker: 'TMO',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'SPGI',  bucket: 'US_EQUITY_LARGE' },
  { ticker: 'NEE',   bucket: 'US_EQUITY_LARGE' },
  { ticker: 'EXPO',  bucket: 'US_EQUITY_SMALL' },
  { ticker: 'ORI',   bucket: 'US_EQUITY_SMALL' },
  { ticker: 'TSM',   bucket: 'INTL_EQUITY_DEVELOPED' },
  { ticker: 'NVO',   bucket: 'INTL_EQUITY_DEVELOPED' },
  { ticker: 'O',     bucket: 'REAL_ASSETS' },
  { ticker: 'AMT',   bucket: 'REAL_ASSETS' },
  { ticker: 'PSA',   bucket: 'REAL_ASSETS' },
]

// ─── Public export ─────────────────────────────────────────────────────────────

export const UNIVERSES: Record<GoalType, UniverseTicker[]> = {
  quality_growth:       QUALITY_GROWTH,
  total_return:         TOTAL_RETURN,
  dividend_income:      DIVIDEND_INCOME,
  capital_preservation: CAPITAL_PRESERVATION,
  deep_value:           DEEP_VALUE,
  balanced:             BALANCED,
}

export function getUniverse(goal: GoalType): UniverseTicker[] {
  return UNIVERSES[goal] ?? BALANCED
}
