import { supabase } from '@/integrations/supabase/client';

export interface FinancialProfile {
  display_name?: string;
  age?: number;
  income_range?: string;
  marital_status?: string;
  dependents?: number;
  employment_type?: string;
  housing_status?: string;
  primary_concern?: string;
  risk_tolerance?: string;
  current_savings_range?: string;
  has_retirement_account?: boolean;
  has_emergency_fund?: boolean;
  completed_intake?: boolean;
  // Snapshot fields (from SnapshotIntake)
  monthly_take_home?: number;
  monthly_expenses?: number;
  high_interest_debt?: number | null;
  low_interest_debt?: number | null;
  liquid_savings?: number | null;
  employer_match_pct?: number | null;
  has_hsa_access?: boolean | null;
  snapshot_completed?: boolean;
}

export type MilestoneStatus = 'complete' | 'skipped' | 'in_progress';

/** Who put a milestone in its current state. 'auto' rows are re-derived from
 *  the profile on every load; 'user' rows are decisions and are left alone. */
export type MilestoneSource = 'user' | 'auto';

export interface UserMilestone {
  id: string;
  user_id: string;
  milestone_id: string;
  status: MilestoneStatus;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  /** Optional so rows read before the source migration still parse. */
  source?: MilestoneSource | null;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolLaunch?: { type: string; prefill: Record<string, unknown> } | null;
  created_at: string;
}

export interface CoachQuota {
  limit: number;
  used: number;
  remaining: number;
}

