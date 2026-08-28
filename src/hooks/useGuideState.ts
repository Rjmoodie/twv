import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Tracks which guide IDs a user has dismissed.
 * Keyed per user so guides reset on account switch.
 * localStorage-only — no server round-trip needed for dismissal state.
 */

export const GUIDE_IDS = {
  NUDGE_CONNECT_BANK:  'nudge_connect_bank_v1',
  NUDGE_STALE_SYNC:    'nudge_stale_sync_v1',
  NUDGE_START_JOURNEY: 'nudge_start_journey_v1',
  NUDGE_NO_SNAPSHOT:   'nudge_no_snapshot_v1',
  NUDGE_DEAL_TIP:      'nudge_deal_tip_v1',
} as const;

export type GuideId = typeof GUIDE_IDS[keyof typeof GUIDE_IDS];

function storageKey(userId: string) {
  return `somatech_guide_state_${userId}`;
}

function load(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function save(userId: string, seen: Set<string>) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...seen]));
  } catch { /* storage quota — fail silently */ }
}

export function useGuideState(userId: string | undefined) {
  const [dismissed, setDismissed] = useState<Set<string>>(() =>
    userId ? load(userId) : new Set()
  );

  // Re-hydrate from localStorage whenever userId changes (sign-in, account switch).
  // Comparing against a ref avoids re-running on unrelated renders.
  const prevUserIdRef = useRef(userId);
  useEffect(() => {
    if (userId === prevUserIdRef.current) return;
    prevUserIdRef.current = userId;
    setDismissed(userId ? load(userId) : new Set());
  }, [userId]);

  const isDismissed = useCallback(
    (id: GuideId) => dismissed.has(id),
    [dismissed],
  );

  const dismiss = useCallback((id: GuideId) => {
    if (!userId) return;
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      save(userId, next);
      return next;
    });
  }, [userId]);

  const reset = useCallback((id: GuideId) => {
    if (!userId) return;
    setDismissed(prev => {
      const next = new Set(prev);
      next.delete(id);
      save(userId, next);
      return next;
    });
  }, [userId]);

  return { isDismissed, dismiss, reset };
}
