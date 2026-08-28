import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/somatech/AuthProvider';
import { coachService } from '@/services/coachService';
import { format, subMonths, startOfMonth } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NetWorthSnapshot {
  id?: string;
  updated_at?: string;
  snapshot_month: string;   // YYYY-MM-01
  checking: number;
  savings: number;
  investments: number;
  real_estate: number;
  other_assets: number;
  credit_cards: number;
  student_loans: number;
  mortgage: number;
  car_loans: number;
  other_liabilities: number;
  notes: string | null;
}

export interface MonthlyCashFlow {
  id?: string;
  flow_month: string;       // YYYY-MM-01
  primary_income: number;
  side_income: number;
  investment_income: number;
  other_income: number;
  housing: number;
  food: number;
  transport: number;
  healthcare: number;
  entertainment: number;
  subscriptions: number;
  clothing: number;
  education: number;
  travel: number;
  other_expenses: number;
  notes: string | null;
}

export interface ScenarioModel {
  id?: string;
  name: string;
  income_change_pct: number;
  expense_change_pct: number;
  one_time_cost: number;
  extra_monthly_savings: number;
  color: string;
  is_preset: boolean;
}

// ── Computed helpers ──────────────────────────────────────────────────────────

export function computeNetWorth(s: NetWorthSnapshot) {
  const totalAssets = s.checking + s.savings + s.investments + s.real_estate + s.other_assets;
  const totalLiabilities = s.credit_cards + s.student_loans + s.mortgage + s.car_loans + s.other_liabilities;
  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
}

export function computeCashFlow(cf: MonthlyCashFlow) {
  const totalIncome = cf.primary_income + cf.side_income + cf.investment_income + cf.other_income;
  const totalExpenses = cf.housing + cf.food + cf.transport + cf.healthcare + cf.entertainment +
    cf.subscriptions + cf.clothing + cf.education + cf.travel + cf.other_expenses;
  const surplus = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (surplus / totalIncome) * 100 : 0;
  return { totalIncome, totalExpenses, surplus, savingsRate };
}

export const EXPENSE_CATEGORIES: { key: keyof MonthlyCashFlow; label: string; color: string }[] = [
  { key: 'housing',       label: 'Housing',       color: '#6366f1' },
  { key: 'food',          label: 'Food',           color: '#10b981' },
  { key: 'transport',     label: 'Transport',      color: '#f59e0b' },
  { key: 'healthcare',    label: 'Healthcare',     color: '#ef4444' },
  { key: 'entertainment', label: 'Entertainment',  color: '#8b5cf6' },
  { key: 'subscriptions', label: 'Subscriptions',  color: '#06b6d4' },
  { key: 'clothing',      label: 'Clothing',       color: '#ec4899' },
  { key: 'education',     label: 'Education',      color: '#3b82f6' },
  { key: 'travel',        label: 'Travel',         color: '#14b8a6' },
  { key: 'other_expenses',label: 'Other',          color: '#9ca3af' },
];

// ── Demo data (shown when no real data exists) ────────────────────────────────
// Fully deterministic — no Math.random() so charts don't flicker on re-render.

function buildDemoSnapshots(): NetWorthSnapshot[] {
  const base = { checking: 8200, savings: 24000, investments: 62000, real_estate: 0, other_assets: 3000,
                  credit_cards: 4200, student_loans: 18000, mortgage: 0, car_loans: 8500, other_liabilities: 0, notes: null };
  const growth = [0, 1800, 3200, 5100, 6900, 9200];
  return growth.map((g, i) => ({
    ...base,
    snapshot_month: format(startOfMonth(subMonths(new Date(), 5 - i)), 'yyyy-MM-dd'),
    savings:      base.savings      + g * 0.6,
    investments:  base.investments  + g * 0.4,
    credit_cards: Math.max(0, base.credit_cards - i * 200),
  }));
}

// Month-specific deterministic deltas so each month looks slightly different.
const DEMO_FOOD_DELTAS        = [+40, -20, +60, -35, +15, -10];
const DEMO_ENTERTAIN_DELTAS   = [-15, +30, -40, +20, -5,  +25];
const DEMO_TRAVEL             = [150, 150, 890, 150, 150, 150]; // month 2 is a trip

