import { describe, it, expect } from 'vitest';
import { provenanceOf, PROVENANCE, SOURCE_NAMES } from './provenance';

describe('provenance', () => {
  it('classifies filed line items as filed', () => {
    for (const f of ['revenue', 'net_income', 'free_cash_flow', 'short_term_debt', 'tax_expense']) {
      expect(provenanceOf(f), f).toBe('filed');
    }
  });

  it('classifies vendor market data as market, not filed', () => {
    for (const f of ['current_price', 'beta', 'analyst_target', 'week52_high']) {
      expect(provenanceOf(f), f).toBe('market');
    }
  });

  it('treats anything we compute as model', () => {
    for (const f of ['piotroski', 'composite', 'intrinsic_value', 'roic_5yr_avg', 'anything_else']) {
      expect(provenanceOf(f), f).toBe('model');
    }
  });

  it('keeps SEC and EDGAR as distinct concepts, not synonyms', () => {
    expect(SOURCE_NAMES.filingAuthority).toBe('SEC');
    expect(SOURCE_NAMES.filingSystem).toBe('EDGAR');
    expect(SOURCE_NAMES.filingsFull).toContain('SEC');
    expect(SOURCE_NAMES.filingsFull).toContain('EDGAR');
  });

  it('gives every kind a short label and a precise detail line', () => {
    for (const kind of ['filed', 'market', 'model'] as const) {
      expect(PROVENANCE[kind].label.length).toBeLessThanOrEqual(8);
      expect(PROVENANCE[kind].detail.length).toBeGreaterThan(30);
    }
  });

  it('says plainly that a model figure is not a reported one', () => {
    expect(PROVENANCE.model.detail).toMatch(/not a reported figure/i);
  });
});
