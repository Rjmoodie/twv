import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAllUserEvents,
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  seedJourneyEvents,
  type FinancialEvent,
  type CreateEventParams,
} from '@/services/financialCalendarService';
import type { CalendarSeed } from '@/services/financialCalendarService';

const QK = {
  all:   (uid: string)                   => ['financial-calendar', uid] as const,
  range: (uid: string, f: string, t: string) => ['financial-calendar', uid, f, t] as const,
};

// ── All events for a user (for the full calendar view) ────────────────────────
export function useCalendarEvents(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? QK.all(userId) : ['financial-calendar-all-disabled'],
    queryFn:  () => fetchAllUserEvents(userId!),
    enabled:  !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Range query (optional narrower view) ─────────────────────────────────────
export function useCalendarRange(userId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: userId ? QK.range(userId, from, to) : ['financial-calendar-range-disabled'],
    queryFn:  () => fetchEvents(userId!, from, to),
    enabled:  !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────
export function useCalendarMutations(userId: string | undefined) {
  const qc = useQueryClient();

  const invalidate = () => {
    if (userId) qc.invalidateQueries({ queryKey: QK.all(userId) });
  };

  const createMut = useMutation({
    mutationFn: (params: Omit<CreateEventParams, 'is_completed' | 'color' | 'metadata'> &
                         Partial<Pick<CreateEventParams, 'is_completed' | 'color' | 'metadata'>>) =>
      createEvent(userId!, params),
    onSuccess: invalidate,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<FinancialEvent, 'title' | 'description' | 'event_date' | 'is_completed' | 'color' | 'metadata'>> }) =>
      updateEvent(userId!, id, patch),
    onMutate: async ({ id, patch }) => {
      // Optimistic update for completion toggle
      if (patch.is_completed !== undefined && userId) {
        await qc.cancelQueries({ queryKey: QK.all(userId) });
        qc.setQueryData<FinancialEvent[]>(QK.all(userId), old =>
          old?.map(e => e.id === id ? { ...e, ...patch } : e)
        );
      }
    },
    onSuccess: invalidate,
    onError:   invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteEvent(userId!, id),
    onMutate: async (id) => {
      if (userId) {
        await qc.cancelQueries({ queryKey: QK.all(userId) });
        qc.setQueryData<FinancialEvent[]>(QK.all(userId), old => old?.filter(e => e.id !== id));
      }
    },
    onSuccess: invalidate,
    onError:   invalidate,
  });

  const seedMut = useMutation({
    mutationFn: (seeds: CalendarSeed[]) => seedJourneyEvents(userId!, seeds),
    onSuccess: invalidate,
  });

  return { createMut, updateMut, deleteMut, seedMut };
}