function buildDemoCashFlows(): MonthlyCashFlow[] {
  const base: Omit<MonthlyCashFlow, 'flow_month'> = {
    primary_income: 8500, side_income: 400, investment_income: 120, other_income: 0,
    housing: 2200, food: 620, transport: 380, healthcare: 180, entertainment: 240,
    subscriptions: 95, clothing: 110, education: 0, travel: 150, other_expenses: 200,
    notes: null,
  };
  return Array.from({ length: 6 }, (_, i) => ({
    ...base,
    flow_month:    format(startOfMonth(subMonths(new Date(), 5 - i)), 'yyyy-MM-dd'),
    food:          base.food          + DEMO_FOOD_DELTAS[i],
    entertainment: base.entertainment + DEMO_ENTERTAIN_DELTAS[i],
    travel:        DEMO_TRAVEL[i],
  }));
}

const PRESET_SCENARIOS: Omit<ScenarioModel, 'id'>[] = [
  { name: 'Base Case',         income_change_pct: 0,   expense_change_pct: 0,   one_time_cost: 0,      extra_monthly_savings: 0,   color: '#6366f1', is_preset: true },
  { name: 'Job Loss',          income_change_pct: -100, expense_change_pct: -30, one_time_cost: 0,      extra_monthly_savings: 0,   color: '#ef4444', is_preset: true },
  { name: 'Big Purchase',      income_change_pct: 0,   expense_change_pct: 0,   one_time_cost: 25000,  extra_monthly_savings: 0,   color: '#f59e0b', is_preset: true },
  { name: 'Aggressive Saving', income_change_pct: 0,   expense_change_pct: -20, one_time_cost: 0,      extra_monthly_savings: 500, color: '#10b981', is_preset: true },
];

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UsePersonalFinanceReturn {
  snapshots: NetWorthSnapshot[];
  cashFlows: MonthlyCashFlow[];
  scenarios: ScenarioModel[];
  isLoading: boolean;
  isDemo: boolean;
  loadError: string | null;
  saveSnapshot: (data: Omit<NetWorthSnapshot, 'id'>) => Promise<void>;
  saveCashFlow: (data: Omit<MonthlyCashFlow, 'id'>) => Promise<void>;
  saveScenario: (data: Omit<ScenarioModel, 'id'>) => Promise<void>;
  deleteScenario: (id: string) => Promise<void>;
  refresh: () => void;
}

