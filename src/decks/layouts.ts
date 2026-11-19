import { BODY_BOTTOM, BODY_TOP, C, H, W, contentFrame, fitSize, paginate, wrap, textHeight, type Ctx, type Prim, type Slide } from './engine';

export interface Photo { id: string; caption?: string }

// ---------- title & section ----------
export function titleSlide(o: { kicker: string; title: string; sub?: string; meta?: string; cover?: string }): Slide {
  const p: Prim[] = [];
  if (o.cover) {
    p.push({ k: 'img', x: 7.6, y: 0, w: W - 7.6, h: H, id: o.cover, fit: 'cover' });
    p.push({ k: 'rect', x: 7.6, y: 0, w: 0.08, h: H, fill: C.gold });
  }
  const tw = o.cover ? 6.3 : 11.3;
  const size = fitSize(o.title, tw, 2.6, 54, 30, true) ?? 30;
  const th = textHeight(wrap(o.title, size, tw, true).length, size);
  const y0 = 2.55;
  p.push({ k: 'text', x: 0.8, y: 1.55, w: tw, h: 0.4, text: o.kicker, size: 14, color: C.gold, bold: true, caps: true, spacing: 3 });
  p.push({ k: 'rect', x: 0.8, y: 2.1, w: 1.3, h: 0.07, fill: C.gold });
  p.push({ k: 'text', x: 0.8, y: y0, w: tw, h: th + 0.1, text: o.title, size, color: C.white, bold: true });
  if (o.sub) p.push({ k: 'text', x: 0.8, y: y0 + th + 0.3, w: tw, h: 0.5, text: o.sub, size: 22, color: C.goldSoft });
  if (o.meta) p.push({ k: 'text', x: 0.8, y: H - 1.15, w: tw, h: 0.4, text: o.meta, size: 14, color: 'B8C2CC' });
  return { bg: C.navy, prims: p };
}

export function closingSlide(title: string, sub?: string): Slide {
  return {
    bg: C.navy, prims: [
      { k: 'rect', x: W / 2 - 0.65, y: 2.55, w: 1.3, h: 0.07, fill: C.gold },
      { k: 'text', x: 1, y: 2.85, w: W - 2, h: 1.1, text: title, size: 48, color: C.white, bold: true, align: 'center' },
      ...(sub ? [{ k: 'text', x: 1, y: 4.05, w: W - 2, h: 0.6, text: sub, size: 20, color: C.goldSoft, align: 'center' } as Prim] : []),
    ],
  };
}

// ---------- text (+ optional photos) — splits across slides if long ----------
export function textSlides(ctx: Ctx, title: string, text: string, photos: Photo[] = [], kicker?: string): Slide[] {
  const withPics = photos.length > 0;
  const tw = withPics ? 6.4 : 11.9;
  const th = BODY_BOTTOM - BODY_TOP;
  const size = fitSize(text, tw, th, 24, 16) ?? 16;
  const pages = paginate(text, tw, th, size);
  return pages.map((chunk, i) => {
    const p = contentFrame(i ? `${title} (continued)` : title, ctx, kicker);
    p.push({ k: 'text', x: 0.7, y: BODY_TOP, w: tw, h: th, text: chunk, size, color: C.ink });
    if (withPics && i === 0) p.push(...photoColumn(photos.slice(0, 2), 7.55, BODY_TOP, W - 7.55 - 0.7, th));
    return { bg: C.cream, prims: p };
  });
}

function photoColumn(photos: Photo[], x: number, y: number, w: number, h: number): Prim[] {
  const gap = 0.2;
  const each = (h - gap * (photos.length - 1)) / photos.length;
  return photos.flatMap((ph, i) => photoBox(ph, x, y + i * (each + gap), w, each));
}

function photoBox(ph: Photo, x: number, y: number, w: number, h: number): Prim[] {
  const cap = ph.caption?.trim();
  const ch = cap ? 0.4 : 0;
  const out: Prim[] = [
    { k: 'rect', x, y, w, h: h - ch, fill: C.white },
    { k: 'img', x: x + 0.06, y: y + 0.06, w: w - 0.12, h: h - ch - 0.12, id: ph.id, fit: 'contain' },
  ];
  if (cap) out.push({ k: 'text', x, y: y + h - ch + 0.04, w, h: ch - 0.04, text: cap, size: 12, color: C.muted, align: 'center' });
  return out;
}

// ---------- photo grid (1–4 per slide) ----------
export function photoSlides(ctx: Ctx, title: string, photos: Photo[], kicker?: string): Slide[] {
  const out: Slide[] = [];
  for (let i = 0; i < photos.length; i += 4) {
    const set = photos.slice(i, i + 4);
    const p = contentFrame(i ? `${title} (continued)` : title, ctx, kicker);
    const x0 = 0.7, y0 = BODY_TOP, w = W - 1.4, h = BODY_BOTTOM - BODY_TOP, gap = 0.25;
    const cols = set.length === 1 ? 1 : 2, rows = set.length > 2 ? 2 : 1;
    const cw = (w - gap * (cols - 1)) / cols, rh = (h - gap * (rows - 1)) / rows;
    set.forEach((ph, j) => p.push(...photoBox(ph, x0 + (j % cols) * (cw + gap), y0 + Math.floor(j / cols) * (rh + gap), cw, rh)));
    out.push({ bg: C.cream, prims: p });
  }
  return out;
}

