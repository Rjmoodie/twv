import { useState, useEffect, useCallback, useRef } from 'react';
import { coachService, CoachMessage, CoachQuota, CoachQuotaError, FinancialProfile } from '@/services/coachService';
import { useAuth } from '@/components/somatech/AuthProvider';

export type { CoachMessage, FinancialProfile, CoachQuota };

export interface UseFinancialCoachReturn {
  messages: CoachMessage[];
  profile: FinancialProfile | null;
  isLoading: boolean;
  isSending: boolean;
  conversationId: string | null;
  hasCompletedIntake: boolean;
  quota: CoachQuota | null;
  quotaExceeded: boolean;
  quotaResetAt: string | null;
  sendMessage: (content: string) => Promise<void>;
  saveProfile: (profile: Partial<FinancialProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  startNewConversation: () => Promise<void>;
  currentModule: string | undefined;
  setCurrentModule: (m: string | undefined) => void;
  roadmapContext: string | undefined;
  setRoadmapContext: (ctx: string | undefined) => void;
}

export function useFinancialCoach(): UseFinancialCoachReturn {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [profile, setProfile] = useState<FinancialProfile | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [currentModule, setCurrentModule] = useState<string | undefined>(undefined);
  const [roadmapContext, setRoadmapContext] = useState<string | undefined>(undefined);
  const [quota, setQuota] = useState<CoachQuota | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [quotaResetAt, setQuotaResetAt] = useState<string | null>(null);
  // Track which user ID has been initialised — prevents stale data if user changes in the same tab
  const initDoneFor = useRef<string | null>(null);

  const hasCompletedIntake = profile?.completed_intake === true;

  const init = useCallback(async () => {
    if (!user) {
      // Clear state when signed out so a subsequent sign-in starts clean
      setProfile(null);
      setMessages([]);
      setConversationId(null);
      return;
    }
    if (initDoneFor.current === user.id) return;
    initDoneFor.current = user.id;
    setIsLoading(true);
    try {
      const [fetchedProfile, convId] = await Promise.all([
        coachService.getProfile(user.id),
        coachService.getOrCreateConversation(user.id),
      ]);
      setProfile(fetchedProfile);
      setConversationId(convId);
      const msgs = await coachService.getMessages(convId);
      setMessages(msgs);
    } catch (err) {
      console.error('Coach init error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    init();
  }, [init]);

  // Re-fetch profile on tab focus so Roadmap milestones reflect any data
  // saved in Personal Finance (Plaid sync, manual entry) while Coach was open.
  useEffect(() => {
    if (!user) return;
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const refreshed = await coachService.getProfile(user.id);
        if (refreshed) setProfile(refreshed);
      } catch { /* non-fatal */ }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user?.id]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const refreshed = await coachService.getProfile(user.id);
      if (refreshed) setProfile(refreshed);
    } catch { /* non-fatal */ }
  }, [user]);

  const saveProfile = useCallback(async (updates: Partial<FinancialProfile>) => {
    if (!user) return;
    await coachService.upsertProfile(user.id, updates);
    setProfile((prev) => ({ ...(prev ?? {}), ...updates }));
  }, [user]);

  const sendMessage = useCallback(async (content: string) => {
    if (!user || !conversationId || isSending || quotaExceeded) return;
    setIsSending(true);

    const userMsg = await coachService.saveMessage(conversationId, user.id, 'user', content);
    setMessages((prev) => [...prev, userMsg]);

    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const reply = await coachService.chat(history, profile ?? {}, { currentModule, roadmapContext });

      if (reply.quota) setQuota(reply.quota);

      // A reply that stopped at the token ceiling is saved with a visible note,
      // so the persisted transcript records that it was cut off rather than
      // reading back later as a complete answer that simply trails away.
      const body = reply.truncated
        ? `${reply.content}\n\n_(Cut off at the length limit — ask me to continue.)_`
        : reply.content;

      const assistantMsg = await coachService.saveMessage(
        conversationId,
        user.id,
        'assistant',
        body,
        reply.toolLaunch ?? undefined
      );
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      if (err instanceof CoachQuotaError) {
        setQuotaExceeded(true);
        setQuotaResetAt(err.resetAt);
        setQuota({ limit: err.limit, used: err.used, remaining: 0 });
      } else {
        console.error('Coach send error:', err);
        // The edge function returns the real cause in its 500 body. Replacing it
        // with a generic string meant a misconfigured key and a network blip were
        // indistinguishable, and neither reached anyone who could act on it.
        const detail = err instanceof Error ? err.message : String(err);
        const errMsg: CoachMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            "I couldn't reach the coaching service. Your message was saved — try again in a moment.\n\n" +
            `_${detail}_`,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    } finally {
      setIsSending(false);
    }
  }, [user, conversationId, isSending, quotaExceeded, messages, profile, currentModule, roadmapContext]);

  const startNewConversation = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await import('@/integrations/supabase/client').then(m =>
        m.supabase.from('coach_conversations')
          .insert({ user_id: user.id, title: 'Financial Coaching Session' })
          .select('id')
          .single()
      );
      if (error) throw error;
      setConversationId(data.id);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    messages,
    profile,
    isLoading,
    isSending,
    conversationId,
    hasCompletedIntake,
    quota,
    quotaExceeded,
    quotaResetAt,
    sendMessage,
    saveProfile,
    refreshProfile,
    startNewConversation,
    currentModule,
    setCurrentModule,
    roadmapContext,
    setRoadmapContext,
  };
}
