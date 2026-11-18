import { PDFDocument, PDFFont, PDFPage, PDFTextField, StandardFonts, rgb } from '@cantoo/pdf-lib';
import { ALL_FIELDS, HOURS_PDF, HOURS_ROWS, hoursTotals, num, rowValue, SECTIONS, tableTotal, type Field } from './schema';

// Fills the official Workbook No. 512-927 with the Scout's entries.
// Pure function of (template bytes, values, media loader) so it runs in the
// browser and in Node tests alike.

export interface MediaBytes { bytes: Uint8Array; type: string; w: number; h: number }
export type MediaLoader = (id: string) => Promise<MediaBytes | undefined>;

const LETTER: [number, number] = [612, 792];
const NAVY = rgb(0.06, 0.15, 0.27);
const GRAY = rgb(0.35, 0.35, 0.38);

const usDate = (iso?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso || '';
};
const fmtMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

interface Overflow { title: string; text: string }
interface TableOverflow { title: string; field: Field; rows: any[] }

export async function fillWorkbook(template: ArrayBuffer | Uint8Array, v: Record<string, any>, loadMedia: MediaLoader): Promise<Uint8Array> {
  const doc = await PDFDocument.load(template, { password: '', ignoreEncryption: false } as any);
  const form = doc.getForm();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
  const script = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const pages = doc.getPages();
  const overflows: Overflow[] = [];
  const tableOverflows: TableOverflow[] = [];

  const pageOf = (w: any) => pages.findIndex((p) => p.ref === w.P());

  // The template shares one "Project Description" box across pp. 7, 11 and 22.
  // Split pp. 11 and 22 into their own fields so each shows the right text.
  splitShared(doc, form, 'Project Description', [
    { page: 10, newName: 'Brief Project Description (Proposal)' },
    { page: 21, newName: 'Brief Project Description (Report)' },
  ], pageOf);

  const tf = (name: string): PDFTextField | undefined => { try { return form.getTextField(name); } catch { return undefined; } };

  const put = (name: string, text: string, multiline = false, title = '') => {
    if (!name) return;
    const f = tf(name);
    if (!f) return;
    text = text ?? '';
    const w = f.acroField.getWidgets()[0];
    const r = w.getRectangle();
    if (multiline) {
      try { f.enableMultiline(); } catch { /* ignore */ }
      const fit = fitText(text, helv, r.width - 6, r.height - 4);
      if (fit.overflow) {
        overflows.push({ title: title || name, text });
        f.setText(fit.text);
      } else f.setText(text);
      f.setFontSize(fit.size);
    } else {
      f.setText(text);
      let size = Math.min(10, Math.max(6, r.height * 0.72));
      while (size > 6 && helv.widthOfTextAtSize(text, size) > r.width - 4) size -= 0.5;
      f.setFontSize(size);
    }
  };

  // ── simple fields straight from the schema
  for (const { field: f, section } of ALL_FIELDS) {
    const val = v[f.id];
    if (!f.pdf) continue;
    const pdfName = f.pdf.replace(/__.*$/, '');
    switch (f.type) {
      case 'text': case 'tel': case 'email': case 'state': case 'num':
        put(pdfName, val ?? ''); break;
      case 'money': put(pdfName, val === undefined || val === '' ? '' : fmtMoney(num(val))); break;
      case 'date': put(pdfName, usDate(val)); break;
      case 'long':
        if (f.id === 'prop.description') put('Project Description', val || '', true, `${section.title} — ${f.label}`);
        else if (f.id === 'appr.brief') put('Brief Project Description (Proposal)', val || '', true, 'Proposal Approval — Brief project description');
        else if (f.id === 'rep.brief') put('Brief Project Description (Report)', val || v['appr.brief'] || '', true, 'Acceptance of the Work — Brief project description');
        else if (f.id === 'plan.benInput' || f.id === 'plan.benMods') { /* combined below */ }
        else put(pdfName, val || '', true, `${section.title} — ${f.label}`);
        break;
      case 'calc': put(pdfName, fmtMoney(Number(f.calc!(v)))); break;
      case 'choice': if (val) { try { form.getDropdown(pdfName).select(val); } catch { /* ignore */ } } break;
      case 'yesno': if (val) { try { form.getRadioGroup(pdfName).select(val); } catch { /* ignore */ } } break;
    }
  }

  // header on every page
  put('Candidates Full Name', v['cand.fullName'] || '');
  put('Project Title', v['project.title'] || '');

  // shared names: Scoutmaster (pp. 5/11/22) and beneficiary org (pp. 5/22)
  put('Scoutmaster’s Name', v['appr.smSig']?.name || v['rep.smSig']?.name || v['sm.name'] || '');
  put('Name of Organization', v['ben.org'] || '');

  // plan review: one box holds both answers
  const bi = [v['plan.benInput'], v['plan.benMods'] && `Modifications: ${v['plan.benMods']}`].filter(Boolean).join('\n\n');
  put('Input from Beneficiary', bi, true, 'Project Plan — Input from beneficiary');

  // ── hours tables (pp. 9, 15, 20)
  const t = hoursTotals(v);
  for (const phase of ['proposal', 'plan', 'report'] as const) {
    const map = HOURS_PDF[phase] as any;
    const rows = (v[`hours.${phase}`] || {}) as any;
    for (const r of HOURS_ROWS) {
      const n = 'fixedN' in r ? 1 : rows[r.key]?.n;
      if (!('fixedN' in r)) put(map.n[r.key], n === undefined || n === '' ? '' : fmtNum(num(n)));
      const h = rows[r.key]?.h;
      put(map.h[r.key], h === undefined || h === '' ? '' : fmtNum(num(h)));
      if (phase === 'report') put(map.rowTotal[r.key], fmtNum(t.rowTotal(r.key)));
    }
  }
  put('Eagle Scout Candidate', '1');
  put(HOURS_PDF.proposal.totalN, fmtNum(t.proposalN)); put(HOURS_PDF.proposal.totalH, fmtNum(t.proposalH));
  put(HOURS_PDF.plan.totalN, fmtNum(t.planN)); put(HOURS_PDF.plan.totalH, fmtNum(t.planH));
  put(HOURS_PDF.report.totalN, fmtNum(t.reportN)); put(HOURS_PDF.report.totalH, fmtNum(t.reportH));
  put(HOURS_PDF.report.grand, fmtNum(t.grand));

  // ── repeating tables
  for (const { field: f, section } of ALL_FIELDS) {
    if (f.type !== 'table') continue;
    const rows: any[] = (v[f.id] || []).filter((r: any) => f.columns!.some((c) => r[c.id] !== undefined && r[c.id] !== ''));
    rows.slice(0, f.pdfRows).forEach((row, i) => {
      for (const c of f.columns!) {
        let s: string = row[c.id] ?? '';
        if (c.type === 'money') s = c.calc || s !== '' ? fmtMoney(rowValue(row, c)) : '';
        if (c.calc && !row.qty && !row.unit && !row[c.id]) s = '';
        put(c.pdf!(i + 1), String(s));
      }
    });
    if (f.totalPdf && f.totalCol) put(f.totalPdf, fmtMoney(tableTotal(rows, f.columns!.find((c) => c.id === f.totalCol)!)));
    if (f.pdfRows && rows.length > f.pdfRows) tableOverflows.push({ title: `${section.title} — ${f.label} (continued)`, field: f, rows: rows.slice(f.pdfRows) });
  }

  // ── signatures (drawn image or typed name, placed in the signature box)
  for (const { field: f } of ALL_FIELDS) {
    if (f.type !== 'sig') continue;
    const s = v[f.id] || {};
    if (f.datePdf) put(f.datePdf, usDate(s.date));
    if (f.namePdf && f.namePdf !== 'Scoutmaster’s Name') put(f.namePdf, s.name || '');
    let sigField: any;
    try { sigField = form.getField(f.pdf!); } catch { continue; }
    const w = sigField.acroField.getWidgets()[0];
    const page = pages[pageOf(w)];
    const r = w.getRectangle();
    if (s.drawn) {
      const m = await loadMedia(s.drawn);
      if (m) {
        const img = m.type === 'image/png' ? await doc.embedPng(m.bytes) : await doc.embedJpg(m.bytes);
        const sc = Math.min(r.width / img.width, (r.height + 6) / img.height);
        page.drawImage(img, { x: r.x + 2, y: r.y - 2, width: img.width * sc, height: img.height * sc });
      }
    } else if (s.typed) {
      let size = Math.min(16, r.height * 0.8);
      while (size > 7 && script.widthOfTextAtSize(s.typed, size) > r.width - 4) size -= 0.5;
      page.drawText(s.typed, { x: r.x + 3, y: r.y + (r.height - size) / 2 + 2, size, font: script, color: NAVY });
    }
  }

  form.updateFieldAppearances(helv);

  // ── attachments: continued text, continued tables, then photos
  const att = new Attach(doc, helv, helvB, v['cand.fullName'] || '', v['project.title'] || '');
  for (const o of overflows) att.textBlock(o.title + ' (continued)', o.text);
  for (const t of tableOverflows) att.table(t.title, t.field, t.rows, the(t.field.pdfRows));
  for (const s of SECTIONS) {
    for (const g of s.groups) {
      for (const f of g.fields) {
        if (f.type !== 'photos') continue;
        const ps: any[] = v[f.id] || [];
        if (!ps.length) continue;
        await att.photos(`${s.title} — ${g.title && g.title !== f.label ? `${g.title}: ` : ''}${f.label}`, ps, loadMedia);
      }
    }
  }

  return doc.save({ updateFieldAppearances: false } as any);
}