export class CoachQuotaError extends Error {
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
  upgradeRequired: boolean;
  constructor(data: { limit: number; used: number; remaining: number; resetAt: string; upgradeRequired: boolean }) {
    super("Daily message limit reached");
    this.name = "CoachQuotaError";
    this.limit = data.limit;
    this.used = data.used;
    this.remaining = data.remaining;
    this.resetAt = data.resetAt;
    this.upgradeRequired = data.upgradeRequired;
  }
}

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export const coachService = {
  async getProfile(userId: string): Promise<FinancialProfile | null> {
    const { data, error } = await supabase
      .from('financial_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsertProfile(userId: string, profile: Partial<FinancialProfile>): Promise<void> {
    // display_name is not a column on financial_profiles — it lives on profiles.username.
    // Extract it before writing so we don't hit a PGRST204 schema error.
    const { display_name, ...financialFields } = profile;

    if (display_name) {
      // Only set username if it's not already set — don't overwrite an existing handle.
      await supabase
        .from('profiles')
        .update({ username: display_name })
        .eq('id', userId)
        .is('username', null);
      // Ignore errors here — username update is best-effort.
    }

    if (Object.keys(financialFields).length === 0) return;

    // Check whether a row already exists — avoids relying on a unique constraint
    // on user_id (which PostgREST requires for onConflict but may not be present).
    const { data: existing, error: fetchError } = await supabase
      .from('financial_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchError) throw fetchError;

    if (existing) {
      const { error } = await supabase
        .from('financial_profiles')
        .update(financialFields)
        .eq('user_id', userId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('financial_profiles')
        .insert({ user_id: userId, ...financialFields });
      if (error) throw error;
    }
  },

  async getOrCreateConversation(userId: string): Promise<string> {
    const { data: existing, error: fetchErr } = await supabase
      .from('coach_conversations')
      .select('id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (existing) return existing.id;

    const { data: created, error: createErr } = await supabase
      .from('coach_conversations')
      .insert({ user_id: userId, title: 'Financial Coaching Session' })
      .select('id')
      .single();
    if (createErr) throw createErr;
    return created.id;
  },

  async getMessages(conversationId: string): Promise<CoachMessage[]> {
    const { data, error } = await supabase
      .from('coach_messages')
      .select('id, role, content, tool_launch, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      toolLaunch: m.tool_launch as CoachMessage['toolLaunch'],
      created_at: m.created_at,
    }));
  },

  async saveMessage(
    conversationId: string,
    userId: string,
    role: 'user' | 'assistant',
    content: string,
    toolLaunch?: CoachMessage['toolLaunch']
  ): Promise<CoachMessage> {
    const { data, error } = await supabase
      .from('coach_messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role,
        content,
        tool_launch: toolLaunch ?? null,
      })
      .select('id, role, content, tool_launch, created_at')
      .single();
    if (error) throw error;
    return {
      id: data.id,
      role: data.role as 'user' | 'assistant',
      content: data.content,
      toolLaunch: data.tool_launch as CoachMessage['toolLaunch'],
      created_at: data.created_at,
    };
  },

  async chat(
    messages: { role: 'user' | 'assistant'; content: string }[],
    profile: FinancialProfile,
    appContext?: { currentModule?: string; roadmapContext?: string }
  ): Promise<{ content: string; toolLaunch: CoachMessage['toolLaunch']; quota: CoachQuota | null; truncated: boolean }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('financial-coach', {
      body: { messages, profile, appContext },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    // supabase.functions.invoke swallows non-2xx into `error` but also puts
    // the parsed body in `error.context`. For 429 we need the quota payload.
    if (error) {
      const ctx = (error as any).context;
      if (ctx?.status === 429 || data?.error === 'Daily message limit reached') {
        const payload = typeof ctx?.json === 'function' ? await ctx.json() : data;
        throw new CoachQuotaError({
          limit: payload?.limit ?? 0,
          used: payload?.used ?? 0,
          remaining: 0,
          resetAt: payload?.resetAt ?? '',
          upgradeRequired: payload?.upgradeRequired ?? true,
        });
      }
      throw error;
    }

    return {
      content: data.content,
      toolLaunch: data.toolLaunch ?? null,
      quota: data.quota ?? null,
      // The reply stopped at the token ceiling rather than finishing; the
      // UI says so instead of presenting a half-answer as complete.
      truncated: Boolean(data.truncated),
    };
  },

  async getMilestones(userId: string): Promise<UserMilestone[]> {
    const { data, error } = await supabase
      .from('user_milestones')
      .select('*')
      .eq('user_id', userId);
    // Silently return empty if the table hasn't been migrated yet (404 or 42P01)
    if (error) return [];
    return (data ?? []) as UserMilestone[];
  },

  async upsertMilestone(
    userId: string,
    milestoneId: string,
    status: MilestoneStatus,
    notes?: string
  ): Promise<void> {
    const { error } = await supabase.from('user_milestones').upsert(
      {
        user_id: userId,
        milestone_id: milestoneId,
        status,
        completed_at: status === 'complete' ? new Date().toISOString() : null,
        notes: notes ?? null,
        // A person acted. This outranks any inference and is never re-evaluated.
        source: 'user',
      },
      { onConflict: 'user_id,milestone_id' }
    );
    // Silently ignore if the table hasn't been migrated yet
    if (error && (error as any).code !== '404' && error.message !== 'Not Found') throw error;
  },

  /**
   * Bulk write. `source` defaults to 'auto' because the only caller is the
   * profile-derived completion detector — an inference, which the roadmap
   * re-evaluates on every load rather than treating as settled.
   */
  async bulkUpsertMilestones(
    userId: string,
    rows: { milestoneId: string; status: MilestoneStatus }[],
    source: MilestoneSource = 'auto'
  ): Promise<void> {
    if (!rows.length) return;
    const { error } = await supabase.from('user_milestones').upsert(
      rows.map(({ milestoneId, status }) => ({
        user_id: userId,
        milestone_id: milestoneId,
        status,
        completed_at: status === 'complete' ? new Date().toISOString() : null,
        source,
      })),
      { onConflict: 'user_id,milestone_id' }
    );
    // Silently ignore if the table hasn't been migrated yet
    if (error && (error as any).code !== '404' && error.message !== 'Not Found') throw error;
  },
};
