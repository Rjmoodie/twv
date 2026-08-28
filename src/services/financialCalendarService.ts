import { supabase } from '@/integrations/supabase/client';
import type { CalendarSeed } from './journeyMilestones';

export type EventType =
  | 'journey_milestone' | 'check_in' | 'coach_reminder'
  | 'savings_target'    | 'earnings' | 'pdufa' | 'macro' | 'bill' | 'custom';

export type EventCategory =
  | 'savings' | 'debt' | 'investment' | 'home'
  | 'business' | 'market' | 'bill' | 'general';

export interface FinancialEvent {
  id:           string;
  user_id:      string;
  title:        string;
  description:  string | null;
  event_date:   string;  // YYYY-MM-DD
  event_type:   EventType;
  journey_id:   string | null;
  journey_plan_id?: string | null;
  source_key?: string | null;
  source_revision?: number | null;
  category:     EventCategory;
  is_completed: boolean;
  completed_at: string | null;
  color:        string | null;
  metadata:     Record<string, unknown>;
  created_at:   string;
  updated_at:   string;
}

export type CreateEventParams = Omit<FinancialEvent, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'completed_at'>;

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchEvents(
  userId: string,
  from: string,
  to: string,
): Promise<FinancialEvent[]> {
  const { data, error } = await supabase
    .from('financial_events')
    .select('*')
    .eq('user_id', userId)
    .gte('event_date', from)
    .lte('event_date', to)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as FinancialEvent[];
}

export async function fetchAllUserEvents(userId: string): Promise<FinancialEvent[]> {
  const { data, error } = await supabase
    .from('financial_events')
    .select('*')
    .eq('user_id', userId)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as FinancialEvent[];
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createEvent(
  userId: string,
  params: Omit<CreateEventParams, 'is_completed' | 'color' | 'metadata'> &
          Partial<Pick<CreateEventParams, 'is_completed' | 'color' | 'metadata'>>,
): Promise<FinancialEvent> {
  const { data, error } = await supabase
    .from('financial_events')
    .insert({
      user_id:      userId,
      title:        params.title,
      description:  params.description ?? null,
      event_date:   params.event_date,
      event_type:   params.event_type,
      journey_id:   params.journey_id ?? null,
      category:     params.category,
      is_completed: params.is_completed ?? false,
      color:        params.color ?? null,
      metadata:     params.metadata ?? {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as FinancialEvent;
}

// ── Bulk seed from journey ────────────────────────────────────────────────────

export async function seedJourneyEvents(
  userId: string,
  seeds: CalendarSeed[],
): Promise<void> {
  if (seeds.length === 0) return;

  // Remove any existing events for this journey before re-seeding
  const journeyId = seeds[0].journey_id;
  const { error: deleteError } = await supabase
    .from('financial_events')
    .delete()
    .eq('user_id', userId)
    .eq('journey_id', journeyId);
  if (deleteError) throw deleteError;

  const rows = seeds.map(s => ({
    user_id:      userId,
    title:        s.title,
    description:  s.description,
    event_date:   s.event_date,
    event_type:   s.event_type,
    journey_id:   s.journey_id,
    category:     s.category,
    is_completed: false,
    metadata:     s.metadata,
  }));

  const { error } = await supabase.from('financial_events').insert(rows);
  if (error) throw error;
}

/** Stable identity for plan-generated events, independent of their projected date. */
export function calendarSeedKey(seed: CalendarSeed): string {
  const metadataIdentity = seed.metadata.month ?? seed.metadata.quarter ?? seed.metadata.milestone
    ?? seed.metadata.targetMonth ?? seed.metadata.payoffMonth ?? seed.metadata.goalAmount ?? seed.title;
  return `${seed.event_type}:${String(metadataIdentity).trim().toLowerCase().replace(/[^a-z0-9.-]+/g, '-').slice(0, 140)}`;
}

/**
 * Reconciles an activated plan without destroying completed events or changing
 * the IDs used by durable reminders.
 */
export async function reconcileJourneyPlanEvents(
  userId: string,
  planId: string,
  sourceRevision: number,
  seeds: CalendarSeed[],
): Promise<void> {
  // Remove after deployed schema types include the Journey plan columns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: existingData, error: existingError } = await db.from('financial_events')
    .select('*').eq('user_id', userId).eq('journey_plan_id', planId);
  if (existingError) throw existingError;
  const existing = (existingData ?? []) as FinancialEvent[];
  const incomingKeys = new Set(seeds.map(calendarSeedKey));

  const obsolete = existing.filter(event =>
    event.source_key && !incomingKeys.has(event.source_key) && !event.is_completed
  );
  if (obsolete.length) {
    const reminderKeys = obsolete.map(event => `personal:${event.id}`);
    const { error: reminderError } = await db.from('calendar_reminders').update({ status: 'cancelled' })
      .eq('user_id', userId).in('event_key', reminderKeys);
    if (reminderError) throw reminderError;
    const { error } = await db.from('financial_events').delete()
      .eq('user_id', userId).in('id', obsolete.map(event => event.id));
    if (error) throw error;
  }

  if (!seeds.length) return;
  const existingByKey = new Map(existing.filter(event => event.source_key).map(event => [event.source_key!, event]));
  const rows = seeds.map(seed => {
    const sourceKey = calendarSeedKey(seed);
    const previous = existingByKey.get(sourceKey);
    return {
      user_id: userId,
      title: seed.title,
      description: seed.description,
      event_date: seed.event_date,
      event_type: seed.event_type,
      journey_id: seed.journey_id,
      journey_plan_id: planId,
      source_key: sourceKey,
      source_revision: sourceRevision,
      category: seed.category,
      is_completed: previous?.is_completed ?? false,
      completed_at: previous?.completed_at ?? null,
      metadata: { ...seed.metadata, generatedBy: 'journey_plan', planId },
    };
  });
  const { error } = await db.from('financial_events').upsert(rows, {
    onConflict: 'user_id,journey_plan_id,source_key',
  });
  if (error) throw error;
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateEvent(
  userId: string,
  eventId: string,
  patch: Partial<Pick<FinancialEvent, 'title' | 'description' | 'event_date' | 'is_completed' | 'color' | 'metadata'>>,
): Promise<FinancialEvent> {
  const update: Record<string, unknown> = { ...patch };
  if (patch.is_completed === true)  update.completed_at = new Date().toISOString();
  if (patch.is_completed === false) update.completed_at = null;

  const { data, error } = await supabase
    .from('financial_events')
    .update(update)
    .eq('id', eventId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as FinancialEvent;
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('financial_events')
    .delete()
    .eq('id', eventId)
    .eq('user_id', userId);

  if (error) throw error;
}

// ── Journey events check ──────────────────────────────────────────────────────

export async function hasJourneyEvents(
  userId: string,
  journeyId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from('financial_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('journey_id', journeyId);

  if (error) return false;
  return (count ?? 0) > 0;
}
