import { supabase } from '@/integrations/supabase/client';
import { normalizeInvestmentRiskProfile, projectInvestmentGoal, type InvestmentGoalProjection, type InvestmentRiskProfile } from '@/lib/investmentGoalEngine';

export interface InvestmentGoalRecord {
  id: string;
  user_id: string;
  target_amount: number;
  target_date: string;
  horizon_years: number;
  current_balance: number;
  monthly_contribution: number;
  risk_profile: InvestmentRiskProfile;
  annual_contribution_growth_pct: number;
  inflation_pct: number;
  projection: InvestmentGoalProjection;
  assumption_version: string;
  status: 'active' | 'reached' | 'paused' | 'archived';
  /** Real columns returned by select('*'); the baseline projection is anchored to created_at. */
  created_at: string;
  updated_at: string;
}

export function investmentGoalFromAnswers(answers: Record<string, string | number>): InvestmentGoalProjection {
  return projectInvestmentGoal({
    targetAmount: Number(answers.investmentGoal ?? 0),
    currentBalance: Number(answers.currentSavings ?? 0),
    monthlyContribution: Number(answers.monthlyContribution ?? 0),
    horizonYears: Number(answers.investmentHorizonYears ?? 20),
    riskProfile: normalizeInvestmentRiskProfile(answers.riskTolerance),
  });
}

export async function saveInvestmentGoal(userId: string, answers: Record<string, string | number>): Promise<InvestmentGoalRecord> {
  const projection = investmentGoalFromAnswers(answers);
  const targetDate = new Date();
  targetDate.setFullYear(targetDate.getFullYear() + projection.inputs.horizonYears);

  const { data, error } = await supabase
    .from('investment_goals')
    .upsert({
      user_id: userId,
      goal_type: 'investing',
      target_amount: projection.inputs.targetAmount,
      target_date: targetDate.toISOString().slice(0, 10),
      horizon_years: projection.inputs.horizonYears,
      current_balance: projection.inputs.currentBalance,
      monthly_contribution: projection.inputs.monthlyContribution,
      risk_profile: projection.inputs.riskProfile,
      annual_contribution_growth_pct: projection.inputs.annualContributionGrowthPct ?? 0,
      inflation_pct: projection.inputs.inflationPct ?? 2.5,
      projection: projection as never,
      assumption_version: projection.assumptions.version,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,goal_type' })
    .select('*')
    .single();

  if (error) throw error;
  return data as unknown as InvestmentGoalRecord;
}

export async function getActiveInvestmentGoal(userId: string): Promise<InvestmentGoalRecord | null> {
  const { data, error } = await supabase
    .from('investment_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('goal_type', 'investing')
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data as unknown as InvestmentGoalRecord | null;
}
