import { addDays, type Item } from './model';

// Builds an .ics calendar file of every dated item (all-day events).
// On iPhone/iPad, opening it offers "Add All" to the Calendar app.
export function buildIcs(items: Item[], projectTitle: string): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const d = (s: string) => s.replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Eagle Project//ESP//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(projectTitle || 'Eagle Project')}`];
  for (const it of items) {
    if (!it.due || it.status === 'done') continue;
    const prefix = it.kind === 'milestone' ? '◆ ' : it.kind === 'checklist' ? `Step ${it.num}: ` : '';
    lines.push(
      'BEGIN:VEVENT',
      `UID:${it.key.replace(/[^a-z0-9:-]/gi, '')}@eagle-project`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d(it.due)}`,
      `DTEND;VALUE=DATE:${d(addDays(it.due, 1))}`,
      `SUMMARY:${esc(`${prefix}${it.title}`)}`,
      ...(it.notes ? [`DESCRIPTION:${esc(it.notes)}`] : []),
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(it.title)}`, 'TRIGGER:-PT15H', 'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n');
}

function fold(l: string) {
  if (l.length <= 74) return l;
  const out = [l.slice(0, 74)];
  for (let i = 74; i < l.length; i += 73) out.push(' ' + l.slice(i, i + 73));
  return out.join('\r\n');
}
