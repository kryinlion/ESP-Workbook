import { useEffect, useState } from 'preact/hooks';
import { useProject } from '../core/store';
import { timeline } from '../timeline/model';
import { meetingsStore } from '../meetings/model';
import { moneyStore } from '../money/model';
import { startTour } from './tour';
import { HOME_TOUR, SCREEN_TIPS } from './tours';
import { hasUrgent, ranked, type Suggestion } from './next';

// "?" button (top bar, right) → panel slides in from the right with what to do next.
// One big "Do this next" + up to 3 "Also coming up", ranked for the screen Colin is on.
const screenNow = () => location.hash.replace(/^#\/?/, '').split('/')[0] || 'home';
let open = false;
const subs = new Set<() => void>();
export function openHelp(v = true) { open = v; subs.forEach((f) => f()); }
function useLive() { useProject(); timeline.use(); meetingsStore.use(); moneyStore.use(); }

export function HelpButton() {
  useLive();
  const [, f] = useState(0);
  useEffect(() => { const t = setInterval(() => f((n) => n + 1), 60_000); return () => clearInterval(t); }, []); // dates roll over
  const urgent = hasUrgent();
  return (
    <button type="button" class={`help-btn${urgent ? ' urgent' : ''}`} data-tour="help" aria-label={urgent ? 'Help: something needs attention' : 'Help and next step'} onClick={() => openHelp(true)}>
      ?{urgent && <span class="help-dot" />}
    </button>
  );
}

const LV = { 3: 'Needs attention', 2: 'Coming up soon', 1: 'Keep going' } as const;

export function HelpPanel() {
  const [, f] = useState(0);
  useEffect(() => { const s = () => f((n) => n + 1); subs.add(s); return () => { subs.delete(s); }; }, []);
  useLive();
  const scr = screenNow();
  const list = open ? ranked(scr) : [];
  const [top, ...rest] = list;
  const go = (s: Suggestion) => { openHelp(false); location.hash = s.href; };
  return (
    <div class={`help-bg${open ? ' on' : ''}`} onClick={() => openHelp(false)} aria-hidden={!open}>
      <aside class="help-panel" onClick={(e) => e.stopPropagation()} aria-label="What's next">
        <div class="help-head"><h2>What's next?</h2><button type="button" class="x-btn" aria-label="Close" onClick={() => openHelp(false)}>×</button></div>
        {top ? (
          <div class={`card help-next lv${top.level}`}>
            <span class="help-k">Do this next · {LV[top.level]}</span>
            <b>{top.title}</b>
            <span>{top.detail}</span>
            <button type="button" class="btn" onClick={() => go(top)}>{top.go} →</button>
          </div>
        ) : <div class="card help-next"><b>You're all caught up. 🦅</b><span>Nothing needs your attention right now.</span></div>}
        {rest.length > 0 && (
          <>
            <h3 class="help-sub">Also coming up</h3>
            {rest.slice(0, 3).map((s) => (
              <button type="button" class={`help-row lv${s.level}`} onClick={() => go(s)}>
                <span class="help-row-main"><b>{s.title}</b><small>{s.detail}</small></span>
                <span class="help-row-go">{s.go} →</span>
              </button>
            ))}
          </>
        )}
        <div class="help-more">
          {SCREEN_TIPS[scr] && <button type="button" class="btn ghost wide" onClick={() => { openHelp(false); setTimeout(() => startTour(SCREEN_TIPS[scr]), 300); }}>💡 Show tips for this screen</button>}
          <button type="button" class="btn ghost wide" onClick={() => { openHelp(false); setTimeout(() => startTour(HOME_TOUR), 300); }}>▶ Replay the tour</button>
        </div>
      </aside>
    </div>
  );
}
