/**
 * FinancialDisclaimer — D9 regulatory footer.
 *
 * Audit requirement: "All financial data pages must carry a SEC-style
 * disclaimer. This is standard practice for any site showing security prices,
 * analyst ratings, or investment-related content."
 *
 * Usage:
 *   <FinancialDisclaimer />                    // full disclaimer
 *   <FinancialDisclaimer compact />            // single-line footer
 *   <FinancialDisclaimer variant="research" /> // research-specific language
 */
import React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Disclaimer copy ─────────────────────────────────────────────────────────

const DISCLAIMERS = {
  general: `The information provided on SomaTech is for informational and educational
purposes only and does not constitute investment advice, financial advice, trading advice,
or any other type of advice. SomaTech is not a registered investment advisor, broker-dealer,
or financial planner. Past performance is not indicative of future results. All investments
involve risk, including the possible loss of principal. You should consult with a qualified
financial professional before making any investment decisions.`,

  research: `Analyst ratings, price targets, and research content are sourced from third parties
and are provided for informational purposes only. SomaTech does not independently verify
this information and makes no representation as to its accuracy or completeness.
Third-party research reflects the opinions of the originating firm as of the publication
date and may not reflect current conditions.`,

  pdufa: `FDA PDUFA dates and regulatory calendars are compiled from publicly available
government sources and third-party databases. This information is provided for reference
only and does not constitute medical or investment advice. Regulatory decisions are
inherently uncertain; actual outcomes may differ materially from expectations.`,
};

// ─── Props ───────────────────────────────────────────────────────────────────

type DisclaimerVariant = 'general' | 'research' | 'pdufa';

interface FinancialDisclaimerProps {
  variant?: DisclaimerVariant;
  /** Single-line footer style */
  compact?: boolean;
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

const FinancialDisclaimer: React.FC<FinancialDisclaimerProps> = ({
  variant = 'general',
  compact = false,
  className,
}) => {
  const text = DISCLAIMERS[variant];

  if (compact) {
    return (
      <p
        className={cn(
          'text-[11px] text-muted-foreground leading-relaxed',
          className
        )}
      >
        <Info
          className="inline-block h-3 w-3 mr-1 align-text-bottom"
          aria-hidden="true"
        />
        For informational purposes only. Not investment advice.{' '}
        <span className="hidden sm:inline">
          Past performance is not indicative of future results.
        </span>
      </p>
    );
  }

  return (
    <aside
      className={cn(
        'rounded-md border border-border bg-muted/40 p-3',
        className
      )}
      aria-label="Financial disclaimer"
    >
      <div className="flex gap-2">
        <Info
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {text.trim()}
        </p>
      </div>
    </aside>
  );
};

export default FinancialDisclaimer;
