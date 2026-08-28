import { describe, expect, it } from 'vitest';
import { addCalendarDays, calendarDayInTimeZone, formatCalendarDay, startOfWeek } from './calendarDate';

describe('calendarDate', () => {
  it('keeps the New York calendar day after UTC midnight', () => {
    expect(calendarDayInTimeZone(new Date('2026-08-26T03:30:00Z'))).toBe('2026-08-25');
  });

  it('moves across month and DST boundaries as calendar days', () => {
    expect(addCalendarDays('2026-10-31', 2)).toBe('2026-11-02');
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('finds the Sunday containing a date', () => {
    expect(startOfWeek('2026-08-26')).toBe('2026-08-23');
  });

  it('formats without shifting the date for the viewer timezone', () => {
    expect(formatCalendarDay('2026-08-26', { month: 'short', day: 'numeric' }, 'en-US')).toBe('Aug 26');
  });
});
