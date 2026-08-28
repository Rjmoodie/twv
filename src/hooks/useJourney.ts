import { useState, useCallback } from 'react';
import type { JourneyId } from '@/components/somatech/journey/journeyConfig';
import type { FinancialProfile } from '@/services/coachService';

export interface JourneyDraft {
  journeyId:    JourneyId;
  answers:      Record<string, string | number>;
  startedAt:    number;
  /** Question IDs whose answers were pre-filled from Personal Finance or saved profile. */
  prefilledIds?: string[];
  /** Provenance for pre-filled values; plans remain distinct from factual source records. */
  prefillSource?: 'personal_finance' | 'profile';
  /** Remote document identity, required to resume a scenario without touching its baseline. */
  planId?: string;
}

const STORAGE_KEY     = 'somatech_journey_draft';
const DRAFT_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Completed journey plans — persisted per journeyId ────────────────────────

const COMPLETED_KEY = (id: JourneyId) => `somatech_journey_completed_${id}`;

export interface CompletedJourney {
  journeyId:   JourneyId;
  answers:     Record<string, string | number>;
  completedAt: number;
}

export function saveCompletedJourney(draft: JourneyDraft) {
  try {
    const record: CompletedJourney = {
      journeyId:   draft.journeyId,
      answers:     draft.answers,
      completedAt: Date.now(),
    };
    localStorage.setItem(COMPLETED_KEY(draft.journeyId), JSON.stringify(record));
  } catch { /* storage quota — fail silently */ }
}

export function loadCompletedJourney(id: JourneyId): CompletedJourney | null {
  try {
    const raw = localStorage.getItem(COMPLETED_KEY(id));
    if (!raw) return null;
    return JSON.parse(raw) as CompletedJourney;
  } catch {
    return null;
  }
}

export function loadAllCompletedJourneys(): Partial<Record<JourneyId, CompletedJourney>> {
  const ids: JourneyId[] = ['debt-freedom', 'budget-clarity', 'investor-starter', 'home-buying', 'business-owner'];
  const out: Partial<Record<JourneyId, CompletedJourney>> = {};
  for (const id of ids) {
    const c = loadCompletedJourney(id);
    if (c) out[id] = c;
  }
  return out;
}

function loadDraft(): JourneyDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as JourneyDraft;
    // Auto-clear expired or structurally invalid drafts on load — no warning banner needed
    if (!draft.journeyId || !draft.answers || typeof draft.startedAt !== 'number') {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.now() - draft.startedAt > DRAFT_EXPIRY_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return draft;
  } catch {
    // Corrupt JSON — wipe it
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    return null;
  }
}

function saveDraft(draft: JourneyDraft) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch { /* storage quota exceeded — fail silently */ }
}

/**
 * @deprecated Journey answers are assumptions, not factual profile data. Kept
 * temporarily for compatibility; new flows must use explicit plan activation.
 */
export function mapJourneyDraftToProfile(draft: JourneyDraft): Partial<FinancialProfile> {
  const { journeyId, answers } = draft;
  const n = (key: string) => Number(answers[key] ?? 0);
  const s = (key: string) => String(answers[key] ?? '');

  const concernMap: Record<string, string> = {
    'debt-freedom':    'debt',
    'budget-clarity':  'saving-more',
    'investor-starter':'investing',
    'home-buying':     'buying-home',
    'business-owner':  'running-business',
  };

  const profile: Partial<FinancialProfile> = {
    primary_concern: concernMap[journeyId] ?? 'investing',
  };

  if (journeyId === 'debt-freedom') {
    if (n('monthlyIncome') > 0) profile.monthly_take_home  = n('monthlyIncome');
    if (n('totalDebt')     > 0) profile.high_interest_debt = n('totalDebt');
  } else if (journeyId === 'budget-clarity') {
    if (n('monthlyIncome') > 0) profile.monthly_take_home = n('monthlyIncome');
    const expenses = n('fixedExpenses') + n('variableExpenses');
    if (expenses > 0) profile.monthly_expenses = expenses;
  } else if (journeyId === 'investor-starter') {
    if (n('currentSavings') > 0) profile.liquid_savings = n('currentSavings');
    const riskMap: Record<string, string> = { conservative: 'low', moderate: 'medium', growth: 'high' };
    if (answers['riskTolerance']) profile.risk_tolerance = riskMap[s('riskTolerance')] ?? 'medium';
  } else if (journeyId === 'home-buying') {
    if (n('monthlyIncome')  > 0) profile.monthly_take_home = n('monthlyIncome');
    if (n('currentSavings') > 0) profile.liquid_savings    = n('currentSavings');
  } else if (journeyId === 'business-owner') {
    if (n('monthlyRevenue')  > 0) profile.monthly_take_home = n('monthlyRevenue');
    if (n('monthlyExpenses') > 0) profile.monthly_expenses  = n('monthlyExpenses');
    if (n('cashReserves')    > 0) profile.liquid_savings     = n('cashReserves');
  }

  return profile;
}

