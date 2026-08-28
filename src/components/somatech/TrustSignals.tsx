/**
 * TrustSignals — D1 credibility / security indicators.
 *
 * Audit requirement: "Pricing and auth pages must display security badges,
 * encryption indicators, and compliance markers to reduce purchase anxiety."
 *
 * Rendered as a compact horizontal strip or a 2×N grid depending on `layout`.
 */
import React from 'react';
import { Shield, Lock, RefreshCw, CreditCard, Eye, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Signal definitions ───────────────────────────────────────────────────────

interface Signal {
  Icon: React.ElementType;
  label: string;
  sublabel?: string;
}

const SIGNALS: Signal[] = [
  {
    Icon: Lock,
    label: '256-bit SSL',
    sublabel: 'Encrypted connection',
  },
  {
    Icon: Shield,
    label: 'SOC 2 Ready',
    sublabel: 'Enterprise-grade security',
  },
  {
    Icon: CreditCard,
    label: 'Secure payments',
    sublabel: 'Powered by Stripe',
  },
  {
    Icon: RefreshCw,
    label: 'Cancel anytime',
    sublabel: 'No lock-in contracts',
  },
  {
    Icon: Eye,
    label: 'Privacy first',
    sublabel: 'We never sell your data',
  },
  {
    Icon: Award,
    label: '30-day guarantee',
    sublabel: 'Full refund, no questions',
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface TrustSignalsProps {
  /** Which signals to include (defaults to all) */
  signals?: Array<
    'ssl' | 'soc2' | 'payments' | 'cancel' | 'privacy' | 'guarantee'
  >;
  layout?: 'strip' | 'grid';
  className?: string;
  /** Muted text — suitable for dark pricing card backgrounds */
  muted?: boolean;
}

const SIGNAL_KEYS = [
  'ssl',
  'soc2',
  'payments',
  'cancel',
  'privacy',
  'guarantee',
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

const TrustSignals: React.FC<TrustSignalsProps> = ({
  signals,
  layout = 'strip',
  className,
  muted = false,
}) => {
  const indices = signals
    ? signals.map((k) => SIGNAL_KEYS.indexOf(k)).filter((i) => i !== -1)
    : SIGNAL_KEYS.map((_, i) => i);

  const items = indices.map((i) => SIGNALS[i]);

  if (layout === 'grid') {
    return (
      <div
        className={cn(
          'grid grid-cols-2 gap-3 sm:grid-cols-3',
          className
        )}
        aria-label="Security and trust information"
      >
        {items.map(({ Icon, label, sublabel }) => (
          <div key={label} className="flex items-start gap-2">
            <Icon
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                muted
                  ? 'text-muted-foreground'
                  : 'text-accent dark:text-accent'
              )}
              aria-hidden="true"
            />
            <div>
              <p
                className={cn(
                  'text-xs font-medium leading-none',
                  muted ? 'text-muted-foreground' : 'text-foreground'
                )}
              >
                {label}
              </p>
              {sublabel && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sublabel}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Strip layout — single row of icon + label
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-5 gap-y-2',
        className
      )}
      aria-label="Security and trust information"
    >
      {items.map(({ Icon, label }) => (
        <span
          key={label}
          className={cn(
            'inline-flex items-center gap-1 text-xs',
            muted
              ? 'text-muted-foreground'
              : 'text-muted-foreground hover:text-foreground transition-colors'
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
};

export default TrustSignals;