const the = (n?: number) => n || 0;

function fitText(text: string, font: PDFFont, w: number, h: number): { size: number; text: string; overflow: boolean } {
  for (let size = 10; size >= 7; size -= 0.5) {
    const lines = wrap(text, font, size, w);
    if (lines.length * size * 1.16 <= h) return { size, text, overflow: false };
  }
  const size = 7;
  const lines = wrap(text, font, size, w);
  const max = Math.max(1, Math.floor(h / (size * 1.16)) - 1);
  const kept = lines.slice(0, max).join('\n');
  return { size, text: `${kept}\n… (continued on attached page)`, overflow: true };
}

export function wrap(text: string, font: PDFFont, size: number, w: number): string[] {
  const out: string[] = [];
  for (const para of String(text).replace(/\r/g, '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const tryL = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(tryL, size) <= w) line = tryL;
      else {
        if (line) out.push(line);
        line = word;
        while (font.widthOfTextAtSize(line, size) > w && line.length > 1) {
          let k = line.length; while (k > 1 && font.widthOfTextAtSize(line.slice(0, k), size) > w) k--;
          out.push(line.slice(0, k)); line = line.slice(k);
        }
      }
    }
    out.push(line);
  }
  return out;
}

function splitShared(doc: PDFDocument, form: any, name: string, splits: { page: number; newName: string }[], pageOf: (w: any) => number) {
  let field: any;
  try { field = form.getTextField(name); } catch { return; }
  const pages = doc.getPages();
  for (const s of splits) {
    const widgets = field.acroField.getWidgets();
    const idx = widgets.findIndex((w: any) => pageOf(w) === s.page);
    if (idx < 0) continue;
    const w = widgets[idx];
    const r = w.getRectangle();
    const ref = doc.context.getObjectRef(w.dict);
    field.acroField.removeWidget(idx);
    if (ref) pages[s.page].node.removeAnnot(ref);
    const nf = form.createTextField(s.newName);
    nf.enableMultiline();
    nf.addToPage(pages[s.page], { x: r.x, y: r.y, width: r.width, height: r.height, borderWidth: 0, font: undefined });
  }
}

