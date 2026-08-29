import React from 'react';
import { Zap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
interface UpgradeNudgeProps {
  onUpgrade: () => void;
  collapsed?: boolean;
  className?: string;
}

const UpgradeNudge: React.FC<UpgradeNudgeProps> = ({ onUpgrade, collapsed = false, className }) => {
  if (collapsed) {
    return (
      <button
        onClick={onUpgrade}
        title="See plans — Planner from $15/mo"
        className={cn(
          'flex items-center justify-center w-full rounded-xl p-2',
          'bg-primary/10 hover:bg-primary/20 text-primary transition-colors duration-150',
          className
        )}
      >
        <Zap className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={onUpgrade}
      className={cn(
        'w-full rounded-xl px-3 py-2.5 text-left',
        'bg-primary/8 hover:bg-primary/14 border border-primary/20 hover:border-primary/30',
        'transition-colors duration-150 group',
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="shrink-0 h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
          <Zap className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground leading-tight">Unlock more</p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            Planner $15 · Investor $35 · Complete $50
          </p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
      </div>
    </button>
  );
};

export default UpgradeNudge;
