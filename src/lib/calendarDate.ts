export const DEFAULT_MARKET_TIME_ZONE = 'America/New_York';

export function calendarDayInTimeZone(
  now: Date = new Date(),
  timeZone = DEFAULT_MARKET_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addCalendarDays(isoDay: string, amount: number): string {
  const date = new Date(`${isoDay}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function startOfWeek(isoDay: string, weekStartsOn = 0): string {
  const date = new Date(`${isoDay}T12:00:00Z`);
  const offset = (date.getUTCDay() - weekStartsOn + 7) % 7;
  return addCalendarDays(isoDay, -offset);
}

export function formatCalendarDay(
  isoDay: string,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US',
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' })
    .format(new Date(`${isoDay}T12:00:00Z`));
}
