import { useEffect, useState } from 'preact/hooks';
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

  let screen;
  if (top === 'home') screen = <Home />;
  else if (top === 'workbook') screen = <Workbook sectionId={parts[1]} />;
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
          : <a href="#/" class="brand"><img src="icons/icon-192.png" alt="" /><span>{p.values['project.title'] || 'My Eagle Project'}</span></a>}
        <span class={`saved ${saveState}`} aria-live="polite">{saveState === 'saving' ? 'Saving…' : 'Saved ✓'}</span>
        <a href="#/export" class="share-btn" aria-label="Export and backup">⇪</a>
      </header>
      <main>{screen}</main>
      <BackupPrompt />
      <nav class="tabbar">
        {MODULES.filter((m) => m.tab).map((m) => (
          <a href={`#/${m.id === 'home' ? '' : m.id}`} class={top === m.id ? 'on' : ''}>
            <span class="ti">{m.icon}</span><span class="tl">{m.short}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
