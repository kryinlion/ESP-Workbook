import { C, FONT, H, LINE, W, wrap, type Deck, type Img, type Slide } from './engine';
import { getMedia } from '../core/db';

// ---------- images: crop/fit once, used by both PowerPoint and PDF ----------
export interface Prepared { x: number; y: number; w: number; h: number; bytes: Uint8Array; type: 'image/jpeg' | 'image/png'; dataUrl: string }

async function prepImage(im: Img): Promise<Prepared | null> {
  const m = await getMedia(im.id);
  if (!m) return null;
  const bmp = await createImageBitmap(m.blob);
  let { x, y, w, h } = im;
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  const boxR = w / h, imgR = bmp.width / bmp.height;
  if (im.fit === 'cover') {
    if (imgR > boxR) { sw = bmp.height * boxR; sx = (bmp.width - sw) / 2; } else { sh = bmp.width / boxR; sy = (bmp.height - sh) / 2; }
  } else if (imgR > boxR) { const nh = w / imgR; y += (h - nh) / 2; h = nh; } else { const nw = h * imgR; x += (w - nw) / 2; w = nw; }
  const pxW = Math.min(Math.round(w * 200), Math.round(sw)), pxH = Math.round(pxW * (h / w));
  const c = document.createElement('canvas'); c.width = Math.max(1, pxW); c.height = Math.max(1, pxH);
  const g = c.getContext('2d')!;
  const png = m.type === 'image/png';
  if (!png) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
  g.drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const type = png ? 'image/png' : 'image/jpeg';
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), type, 0.86));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const dataUrl: string = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); });
  return { x, y, w, h, bytes, type, dataUrl };
}

async function prepAll(deck: Deck) {
  const map = new Map<Img, Prepared | null>();
  for (const s of deck.slides) for (const p of s.prims) if (p.k === 'img') map.set(p, await prepImage(p));
  return map;
}

const caps = (t: string, on?: boolean) => (on ? t.toUpperCase() : t);

// ---------- PowerPoint ----------
export async function toPptx(deck: Deck): Promise<File> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const imgs = await prepAll(deck);
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'W16x9', width: W, height: H });
  pptx.layout = 'W16x9';
  pptx.title = deck.title;
  for (const s of deck.slides) {
    const sl = pptx.addSlide();
    sl.background = { color: s.bg };
    for (const p of s.prims) {
      if (p.k === 'rect') sl.addShape('rect', { x: p.x, y: p.y, w: p.w, h: p.h, fill: { color: p.fill }, line: { color: p.fill, width: 0 } });
      else if (p.k === 'img') { const im = imgs.get(p); if (im) sl.addImage({ data: im.dataUrl, x: im.x, y: im.y, w: im.w, h: im.h }); }
      else sl.addText(caps(p.text, p.caps), {
        x: p.x, y: p.y, w: p.w, h: p.h, fontFace: FONT, fontSize: p.size, color: p.color, bold: !!p.bold,
        align: p.align || 'left', valign: p.valign || 'top', margin: 0, lineSpacingMultiple: LINE / 1.17, charSpacing: p.spacing, fit: 'none', wrap: true,
      });
    }
    if (s.notes) sl.addNotes(s.notes);
  }
  const blob = (await pptx.write({ outputType: 'blob' })) as Blob;
  return new File([blob], `${deck.file}.pptx`, { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
}

// ---------- PDF ----------
// Helvetica (built-in) only knows the Windows-1252 character set; swap anything else.
const PDF_SAFE: Record<string, string> = { '✓': '+', '✔': '+', '→': '->', '←': '<-', ' ': ' ', ' ': ' ', ' ': ' ' };
const pdfSafe = (s: string) => s.replace(/[^\x00-\xff‘’“”–—•…€™]/g, (ch) => PDF_SAFE[ch] ?? '');

type PdfLib = typeof import('@cantoo/pdf-lib');
const hex = (lib: PdfLib, h: string) => lib.rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);

/** Draw one slide onto a PDF page. (ox, oy) = slide's top-left on the page in inches, k = scale. */
async function drawSlide(lib: PdfLib, doc: any, page: any, fonts: { reg: any; bold: any }, s: Slide, imgs: Map<Img, Prepared | null>,
  ox: number, oy: number, k: number, pageH: number, recolor: (h: string) => string = (h) => h) {
  const P = (i: number) => i * 72;
  const X = (x: number) => P(ox + x * k);
  const Y = (y: number, h = 0) => P(pageH - oy - (y + h) * k);
  page.drawRectangle({ x: X(0), y: Y(0, H), width: P(W * k), height: P(H * k), color: hex(lib, recolor(s.bg)) });
  for (const p of s.prims) {
    if (p.k === 'rect') page.drawRectangle({ x: X(p.x), y: Y(p.y, p.h), width: P(p.w * k), height: P(p.h * k), color: hex(lib, recolor(p.fill)) });
    else if (p.k === 'img') {
      const im = imgs.get(p); if (!im) continue;
      const e = im.type === 'image/png' ? await doc.embedPng(im.bytes) : await doc.embedJpg(im.bytes);
      page.drawImage(e, { x: X(im.x), y: Y(im.y, im.h), width: P(im.w * k), height: P(im.h * k) });
    } else {
      const font = p.bold ? fonts.bold : fonts.reg;
      const lines = wrap(caps(p.text, p.caps), p.size, p.w, p.bold).map(pdfSafe);
      const lh = (p.size * LINE) / 72;
      const total = lines.length * lh;
      let top = p.y;
      if (p.valign === 'middle') top = p.y + (p.h - total) / 2;
      else if (p.valign === 'bottom') top = p.y + p.h - total;
      lines.forEach((ln, i) => {
        const spacing = (p.spacing || 0) * (ln.length - 1);
        const tw = font.widthOfTextAtSize(ln, p.size) / 72 + spacing / 72;
        const x = p.align === 'center' ? p.x + (p.w - tw) / 2 : p.align === 'right' ? p.x + p.w - tw : p.x;
        const baseline = top + i * lh + (p.size * 0.93) / 72 + (lh - p.size / 72) / 2;
        page.drawText(ln, { x: X(x), y: Y(baseline), size: p.size * k, font, color: hex(lib, recolor(p.color)), characterSpacing: p.spacing ? p.spacing * k : undefined });
      });
    }
  }
}

