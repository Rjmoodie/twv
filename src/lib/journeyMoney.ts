/**
 * Currency input helpers shared by Journey intake and workspace fields.
 * Values are rounded to cents at the application boundary while the display
 * string preserves transient states such as `1500.` and `1500.5` during entry.
 */
export function formatCurrencyInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';

  const decimalAt = cleaned.indexOf('.');
  const integerRaw = decimalAt === -1 ? cleaned : cleaned.slice(0, decimalAt);
  const decimalRaw = decimalAt === -1
    ? null
    : cleaned.slice(decimalAt + 1).replace(/\./g, '').slice(0, 2);

  const integer = integerRaw.replace(/^0+(?=\d)/, '') || '0';
  const grouped = Number(integer).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return decimalRaw === null ? grouped : `${grouped}.${decimalRaw}`;
}

export function parseCurrencyInput(display: string): number {
  const normalized = display.replace(/,/g, '').replace(/[^0-9.]/g, '');
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function formatMoney(value: number, currency = 'USD', maximumFractionDigits = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}
