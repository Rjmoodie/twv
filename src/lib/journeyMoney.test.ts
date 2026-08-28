import { describe, expect, it } from 'vitest';
import { formatCurrencyInput, parseCurrencyInput } from './journeyMoney';

describe('journey currency inputs', () => {
  it.each([
    ['1500.50', '1,500.50', 1500.5],
    ['$1,500.50', '1,500.50', 1500.5],
    ['1500.', '1,500.', 1500],
    ['1500.5', '1,500.5', 1500.5],
    ['00012.09', '12.09', 12.09],
    ['', '', 0],
  ])('formats %s without changing its monetary value', (raw, display, value) => {
    expect(formatCurrencyInput(raw)).toBe(display);
    expect(parseCurrencyInput(display)).toBe(value);
  });

  it('keeps only one decimal separator and two decimal places', () => {
    expect(formatCurrencyInput('12.3.456')).toBe('12.34');
  });
});
