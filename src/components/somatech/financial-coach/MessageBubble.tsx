import React from 'react';
import { cn } from '@/lib/utils';
import { CoachMessage } from '@/hooks/useFinancialCoach';
import { Bot, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ToolLaunchCard from './ToolLaunchCard';

interface MessageBubbleProps {
  message: CoachMessage;
  onLaunchTool: (type: string, prefill: Record<string, unknown>) => void;
  onRetry?: () => void;
}

const ERROR_PHRASES = [
  'trouble connecting',
  'try again in a moment',
  'failed to',
  'error occurred',
  'something went wrong',
];

function isErrorMessage(content: string): boolean {
  const lower = content.toLowerCase();
  return ERROR_PHRASES.some(p => lower.includes(p));
}

export default function MessageBubble({ message, onLaunchTool, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = !isUser && isErrorMessage(message.content);

  if (isError) {
    return (
      <div className="flex gap-2.5 max-w-full">
        <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center mt-0.5">
          <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl rounded-tl-sm border border-border/60 bg-muted/40 px-4 py-3 space-y-2">
            <p className="text-[13px] font-medium text-foreground">Connection paused</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Couldn't reach the coach service. Your financial data is safe — try again in a moment.
            </p>
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="h-7 text-xs px-3 rounded-lg mt-1"
              >
                Try again
              </Button>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground px-1 mt-1 block">
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2.5 max-w-full', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar — assistant only, user relies on alignment */}
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center mt-0.5">
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}

      <div className={cn('flex flex-col gap-1 max-w-[82%]', isUser ? 'items-end' : 'items-start')}>
        <div className={cn(
          'px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap',
          isUser
            // Soft brand tint — calm, not electric
            ? 'bg-primary/[0.08] text-foreground border border-primary/10 rounded-tr-sm'
            : 'bg-muted/60 text-foreground rounded-tl-sm'
        )}>
          {message.content}
        </div>

        {message.toolLaunch && (
          <ToolLaunchCard
            type={message.toolLaunch.type}
            prefill={message.toolLaunch.prefill}
            onLaunch={onLaunchTool}
          />
        )}

        <span className="text-[10px] text-muted-foreground/70 px-1">
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