export async function toPdf(deck: Deck): Promise<File> {
  const lib = await import('@cantoo/pdf-lib');
  const imgs = await prepAll(deck);
  const doc = await lib.PDFDocument.create();
  doc.setTitle(deck.title);
  const fonts = { reg: await doc.embedFont(lib.StandardFonts.Helvetica), bold: await doc.embedFont(lib.StandardFonts.HelveticaBold) };
  for (const s of deck.slides) await drawSlide(lib, doc, doc.addPage([W * 72, H * 72]), fonts, s, imgs, 0, 0, 1, H);
  const bytes = await doc.save();
  return new File([bytes as BlobPart], `${deck.file}.pdf`, { type: 'application/pdf' });
}

// ---------- Handout: portrait letter, 3 slides per page with note lines, ink-saving ----------
// Cream backgrounds print white; dark title/closing slides are left out (the page header carries the title).
export async function toHandout(deck: Deck, meta: { title: string; sub: string }): Promise<File> {
  const lib = await import('@cantoo/pdf-lib');
  const slides = deck.slides.filter((s) => s.bg !== C.navy);
  const imgs = await prepAll({ ...deck, slides });
  const doc = await lib.PDFDocument.create();
  doc.setTitle(`${deck.title} — handout`);
  const fonts = { reg: await doc.embedFont(lib.StandardFonts.Helvetica), bold: await doc.embedFont(lib.StandardFonts.HelveticaBold) };
  const PW = 8.5, PH = 11, M = 0.55, top = 1.25, gap = 0.3, per = 3;
  const slot = (PH - top - 0.6 - gap * (per - 1)) / per; // space per slide
  const k = Math.min(slot / H, 4.6 / W);                  // scale
  const sw = W * k, sh = H * k;
  const lx = M + sw + 0.3, lw = PW - M - lx;              // notes column
  const ink = (h: string) => (h === C.cream ? C.white : h);
  const pages = Math.ceil(slides.length / per) || 1;
  for (let pg = 0; pg < pages; pg++) {
    const page = doc.addPage([PW * 72, PH * 72]);
    const t = (s: string, x: number, y: number, size: number, f: any, color: string) => page.drawText(pdfSafe(s), { x: x * 72, y: (PH - y) * 72, size, font: f, color: hex(lib, color) });
    t(meta.title, M, 0.62, 15, fonts.bold, C.navy);
    t(`${deck.title}${meta.sub ? '  ·  ' + meta.sub : ''}`, M, 0.86, 10, fonts.reg, C.muted);
    page.drawRectangle({ x: M * 72, y: (PH - 1.0) * 72, width: 0.9 * 72, height: 0.04 * 72, color: hex(lib, C.gold) });
    t('Notes', lx, top - 0.08, 9, fonts.bold, C.muted);
    for (let i = 0; i < per; i++) {
      const s = slides[pg * per + i]; if (!s) break;
      const y = top + i * (slot + gap) + (slot - sh) / 2;
      await drawSlide(lib, doc, page, fonts, s, imgs, M, y, k, PH, ink);
      page.drawRectangle({ x: M * 72, y: (PH - y - sh) * 72, width: sw * 72, height: sh * 72, borderColor: hex(lib, 'BFC6CC'), borderWidth: 0.75 });
      for (let ly = y + 0.3; ly <= y + sh + 0.001; ly += 0.3)
        page.drawLine({ start: { x: lx * 72, y: (PH - ly) * 72 }, end: { x: (lx + lw) * 72, y: (PH - ly) * 72 }, thickness: 0.5, color: hex(lib, 'C9CED3') });
    }
    const pn = `${pg + 1} / ${pages}`;
    t(pn, PW - M - fonts.reg.widthOfTextAtSize(pn, 9) / 72, PH - 0.35, 9, fonts.reg, C.muted);
  }
  const bytes = await doc.save();
  return new File([bytes as BlobPart], `${deck.file}_Handout.pdf`, { type: 'application/pdf' });
}

export { C };
