import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { flush } from '../core/store';
import { flushAllDocStores } from '../core/docstore';

// "Update ready — tap to refresh": a new version waits until Colin taps, so it never swaps in
// mid-sentence. Everything is saved first; the new version then makes a safety copy on startup.
let ready = false;
let apply: ((reload?: boolean) => Promise<void>) | null = null;
let regRef: ServiceWorkerRegistration | undefined;
const showIfWaiting = () => { if (regRef?.waiting && !ready) { ready = true; emit(); } };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function startUpdateWatch() {
  if (!('serviceWorker' in navigator)) return;
  apply = registerSW({
    onNeedRefresh() { ready = true; emit(); },
    onRegisteredSW(_url, reg) {
      // check for a new version every hour while the app is open, and whenever it comes back to the front
      // (a version already downloaded and waiting re-shows the banner even if × was tapped earlier)
      if (!reg) return;
      regRef = reg;
      showIfWaiting();
      setInterval(() => { showIfWaiting(); reg.update().catch(() => {}); }, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { showIfWaiting(); reg.update().catch(() => {}); } });
    },
  });
}

/** Export & Backup → "Check for updates". Resolves 'ready' (banner shown), 'current', or 'offline'. */
export async function checkForUpdate(): Promise<'ready' | 'current' | 'offline'> {
  if (!regRef) return 'offline';
  try { await regRef.update(); } catch { return 'offline'; }
  // a found update takes a moment to download before it is "waiting"
  for (let i = 0; i < 20 && (regRef.installing || !regRef.waiting); i++) {
    if (regRef.waiting) break;
    if (!regRef.installing && i > 2) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (regRef.waiting) { ready = true; emit(); return 'ready'; }
  return 'current';
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
