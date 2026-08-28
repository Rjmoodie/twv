import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface RetirementInputs {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentSavings: number;
  monthlyContribution: number;
  expectedReturn: number;
  retirementSpending: number;
  inflationRate: number;
  otherIncome: number;
}

export interface RetirementResults {
  totalSavingsAtRetirement: number;
  yearsToRetirement: number;
  yearsInRetirement: number;
  inflationAdjustedSpending: number;
  annualIncomeGap: number;
  surplusOrShortfall: number;
  requiredReturnToMeetGoal: number;
  yearsWillLast: number;
  onTrack: boolean;
  breakdown?: {
    futureValueCurrentSavings: number;
    futureValueContributions: number;
    actualMonthlyContribution: number;
  };
}

export interface SavedPlan {
  id: string;
  plan_name: string;
  inputs: RetirementInputs;
  results: RetirementResults;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Core retirement calculation logic
 */
export const calculateRetirement = (
  currentAge: string,
  retirementAge: string,
  lifeExpectancy: string,
  currentSavings: string,
  monthlyContribution: string,
  expectedReturn: number[],
  retirementSpending: string,
  inflationRate: number[],
  otherIncome: string
): RetirementResults | null => {
  if (!currentAge || !retirementAge || !currentSavings || !monthlyContribution || !retirementSpending) return null;

  const age = parseInt(currentAge);
  const retAge = parseInt(retirementAge);
  const lifeExp = parseInt(lifeExpectancy);
  const savings = parseFloat(currentSavings);
  const contribution = parseFloat(monthlyContribution);
  const returnRate = expectedReturn[0] / 100;
  const annualSpending = parseFloat(retirementSpending);
  const inflation = inflationRate[0] / 100;
  const otherAnnualIncome = parseFloat(otherIncome) || 0;

  const yearsToRetirement = retAge - age;
  const yearsInRetirement = lifeExp - retAge;
  const monthsToRetirement = yearsToRetirement * 12;
  const monthlyReturn = returnRate / 12;

  // Future value at retirement
  const totalSavingsAtRetirement = savings * Math.pow(1 + returnRate, yearsToRetirement) +
    contribution * (Math.pow(1 + monthlyReturn, monthsToRetirement) - 1) / monthlyReturn;

  // Adjust spending for inflation
  const inflationAdjustedSpending = annualSpending * Math.pow(1 + inflation, yearsToRetirement);
  const netAnnualNeed = inflationAdjustedSpending - otherAnnualIncome;
  
  // Calculate how long funds will last
  let remainingFunds = totalSavingsAtRetirement;
  let yearsLasted = 0;
  for (let year = 0; year < yearsInRetirement; year++) {
    const yearlySpendingNeed = netAnnualNeed * Math.pow(1 + inflation, year);
    if (remainingFunds >= yearlySpendingNeed) {
      remainingFunds = remainingFunds * (1 + returnRate) - yearlySpendingNeed;
      yearsLasted++;
    } else {
      break;
    }
  }

  // Calculate total needed at retirement for full coverage
  const totalNeeded = netAnnualNeed * yearsInRetirement * 1.05; // 5% buffer
  const surplusOrShortfall = totalSavingsAtRetirement - totalNeeded;
  
  // Required return rate to meet goal
  const requiredReturn = surplusOrShortfall < 0 ? 
    Math.pow((totalNeeded - savings) / (contribution * 12 * yearsToRetirement), 1/yearsToRetirement) - 1 : 
    returnRate;

  return {
    totalSavingsAtRetirement: Math.round(totalSavingsAtRetirement),
    yearsToRetirement,
    yearsInRetirement,
    inflationAdjustedSpending: Math.round(inflationAdjustedSpending),
    annualIncomeGap: Math.round(Math.max(0, netAnnualNeed)),
    surplusOrShortfall: Math.round(surplusOrShortfall),
    requiredReturnToMeetGoal: Math.round(requiredReturn * 100 * 100) / 100,
    yearsWillLast: yearsLasted,
    onTrack: surplusOrShortfall >= 0
  };
};

/**
 * Custom hook for retirement plan operations
 */
export const useRetirementOperations = (userId: string | undefined) => {
  const fetchSavedPlans = async (): Promise<SavedPlan[]> => {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('retirement_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as any[])?.map(item => ({
      ...item,
      inputs: item.inputs as RetirementInputs,
      results: item.results as RetirementResults
    })) || [];
  };

  return useQuery({
    queryKey: ['retirement-plans', userId],
    queryFn: fetchSavedPlans,
    enabled: !!userId,
    staleTime: 60000
  });
};

export const useSavePlan = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ planName, inputs, results, notes }: { planName: string; inputs: RetirementInputs; results: RetirementResults; notes?: string }) => {
      if (!userId) throw new Error('User not logged in');
      const { error } = await supabase
        .from('retirement_plans')
        .insert({
          user_id: userId,
          plan_name: planName,
          inputs,
          results,
          notes
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retirement-plans', userId] });
      toast({ title: 'Plan Saved', description: 'Your retirement plan has been saved.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });
};

export const useDeletePlan = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      if (!userId) throw new Error('User not logged in');
      const { error } = await supabase
        .from('retirement_plans')
        .delete()
        .eq('id', planId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retirement-plans', userId] });
      toast({ title: 'Plan Deleted', description: 'Your retirement plan has been deleted.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });
};

export const useUpdatePlanNotes = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, planName, notes }: { planId: string; planName: string; notes: string }) => {
      if (!userId) throw new Error('User not logged in');
      const { error } = await supabase
        .from('retirement_plans')
        .update({ notes, plan_name: planName })
        .eq('id', planId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retirement-plans', userId] });
      toast({ title: 'Notes Updated', description: 'Plan notes have been updated.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });
};