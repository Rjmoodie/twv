import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/somatech/AuthProvider';
import { coachService, type FinancialProfile } from '@/services/coachService';

/**
 * Shared, cached coach profile. Replaces individual coachService.getProfile calls
 * scattered across dashboard components — they all resolve from one React Query cache entry.
 */
export function useCoachProfile() {
  const { user } = useAuth();

  const query = useQuery<FinancialProfile | null>({
    queryKey: ['coachProfile', user?.id],
    queryFn: () => (user ? coachService.getProfile(user.id) : null),
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : query.isError ? 'Financial profile could not be loaded.' : null,
    refetch: query.refetch,
  };
}
