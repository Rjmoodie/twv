import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextualNudgeProps {
  /** Short headline */
  title:    string;
  /** 1-2 sentence body */
  body:     string;
  /** Optional CTA button */
  action?:  { label: string; onClick: () => void };
  /** Call when the user dismisses */
  onDismiss: () => void;
  /** Visual variant */
  variant?: 'default' | 'info' | 'warning';
  className?: string;
}

const VARIANT_STYLES = {
  default: 'bg-card border-border/60',
  info:    'bg-primary/5 border-primary/20',
  warning: 'bg-amber-500/5 border-amber-500/20',
};

/**
 * A slim, dismissible tip shown in-context — never modal, never blocking.
 * Pair with useGuideState to show it only once per user.
 */
export default function ContextualNudge({
  title,
  body,
  action,
  onDismiss,
  variant = 'default',
  className,
}: ContextualNudgeProps) {
  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-xl border px-4 py-3',
        VARIANT_STYLES[variant],
        className,
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{body}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            {action.label} →
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex-shrink-0 mt-0.5 p-0.5 rounded-md text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
