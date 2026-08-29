import React from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TERMS } from './terms';

interface HelpTooltipProps {
  /** Key from TERMS dictionary, or pass `label` + `explain` directly */
  term?:    keyof typeof TERMS;
  label?:   string;
  explain?: string;
  /** Where the tooltip appears relative to the trigger */
  side?:    'top' | 'bottom' | 'left' | 'right';
  /**
   * Extra classes on the trigger element.
   * No-children path: applied to the <button> wrapper.
   * Children path: merged onto the child element (requires a single React element child).
   */
  className?: string;
  /** Render a single React element as the trigger instead of a plain label+icon button */
  children?: React.ReactElement;
}

/**
 * Drop-in tooltip for financial terms.
 *
 * Usage (term key):        <HelpTooltip term="cash_runway" />
 * Usage (inline text):     <HelpTooltip label="ARV" explain="After-Repair Value…" />
 * Usage (custom trigger):  <HelpTooltip term="net_worth"><span>Net Worth</span></HelpTooltip>
 */
export default function HelpTooltip({
  term,
  label,
  explain,
  side = 'top',
  className,
  children,
}: HelpTooltipProps) {
  const def = term ? TERMS[term] : undefined;
  const resolvedLabel   = label   ?? def?.label   ?? '';
  const resolvedExplain = explain ?? def?.explain ?? '';

  if (!resolvedExplain) {
    return <>{children ?? <span>{resolvedLabel}</span>}</>;
  }

  // Children path: merge className + cursor-default directly onto the child element
  // so there is no anonymous wrapper between TooltipTrigger and the caller's element.
  const trigger = children
    ? React.cloneElement(children, {
        className: cn('cursor-default', children.props.className, className),
      })
    : (
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 cursor-default select-none',
            className,
          )}
        >
          <span>{resolvedLabel}</span>
          <Info className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
        </button>
      );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-[220px] text-xs leading-relaxed font-normal"
      >
        {resolvedExplain}
      </TooltipContent>
    </Tooltip>
  );
}
