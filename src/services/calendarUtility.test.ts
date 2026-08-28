import { expect, it } from 'vitest';
import type { FinancialEvent } from './financialCalendarService';
import { eventsToIcs } from './calendarUtility';

it('exports valid all-day events and escapes user content', () => {
  const event = { id: 'abc', title: 'CPI, release', description: 'Line 1\nLine 2', event_date: '2026-08-26', metadata: { sourceUrl: 'https://example.com' } } as FinancialEvent;
  const output = eventsToIcs([event]);
  expect(output).toContain('DTSTART;VALUE=DATE:20260826');
  expect(output).toContain('DTEND;VALUE=DATE:20260827');
  expect(output).toContain('SUMMARY:CPI\\, release');
  expect(output).toContain('DESCRIPTION:Line 1\\nLine 2');
  expect(output).toContain('END:VCALENDAR');
});
