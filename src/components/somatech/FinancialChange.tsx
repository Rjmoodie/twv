/**
 * FinancialChange — colorblind-safe directional indicator.
 *
 * Audit requirement D6: "Red/green financial indicators must work for
 * deuteranopia — use shape + color, not color alone."
 *
 * This component always pairs a directional icon (TrendingUp / TrendingDown /
 * Minus) with the colored text so the direction is unambiguous without color.
 */
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatChange,
  formatCurrency,
  formatPercent,
  changeColorClass,
  TABULAR,
  type ChangeResult,
} from '@/lib/finance';

// ─── Props ───────────────────────────────────────────────────────────────────

interface FinancialChangeProps {
  /** Raw numeric change value */
  value: number;
  /** How to format the number */
  type?: 'currency' | 'percent' | 'number';
  /** Show icon before the value */
  showIcon?: boolean;
  /** Tailwind size class for the icon, e.g. "h-3 w-3" */
  iconSize?: string;
  /** Additional class names applied to the outer span */
  className?: string;
  /** Aria label override; auto-generated if omitted */
  'aria-label'?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

const FinancialChange: React.FC<FinancialChangeProps> = ({
  value,
  type = 'currency',
  showIcon = true,
  iconSize = 'h-3.5 w-3.5',
  className,
  'aria-label': ariaLabel,
}) => {
  const { formatted, direction } = formatChange(value, type);
  const colorClass = changeColorClass(value);

  const Icon =
    direction === 'up'
      ? TrendingUp
      : direction === 'down'
      ? TrendingDown
      : Minus;

  const directionLabel =
    direction === 'up' ? 'increase' : direction === 'down' ? 'decrease' : 'unchanged';

  return (
    <span
      className={cn('inline-flex items-center gap-1', colorClass, TABULAR, className)}
      aria-label={ariaLabel ?? `${directionLabel}: ${formatted}`}
    >
      {showIcon && (
        <Icon className={cn('shrink-0', iconSize)} aria-hidden="true" />
      )}
      <span>{formatted}</span>
    </span>
  );
};

// ─── Compound variant: dollar change + percent change on one line ─────────────

interface FinancialChangePairProps {
  /** Absolute dollar change */
  dollarChange: number;
  /** Percentage change (e.g. 0.034 = 3.4%) */
  percentChange: number;
  className?: string;
}

export const FinancialChangePair: React.FC<FinancialChangePairProps> = ({
  dollarChange,
  percentChange,
  className,
}) => (
  <span className={cn('inline-flex items-center gap-1.5', className)}>
    <FinancialChange value={dollarChange} type="currency" />
    <span className="text-muted-foreground text-xs">/</span>
    <FinancialChange value={percentChange} type="percent" showIcon={false} />
  </span>
);

export default FinancialChange;
