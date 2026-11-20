import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { saveState, useProject } from './core/store';
import { MODULES } from './modules/registry';
import { Home } from './modules/home';
import { Workbook } from './modules/workbook';
import { ExportScreen } from './modules/export';
import { ComingSoon } from './modules/coming';
import { Timeline } from './modules/timeline';
import { Decks } from './modules/decks';
import { Meetings } from './modules/meetings';
import { Money } from './modules/money';
import { BackupPrompt } from './ui/backupPrompt';
import { ScreenTips, TourOverlay, Welcome, startTour } from './tour/tour';
import { HOME_TOUR, SCREEN_TIPS } from './tour/tours';
import { HelpButton, HelpPanel } from './tour/help';
import { QuestCelebrate } from './tour/quests';
import { UpdateBanner } from './ui/updatePrompt';

export function useRoute() {
  const [r, setR] = useState(location.hash.slice(1) || '/');
  useEffect(() => {
    const f = () => { setR(location.hash.slice(1) || '/'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}

// Top-bar slot: on Home it shows the PROJECT NAME; on every other screen it's a back button
// (main tabs → Home, deeper screens → their parent list). Mark 2026-11-20.
function backFor(parts: string[]): { href: string; label: string } | null {
  const [a, b, c] = parts;
  if (a === 'meetings' && b) return { href: '#/meetings', label: 'Meetings' };
  if (a === 'money' && ['donation', 'expense', 'donor', 'event'].includes(b)) {
    const tab = { donation: 'donations', expense: 'expenses', donor: 'donors', event: 'events' }[b as 'donation'];
    return { href: `#/money/${tab}`, label: tab[0].toUpperCase() + tab.slice(1) };
  }
  if (a === 'decks' && b === 'meeting' && c) return { href: `#/meetings/${c}`, label: 'Meeting' };
  if (a === 'decks' && b) return { href: '#/decks', label: 'Presentations' };
  // every other screen (Workbook, Timeline, Meetings, Money, Presentations, Export…) goes back Home
  if (a && a !== 'home') return { href: '#/', label: 'Home' };
  return null; // Home itself shows the project name
}

export function App() {
  const route = useRoute();
  const p = useProject();
  const parts = route.split('/').filter(Boolean);
  const top = parts[0] || 'home';
  const back = backFor(parts);
  // Home title: shrink a little (17→14px) to fit one line; if it still doesn't fit, wrap to two lines.
  const titleRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const fit = () => {
      const el = titleRef.current; if (!el) return;
      el.classList.remove('two'); el.style.fontSize = '';
      for (let px = 17; px >= 14; px -= 0.5) { el.style.fontSize = `${px}px`; if (el.scrollWidth <= el.clientWidth) return; }
      el.style.fontSize = '15px'; el.classList.add('two');
    };
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  });

  let screen;
  if (top === 'home') screen = <Home />;
  else if (top === 'workbook') screen = <Workbook sectionId={parts[1]} focusId={parts[2]} />;
  else if (top === 'export') screen = <ExportScreen />;
  else if (top === 'timeline') screen = <Timeline view={parts[1]} />;
  else if (top === 'decks') screen = <Decks deckId={parts[1]} arg={parts[2]} />;
  else if (top === 'meetings') screen = <Meetings id={parts[1]} />;
  else if (top === 'money') screen = <Money parts={parts.slice(1)} />;
  else { const m = MODULES.find((x) => x.id === top); screen = m ? <ComingSoon m={m} /> : <Home />; }

  return (
    <div class="app">
      <header class="topbar">
        {back
          ? <a href={back.href} class="topback" aria-label={`Back to ${back.label}`}><span class="chev">‹</span><span>{back.label}</span></a>
          : <a href="#/" class="brand"><img src="icons/icon-192.png" alt="" /><span ref={titleRef}>{p.values['project.title'] || 'My Eagle Project'}</span></a>}
        <span class={`saved ${saveState}`} aria-live="polite" aria-label={saveState === 'saving' ? 'Saving' : 'Saved'} data-hud-tip="Saved">{saveState === 'saving' ? '•••' : '✓'}</span>
        <HelpButton />
        <a href="#/export" class="share-btn" data-tour="backup" aria-label="Export and backup">⇪</a>
      </header>
      <main>{screen}</main>
      <BackupPrompt />
      <HelpPanel />
      <Welcome onTour={() => startTour(HOME_TOUR)} />
      <TourOverlay />
      <QuestCelebrate />
      <UpdateBanner />
      <ScreenTips screen={parts.length === 1 || (top === 'workbook' && parts.length >= 2) || (top === 'timeline') ? top : ''} tips={SCREEN_TIPS} />
      <nav class="tabbar">
        {MODULES.filter((m) => m.tab).map((m) => (
          <a href={`#/${m.id === 'home' ? '' : m.id}`} class={top === m.id ? 'on' : ''} data-tour={`tab-${m.id}`}>
            <span class="ti">{m.icon}</span><span class="tl">{m.short}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
