export const RISK_LABELS_SHORT = ['Very Cons.', 'Conservative', 'Moderate', 'Aggressive', 'Very Agg.']

export function formatPct(val: number | null | undefined, decimals = 1): string {
  if (val == null) return '—'
  return `${(val * 100).toFixed(decimals)}%`
}

export function formatUSD(val: number | null | undefined): string {
  if (val == null) return '—'
  const abs = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000)     return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)         return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

export function formatScore(val: number | null | undefined, outOf = 10): string {
  if (val == null) return '—'
  return `${val.toFixed(1)}/${outOf}`
}

export const SEVERITY_COLOR: Record<string, string> = {
  on_target: 'bg-emerald-500',
  minor:     'bg-yellow-400',
  moderate:  'bg-warning/100',
  critical:  'bg-red-600',
}

export const FLAG_LABELS: Record<string, string> = {
  ACCRUALS_SPIKE:      'Accruals spike',
  DILUTION_WARNING:    'Share dilution',
  FCF_DIVERGENCE:      'FCF divergence',
  LEVERAGE_RISING:     'Leverage rising',
  MARGIN_COMPRESSION:  'Margin compression',
  INSIDER_SELLING:     'Insider selling',
  INSIDER_FUNDAMENTALS_DIVERGENCE: 'Insider selling + earnings-quality concern',
  MOAT_EROSION:        'Moat erosion',
  DIVIDEND_AT_RISK:    'Dividend at risk',
  EARNINGS_QUALITY_LOW:'Low earnings quality',
  BALANCE_SHEET_WEAK:  'Weak balance sheet',
}
