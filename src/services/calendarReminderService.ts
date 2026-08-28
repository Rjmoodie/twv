import { supabase } from '@/integrations/supabase/client';
import type { FinancialEvent } from './financialCalendarService';
import { addCalendarDays, calendarDayInTimeZone } from '@/lib/calendarDate';

export type ReminderChannels = 'in_app' | 'email' | 'push';

const normalized = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-|-$/g, '');
const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return (result >>> 0).toString(36);
};

/** Stable across provider date changes, but distinct across companies/programs. */
export function calendarReminderKey(event: FinancialEvent): string {
  if (event.metadata.readOnly !== true) return `personal:${event.id}`;
  const identity = event.event_type === 'earnings'
    ? [event.event_type, event.metadata.ticker, event.metadata.fiscalDateEnding]
    : event.event_type === 'pdufa'
      ? [event.event_type, event.metadata.ticker ?? event.metadata.company, event.metadata.drug, event.metadata.eventType]
      : [event.event_type, event.metadata.agency, event.title, event.metadata.period];
  const raw = identity.map(normalized).filter(Boolean).join(':');
  return `market:${raw.slice(0, 190)}:${hash(raw)}`;
}

export function validateReminderSchedule(eventDate: string, daysBefore: number, today = calendarDayInTimeZone()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new Error('This event does not have a valid calendar date.');
  if (!Number.isInteger(daysBefore) || daysBefore < 0 || daysBefore > 30) throw new Error('Reminder must be between 0 and 30 days before the event.');
  if (eventDate < today) throw new Error('Reminders cannot be created for past events.');
  if (addCalendarDays(eventDate, -daysBefore) < today) throw new Error('That reminder time has already passed. Choose a shorter lead time.');
}

export async function scheduleCalendarReminder(
  userId: string,
  event: FinancialEvent,
  daysBefore: number,
  channels: ReminderChannels[] = ['in_app'],
) {
  validateReminderSchedule(event.event_date, daysBefore);
  if (!channels.length) throw new Error('Choose at least one reminder channel.');
  const { error } = await supabase.from('calendar_reminders' as never).upsert({
    user_id: userId,
    event_key: calendarReminderKey(event),
    event_date: event.event_date,
    title: event.title.slice(0, 240),
    event_type: event.event_type,
    days_before: daysBefore,
    channels,
    status: 'scheduled',
    updated_at: new Date().toISOString(),
  } as never, { onConflict: 'user_id,event_key' });
  if (error) throw error;
}
