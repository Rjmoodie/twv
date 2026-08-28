import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { MonthlyMoneyStory } from '@/lib/personalFinanceEngine';

interface Props {
  story:       MonthlyMoneyStory;
  onAskCoach?: (prompt: string) => void;
}

export default function MonthlyMoneyStoryCard({ story, onAskCoach }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-border/40 bg-background overflow-hidden"
         style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}>
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="text-[14px] font-semibold text-foreground">{story.title}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">{story.summary}</p>
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground ml-3">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-border/30 space-y-3.5">
          <div className="space-y-2 pt-2">
            {[
              story.incomeSentence,
              story.spendingSentence,
              story.savingsSentence,
              story.netWorthSentence,
            ].filter(Boolean).map((sentence, i) => (
              <p key={i} className="text-[13px] text-muted-foreground leading-relaxed">{sentence}</p>
            ))}
          </div>

          {story.notableChanges.length > 0 && (
            <div className="rounded-xl bg-muted/30 border border-border/40 px-4 py-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Month-over-month changes
              </p>
              {story.notableChanges.map((change, i) => (
                <p key={i} className="text-[12px] text-foreground">• {change}</p>
              ))}
            </div>
          )}

          <p className="text-[13px] text-foreground/80 leading-relaxed border-l-2 border-primary/30 pl-3 italic">
            {story.closingInsight}
          </p>

          {onAskCoach && (
            <button
              onClick={() => onAskCoach(`${story.summary} ${story.closingInsight} Help me improve my financial position next month.`)}
              className="text-[11px] text-primary hover:underline underline-offset-2"
            >
              Ask Coach about this month →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
