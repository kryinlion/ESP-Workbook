import { useEffect, useLayoutEffect, useState } from 'preact/hooks';

// ── New-user guidance: a first-launch Welcome and spotlight tours with animated pointer bubbles.
// Progress is remembered per device (localStorage). Losing it only means the welcome shows again.

export interface Step { target: string; title: string; body: string; route?: string }
export interface Tour { id: string; steps: Step[] }

const LS = 'esp.tour';
type Seen = { welcome?: boolean; tours?: Record<string, boolean> };
const read = (): Seen => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
const write = (p: Partial<Seen>) => { try { localStorage.setItem(LS, JSON.stringify({ ...read(), ...p })); } catch { /* private mode */ } };
export const tourSeen = (id: string) => !!read().tours?.[id];
export const markTour = (id: string) => write({ tours: { ...(read().tours || {}), [id]: true } });
export const welcomeSeen = () => !!read().welcome;
export const markWelcome = () => write({ welcome: true });

// tiny store so any button can start a tour
let active: { tour: Tour; i: number } | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export function startTour(t: Tour) { active = { tour: t, i: 0 }; emit(); }
function go(i: number) { if (!active) return; if (i >= active.tour.steps.length) return end(); active = { ...active, i: Math.max(0, i) }; emit(); }
function end() { if (active) markTour(active.tour.id); active = null; emit(); }
export function useTourActive() {
  const [, f] = useState(0);
  useEffect(() => { const s = () => f((n) => n + 1); subs.add(s); return () => { subs.delete(s); }; }, []);
  return active;
}

// ── Spotlight + bubble
export function TourOverlay() {
  const a = useTourActive();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = a?.tour.steps[a.i];

  useLayoutEffect(() => {
    if (!step) return;
    if (step.route && location.hash !== step.route) location.hash = step.route;
    let tries = 0; let raf = 0;
    const find = () => {
      const el = document.querySelector<HTMLElement>(step.target);
      if (!el) { if (tries++ < 40) raf = requestAnimationFrame(find); else go(a!.i + 1); return; }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const settle = () => setRect(el.getBoundingClientRect());
      setTimeout(settle, 380); settle();
    };
    setRect(null); find();
    const onResize = () => { const el = document.querySelector<HTMLElement>(step.target); if (el) setRect(el.getBoundingClientRect()); };
    window.addEventListener('resize', onResize); window.addEventListener('scroll', onResize, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onResize); };
  }, [a?.tour.id, a?.i]);

  if (!a || !step) return null;
  const n = a.tour.steps.length;
  const pad = 8;
  const vw = window.innerWidth, vh = window.innerHeight;
  const r = rect;
  // bubble goes below the target if there's room, otherwise above
  const below = r ? r.bottom + 190 < vh || r.top < 220 : true;
  const bw = Math.min(340, vw - 32);
  const cx = r ? r.left + r.width / 2 : vw / 2;
  const left = Math.min(Math.max(16, cx - bw / 2), vw - bw - 16);
  const arrowX = Math.min(Math.max(22, cx - left), bw - 22);
  const top = r ? (below ? r.bottom + pad + 14 : undefined) : vh / 2 - 80;
  const bottom = r && !below ? vh - r.top + pad + 14 : undefined;

  return (
    <div class="tour" role="dialog" aria-modal="true" aria-label="Guided tour">
      {r && <div class="tour-hole" style={{ left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` }} />}
      {!r && <div class="tour-dim" />}
      <div key={a.i} class={`tour-bubble ${below ? 'below' : 'above'}`} style={{ left: `${left}px`, width: `${bw}px`, top: top !== undefined ? `${top}px` : undefined, bottom: bottom !== undefined ? `${bottom}px` : undefined, '--ax': `${arrowX}px` } as any}>
        <p class="tour-count">{a.tour.id.startsWith('tips-') ? (n > 1 ? `Tip ${a.i + 1} of ${n}` : 'Tip') : `${a.i + 1} of ${n}`}</p>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div class="tour-btns">
          <button type="button" class="lnk-btn" onClick={end}>{n === 1 ? '' : a.tour.id.startsWith('tips-') ? 'Skip tips' : 'Skip tour'}</button>
          <span class="spacer" />
          {a.i > 0 && <button type="button" class="btn ghost small" onClick={() => go(a.i - 1)}>Back</button>}
          <button type="button" class="btn small" onClick={() => go(a.i + 1)}>{a.i === n - 1 ? (a.tour.id.startsWith('tips-') ? 'Got it' : 'Done') : 'Next'}</button>
        </div>
        {n > 1 && <div class="tour-dots">{a.tour.steps.map((_, j) => <i class={j === a.i ? 'on' : j < a.i ? 'past' : ''} />)}</div>}
      </div>
    </div>
  );
}

/** First visit to a main screen → its tips (after the welcome has been seen or skipped; never on top of another tour). */
export function ScreenTips({ screen, tips }: { screen: string; tips: Record<string, Tour> }) {
  useEffect(() => {
    const t = tips[screen];
    if (!t || tourSeen(t.id) || !welcomeSeen()) return;
    const timer = setTimeout(() => { if (!active && !tourSeen(t.id)) startTour(t); }, 900);
    return () => clearTimeout(timer);
  }, [screen]);
  return null;
}

// ── First-launch welcome (3 cards) → offers the Home tour
const CARDS = [
  { icon: '⚜︎', title: 'Your Eagle project, all in one place', body: 'The official workbook, your timeline, advisor meetings, money, and presentations, built for your phone and iPad.' },
  { icon: '✓︎', title: 'It saves itself', body: 'Everything saves as you type. Your name, address, phone numbers, and signatures stay private on this device.' },
  { icon: '★︎', title: 'Earn your way to Eagle', body: 'Every answer moves your progress ring and your rank, from Scout to Eagle. Ready for a 1-minute tour?' },
];
export function Welcome({ onTour }: { onTour: () => void }) {
  const [show, setShow] = useState(() => !welcomeSeen());
  const [i, setI] = useState(0);
  if (!show) return null;
  const close = (tour: boolean) => { markWelcome(); setShow(false); if (tour) setTimeout(onTour, 250); };
  const c = CARDS[i];
  const last = i === CARDS.length - 1;
  return (
    <div class="welcome-bg">
      <div class="welcome" key={i}>
        <div class="welcome-ico">{c.icon}</div>
        <h2>{c.title}</h2>
        <p>{c.body}</p>
        <div class="tour-dots">{CARDS.map((_, j) => <i class={j === i ? 'on' : j < i ? 'past' : ''} />)}</div>
        {last ? (
          <>
            <button type="button" class="btn wide" onClick={() => close(true)}>Take the tour</button>
            <button type="button" class="lnk-btn welcome-skip" onClick={() => close(false)}>Skip for now</button>
          </>
        ) : (
          <>
            <button type="button" class="btn wide" onClick={() => setI(i + 1)}>Next</button>
            <button type="button" class="lnk-btn welcome-skip" onClick={() => close(false)}>Skip</button>
          </>
        )}
      </div>
    </div>
  );
}
