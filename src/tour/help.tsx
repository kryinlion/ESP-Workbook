import { useEffect, useState } from 'preact/hooks';
import { useProject } from '../core/store';
import { CHECKLIST } from '../workbook/schema';
import { startTour } from './tour';
import { HOME_TOUR, SCREEN_TIPS } from './tours';

// "?" button → slide-in panel. Starter version (Mark and Claude are still designing the next-step logic).
const screenNow = () => location.hash.replace(/^#\/?/, '').split('/')[0] || 'home';
let open = false;
const subs = new Set<() => void>();
export function openHelp(v = true) { open = v; subs.forEach((f) => f()); }

export function HelpButton() {
  return <button type="button" class="help-btn" data-tour="help" aria-label="Help and next step" onClick={() => openHelp(true)}>?</button>;
}

export function HelpPanel() {
  const [, f] = useState(0);
  useEffect(() => { const s = () => f((n) => n + 1); subs.add(s); return () => { subs.delete(s); }; }, []);
  const p = useProject();
  const ck = (p.values.checklist || {}) as Record<number, boolean>;
  const next = CHECKLIST.findIndex((_, i) => !ck[i]);
  return (
    <div class={`help-bg${open ? ' on' : ''}`} onClick={() => openHelp(false)} aria-hidden={!open}>
      <aside class="help-panel" onClick={(e) => e.stopPropagation()} aria-label="Help">
        <div class="help-head"><h2>What's next?</h2><button type="button" class="x-btn" aria-label="Close" onClick={() => openHelp(false)}>×</button></div>
        {next >= 0 ? (
          <a class="card help-next" href="#/timeline" onClick={() => openHelp(false)}>
            <span class="help-k">Your next workbook step</span>
            <b>Step {next + 1} of {CHECKLIST.length}</b>
            <span>{CHECKLIST[next]}</span>
          </a>
        ) : <div class="card help-next"><b>Every workbook step is checked off. 🦅</b></div>}
        {SCREEN_TIPS[screenNow()] && <button type="button" class="btn ghost wide" onClick={() => { openHelp(false); setTimeout(() => startTour(SCREEN_TIPS[screenNow()]), 300); }}>💡 Show tips for this screen</button>}
        <button type="button" class="btn ghost wide" onClick={() => { openHelp(false); setTimeout(() => startTour(HOME_TOUR), 300); }}>▶ Replay the tour</button>
        <p class="hint" style={{ marginTop: '14px' }}>Smarter "what to do next" suggestions are coming here.</p>
      </aside>
    </div>
  );
}
