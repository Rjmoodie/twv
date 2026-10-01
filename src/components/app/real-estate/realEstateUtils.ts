/**
 * Display formatting shared by the real-estate calculators.
 */

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatPercentage = (value: number): string => {
  // An infinite return is the defining BRRRR success case: every dollar of
  // invested capital came back out on the refinance, so return on remaining
  // capital is unbounded. Render it rather than printing "Infinity%".
  if (value === Infinity) return '∞';
  if (value === -Infinity) return '−∞';
  if (!Number.isFinite(value)) return 'N/M';
  return `${value.toFixed(1)}%`;
};
