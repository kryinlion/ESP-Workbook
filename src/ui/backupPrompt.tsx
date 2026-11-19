import { useEffect, useState } from 'preact/hooks';
import { makeBackup } from '../core/backup';
import { project, setMeta, useProject } from '../core/store';
import { overallProgress } from '../workbook/progress';

// One-button weekly backup.
// The backup file is packed the moment the screen opens, so the single tap goes
// straight to the iPhone/iPad share sheet (iOS only allows the share sheet right
// after a tap). In the share sheet he picks "Save to Files" → iCloud Drive.

const WEEK = 7 * 864e5;
const DAY = 864e5;

let openFlag = false;
const subs = new Set<() => void>();
export function openBackup() { openFlag = true; subs.forEach((f) => f()); }
function closeBackup() { openFlag = false; subs.forEach((f) => f()); }

export function backupDue(): boolean {
  const p = project();
  if (overallProgress(p.values).done === 0) return false; // nothing to protect yet
  const last = p.meta.lastBackupAt || p.meta.createdAt;
  const snooze = p.meta.backupSnoozeUntil || 0;
  return Date.now() - last >= WEEK && Date.now() >= snooze;
}

export function BackupPrompt() {
  const p = useProject();
  const [, f] = useState(0);
  useEffect(() => { const s = () => f((n) => n + 1); subs.add(s); return () => { subs.delete(s); }; }, []);
  // weekly auto-open, once per app launch
  useEffect(() => { const t = setTimeout(() => { if (backupDue()) openBackup(); }, 1200); return () => clearTimeout(t); }, []);
  if (!openFlag) return null;
  return <Sheet last={p.meta.lastBackupAt} />;
}

function Sheet({ last }: { last?: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<'packing' | 'ready' | 'done' | 'error'>('packing');
  const [err, setErr] = useState('');

  useEffect(() => {
    makeBackup().then((f) => { setFile(f); setState('ready'); }).catch((e) => { setErr(String(e?.message || e)); setState('error'); });
  }, []);

  const go = async () => {
    if (!file) return;
    const nav: any = navigator;
    const download = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    };
    try {
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try { await nav.share({ files: [file], title: 'Eagle Project backup' }); }
        catch (e: any) { if (e?.name === 'AbortError') return; download(); } // closed the sheet → stay; refused → save directly
      } else download();
      setMeta({ lastBackupAt: Date.now(), backupSnoozeUntil: 0 });
      setState('done');
      setTimeout(closeBackup, 2200);
    } catch (e: any) {
      setErr(String(e?.message || e)); setState('error');
    }
  };

  const later = () => { setMeta({ backupSnoozeUntil: Date.now() + DAY }); closeBackup(); };
  const days = last ? Math.floor((Date.now() - last) / DAY) : null;

  return (
    <div class="bk-bg" role="dialog" aria-modal="true" aria-labelledby="bk-title">
      <div class="bk">
        {state === 'done' ? (
          <>
            <div class="bk-icon ok">✓</div>
            <h2 id="bk-title">Backed up</h2>
            <p class="bk-sub">Your project is safe.</p>
          </>
        ) : (
          <>
            <div class="bk-icon">
              <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
                <path d="M24 4 8 10v12c0 10.5 6.8 18.6 16 22 9.2-3.4 16-11.5 16-22V10L24 4Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" />
                <path d="m16 24 6 6 11-12" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <h2 id="bk-title">Back up your project</h2>
            <p class="bk-sub">{days === null ? 'You haven’t saved a backup yet.' : `Last backup: ${days} day${days === 1 ? '' : 's'} ago.`}</p>
            <button type="button" class="bk-go" disabled={state !== 'ready'} onClick={go}>
              {state === 'packing' ? 'Getting ready…' : 'Back up now'}
            </button>
            <p class="bk-hint">Then tap <b>Save to Files</b> → <b>iCloud Drive</b> → <b>Save</b>.</p>
            {state === 'error' && <p class="bk-err">Something went wrong: {err}</p>}
            <button type="button" class="bk-later" onClick={later}>Not now</button>
          </>
        )}
      </div>
    </div>
  );
}
