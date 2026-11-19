import { C, FONT, H, LINE, W, wrap, type Deck, type Img } from './engine';
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

export async function toPdf(deck: Deck): Promise<File> {
  const { PDFDocument, StandardFonts, rgb } = await import('@cantoo/pdf-lib');
  const imgs = await prepAll(deck);
  const doc = await PDFDocument.create();
  doc.setTitle(deck.title);
  const reg = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const col = (hex: string) => rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  const pt = (i: number) => i * 72;
  for (const s of deck.slides) {
    const page = doc.addPage([pt(W), pt(H)]);
    page.drawRectangle({ x: 0, y: 0, width: pt(W), height: pt(H), color: col(s.bg) });
    for (const p of s.prims) {
      if (p.k === 'rect') page.drawRectangle({ x: pt(p.x), y: pt(H - p.y - p.h), width: pt(p.w), height: pt(p.h), color: col(p.fill) });
      else if (p.k === 'img') {
        const im = imgs.get(p); if (!im) continue;
        const e = im.type === 'image/png' ? await doc.embedPng(im.bytes) : await doc.embedJpg(im.bytes);
        page.drawImage(e, { x: pt(im.x), y: pt(H - im.y - im.h), width: pt(im.w), height: pt(im.h) });
      } else {
        const font = p.bold ? bold : reg;
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
          page.drawText(ln, { x: pt(x), y: pt(H - baseline), size: p.size, font, color: col(p.color), characterSpacing: p.spacing || undefined } as any);
        });
      }
    }
  }
  const bytes = await doc.save();
  return new File([bytes as BlobPart], `${deck.file}.pdf`, { type: 'application/pdf' });
}

export { C };
