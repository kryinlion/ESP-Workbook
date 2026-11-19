import { values } from '../core/store';
import { attendees, longDate, meetingTitle, time12, type Meeting } from './model';

// Meeting agenda — one item per line in the Agenda box. Leading bullets/numbers are ignored.
export function agendaItems(m: Meeting): string[] {
  return (m.agenda || '').split('\n').map((s) => s.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim()).filter(Boolean);
}

const header = (m: Meeting) => {
  const v = values();
  return {
    title: `${meetingTitle(m)} — agenda`,
    project: String(v['project.title'] || 'Eagle Scout Project'),
    by: String(v['cand.fullName'] || ''),
    when: `${longDate(m.date)}${m.time ? `, ${time12(m.time)}` : ''}`,
  };
};

/** Plain text for Messages / Mail. */
export function agendaText(m: Meeting): string {
  const h = header(m);
  const who = attendees(m);
  return [
    `${h.project}: ${h.title}`,
    h.when + (m.where ? ` · ${m.where}` : ''),
    ...(who.length ? [`With: ${who.join(', ')}`] : []),
    '',
    ...agendaItems(m).map((a, i) => `${i + 1}. ${a}`),
    '',
    ...(h.by ? [`— ${h.by}`] : []),
  ].join('\n').trim();
}

/** One-page printable agenda (US Letter) with room for notes under each item. */
export async function agendaPdf(m: Meeting): Promise<File> {
  const lib = await import('@cantoo/pdf-lib');
  const doc = await lib.PDFDocument.create();
  const h = header(m);
  doc.setTitle(h.title);
  const reg = await doc.embedFont(lib.StandardFonts.Helvetica), bold = await doc.embedFont(lib.StandardFonts.HelveticaBold);
  const rgb = (x: string) => lib.rgb(parseInt(x.slice(0, 2), 16) / 255, parseInt(x.slice(2, 4), 16) / 255, parseInt(x.slice(4, 6), 16) / 255);
  const safe = (s: string) => s.replace(/[^\x00-\xff‘’“”–—•…]/g, '');
  const PW = 612, PH = 792, M = 54, W = PW - M * 2;
  let page = doc.addPage([PW, PH]);
  let y = PH - M;
  const wrap = (s: string, f: any, size: number, w: number) => {
    const out: string[] = []; let line = '';
    for (const word of safe(s).split(/\s+/)) { const t = line ? `${line} ${word}` : word; if (f.widthOfTextAtSize(t, size) <= w || !line) line = t; else { out.push(line); line = word; } }
    if (line) out.push(line); return out;
  };
  const text = (s: string, x: number, size: number, f: any, color = '17212B', w = W) => {
    for (const ln of wrap(s, f, size, w)) {
      if (y < M + size) { page = doc.addPage([PW, PH]); y = PH - M; }
      page.drawText(ln, { x, y: y - size, size, font: f, color: rgb(color) }); y -= size * 1.3;
    }
  };
  text(h.project.toUpperCase(), M, 10, bold, 'B08A20');
  y -= 4;
  text(h.title, M, 24, bold, '0F1D2B');
  page.drawRectangle({ x: M, y: y - 6, width: 64, height: 3, color: rgb('D6AB38') }); y -= 20;
  text(h.when, M, 12, bold);
  if (m.where) text(`Where: ${m.where}`, M, 12, reg);
  const who = attendees(m);
  if (who.length) text(`With: ${who.join(', ')}`, M, 12, reg);
  if (h.by) text(`Prepared by ${h.by}`, M, 12, reg, '66717D');
  y -= 16;
  const items = agendaItems(m);
  if (!items.length) text('(No agenda items yet.)', M, 13, reg, '66717D');
  const notesLines = items.length <= 4 ? 3 : items.length <= 7 ? 2 : 1;
  items.forEach((a, i) => {
    if (y < M + 60) { page = doc.addPage([PW, PH]); y = PH - M; }
    const n = `${i + 1}.`;
    const top = y;
    text(a, M + 26, 14, bold, '17212B', W - 26);
    page.drawText(n, { x: M, y: top - 14, size: 14, font: bold, color: rgb('B08A20') });
    for (let k = 0; k < notesLines; k++) {
      y -= 22;
      page.drawLine({ start: { x: M + 26, y }, end: { x: M + W, y }, thickness: 0.5, color: rgb('C9CED3') });
    }
    y -= 16;
  });
  const bytes = await doc.save();
  const d = m.date.replace(/-/g, '');
  return new File([bytes as BlobPart], `Agenda_${meetingTitle(m).replace(/[^A-Za-z0-9]+/g, '_')}_${d}.pdf`, { type: 'application/pdf' });
}
