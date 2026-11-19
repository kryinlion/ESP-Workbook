import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import '@fontsource/bebas-neue/latin-400.css';

// Home-screen hero.
//  • Label "EAGLE SCOUT LEADERSHIP SERVICE PROJECT" on a near-black strip, sized to one line.
//  • YOUR / EAGLE / PROJECT stack on the right: PROJECT sets the width; EAGLE is scaled up
//    and YOUR is 3pt smaller than PROJECT and letter-spaced so all three words' INK edges hit
//    the same two vertical lines.
//  • Progress ring on the left, exactly as tall as the stack (top + bottom ink lines).
//  Everything is measured from real glyph outlines on a canvas, so it holds at any width.

const FONT = '"Bebas Neue"';
const PT3 = 4; // 3pt ≈ 4 CSS px

export const RANKS = [
  { name: 'Scout', at: 0 },
  { name: 'Tenderfoot', at: 10 },
  { name: 'Second Class', at: 25 },
  { name: 'First Class', at: 40 },
  { name: 'Star', at: 55 },
  { name: 'Life', at: 75 },
  { name: 'Eagle', at: 100 },
];

export function rankFor(pct: number) {
  let i = 0;
  RANKS.forEach((r, j) => { if (pct >= r.at) i = j; });
  return i;
}

interface Ink { left: number; right: number; ascent: number; descent: number; width: number; advance: number }

let ctx: CanvasRenderingContext2D | null = null;
function ink(text: string, size: number, font = FONT, weight = '400'): Ink {
  ctx ??= document.createElement('canvas').getContext('2d');
  ctx!.font = `${weight} ${size}px ${font}`;
  const m = ctx!.measureText(text);
  return {
    left: m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight,
    ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent,
    width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, advance: m.width,
  };
}

interface Layout {
  W: number; H: number; D: number; gap: number; stackX: number;
  words: { text: string; size: number; y: number; letters: { ch: string; x: number }[] }[];
  label: { size: number };
}

function compute(inner: number): Layout {
  const LINE_GAP = 0.16; // gap between words, as a fraction of PROJECT cap height
  const COL_GAP = 25; // space between ring and stack
  const SCALE = 0.9; // Mark: dial both back ~10% from full-width fit
  // unit stack: PROJECT ink width = 1
  const p1 = ink('PROJECT', 100);
  const sP = 100 / p1.width; // size where PROJECT ink width = 1
  const e1 = ink('EAGLE', 100);
  const sE = 100 / e1.width;
  const hP = ink('PROJECT', sP).ascent;
  const hE = ink('EAGLE', sE).ascent;
  // Stack height is ~linear in width (YOUR's 3pt offset adds a constant), and the ring
  // diameter equals that height, so solve  W + COL_GAP + H(W) = inner  directly.
  const H1 = stackHeight(100, sP, sE, hP, hE, LINE_GAP), H2 = stackHeight(200, sP, sE, hP, hE, LINE_GAP);
  const k = (H2 - H1) / 100, h0 = H1 - 100 * k;
  const W = Math.max(80, Math.min((inner - COL_GAP - h0) / (1 + k), 340)) * SCALE;
  const words = layoutWords(W, sP, sE, LINE_GAP);
  const H = words.h;
  // ring sits left; stack hugs the right edge
  return { W, H, D: H, gap: COL_GAP, stackX: inner - W, words: words.list, label: { size: fitLabel(inner) } };
}

function stackHeight(W: number, sP: number, sE: number, hP: number, hE: number, gap: number) {
  const sizeP = sP * W, sizeY = Math.max(6, sizeP - PT3);
  const hY = ink('YOUR', sizeY).ascent;
  const g = gap * hP * W;
  return hY + g + hE * W + g + hP * W;
}

function layoutWords(W: number, sP: number, sE: number, gap: number) {
  const sizeP = sP * W, sizeE = sE * W, sizeY = Math.max(6, sizeP - PT3);
  const iP = ink('PROJECT', sizeP), iE = ink('EAGLE', sizeE), iY = ink('YOUR', sizeY);
  const g = gap * iP.ascent;
  const list: Layout['words'] = [];
  let y = 0;
  // YOUR — letter-spaced: place each glyph so first ink-left = 0 and last ink-right = W
  {
    const chars = [...'YOUR'];
    const glyphs = chars.map((ch) => ink(ch, sizeY));
    const natural = glyphs.reduce((a, gl, i) => a + (i < chars.length - 1 ? gl.advance : 0), 0);
    // ink span with zero extra spacing:
    const span0 = glyphs[0].left + natural + glyphs[glyphs.length - 1].right;
    const ls = (W - span0) / (chars.length - 1);
    let x = glyphs[0].left;
    const letters = chars.map((ch, i) => { const out = { ch, x }; x += glyphs[i].advance + ls; return out; });
    y += iY.ascent;
    list.push({ text: 'YOUR', size: sizeY, y, letters });
  }
  y += g + iE.ascent;
  list.push({ text: 'EAGLE', size: sizeE, y, letters: [{ ch: 'EAGLE', x: iE.left }] });
  y += g + iP.ascent;
  list.push({ text: 'PROJECT', size: sizeP, y, letters: [{ ch: 'PROJECT', x: iP.left }] });
  return { list, h: y };
}

