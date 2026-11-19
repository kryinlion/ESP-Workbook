import { useState } from 'preact/hooks';
import { project, useProject, flush } from '../core/store';
import { clearAll, getMedia } from '../core/db';
import { backupNow, restoreBackup, shareOrDownload } from '../core/backup';

const safe = (s: string) => (s || '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

export function ExportScreen() {
  const p = useProject();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [eraseAsk, setEraseAsk] = useState(false);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

  const run = async (label: string, fn: () => Promise<any>) => {
    setBusy(label); setMsg('');
    try { await fn(); } catch (e: any) { console.error(e); setMsg(`⚠️ ${e.message || e}`); }
    setBusy('');
  };

  const officialPdf = () => run('pdf', async () => {
    await flush();
    const { fillWorkbook } = await import('../workbook/pdfExport');
    const tpl = await (await fetch(`${import.meta.env.BASE_URL}workbook-512-927.pdf`)).arrayBuffer();
    const bytes = await fillWorkbook(tpl, project().values, async (id) => {
      const m = await getMedia(id);
      return m ? { bytes: new Uint8Array(await m.blob.arrayBuffer()), type: m.type, w: m.w, h: m.h } : undefined;
    });
    const name = `Eagle_Workbook_${safe(p.values['cand.fullName']) || 'Scout'}.pdf`;
    const r = await shareOrDownload(new File([bytes as BlobPart], name, { type: 'application/pdf' }));
    if (r !== 'cancelled') setMsg(`✓ ${name} ready`);
  });

  const days = p.meta.lastBackupAt ? Math.floor((Date.now() - p.meta.lastBackupAt) / 864e5) : null;

  return (
    <div class="page">
      <div class="sec-head"><h1>Export & Backup</h1></div>

      <section class="card">
        <h2>Official workbook PDF</h2>
        <p class="intro">Fills in the real Workbook No. 512-927 with everything you've entered. Photos, drawings, and anything too long for a box are added as attachment pages at the end. Signatures you typed or drew are placed in the signature boxes.</p>
        <button class="btn wide" disabled={!!busy} onClick={officialPdf}>{busy === 'pdf' ? 'Building PDF…' : '📄 Create workbook PDF'}</button>
      </section>

      <section class="card">
        <h2>Presentations</h2>
        <p class="intro">PowerPoint and PDF slide decks from your entries and photos are coming in build phase 3.</p>
        <a class="btn ghost wide" href="#/decks">See what's planned</a>
      </section>

      <section class="card">
        <h2>Backup</h2>
        <p class="intro">Your work saves on this device automatically as you type. A backup is one file with everything, photos included. Save it to <b>iCloud Drive</b> or <b>Files</b>, or AirDrop it to your iPad and tap Restore there.</p>
        <p class="muted">{days === null ? 'No backup saved yet.' : days === 0 ? 'Last backup: today.' : `Last backup: ${days} day${days === 1 ? '' : 's'} ago.`}</p>
        <button class="btn wide" disabled={!!busy} onClick={() => run('backup', async () => { const r = await backupNow(); if (r !== 'cancelled') setMsg('✓ Backup saved'); })}>
          {busy === 'backup' ? 'Packing…' : '💾 Save backup'}
        </button>
        <label class="btn ghost wide file-btn">
          ⟲ Restore from a backup…
          <input type="file" accept=".zip,application/zip" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; (e.target as HTMLInputElement).value = ''; if (f) setRestoreFile(f); }} />
        </label>
        {restoreFile && (
          <div class="confirm">
            <p><b>Replace everything on this device</b> with <i>{restoreFile.name}</i>? Anything not in that backup will be lost.</p>
            <div class="row-btns">
              <button class="btn ghost" onClick={() => setRestoreFile(null)}>Cancel</button>
              <button class="btn danger" onClick={() => run('restore', async () => { await restoreBackup(restoreFile); setRestoreFile(null); setMsg('✓ Restored'); })}>Replace and restore</button>
            </div>
          </div>
        )}
      </section>

      {msg && <p class={`toast ${msg.startsWith('⚠') ? 'bad' : ''}`}>{msg}</p>}

      <section class="card">
        <h2>Start over on this device</h2>
        <p class="intro">Erases every answer, photo, and signature saved on this device. Save a backup first if you might want it back.</p>
        {!eraseAsk
          ? <button class="btn ghost wide" onClick={() => setEraseAsk(true)}>Erase all data on this device…</button>
          : (
            <div class="confirm">
              <p><b>Erase everything on this device?</b> This can't be undone unless you have a backup.</p>
              <div class="row-btns">
                <button class="btn ghost" onClick={() => setEraseAsk(false)}>Cancel</button>
                <button class="btn danger" onClick={() => run('erase', async () => { await clearAll(); location.hash = '#/'; location.reload(); })}>Erase everything</button>
              </div>
            </div>
          )}
      </section>

      {!standalone && (
        <section class="card">
          <h2>Install on iPhone / iPad</h2>
          <ol class="steps">
            <li>Open this page in <b>Safari</b>.</li>
            <li>Tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</li>
            <li>Always open the app from that icon. On iPhone and iPad, the icon keeps its own saved data, separate from a Safari tab.</li>
          </ol>
        </section>
      )}
    </div>
  );
}
