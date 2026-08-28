import React, { useRef, useEffect, useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, RotateCcw, Loader2, Zap, Lock, AlertCircle } from 'lucide-react';
import { CoachMessage, CoachQuota } from '@/hooks/useFinancialCoach';
import MessageBubble from './MessageBubble';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  messages: CoachMessage[];
  isSending: boolean;
  onSend: (content: string) => void;
  onNewConversation: () => void;
  onLaunchTool: (type: string, prefill: Record<string, unknown>) => void;
  contextSummary?: string;
  quota: CoachQuota | null;
  quotaExceeded: boolean;
  quotaResetAt: string | null;
  onUpgrade?: () => void;
  hideToolbar?: boolean;
  contextualSuggestions?: string[];
}

const SUGGESTED_STARTERS = [
  "Should I be renting or buying right now?",
  "Am I taking too little risk with my investments?",
  "How do I know if I'm saving enough?",
  "What should I do with my emergency fund?",
];

function QuotaBar({ quota, onUpgrade }: { quota: CoachQuota; onUpgrade?: () => void }) {
  const pct = Math.round((quota.remaining / quota.limit) * 100);
  const isLow = quota.remaining <= 3;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border/40 bg-muted/30">
      <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', isLow ? 'bg-warning/100' : 'bg-primary/60')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('text-[10px] font-medium shrink-0', isLow ? 'text-warning' : 'text-muted-foreground')}>
        {quota.remaining}/{quota.limit} today
      </span>
      {isLow && onUpgrade && (
        <button
          onClick={onUpgrade}
          className="text-[10px] text-primary underline underline-offset-2 shrink-0"
        >
          Upgrade
        </button>
      )}
    </div>
  );
}

function QuotaExceededBanner({
  resetAt,
  onUpgrade,
}: {
  resetAt: string | null;
  onUpgrade?: () => void;
}) {
  const resetTime = resetAt
    ? new Date(resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'midnight UTC';

  return (
    <div className="mx-4 my-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-center space-y-3">
      <div className="flex justify-center">
        <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
          <Lock className="h-5 w-5 text-warning" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Daily limit reached</p>
        <p className="text-xs text-muted-foreground">
          Free users get 20 messages per day. Resets at {resetTime}.
        </p>
      </div>
      {onUpgrade && (
        <Button
          size="sm"
          onClick={onUpgrade}
          className="gap-2 w-full"
        >
          <Zap className="h-3.5 w-3.5" />
          Upgrade for unlimited access
        </Button>
      )}
    </div>
  );
}

export default function ChatInterface({
  messages,
  isSending,
  onSend,
  onNewConversation,
  onLaunchTool,
  contextSummary,
  quota,
  quotaExceeded,
  quotaResetAt,
  onUpgrade,
  hideToolbar = false,
  contextualSuggestions,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEmpty = messages.length === 0;

  useEffect(() => {
    // 'instant' avoids conflicting with iOS momentum scrolling mid-gesture
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [messages.length, isSending]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isSending || quotaExceeded) return;
    onSend(trimmed);
    setInput('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar — hidden in compact/panel mode where the parent already has a header */}
      {!hideToolbar && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 shrink-0 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn('w-2 h-2 rounded-full shrink-0', quotaExceeded ? 'bg-warning/100' : 'bg-accent animate-pulse')} />
            <span className="text-sm font-medium text-foreground shrink-0">Financial Coach</span>
            {contextSummary && (
              <span className="text-[10px] text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5 truncate max-w-[200px] leading-none">
                {contextSummary}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onNewConversation}
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            <RotateCcw className="h-3 w-3" />
            New session
          </Button>
        </div>
      )}

      {/* Quota bar — only shown for limited tiers */}
      {quota && !quotaExceeded && <QuotaBar quota={quota} onUpgrade={onUpgrade} />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 space-y-3.5"
           style={{ WebkitOverflowScrolling: 'touch' }}>
        {isEmpty && !quotaExceeded ? (
          <div className="flex flex-col justify-end h-full gap-3 pb-2">
            <p className="text-[13px] text-muted-foreground px-0.5">Suggested questions</p>
            <div className="flex flex-col gap-2">
              {(contextualSuggestions ?? SUGGESTED_STARTERS).map((s) => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  className="text-left text-[13px] px-3.5 py-2.5 rounded-xl border border-border/60 bg-background hover:border-border hover:bg-muted/30 transition-colors text-foreground leading-snug"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const next = messages[i + 1];
              /**
               * A user turn with no assistant turn after it never got a reply.
               * Failure bubbles live in local state only, so after a reload this
               * marker is the sole trace that a send failed — without it the
               * transcript reads as though the coach silently ignored the
               * message, which is what makes people re-send the same question.
               */
              const unanswered =
                msg.role === 'user' &&
                (next != null
                  ? next.role === 'user'
                  : !isSending && !quotaExceeded);

              return (
                <React.Fragment key={msg.id}>
                  <MessageBubble
                    message={msg}
                    onLaunchTool={onLaunchTool}
                    onRetry={() => {
                      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                      if (lastUserMsg) onSend(lastUserMsg.content);
                    }}
                  />
                  {unanswered && (
                    <div className="flex justify-end -mt-1">
                      <button
                        type="button"
                        onClick={() => onSend(msg.content)}
                        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <AlertCircle className="h-3 w-3 shrink-0 text-warning" />
                        No reply — this send failed. Retry
                      </button>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            {isSending && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            {quotaExceeded && <QuotaExceededBanner resetAt={quotaResetAt} onUpgrade={onUpgrade} />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-3.5 border-t border-border/30 bg-background">
        <div className="flex gap-2 items-end rounded-xl border border-border/50 bg-background px-3 py-2 focus-within:border-border transition-colors">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={quotaExceeded ? "Daily limit reached" : "Ask about your finances…"}
            disabled={quotaExceeded}
            rows={1}
            className={cn(
              "resize-none min-h-[28px] max-h-[100px] flex-1 text-[13px] border-0 shadow-none focus-visible:ring-0 p-0 bg-transparent",
              quotaExceeded && "opacity-50 cursor-not-allowed"
            )}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const t = e.currentTarget;
              // Reset then measure in one frame to avoid double reflow
              requestAnimationFrame(() => {
                t.style.height = '0px';
                t.style.height = `${Math.min(t.scrollHeight, 100)}px`;
              });
            }}
          />
          <Button
            onClick={quotaExceeded ? onUpgrade : handleSend}
            disabled={quotaExceeded ? false : (!input.trim() || isSending)}
            size="icon"
            className={cn('h-7 w-7 shrink-0 rounded-lg', quotaExceeded && 'bg-warning/100 hover:bg-amber-600')}
          >
            {quotaExceeded ? <Zap className="h-3 w-3" /> : <Send className="h-3 w-3" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">
          Not financial advice · Enter to send
        </p>
      </div>
    </div>
  );
}