// ---------- big numbers ----------
export function statsSlide(ctx: Ctx, title: string, stats: { value: string; label: string }[], kicker?: string, note?: string): Slide {
  const p = contentFrame(title, ctx, kicker);
  const n = Math.min(stats.length, 4);
  const gap = 0.3, w = (W - 1.4 - gap * (n - 1)) / n, y = 2.3, h = 2.9;
  stats.slice(0, 4).forEach((s, i) => {
    const x = 0.7 + i * (w + gap);
    p.push({ k: 'rect', x, y, w, h, fill: C.white });
    p.push({ k: 'rect', x, y, w, h: 0.08, fill: C.gold });
    const size = fitSize(s.value, w - 0.4, 1.3, 60, 24, true) ?? 24;
    p.push({ k: 'text', x: x + 0.2, y: y + 0.45, w: w - 0.4, h: 1.3, text: s.value, size, color: C.navy, bold: true, align: 'center', valign: 'middle' });
    p.push({ k: 'text', x: x + 0.2, y: y + 1.9, w: w - 0.4, h: 0.8, text: s.label, size: 16, color: C.muted, align: 'center' });
  });
  if (note) p.push({ k: 'text', x: 0.7, y: 5.55, w: W - 1.4, h: 0.9, text: note, size: 16, color: C.ink });
  return { bg: C.cream, prims: p };
}

// ---------- bullet list (gold square bullets; splits if long) ----------
export function bulletSlides(ctx: Ctx, title: string, items: string[], kicker?: string): Slide[] {
  const out: Slide[] = [];
  const size = 20, w = W - 1.4 - 0.45, lineH = (size * 1.22) / 72, maxH = BODY_BOTTOM - BODY_TOP;
  let p = contentFrame(title, ctx, kicker), y = BODY_TOP, first = true;
  for (const it of items) {
    const lines = wrap(it, size, w);
    const h = lines.length * lineH + 0.16;
    if (y + h > BODY_TOP + maxH && y > BODY_TOP) {
      out.push({ bg: C.cream, prims: p });
      p = contentFrame(`${title} (continued)`, ctx, kicker); y = BODY_TOP; first = false;
    }
    p.push({ k: 'rect', x: 0.75, y: y + lineH / 2 - 0.06, w: 0.13, h: 0.13, fill: C.gold });
    p.push({ k: 'text', x: 0.7 + 0.45, y, w, h: h, text: it, size, color: C.ink });
    y += h;
  }
  void first;
  out.push({ bg: C.cream, prims: p });
  return out;
}

// ---------- table (header row navy; splits if long) ----------
export function tableSlides(ctx: Ctx, title: string, head: string[], rows: string[][], widths: number[], opts: { total?: string[]; kicker?: string; align?: ('left' | 'right')[] } = {}): Slide[] {
  const out: Slide[] = [];
  const x0 = 0.7, tw = W - 1.4, size = 15, rowH = 0.46;
  const sum = widths.reduce((a, b) => a + b, 0);
  const cw = widths.map((x) => (x / sum) * tw);
  const per = Math.floor((BODY_BOTTOM - BODY_TOP - rowH * (opts.total ? 2 : 1)) / rowH);
  const chunks = rows.length ? Array.from({ length: Math.ceil(rows.length / per) }, (_, i) => rows.slice(i * per, i * per + per)) : [[]];
  chunks.forEach((chunk, ci) => {
    const p = contentFrame(ci ? `${title} (continued)` : title, ctx, opts.kicker);
    let y = BODY_TOP;
    const row = (cells: string[], bg: string, color: string, bold: boolean) => {
      p.push({ k: 'rect', x: x0, y, w: tw, h: rowH, fill: bg });
      let x = x0;
      cells.forEach((c, i) => {
        p.push({ k: 'text', x: x + 0.1, y, w: cw[i] - 0.2, h: rowH, text: clip(c, size, cw[i] - 0.2, bold), size, color, bold, valign: 'middle', align: opts.align?.[i] || 'left' });
        x += cw[i];
      });
      y += rowH;
    };
    row(head, C.navy, C.white, true);
    chunk.forEach((r, i) => row(r, i % 2 ? 'EFEBE2' : C.white, C.ink, false));
    if (opts.total && ci === chunks.length - 1) row(opts.total, C.goldSoft, C.navy, true);
    out.push({ bg: C.cream, prims: p });
  });
  return out;
}

function clip(s: string, size: number, w: number, bold: boolean): string {
  if (wrap(s, size, w, bold).length <= 1) return s;
  let t = s;
  while (t.length > 1 && wrap(t + '…', size, w, bold).length > 1) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

// ---------- add footer page numbers (title slide unnumbered) ----------
export function number(slides: Slide[]): Slide[] {
  slides.forEach((s, i) => {
    if (i === 0 || s.bg === C.navy) return;
    s.prims.push({ k: 'text', x: W - 1.7, y: H - 0.5, w: 1, h: 0.3, text: String(i + 1), size: 10, color: C.muted, align: 'right' });
  });
  return slides;
}
