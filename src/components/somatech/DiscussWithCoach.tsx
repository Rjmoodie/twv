/**
 * DiscussWithCoach
 *
 * Reusable button that:
 *  1. Saves the tool session to Supabase (for Coach context on future messages)
 *  2. Writes the session summary to sessionStorage via askCoach()
 *  3. Navigates to the Financial Coach with the summary as the opening prompt
 *
 * Edge cases:
 *  - Session save failure → still navigates (save is best-effort, never blocks UX)
 *  - Double-click / rapid clicks → disabled while saving
 *  - No session → caller should only render this component when result exists
 */

import React, { useState } from 'react';
import { Brain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToolSession } from '@/hooks/useToolSession';
import { useNavigation } from '@/contexts/NavigationContext';
import { askCoach } from '@/lib/askCoach';
import { cn } from '@/lib/utils';
import type { ToolSession } from '@/lib/toolSessionTypes';

interface DiscussWithCoachProps {
  session:    ToolSession;
  label?:     string;
  className?: string;
  size?:      'sm' | 'default';
  variant?:   'outline' | 'default' | 'ghost';
}

export default function DiscussWithCoach({
  session,
  label   = 'Discuss with Coach',
  className,
  size    = 'default',
  variant = 'outline',
}: DiscussWithCoachProps) {
  const { saveSession }        = useToolSession();
  const { navigateToModule }   = useNavigation();
  const [loading, setLoading]  = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);

    // Save is best-effort — if it fails we still navigate to the Coach
    try {
      await saveSession(session);
    } catch (err) {
      console.warn('[DiscussWithCoach] Session save failed (non-fatal):', err);
    }

    setLoading(false);

    // askCoach writes the prompt to sessionStorage and navigates
    try {
      askCoach(session.summary, navigateToModule);
    } catch {
      navigateToModule('financial-coach'); // navigate without prefill as last resort
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      size={size}
      variant={variant}
      className={cn('gap-2', className)}
    >
      {loading
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <Brain className="h-4 w-4 text-primary" />
      }
      {label}
    </Button>
  );
}