class Attach {
  page?: PDFPage; y = 0;
  constructor(private doc: PDFDocument, private f: PDFFont, private fb: PDFFont, private name: string, private title: string) {}
  private newPage(heading?: string) {
    this.page = this.doc.addPage(LETTER);
    const p = this.page;
    p.drawText(`Candidate: ${this.name}`, { x: 54, y: 752, size: 9, font: this.f, color: GRAY });
    p.drawText(`Project: ${this.title}`, { x: 320, y: 752, size: 9, font: this.f, color: GRAY, maxWidth: 240 });
    p.drawLine({ start: { x: 54, y: 745 }, end: { x: 558, y: 745 }, thickness: 0.6, color: GRAY });
    p.drawText('ATTACHMENT', { x: 54, y: 40, size: 8, font: this.fb, color: GRAY });
    this.y = 720;
    if (heading) this.heading(heading);
  }
  private heading(h: string) {
    const lines = wrap(h, this.fb, 13, 504);
    for (const l of lines) { this.page!.drawText(l, { x: 54, y: this.y, size: 13, font: this.fb, color: NAVY }); this.y -= 17; }
    this.y -= 6;
  }
  private ensure(hgt: number, heading: string) { if (!this.page || this.y - hgt < 60) this.newPage(heading); }
  textBlock(title: string, text: string) {
    this.newPage(title);
    for (const l of wrap(text, this.f, 10.5, 504)) {
      if (this.y < 60) this.newPage(title);
      this.page!.drawText(l, { x: 54, y: this.y, size: 10.5, font: this.f });
      this.y -= 14;
    }
  }
  table(title: string, field: Field, rows: any[], startAt: number) {
    this.newPage(title);
    const cols = field.columns!;
    rows.forEach((row, i) => {
      const parts = cols.map((c) => {
        let s = row[c.id] ?? '';
        if (c.type === 'money') s = `$${fmtMoney(rowValue(row, c))}`;
        return `${c.label}: ${s}`;
      });
      const lines = wrap(`${startAt + i + 1}.  ${parts.join('   ·   ')}`, this.f, 10, 504);
      if (this.y - lines.length * 13 < 60) this.newPage(title);
      for (const l of lines) { this.page!.drawText(l, { x: 54, y: this.y, size: 10, font: this.f }); this.y -= 13; }
      this.y -= 6;
    });
  }
  async photos(title: string, ps: { id: string; caption?: string }[], load: MediaLoader) {
    this.newPage(title);
    for (const p of ps) {
      const m = await load(p.id);
      if (!m) continue;
      const img = m.type === 'image/png' ? await this.doc.embedPng(m.bytes) : await this.doc.embedJpg(m.bytes);
      const maxW = 504, maxH = 300;
      const sc = Math.min(maxW / img.width, maxH / img.height, 1.5);
      const w = img.width * sc, h = img.height * sc;
      const capLines = p.caption ? wrap(p.caption, this.f, 10, 504) : [];
      const need = h + capLines.length * 13 + 22;
      if (this.y - need < 60) this.newPage(title);
      this.y -= h;
      this.page!.drawImage(img, { x: 54 + (maxW - w) / 2, y: this.y, width: w, height: h });
      this.y -= 14;
      for (const l of capLines) { this.page!.drawText(l, { x: 54, y: this.y, size: 10, font: this.f, color: GRAY }); this.y -= 13; }
      this.y -= 10;
    }
  }
}
