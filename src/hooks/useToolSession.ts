/**
 * useToolSession
 *
 * Saves planning tool sessions to Supabase so the Financial Coach can read them
 * as context on every conversation.
 *
 * Edge cases handled:
 *   - Unauthenticated users → falls back to localStorage (sessions travel to Coach
 *     via sessionStorage prefill, not DB fetch)
 *   - DB save failure → falls back to localStorage, never blocks navigation
 *   - localStorage quota exceeded → fail silently (StorageError caught)
 *   - Concurrent saves → each insert is independent, no race condition
 *   - Summary too long → truncated to 800 chars before storage
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/somatech/AuthProvider';
import type { ToolSession } from '@/lib/toolSessionTypes';

// ── localStorage fallback ─────────────────────────────────────────────────────

const LS_KEY     = 'somatech_tool_sessions_local';
const LS_MAX     = 10;
const SUMMARY_MAX = 800; // chars — keeps Coach prompt manageable

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function readLocalSessions(): ToolSession[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as ToolSession[]) : [];
  } catch {
    return [];
  }
}

function writeLocalSession(session: ToolSession): void {
  try {
    const existing = readLocalSessions();
    const updated  = [session, ...existing].slice(0, LS_MAX);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  } catch {
    // StorageError (quota) — fail silently; session is already in sessionStorage handoff
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useToolSession() {
  const { user } = useAuth();

  /**
   * Saves a tool session.
   * - Authenticated: writes to Supabase (Coach edge function reads these on every message)
   * - Unauthenticated or DB error: falls back to localStorage
   * Never throws — failures are logged but never surface to the user.
   */
  const saveSession = useCallback(async (session: ToolSession): Promise<void> => {
    const safe: ToolSession = {
      ...session,
      summary: truncate(session.summary, SUMMARY_MAX),
    };

    if (!user) {
      writeLocalSession(safe);
      return;
    }

    try {
      const { error } = await supabase.from('tool_sessions').insert({
        user_id:     user.id,
        tool:        safe.tool,
        summary:     safe.summary,
        key_outputs: safe.key_outputs,
      });
      if (error) throw error;
    } catch (err) {
      // Non-fatal: Coach will still receive the prompt via sessionStorage handoff
      console.warn('[useToolSession] DB save failed, falling back to localStorage:', err);
      writeLocalSession(safe);
    }
  }, [user]);

  return { saveSession };
}
