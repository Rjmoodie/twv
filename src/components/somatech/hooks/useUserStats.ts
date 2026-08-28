import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../AuthProvider';
import { TrendingUp, Target } from 'lucide-react';

interface UsageStats {
  total_analyses: number;
  watchlist_items: number;
  saved_plans: number;
  login_count: number;
  last_login: string;
  member_since: string;
  profile_completion: number;
}

export function useUserStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UsageStats>({
    total_analyses: 0,
    watchlist_items: 0,
    saved_plans: 0,
    login_count: 0,
    last_login: '',
    member_since: '',
    profile_completion: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      // Profile
      supabase
        .from('profiles')
        .select('login_count, last_login_at, created_at, profile_completion_score')
        .eq('id', user.id)
        .single(),
      // Watchlist count
      supabase
        .from('watchlist')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      // Retirement plans count
      supabase
        .from('retirement_plans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      // BRRRR deals count
      supabase
        .from('brrrr_deals')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      // Recent watchlist
      supabase
        .from('watchlist')
        .select('ticker, added_at, company_name')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false })
        .limit(3),
      // Recent plans
      supabase
        .from('retirement_plans')
        .select('plan_name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(2)
    ])
      .then(([
        { data: profile, error: profileError },
        { count: watchlistCount, error: watchlistError },
        { count: plansCount, error: plansError },
        { count: dealsCount, error: dealsError },
        { data: watchlistData, error: watchlistRecentError },
        { data: plansData, error: plansRecentError }
      ]) => {
        if (profileError || watchlistError || plansError || dealsError || watchlistRecentError || plansRecentError) {
          setError('Failed to load user stats');
          setLoading(false);
          return;
        }
        setStats({
          total_analyses: watchlistCount || 0,
          watchlist_items: watchlistCount || 0,
          saved_plans: (plansCount || 0) + (dealsCount || 0),
          login_count: profile?.login_count || 0,
          last_login: profile?.last_login_at || '',
          member_since: profile?.created_at || user.created_at,
          profile_completion: profile?.profile_completion_score || 0
        });
        const activity = [
          ...(watchlistData || []).map((item: any) => ({
            type: 'watchlist',
            title: `Added ${item.ticker} to watchlist`,
            subtitle: item.company_name,
            timestamp: item.added_at,
            icon: TrendingUp
          })),
          ...(plansData || []).map((item: any) => ({
            type: 'plan',
            title: `Created retirement plan: ${item.plan_name}`,
            subtitle: 'Retirement Planning',
            timestamp: item.created_at,
            icon: Target
          }))
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
        setRecentActivity(activity);
        setLoading(false);
      })
      .catch((e) => {
        setError('Failed to load user stats');
        setLoading(false);
      });
  }, [user]);

  // Memoize stats for performance
  const memoStats = useMemo(() => stats, [stats]);
  const memoActivity = useMemo(() => recentActivity, [recentActivity]);

  return { stats: memoStats, recentActivity: memoActivity, loading, error };
} 