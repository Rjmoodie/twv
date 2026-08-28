import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UsageStats {
  monthly_calculations: number;
  saved_projects: number;
  export_reports: number;
}

export interface UsageLimits {
  monthly_calculations: number;
  saved_projects: number;
  export_reports: number;
}

export const useUsageTracking = () => {
  const [usageStats, setUsageStats] = useState<UsageStats>({
    monthly_calculations: 0,
    saved_projects: 0,
    export_reports: 0
  });
  const [usageLimits, setUsageLimits] = useState<UsageLimits>({
    monthly_calculations: 100,
    saved_projects: 10,
    export_reports: 5
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

  const fetchUsageStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current usage
      const { data: usage } = await supabase
        .from('usage_tracking')
        .select('feature_type, usage_count')
        .eq('user_id', user.id)
        .eq('month_year', currentMonth);

      // Get user limits from subscription
      const { data: subscription } = await supabase
        .from('subscribers')
        .select('usage_limits')
        .eq('user_id', user.id)
        .single();

      const stats = {
        monthly_calculations: 0,
        saved_projects: 0,
        export_reports: 0
      };

      usage?.forEach(item => {
        if (item.feature_type === 'calculation') {
          stats.monthly_calculations += item.usage_count || 0;
        } else if (item.feature_type === 'save') {
          stats.saved_projects += item.usage_count || 0;
        } else if (item.feature_type === 'export') {
          stats.export_reports += item.usage_count || 0;
        }
      });

      setUsageStats(stats);
      
      if (subscription?.usage_limits) {
        setUsageLimits(subscription.usage_limits as any);
      }
    } catch (error) {
      console.error('Error fetching usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const trackUsage = async (featureType: 'calculation' | 'save' | 'export') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Check limits first
      const currentUsage = usageStats[
        featureType === 'calculation' ? 'monthly_calculations' :
        featureType === 'save' ? 'saved_projects' : 'export_reports'
      ];
      
      const limit = usageLimits[
        featureType === 'calculation' ? 'monthly_calculations' :
        featureType === 'save' ? 'saved_projects' : 'export_reports'
      ];

      if (limit !== -1 && currentUsage >= limit) {
        toast({
          title: "Usage Limit Reached",
          description: `You've reached your ${featureType} limit. Upgrade your plan for more usage.`,
          variant: "destructive",
        });
        return false;
      }

      // Track usage
      const { error } = await supabase
        .from('usage_tracking')
        .upsert({
          user_id: user.id,
          feature_type: featureType,
          month_year: currentMonth,
          usage_count: 1
        }, {
          onConflict: 'user_id,feature_type,month_year',
          ignoreDuplicates: false
        });

      if (error) throw error;

      // Update local state
      setUsageStats(prev => ({
        ...prev,
        [featureType === 'calculation' ? 'monthly_calculations' :
         featureType === 'save' ? 'saved_projects' : 'export_reports']: currentUsage + 1
      }));

      return true;
    } catch (error) {
      console.error('Error tracking usage:', error);
      return false;
    }
  };

  const checkLimit = (featureType: 'calculation' | 'save' | 'export'): boolean => {
    const currentUsage = usageStats[
      featureType === 'calculation' ? 'monthly_calculations' :
      featureType === 'save' ? 'saved_projects' : 'export_reports'
    ];
    
    const limit = usageLimits[
      featureType === 'calculation' ? 'monthly_calculations' :
      featureType === 'save' ? 'saved_projects' : 'export_reports'
    ];

    return limit === -1 || currentUsage < limit;
  };

  const getUsagePercentage = (featureType: 'calculation' | 'save' | 'export'): number => {
    const currentUsage = usageStats[
      featureType === 'calculation' ? 'monthly_calculations' :
      featureType === 'save' ? 'saved_projects' : 'export_reports'
    ];
    
    const limit = usageLimits[
      featureType === 'calculation' ? 'monthly_calculations' :
      featureType === 'save' ? 'saved_projects' : 'export_reports'
    ];

    if (limit === -1) return 0; // Unlimited
    return Math.min((currentUsage / limit) * 100, 100);
  };

  useEffect(() => {
    fetchUsageStats();
  }, []);

  return {
    usageStats,
    usageLimits,
    loading,
    trackUsage,
    checkLimit,
    getUsagePercentage,
    refreshUsage: fetchUsageStats
  };
};