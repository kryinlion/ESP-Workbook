import { useEffect, useState } from 'preact/hooks';
import { saveState, useProject } from './core/store';
import { MODULES } from './modules/registry';
import { Home } from './modules/home';
import { Workbook } from './modules/workbook';
import { ExportScreen } from './modules/export';
import { ComingSoon } from './modules/coming';

export function useRoute() {
  const [r, setR] = useState(location.hash.slice(1) || '/');
  useEffect(() => {
    const f = () => { setR(location.hash.slice(1) || '/'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return r;
}

export function App() {
  const route = useRoute();
  const p = useProject();
  const parts = route.split('/').filter(Boolean);
  const top = parts[0] || 'home';

  let screen;
  if (top === 'home') screen = <Home />;
  else if (top === 'workbook') screen = <Workbook sectionId={parts[1]} />;
  else if (top === 'export') screen = <ExportScreen />;
  else { const m = MODULES.find((x) => x.id === top); screen = m ? <ComingSoon m={m} /> : <Home />; }

  return (
    <div class="app">
      <header class="topbar">
        <a href="#/" class="brand"><img src="icons/icon-192.png" alt="" /><span>{p.values['project.title'] || 'Eagle Project'}</span></a>
        <span class={`saved ${saveState}`} aria-live="polite">{saveState === 'saving' ? 'Saving…' : 'Saved ✓'}</span>
        <a href="#/export" class="share-btn" aria-label="Export and backup">⇪</a>
      </header>
      <main>{screen}</main>
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
