import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from '@/integrations/supabase/types';

export type WatchlistItem = Database['public']['Tables']['watchlist']['Row'];

/**
 * Custom hook for watchlist operations
 */
export const useWatchlistOperations = (userId: string | undefined) => {
  const fetchWatchlist = async (): Promise<WatchlistItem[]> => {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });
    if (error) throw error;
    return data || [];
  };

  const query = useQuery({
    queryKey: ['watchlist', userId],
    queryFn: fetchWatchlist,
    enabled: !!userId,
    staleTime: 60000
  });
  return query;
};
