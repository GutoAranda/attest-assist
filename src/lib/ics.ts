// Generates and downloads an .ics calendar file for a ticket.
const pad = (n: number) => String(n).padStart(2, '0');

const formatDate = (d: Date) => {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
};

const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

interface IcsEvent {
  uid: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
}

export const downloadIcs = ({ uid, title, description, date }: IcsEvent) => {
  const start = new Date(date + 'T09:00:00');
  const end = new Date(date + 'T10:00:00');
  const now = new Date();
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LOTS DocFlow//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@lots-docflow`,
    `DTSTAMP:${formatDate(now)}`,
    `DTSTART:${formatDate(start)}`,
    `DTEND:${formatDate(end)}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${uid}.ics`;
  a.click();
  URL.revokeObjectURL(url);
};
