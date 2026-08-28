import { supabase } from '@/integrations/supabase/client';
import type { JourneyId } from '@/components/somatech/journey/journeyConfig';
import type { JourneyAnalysis } from '@/lib/journeyMetrics';

export type JourneyPlanStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type JourneyInputSource = 'manual' | 'personal_finance' | 'profile' | 'plaid' | 'migration';

export interface JourneyInputMetadata {
  source: JourneyInputSource;
  asOf: string;
  linked: boolean;
  overriddenAt?: string;
}

export interface JourneyPlanRecord {
  id: string;
  user_id: string;
  journey_id: JourneyId;
  name: string;
  answers: Record<string, string | number>;
  input_metadata: Record<string, JourneyInputMetadata>;
  assumptions: JourneyAnalysis['assumptions'];
  activated_analysis: JourneyAnalysis | null;
  activated_revision: number | null;
  schema_version: number;
  revision: number;
  parent_plan_id: string | null;
  is_baseline: boolean;
  status: JourneyPlanStatus;
  currency_code: string;
  locale: string;
  monthly_commitment: number;
  target_date: string | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JourneyPlanAction {
  id: string;
  user_id: string;
  plan_id: string;
  action_key: string;
  title: string;
  description: string | null;
  category: string;
  action_type: 'commitment' | 'check_in' | 'milestone' | 'review';
  amount: number | null;
  due_date: string | null;
  cadence: string | null;
  status: 'pending' | 'completed' | 'skipped' | 'cancelled';
  source_revision: number;
  metadata: Record<string, unknown>;
}

// The checked-in Database type is generated from the previously deployed
// schema. Keep the escape hatch isolated here until this migration is deployed
// and the generated types are refreshed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function asPlan(value: unknown): JourneyPlanRecord {
  return value as JourneyPlanRecord;
}

export const journeyPlanService = {
  async list(userId: string): Promise<JourneyPlanRecord[]> {
    const { data, error } = await db.from('journey_plans')
      .select('*').eq('user_id', userId).neq('status', 'archived').order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(asPlan);
  },

  async create(params: {
    userId: string;
    journeyId: JourneyId;
    name?: string;
    answers: Record<string, string | number>;
    inputMetadata?: Record<string, JourneyInputMetadata>;
    parentPlanId?: string | null;
    isBaseline?: boolean;
  }): Promise<JourneyPlanRecord> {
    const { data, error } = await db.from('journey_plans').insert({
      user_id: params.userId,
      journey_id: params.journeyId,
      name: params.name?.trim() || (params.parentPlanId ? 'Scenario' : 'Baseline'),
      answers: params.answers,
      input_metadata: params.inputMetadata ?? {},
      parent_plan_id: params.parentPlanId ?? null,
      is_baseline: params.isBaseline ?? !params.parentPlanId,
    }).select('*').single();
    if (error) throw error;
    return asPlan(data);
  },

  async update(plan: JourneyPlanRecord, patch: {
    name?: string;
    answers?: Record<string, string | number>;
    inputMetadata?: Record<string, JourneyInputMetadata>;
    assumptions?: JourneyAnalysis['assumptions'];
  }): Promise<JourneyPlanRecord> {
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name.trim();
    if (patch.answers !== undefined) update.answers = patch.answers;
    if (patch.inputMetadata !== undefined) update.input_metadata = patch.inputMetadata;
    if (patch.assumptions !== undefined) update.assumptions = patch.assumptions;
    const { data, error } = await db.from('journey_plans').update(update)
      .eq('id', plan.id).eq('user_id', plan.user_id).eq('revision', plan.revision).select('*').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('This plan changed in another session. Reload it before saving again.');
    return asPlan(data);
  },

  async branch(plan: JourneyPlanRecord, name: string): Promise<JourneyPlanRecord> {
    return this.create({
      userId: plan.user_id,
      journeyId: plan.journey_id,
      name,
      answers: { ...plan.answers },
      inputMetadata: { ...plan.input_metadata },
      parentPlanId: plan.parent_plan_id ?? plan.id,
      isBaseline: false,
    });
  },

  async activate(plan: JourneyPlanRecord, analysis: JourneyAnalysis): Promise<JourneyPlanRecord> {
    const { data, error } = await db.rpc('activate_journey_plan', {
      p_plan_id: plan.id,
      p_expected_revision: plan.revision,
      p_analysis: analysis,
      p_monthly_commitment: analysis.monthlyCommitment,
      p_target_date: analysis.primaryTargetDate,
    });
    if (error) throw error;
    return asPlan(data);
  },

  async listActions(userId: string, planId?: string): Promise<JourneyPlanAction[]> {
    let query = db.from('journey_plan_actions').select('*').eq('user_id', userId).order('due_date', { ascending: true });
    if (planId) query = query.eq('plan_id', planId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as JourneyPlanAction[];
  },

  async setActionStatus(actionId: string, status: 'pending' | 'completed'): Promise<JourneyPlanAction> {
    const { data, error } = await db.rpc('set_journey_plan_action_status', {
      p_action_id: actionId,
      p_status: status,
    });
    if (error) throw error;
    return data as JourneyPlanAction;
  },

  async reconcileActions(plan: JourneyPlanRecord, actions: Array<Omit<JourneyPlanAction, 'id' | 'user_id' | 'plan_id' | 'status' | 'source_revision'>>): Promise<void> {
    const existing = await this.listActions(plan.user_id, plan.id);
    const existingByKey = new Map(existing.map(action => [action.action_key, action]));
    const rows = actions.map(action => ({
      ...action,
      user_id: plan.user_id,
      plan_id: plan.id,
      source_revision: plan.revision,
      status: ['completed', 'skipped'].includes(existingByKey.get(action.action_key)?.status ?? '')
        ? existingByKey.get(action.action_key)!.status
        : 'pending',
    }));
    const keys = rows.map(row => row.action_key);
    const obsolete = existing.filter(action => action.status === 'pending' && !keys.includes(action.action_key)).map(action => action.id);
    if (obsolete.length) {
      const { error } = await db.from('journey_plan_actions').update({ status: 'cancelled' })
        .eq('user_id', plan.user_id).in('id', obsolete);
      if (error) throw error;
    }
    if (rows.length) {
      const { error } = await db.from('journey_plan_actions').upsert(rows, { onConflict: 'plan_id,action_key' });
      if (error) throw error;
    }
  },
};
