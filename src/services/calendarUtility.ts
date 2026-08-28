import type { FinancialEvent } from './financialCalendarService';

const escapeIcs = (value: string) => value
  .replace(/\\/g, '\\\\')
  .replace(/\r?\n/g, '\\n')
  .replace(/,/g, '\\,')
  .replace(/;/g, '\\;');

const fold = (line: string) => {
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    chunks.push(rest.slice(0, 73));
    rest = rest.slice(73);
  }
  chunks.push(rest);
  return chunks.join('\r\n ');
};

export function eventsToIcs(events: FinancialEvent[], calendarName = 'SomaTech Calendar'): string {
  const body = events.map((event) => {
    const start = event.event_date.replaceAll('-', '');
    const endDate = new Date(`${event.event_date}T12:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const end = endDate.toISOString().slice(0, 10).replaceAll('-', '');
    const sourceUrl = typeof event.metadata.sourceUrl === 'string' ? event.metadata.sourceUrl : '';
    return [
      'BEGIN:VEVENT',
      fold(`UID:${escapeIcs(event.id)}@somatech.pro`),
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      fold(`SUMMARY:${escapeIcs(event.title)}`),
      event.description ? fold(`DESCRIPTION:${escapeIcs(event.description)}`) : null,
      sourceUrl ? fold(`URL:${escapeIcs(sourceUrl)}`) : null,
      'END:VEVENT',
    ].filter(Boolean).join('\r\n');
  }).join('\r\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SomaTech//Financial Calendar//EN', `X-WR-CALNAME:${escapeIcs(calendarName)}`, 'CALSCALE:GREGORIAN', body, 'END:VCALENDAR', ''].join('\r\n');
}

export function downloadCalendar(events: FinancialEvent[], fileName = 'somatech-calendar.ics') {
  const url = URL.createObjectURL(new Blob([eventsToIcs(events)], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function eventTicker(event: FinancialEvent): string | null {
  const value = event.metadata.symbol ?? event.metadata.ticker;
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null;
}
