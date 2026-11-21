import { useEffect, useState } from 'preact/hooks';
import { APP_BUILD } from '../core/upgrade';
import { checkForUpdate } from './updatePrompt';
import { THEMES, currentTheme, setTheme, type ThemeId } from './theme';

// ⚙ Settings (top bar) → panel slides in from the right, same as the ? panel.
// Look picker (Dark default · Light · H.A. · OuterSpace · Eagle Crafting) + app version / check for updates.
let open = false;
const subs = new Set<() => void>();
export function openSettings(v = true) { open = v; subs.forEach((f) => f()); }

export function SettingsButton() {
  return <button type="button" class="set-btn" aria-label="Settings" onClick={() => openSettings(true)}>⚙︎</button>;
}

export function SettingsPanel() {
  const [, f] = useState(0);
  useEffect(() => { const s = () => f((n) => n + 1); subs.add(s); return () => { subs.delete(s); }; }, []);
  const [cur, setCur] = useState<ThemeId>(currentTheme());
  const [chk, setChk] = useState<'' | 'checking' | 'ready' | 'current' | 'offline'>('');
  const pick = (id: ThemeId) => { setTheme(id); setCur(id); };
  const when = (t: number) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <div class={`help-bg${open ? ' on' : ''}`} onClick={() => openSettings(false)} aria-hidden={!open}>
      <aside class="help-panel set-panel" onClick={(e) => e.stopPropagation()} aria-label="Settings">
        <div class="help-head"><h2>Settings</h2><button type="button" class="x-btn" aria-label="Close" onClick={() => openSettings(false)}>×</button></div>
        <h3 class="help-sub">Look</h3>
        <div class="theme-list" role="radiogroup" aria-label="Look">
          {THEMES.map((t) => (
            <button type="button" role="radio" aria-checked={cur === t.id} class={`theme-opt t-${t.id}${cur === t.id ? ' on' : ''}`} onClick={() => pick(t.id)}>
              <span class="theme-sw" aria-hidden="true">{t.swatches.map((c) => <i style={{ background: c }} />)}</span>
              <span class="theme-txt"><b>{t.name}{t.id === 'dark' && <small class="theme-def"> · default</small>}</b><small>{t.blurb}</small></span>
              <span class="theme-tick" aria-hidden="true">{cur === t.id ? '✓' : ''}</span>
            </button>
          ))}
        </div>
        <p class="hint">Saved on this device only. Your answers look the same in every theme.</p>
        <h3 class="help-sub">App</h3>
        <div class="safe-row app-ver">
          <span><b>App version</b><small>{APP_BUILD === 'dev' ? 'dev' : when(Date.parse(APP_BUILD))}</small></span>
          <button type="button" class="btn ghost small" disabled={chk === 'checking'}
            onClick={async () => { setChk('checking'); setChk(await checkForUpdate()); }}>
            {chk === 'checking' ? 'Checking…' : 'Check for updates'}
          </button>
        </div>
        {chk === 'current' && <p class="hint">You have the newest version.</p>}
        {chk === 'ready' && <p class="hint">A new version is ready. Tap <b>Tap to refresh</b> at the bottom.</p>}
        {chk === 'offline' && <p class="hint">Couldn't check. Make sure you're online and try again.</p>}
      </aside>
    </div>
  );
}
