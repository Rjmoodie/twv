import { describe, expect, it } from 'vitest';
import type { FinancialEvent } from './financialCalendarService';
import { calendarReminderKey, validateReminderSchedule } from './calendarReminderService';

const marketEvent = (date: string) => ({ id: `market-earnings-ABC-${date}`, event_type: 'earnings', event_date: date, metadata: { readOnly: true, ticker: 'ABC', fiscalDateEnding: '2026-06-30' } }) as FinancialEvent;

describe('calendar reminders', () => {
  it('keeps a stable identity when a provider moves the date', () => {
    expect(calendarReminderKey(marketEvent('2026-09-01'))).toBe(calendarReminderKey(marketEvent('2026-09-08')));
  });

  it('keeps personal events isolated by database id', () => {
    const event = { id: 'one', event_type: 'custom', metadata: {} } as FinancialEvent;
    expect(calendarReminderKey(event)).toBe('personal:one');
  });

  it('rejects past events and lead times that have already elapsed', () => {
    expect(() => validateReminderSchedule('2026-08-25', 0, '2026-08-26')).toThrow('past events');
    expect(() => validateReminderSchedule('2026-08-27', 7, '2026-08-26')).toThrow('already passed');
    expect(() => validateReminderSchedule('2026-08-27', 1, '2026-08-26')).not.toThrow();
  });
});
