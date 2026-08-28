/**
 * Official FOMC meeting dates.
 *
 * The Fed publishes its annual schedule well ahead of time. This table is the
 * deterministic source both the calendar feed and the rates snapshot read from,
 * so the two can never disagree about when the next decision lands.
 *
 * Each entry is [date, releasesEconomicProjections].
 * Source: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
 */
export const FOMC_CALENDAR_URL =
  "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";

export const FOMC_DATES: Record<number, Array<[string, boolean]>> = {
  2026: [["2026-01-28",false],["2026-03-18",true],["2026-04-29",false],["2026-06-17",true],["2026-07-29",false],["2026-09-16",true],["2026-10-28",false],["2026-12-09",true]],
  2027: [["2027-01-27",false],["2027-03-17",true],["2027-04-28",false],["2027-06-09",true],["2027-07-28",false],["2027-09-15",true],["2027-10-27",false],["2027-12-08",true]],
};

/** All scheduled meetings, ascending. */
export function allFomcMeetings(): Array<[string, boolean]> {
  return Object.keys(FOMC_DATES)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((year) => FOMC_DATES[year]);
}

/**
 * The next meeting on or after `today` (YYYY-MM-DD), or null once the published
 * schedule runs out — better to show nothing than to invent a date.
 */
export function nextFomcMeeting(
  today = new Date().toISOString().slice(0, 10),
): { date: string; hasProjections: boolean } | null {
  const upcoming = allFomcMeetings().find(([date]) => date >= today);
  return upcoming ? { date: upcoming[0], hasProjections: upcoming[1] } : null;
}
