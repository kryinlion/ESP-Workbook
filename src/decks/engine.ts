// Slide engine. Every deck is laid out ONCE as simple shapes (rects, text boxes, images) on a
// 13.333 × 7.5 in (16:9) canvas. Three renderers draw the same shapes: the on-screen preview,
// PowerPoint (.pptx), and PDF — so what Colin sees is what prints.

export const W = 13.333;
export const H = 7.5;

export const C = {
  navy: '0F1D2B', navy2: '1A2F45', gold: 'D6AB38', goldSoft: 'F3E6BF', green: '2F6B58',
  cream: 'F7F4ED', white: 'FFFFFF', ink: '17212B', muted: '66717D', line: 'E2DDD2',
};

export interface Rect { k: 'rect'; x: number; y: number; w: number; h: number; fill: string }
export interface Text {
  k: 'text'; x: number; y: number; w: number; h: number; text: string; size: number; color: string;
  bold?: boolean; align?: 'left' | 'center' | 'right'; valign?: 'top' | 'middle' | 'bottom'; caps?: boolean; spacing?: number;
}
export interface Img { k: 'img'; x: number; y: number; w: number; h: number; id: string; fit: 'cover' | 'contain' }
export type Prim = Rect | Text | Img;
export interface Slide { bg: string; prims: Prim[]; notes?: string }
export interface Deck { id: string; title: string; file: string; slides: Slide[] }

export const LINE = 1.22; // line height multiple used by every renderer
export const FONT = 'Arial'; // PowerPoint/Keynote/Google Slides all have it; PDF uses Helvetica (same metrics)

// ---------- text measuring (canvas, Arial metrics) ----------
let ctx: CanvasRenderingContext2D | null = null;
function measure(s: string, size: number, bold = false) {
  ctx ??= document.createElement('canvas').getContext('2d')!;
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}, Helvetica, sans-serif`;
  return ctx.measureText(s).width / 72; // size in pt → width in inches
}

/** Wrap text into lines that fit `w` inches at `size` pt. Keeps the author's paragraph breaks. */
export function wrap(text: string, size: number, w: number, bold = false): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r/g, '').split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word;
      if (measure(t, size, bold) <= w || !line) line = t;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out;
}
export const textHeight = (lines: number, size: number) => (lines * size * LINE) / 72;

/** Largest size in [min,max] where the text fits the box; null if it doesn't fit even at min. */
export function fitSize(text: string, w: number, h: number, max: number, min: number, bold = false): number | null {
  for (let s = max; s >= min; s -= 1) if (textHeight(wrap(text, s, w, bold).length, s) <= h) return s;
  return null;
}

/** Split long text into chunks that each fit the box at `size` (paragraph/sentence boundaries when possible). */
export function paginate(text: string, w: number, h: number, size: number): string[] {
  const maxLines = Math.max(1, Math.floor((h * 72) / (size * LINE)));
  const lines = wrap(text, size, w);
  if (lines.length <= maxLines) return [text];
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += maxLines) pages.push(lines.slice(i, i + maxLines).join('\n').replace(/^\n+/, ''));
  return pages;
}

// ---------- shared slide pieces ----------
export interface Ctx { footer: string; photo: (id: string) => { w: number; h: number } | undefined }

export function contentFrame(title: string, ctx: Ctx, kicker?: string): Prim[] {
  return [
    { k: 'rect', x: 0, y: 0, w: W, h: 0.12, fill: C.navy },
    ...(kicker ? [{ k: 'text', x: 0.7, y: 0.42, w: 11, h: 0.32, text: kicker, size: 12, color: C.gold, bold: true, caps: true, spacing: 2 } as Text] : []),
    { k: 'text', x: 0.7, y: kicker ? 0.72 : 0.5, w: 11.9, h: 0.75, text: title, size: 32, color: C.navy, bold: true, valign: 'middle' },
    { k: 'rect', x: 0.7, y: kicker ? 1.5 : 1.3, w: 1.1, h: 0.06, fill: C.gold },
    { k: 'text', x: 0.7, y: H - 0.5, w: 9, h: 0.3, text: ctx.footer, size: 10, color: C.muted },
  ];
}
export const BODY_TOP = 1.85;
export const BODY_BOTTOM = H - 0.75;