export function usePersonalFinance(): UsePersonalFinanceReturn {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [cashFlows, setCashFlows] = useState<MonthlyCashFlow[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioModel[]>(PRESET_SCENARIOS as ScenarioModel[]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataUserId, setDataUserId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    // Never leave another account's balances on screen while a replacement
    // account loads or after authentication disappears.
    setSnapshots([]);
    setCashFlows([]);
    setScenarios(PRESET_SCENARIOS as ScenarioModel[]);
    setIsDemo(false);
    setLoadError(null);
    setDataUserId(null);
    if (!user) { setIsLoading(false); return; }
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [snapsRes, flowRes, scenRes] = await Promise.all([
          supabase.from('net_worth_snapshots').select('*').eq('user_id', user.id).order('snapshot_month', { ascending: true }),
          supabase.from('monthly_cash_flow').select('*').eq('user_id', user.id).order('flow_month', { ascending: true }),
          supabase.from('scenario_models').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        ]);

        if (cancelled) return;

        // Surface DB errors rather than silently falling into demo mode.
        if (snapsRes.error) throw new Error(snapsRes.error.message);
        if (flowRes.error)  throw new Error(flowRes.error.message);
        // scenRes errors are non-fatal — scenarios are a nice-to-have.

        const hasRealData = (snapsRes.data?.length ?? 0) > 0 || (flowRes.data?.length ?? 0) > 0;

        if (!hasRealData) {
          setIsDemo(true);
          setSnapshots(buildDemoSnapshots());
          setCashFlows(buildDemoCashFlows());
          setScenarios(PRESET_SCENARIOS as ScenarioModel[]);
          setDataUserId(user.id);
        } else {
          setIsDemo(false);
          setSnapshots((snapsRes.data ?? []) as NetWorthSnapshot[]);
          setCashFlows((flowRes.data ?? []) as MonthlyCashFlow[]);
          const dbScenarios = scenRes.data ?? [];
          setScenarios(dbScenarios.length > 0 ? dbScenarios as ScenarioModel[] : PRESET_SCENARIOS as ScenarioModel[]);
          setDataUserId(user.id);
        }
      } catch (err) {
        console.error('Personal finance load error:', err);
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load your financial data.');
          setDataUserId(user.id);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, tick]);

  const saveSnapshot = useCallback(async (data: Omit<NetWorthSnapshot, 'id'>) => {
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase.from('net_worth_snapshots')
      .upsert({ user_id: user.id, ...data }, { onConflict: 'user_id,snapshot_month' });
    if (error) throw new Error(error.message);

    // Sync liquid assets into financial_profiles using the MOST RECENT snapshot,
    // not the one being saved. Back-filling historical months must not overwrite
    // the Coach's current snapshot data.
    const { data: latestSnap } = await supabase
      .from('net_worth_snapshots')
      .select('checking, savings, credit_cards, student_loans')
      .eq('user_id', user.id)
      .order('snapshot_month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSnap) {
      await coachService.upsertProfile(user.id, {
        liquid_savings:    latestSnap.checking + latestSnap.savings,
        high_interest_debt: latestSnap.credit_cards,
        low_interest_debt:  latestSnap.student_loans,
        snapshot_completed: true,
      }).catch(console.error);
    }

    refresh();
  }, [user, refresh]);

  const saveCashFlow = useCallback(async (data: Omit<MonthlyCashFlow, 'id'>) => {
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase.from('monthly_cash_flow')
      .upsert({ user_id: user.id, ...data }, { onConflict: 'user_id,flow_month' });
    if (error) throw new Error(error.message);

    // Sync income/expense using the MOST RECENT cash flow month, not the one
    // being saved. Back-filling January while it's May must not push January's
    // income into the Coach's profile.
    const { data: latestFlow } = await supabase
      .from('monthly_cash_flow')
      .select('primary_income, side_income, investment_income, other_income, housing, food, transport, healthcare, entertainment, subscriptions, clothing, education, travel, other_expenses')
      .eq('user_id', user.id)
      .order('flow_month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestFlow) {
      const { totalIncome, totalExpenses } = computeCashFlow(latestFlow as MonthlyCashFlow);
      await coachService.upsertProfile(user.id, {
        monthly_take_home: totalIncome,
        monthly_expenses:  totalExpenses,
        snapshot_completed: true,
      }).catch(console.error);
    }

    refresh();
  }, [user, refresh]);

  const saveScenario = useCallback(async (data: Omit<ScenarioModel, 'id'>) => {
    if (!user) throw new Error('Not authenticated');
    const { error } = await supabase.from('scenario_models')
      .insert({ user_id: user.id, ...data });
    if (error) throw new Error(error.message);
    refresh();
  }, [user, refresh]);

  const deleteScenario = useCallback(async (id: string) => {
    if (!user) throw new Error('Not authenticated');
    await supabase.from('scenario_models').delete().eq('id', id).eq('user_id', user.id);
    refresh();
  }, [user, refresh]);

  const ownsData = Boolean(user?.id && dataUserId === user.id);
  return {
    snapshots: ownsData ? snapshots : [],
    cashFlows: ownsData ? cashFlows : [],
    scenarios: ownsData ? scenarios : PRESET_SCENARIOS as ScenarioModel[],
    isLoading: Boolean(user) && (!ownsData || isLoading),
    isDemo: ownsData && isDemo,
    loadError: ownsData || !user ? loadError : null,
    saveSnapshot, saveCashFlow, saveScenario, deleteScenario, refresh,
  };
}
