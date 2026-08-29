/**
 * Single source of truth for every financial term definition in TW Ventures.
 * Each entry has a short label and a plain-English explanation (1–2 sentences max).
 */

export interface TermDef {
  label:   string;
  explain: string;
}

export const TERMS: Record<string, TermDef> = {
  net_worth: {
    label:   'Net Worth',
    explain: 'Everything you own minus everything you owe. The single clearest measure of financial progress.',
  },
  cash_runway: {
    label:   'Cash Runway',
    explain: 'How many months your liquid savings can cover your expenses if income stopped today. 3–6 months is the target.',
  },
  savings_rate: {
    label:   'Savings Rate',
    explain: 'The percentage of take-home income you keep after all expenses. Higher is better — even 10% compounds dramatically over time.',
  },
  data_confidence: {
    label:   'Data Confidence',
    explain: 'How complete and fresh your connected financial data is. Low confidence means some insights are estimates.',
  },
  sync_health: {
    label:   'Sync Health',
    explain: 'Whether your connected bank accounts are syncing successfully. Stale data means insights may not reflect recent transactions.',
  },
  journey_stage: {
    label:   'Journey Stage',
    explain: 'Where you are in your financial plan — Build, Grow, or Thrive. Your stage shapes which actions matter most right now.',
  },
  next_move: {
    label:   'Next Move',
    explain: 'The single highest-priority action based on your financial picture. Doing this one thing moves the needle the most.',
  },
  lead_score: {
    label:   'Lead Score',
    explain: 'A 0–100 rank combining distress signals, source quality, data freshness, and completeness. Higher = stronger opportunity.',
  },
  distressed_lead: {
    label:   'Distressed Lead',
    explain: 'A property showing signs of owner stress — tax delinquency, pre-foreclosure, code violations, or vacancy. These are the most motivated sellers.',
  },
  brrrr: {
    label:   'BRRRR',
    explain: 'Buy, Rehab, Rent, Refinance, Repeat. A strategy to recycle capital — you pull your down payment back out via a cash-out refi and reuse it on the next deal.',
  },
  arv: {
    label:   'ARV',
    explain: 'After-Repair Value. What the property will be worth once renovations are complete. Your refinance and profit calculations hinge on this number.',
  },
  cap_rate: {
    label:   'Cap Rate',
    explain: 'Net Operating Income ÷ Property Value. A quick way to compare deals — higher cap rate generally means more return, but also more risk.',
  },
  plaid_read_only: {
    label:   'Read-only access',
    explain: 'TW Ventures can see your balances and transactions to generate insights. It cannot move, transfer, or touch your money.',
  },
  financial_picture: {
    label:   'Financial Picture',
    explain: 'Your live snapshot — net worth, cash flow, savings rate, and data confidence — pulled from your connected accounts.',
  },
};