/**
 * Maps a saved FinancialProfile → pre-filled journey answers (reverse direction).
 * Only maps fields that are actually present and non-zero to avoid overwriting
 * a blank field with a stale zero from the profile.
 */
export function mapProfileToJourneyAnswers(
  journeyId: JourneyId,
  profile: Partial<FinancialProfile>,
): { answers: Record<string, string | number>; prefilledIds: string[] } {
  const answers: Record<string, string | number> = {};
  const prefilledIds: string[] = [];

  const set = (key: string, val: number | string | undefined | null) => {
    if (val !== undefined && val !== null && val !== 0 && val !== '') {
      answers[key] = val;
      prefilledIds.push(key);
    }
  };

  const riskMap: Record<string, string> = { low: 'conservative', medium: 'moderate', high: 'growth' };

  if (journeyId === 'debt-freedom') {
    set('monthlyIncome', profile.monthly_take_home);
    set('totalDebt',     profile.high_interest_debt);
  } else if (journeyId === 'budget-clarity') {
    set('monthlyIncome', profile.monthly_take_home);
    // monthly_expenses is fixed+variable combined — can't split back, so skip
  } else if (journeyId === 'investor-starter') {
    set('currentSavings', profile.liquid_savings);
    if (profile.risk_tolerance) {
      set('riskTolerance', riskMap[profile.risk_tolerance] ?? 'moderate');
    }
  } else if (journeyId === 'home-buying') {
    set('monthlyIncome',  profile.monthly_take_home);
    set('currentSavings', profile.liquid_savings);
  } else if (journeyId === 'business-owner') {
    set('monthlyRevenue',  profile.monthly_take_home);
    set('monthlyExpenses', profile.monthly_expenses);
    set('cashReserves',    profile.liquid_savings);
  }

  return { answers, prefilledIds };
}

export function useJourney() {
  const [draft, setDraft] = useState<JourneyDraft | null>(loadDraft);

  // Draft is never stale on load now (auto-cleared above), but keep the flag
  // for external consumers that may check it during an active session.
  const isDraftStale = draft != null && Date.now() - draft.startedAt > DRAFT_EXPIRY_MS;

  const startJourney = useCallback((
    journeyId:      JourneyId,
    initialAnswers?: Record<string, string | number>,
    prefilledIds?:   string[],
    prefillSource?:  JourneyDraft['prefillSource'],
    planId?:         string,
  ) => {
    const next: JourneyDraft = {
      journeyId,
      answers:      initialAnswers ?? {},
      startedAt:    Date.now(),
      prefilledIds: prefilledIds ?? (initialAnswers ? Object.keys(initialAnswers) : undefined),
      prefillSource,
      planId,
    };
    saveDraft(next);
    setDraft(next);
  }, []);

  const saveAnswer = useCallback((questionId: string, value: string | number) => {
    setDraft(prev => {
      if (!prev) return prev;
      const next = { ...prev, answers: { ...prev.answers, [questionId]: value } };
      saveDraft(next);
      return next;
    });
  }, []);

  const attachPlan = useCallback((planId: string) => {
    setDraft(prev => {
      if (!prev || prev.planId === planId) return prev;
      const next = { ...prev, planId };
      saveDraft(next);
      return next;
    });
  }, []);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
    setDraft(null);
  }, []);

  return { draft, isDraftStale, startJourney, saveAnswer, attachPlan, clearDraft };
}
