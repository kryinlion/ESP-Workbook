import { useEffect, useState } from 'preact/hooks';
import { listSnapshots, restoreSnapshot, type Snapshot } from '../core/upgrade';

// Export & Backup → "Safety copies": automatic copies saved before each app update and before any
// restore. Rolling back puts every answer back exactly as it was then (photos are never touched).
export function SafetyCopies() {
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null);
  const [ask, setAsk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { listSnapshots().then(setSnaps).catch(() => setSnaps([])); }, []);
  if (!snaps) return null;
  const when = (t: number) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const count = (s: Snapshot) => Object.keys(s.docs.project?.values || {}).length;
  return (
    <section class="card">
      <h2>Safety copies</h2>
      <p class="intro">Saved automatically on this device before each app update and before any restore. If something ever looks wrong after an update, roll back here.</p>
      {!snaps.length && <p class="muted">None yet. The first one is saved the next time the app updates.</p>}
      {snaps.map((s) => (
        <div class="safe-row">
          <span><b>{when(s.at)}</b><small>{count(s)} answers saved</small></span>
          {ask === s.key
            ? <span class="row-btns" style={{ margin: 0 }}>
                <button type="button" class="btn ghost small" onClick={() => setAsk(null)}>Cancel</button>
                <button type="button" class="btn danger small" disabled={busy} onClick={async () => { setBusy(true); await restoreSnapshot(s.key); location.reload(); }}>{busy ? 'Restoring…' : 'Roll back'}</button>
              </span>
            : <button type="button" class="btn ghost small" onClick={() => setAsk(s.key)}>Roll back…</button>}
        </div>
      ))}
      {ask && <p class="hint">Rolling back replaces your current answers with this copy. A safety copy of what's here now is NOT made, so only do this if something went wrong.</p>}
    </section>
  );
}
