/**
 * Single source of truth for every financial term definition in TW Ventures.
 * Each entry has a short label and a plain-English explanation (1–2 sentences max).
 */

export interface TermDef {
  label:   string;
  explain: string;
}

export const TERMS: Record<string, TermDef> = {
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
};
