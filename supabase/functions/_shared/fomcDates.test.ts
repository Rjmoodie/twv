import { describe, it, expect } from 'vitest';
import { FOMC_DATES, allFomcMeetings, nextFomcMeeting } from './fomcDates.ts';

describe('fomcDates', () => {
  it('returns every published meeting in ascending order', () => {
    const meetings = allFomcMeetings();
    const dates = meetings.map(([date]) => date);
    expect(dates).toEqual([...dates].sort());
    expect(meetings).toHaveLength(
      Object.values(FOMC_DATES).reduce((n, year) => n + year.length, 0),
    );
  });

  it('picks the next meeting strictly after a date between two of them', () => {
    expect(nextFomcMeeting('2026-08-27')).toEqual({
      date: '2026-09-16',
      hasProjections: true,
    });
  });

  it('counts the meeting day itself as upcoming, not past', () => {
    // A decision lands at 2pm ET. On the morning of the meeting the useful
    // answer is "today", not "seven weeks from now".
    expect(nextFomcMeeting('2026-09-16')?.date).toBe('2026-09-16');
  });

  it('rolls over the year boundary', () => {
    expect(nextFomcMeeting('2026-12-10')?.date).toBe('2027-01-27');
  });

  it('returns null rather than inventing a date past the schedule', () => {
    expect(nextFomcMeeting('2028-01-01')).toBeNull();
  });

  it('flags which meetings publish economic projections', () => {
    // The Fed publishes the SEP at four meetings a year.
    const withProjections = allFomcMeetings().filter(([, sep]) => sep);
    expect(withProjections).toHaveLength(Object.keys(FOMC_DATES).length * 4);
  });
});
