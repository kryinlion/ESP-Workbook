import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { flush } from '../core/store';
import { flushAllDocStores } from '../core/docstore';

// "Update ready — tap to refresh": a new version waits until Colin taps, so it never swaps in
// mid-sentence. Everything is saved first; the new version then makes a safety copy on startup.
let ready = false;
let apply: ((reload?: boolean) => Promise<void>) | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function startUpdateWatch() {
  if (!('serviceWorker' in navigator)) return;
  apply = registerSW({
    onNeedRefresh() { ready = true; emit(); },
    onRegisteredSW(_url, reg) {
      // check for a new version every hour while the app is open, and whenever it comes back to the front
      if (!reg) return;
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    },
  });
}

export function UpdateBanner() {
  const [, f] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const s = () => f((n) => n + 1); subs.add(s); return () => { subs.delete(s); }; }, []);
  if (!ready) return null;
  const go = async () => {
    setBusy(true);
    try { await flush(); await flushAllDocStores(); } catch { /* still update */ }
    await apply?.(true);
  };
  return (
    <div class="update-bar" role="status">
      <span>✨ <b>Update ready</b></span>
      <button type="button" class="btn small" disabled={busy} onClick={go}>{busy ? 'Saving…' : 'Tap to refresh'}</button>
      <button type="button" class="x-btn" aria-label="Later" onClick={() => { ready = false; emit(); }}>×</button>
    </div>
  );
}
