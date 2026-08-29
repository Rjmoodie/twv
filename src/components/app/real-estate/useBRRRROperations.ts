import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "@/hooks/use-toast";
import { BRRRRInputs, BRRRRResults, SavedDeal } from './brrrrCalculations';

export const useBRRRROperations = (userId: string | undefined) => {
  const decodeResults = (results: Record<string, unknown>): BRRRRResults => ({
    ...(results as unknown as BRRRRResults),
    postRefinanceROI: results.postRefinanceROI === 'Infinity'
      ? Infinity
      : results.postRefinanceROI === '-Infinity'
        ? -Infinity
        : Number(results.postRefinanceROI ?? 0),
  });

  const encodeResults = (results: BRRRRResults): Record<string, number | string> => ({
    ...results,
    postRefinanceROI: Number.isFinite(results.postRefinanceROI)
      ? results.postRefinanceROI
      : results.postRefinanceROI > 0 ? 'Infinity' : '-Infinity',
  });

  const fetchSavedDeals = async (): Promise<SavedDeal[]> => {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('brrrr_deals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as any[])?.map(item => ({
      ...item,
      inputs: item.inputs as BRRRRInputs,
      results: decodeResults(item.results as Record<string, unknown>)
    })) || [];
  };

  const query = useQuery({
    queryKey: ['brrrr-deals', userId],
    queryFn: fetchSavedDeals,
    enabled: !!userId,
    staleTime: 60000
  });

  const saveDeal = async (
    dealName: string,
    inputs: BRRRRInputs,
    results: BRRRRResults,
    notes?: string,
    currentDealId?: string | null
  ): Promise<boolean> => {
    if (!dealName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a deal name before saving.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Sign In Required",
          description: "Please sign in or create an account to save your analysis and access advanced features.",
          variant: "default",
        });
        return false;
      }

      if (currentDealId) {
        const { error } = await supabase
          .from('brrrr_deals')
          .update({
            deal_name: dealName,
            inputs: inputs as any,
            results: encodeResults(results) as any,
            notes: notes,
          })
          .eq('id', currentDealId)
          .eq('user_id', user.id);

        if (error) throw error;
        
        toast({
          title: "Deal Updated",
          description: `"${dealName}" has been updated successfully.`,
        });
      } else {
        const { error } = await supabase
          .from('brrrr_deals')
          .insert([{
            user_id: user.id,
            deal_name: dealName,
            inputs: inputs as any,
            results: encodeResults(results) as any,
            notes: notes,
          }]);
        
        if (error) throw error;
        
        toast({
          title: "Deal Saved",
          description: `"${dealName}" has been saved successfully.`,
        });
      }

      return true;
    } catch (error) {
      console.error('Error saving deal:', error);
      toast({
        title: "Error",
        description: "Failed to save deal. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteDeal = async (dealId: string, dealName: string): Promise<boolean> => {
    if (!userId) return false;
    try {
      const { error } = await supabase
        .from('brrrr_deals')
        .delete()
        .eq('id', dealId)
        .eq('user_id', userId);

      if (error) throw error;
      
      toast({
        title: "Deal Deleted",
        description: `"${dealName}" has been deleted.`,
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting deal:', error);
      toast({
        title: "Error",
        description: "Failed to delete deal. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const updateDealNotes = async (dealId: string, dealName: string, notes: string): Promise<boolean> => {
    if (!userId) return false;
    try {
      const { error } = await supabase
        .from('brrrr_deals')
        .update({ notes })
        .eq('id', dealId)
        .eq('user_id', userId);

      if (error) throw error;
      
      toast({
        title: "Notes Updated",
        description: `Notes for "${dealName}" have been updated.`,
      });
      
      return true;
    } catch (error) {
      console.error('Error updating notes:', error);
      toast({
        title: "Error",
        description: "Failed to update notes. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    query,
    saveDeal,
    deleteDeal,
    updateDealNotes,
  };
};
