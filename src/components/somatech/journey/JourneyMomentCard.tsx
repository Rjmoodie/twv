import { forwardRef, memo } from 'react';
import { Sparkles } from 'lucide-react';
import type { JourneyId } from './journeyConfig';
import { JOURNEY_NAMES } from './momentTemplates';
import { cn } from '@/lib/utils';

type JourneyPalette = {
  bg:    string;
  text:  string;
  accent: string;
  badge: string;
  glow:  string;
};

const JOURNEY_PALETTE: Record<JourneyId, JourneyPalette> = {
  'debt-freedom': {
    bg:    'from-red-950 via-red-950 to-red-900',
    text:  'text-red-200',
    accent: 'border-red-400/20 bg-red-400/10',
    badge: 'bg-red-400/10 text-red-100 ring-red-300/20',
    glow:  'bg-red-400/20',
  },
  'budget-clarity': {
    bg:    'from-blue-950 via-blue-950 to-blue-900',
    text:  'text-blue-200',
    accent: 'border-blue-400/20 bg-blue-400/10',
    badge: 'bg-blue-400/10 text-blue-100 ring-blue-300/20',
    glow:  'bg-blue-400/20',
  },
  'investor-starter': {
    bg:    'from-teal-950 via-emerald-950 to-emerald-900',
    text:  'text-teal-200',
    accent: 'border-teal-400/20 bg-teal-400/10',
    badge: 'bg-teal-400/10 text-teal-100 ring-teal-300/20',
    glow:  'bg-teal-400/20',
  },
  'home-buying': {
    bg:    'from-amber-950 via-amber-950 to-amber-900',
    text:  'text-amber-200',
    accent: 'border-amber-400/20 bg-amber-400/10',
    badge: 'bg-amber-400/10 text-amber-100 ring-amber-300/20',
    glow:  'bg-amber-400/20',
  },
  'business-owner': {
    bg:    'from-violet-950 via-violet-950 to-violet-900',
    text:  'text-violet-200',
    accent: 'border-violet-400/20 bg-violet-400/10',
    badge: 'bg-violet-400/10 text-violet-100 ring-violet-300/20',
    glow:  'bg-violet-400/20',
  },
};

const DEFAULT_ID: JourneyId = 'investor-starter';

const GRID_TEXTURE: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.6) 1px,transparent 1px)',
  backgroundSize: '28px 28px',
};

export interface JourneyMomentCardProps {
  journeyId:     JourneyId;
  headline:      string;
  subheadline:   string;
  timelineLabel: string | null;
  stageLabel:    string;
  showTimeline:  boolean;
  compact?:      boolean;
  className?:    string;
}

const JourneyMomentCard = memo(
  forwardRef<HTMLDivElement, JourneyMomentCardProps>(function JourneyMomentCard(
    { journeyId, headline, subheadline, timelineLabel, stageLabel, showTimeline, compact = false, className },
    ref,
  ) {
    const p    = JOURNEY_PALETTE[journeyId] ?? JOURNEY_PALETTE[DEFAULT_ID];
    const name = JOURNEY_NAMES[journeyId]   ?? 'Financial Journey';
    const showTl = showTimeline && !!timelineLabel;

    return (
      <div
        ref={ref}
        className={cn(
          'relative isolate overflow-hidden rounded-2xl border border-white/10',
          'bg-gradient-to-br text-white shadow-sm select-none',
          p.bg,
          compact ? 'p-4' : 'p-6 sm:p-7',
          className,
        )}
        aria-label={`${name}: ${headline}`}
      >
        {/* Soft glow — lighter in compact mode */}
        <div
          className={cn(
            'pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl',
            compact ? 'opacity-15' : 'opacity-25',
            p.glow,
          )}
          aria-hidden
        />

        {/* Grid texture — full card only, skipped in compact to reduce paint */}
        {!compact && (
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.032]"
            style={GRID_TEXTURE}
            aria-hidden
          />
        )}

        <div className="relative z-10">
          {/* Badge row */}
          <div className="mb-4 flex items-center gap-2">
            <div
              className={cn(
                'flex shrink-0 items-center justify-center rounded-xl border',
                compact ? 'h-8 w-8' : 'h-9 w-9',
                p.accent,
              )}
              aria-hidden
            >
              <Sparkles className={cn('h-4 w-4', p.text)} />
            </div>
            <span
              className={cn(
                'inline-flex max-w-full truncate items-center rounded-full font-semibold ring-1',
                compact ? 'px-2.5 py-1 text-[0.68rem]' : 'px-3 py-1 text-xs',
                p.badge,
              )}
            >
              {name}
            </span>
          </div>

          {/* Stage eyebrow */}
          <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/45">
            {stageLabel}
          </p>

          {/* Headline */}
          <h2
            className={cn(
              'font-bold leading-tight tracking-tight text-white',
              compact ? 'line-clamp-2 text-base' : 'text-xl sm:text-2xl',
            )}
          >
            {headline}
          </h2>

          {/* Subheadline */}
          {subheadline && (
            <p
              className={cn(
                'mt-2 leading-relaxed text-white/70',
                compact ? 'line-clamp-2 text-xs' : 'text-sm',
              )}
            >
              {subheadline}
            </p>
          )}

          {/* Timeline pill */}
          {showTl && (
            <div
              className={cn(
                'mt-4 inline-flex max-w-full items-center truncate rounded-full border font-semibold',
                compact ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-xs',
                p.accent, p.text,
              )}
            >
              {timelineLabel}
            </div>
          )}

          {/* Branding footer — share card only */}
          {!compact && (
            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
              <p className="text-[0.62rem] font-medium uppercase tracking-[0.18em] text-white/35">
                Progress, not advice.
              </p>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-white/55">
                SomaTech
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }),
);

JourneyMomentCard.displayName = 'JourneyMomentCard';
export default JourneyMomentCard;