function fitLabel(inner: number) {
  const LS = 0.12; // letter-spacing in em, matches CSS
  const t = 'EAGLE SCOUT LEADERSHIP SERVICE PROJECT';
  const sys = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const w10 = ink(t, 10, sys, '700').advance + t.length * LS * 10;
  const avail = inner - 20; // label padding
  return Math.max(7, Math.min(14, Math.floor((avail / w10) * 10 * 10) / 10));
}

export function Hero({ pct, done, total, below }: { pct: number; done: number; total: number; below?: preact.ComponentChildren }) {
  const box = useRef<HTMLDivElement>(null);
  const [inner, setInner] = useState(0);
  const [ready, setReady] = useState(false);
  const [L, setL] = useState<Layout | null>(null);

  useEffect(() => {
    let alive = true;
    document.fonts.load(`100px ${FONT}`).then(() => alive && setReady(true));
    const ro = new ResizeObserver(([e]) => setInner(Math.floor(e.contentRect.width)));
    if (box.current) ro.observe(box.current);
    return () => { alive = false; ro.disconnect(); };
  }, []);
  useLayoutEffect(() => { if (ready && inner > 0) setL(compute(Math.min(inner, 560))); }, [ready, inner]);

  const r = rankFor(pct);
  const next = RANKS[r + 1];
  const toNext = next ? Math.max(0, Math.ceil((next.at / 100) * total) - done) : 0;

  return (
    <section class="hero2">
      <div class="hero2-in" ref={box}>
        <span class="hero-label" style={{ fontSize: L ? `${L.label.size}px` : '11px' }}>Eagle Scout Leadership Service Project</span>
        {L && (
          <div class="hero-row" style={{ height: `${L.H}px`, gap: `${L.gap}px` }}>
            <Ring pct={pct} d={L.D} />
            <svg class="stack" width={L.W} height={L.H} viewBox={`0 0 ${L.W} ${L.H}`} aria-label="Your Eagle Project" role="img">
              {L.words.map((w, i) => (
                <g class={`w${i}`}>
                  {w.letters.map((l) => (
                    <text x={l.x} y={w.y} font-size={w.size} font-family={FONT}>{l.ch}</text>
                  ))}
                </g>
              ))}
            </svg>
          </div>
        )}
        <div class="rank-strip">
          <div class="rank-head">
            <span>Rank <b>{RANKS[r].name}</b></span>
            <span class="rank-next">{next ? `${toNext} more answer${toNext === 1 ? '' : 's'} to ${next.name}` : 'Eagle reached. Every answer is filled in!'}</span>
          </div>
          <ol class="pips">
            {RANKS.map((k, i) => (
              <li class={i < r ? 'got' : i === r ? 'now' : ''} title={`${k.name}: ${k.at}%`}>
                <span class="pip" /><span class="pip-name">{k.name.replace('Second Class', '2nd Class').replace('First Class', '1st Class')}</span>
              </li>
            ))}
          </ol>
        </div>
        {below}
      </div>
    </section>
  );
}

function Ring({ pct, d }: { pct: number; d: number }) {
  const sw = Math.max(6, d * 0.085);
  const r = (d - sw) / 2;
  const c = 2 * Math.PI * r;
  const id = 'ringgrad';
  return (
    <svg class="ring2" width={d} height={d} viewBox={`0 0 ${d} ${d}`} aria-label={`${pct}% complete`} role="img">
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stop-color="#3f9a7c" />
          <stop offset="100%" stop-color="#f0c75a" />
        </linearGradient>
      </defs>
      <circle cx={d / 2} cy={d / 2} r={r} class="ring2-bg" stroke-width={sw} />
      {/* tick marks at each rank threshold */}
      {RANKS.slice(1, -1).map((k) => {
        const a = (k.at / 100) * 2 * Math.PI - Math.PI / 2;
        const r1 = r - sw / 2 - 2, r2 = r + sw / 2 + 2;
        return <line x1={d / 2 + r1 * Math.cos(a)} y1={d / 2 + r1 * Math.sin(a)} x2={d / 2 + r2 * Math.cos(a)} y2={d / 2 + r2 * Math.sin(a)} class="ring2-tick" />;
      })}
      <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke={`url(#${id})`} stroke-width={sw} stroke-linecap="round"
        stroke-dasharray={`${(Math.max(pct, 0.5) / 100) * c} ${c}`} transform={`rotate(-90 ${d / 2} ${d / 2})`} class="ring2-fg" />
      <text x={d / 2} y={d / 2 + d * 0.12} text-anchor="middle" font-family={FONT} font-size={d * 0.36} class="ring2-num">{pct}<tspan font-size={d * 0.17} dx={d * 0.01}>%</tspan></text>
      <text x={d / 2} y={d / 2 + d * 0.27} text-anchor="middle" font-size={Math.max(8, d * 0.075)} class="ring2-cap">COMPLETE</text>
    </svg>
  );
}
