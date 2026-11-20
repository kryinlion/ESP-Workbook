import JSZip from 'jszip';
import { allDocs, allMedia, putDoc, putMedia } from './db';
import { flush, loadProject, setMeta } from './store';
import { flushAllDocStores, loadAllDocStores } from './docstore';
import { DATA_VERSION, migrateDocs, safetyCopy } from './upgrade';
import { db } from './db';

// Backup = one .zip containing every module's documents + all images.
// Format is deliberately simple so future sync / native builds can read it.
export async function makeBackup(): Promise<File> {
  await flush();
  await flushAllDocStores();
  const zip = new JSZip();
  const docs = await allDocs();
  const media = await allMedia();
  zip.file('manifest.json', JSON.stringify({ app: 'esp', format: 1, dataVersion: DATA_VERSION, createdAt: new Date().toISOString(), docs: Object.keys(docs), media: media.length }, null, 2));
  zip.file('docs.json', JSON.stringify(docs));
  const meta: any[] = [];
  for (const m of media) {
    const ext = m.type === 'image/png' ? 'png' : 'jpg';
    zip.file(`media/${m.id}.${ext}`, m.blob);
    meta.push({ id: m.id, type: m.type, w: m.w, h: m.h, name: m.name, createdAt: m.createdAt, file: `media/${m.id}.${ext}` });
  }
  zip.file('media.json', JSON.stringify(meta));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  return new File([blob], `Eagle_Project_backup_${stamp}.zip`, { type: 'application/zip' });
}

export async function shareOrDownload(file: File) {
  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title: file.name }); return 'shared'; }
    catch (e: any) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  return 'downloaded';
}

export async function backupNow() {
  const f = await makeBackup();
  const r = await shareOrDownload(f);
  if (r !== 'cancelled') setMeta({ lastBackupAt: Date.now() });
  return r;
}

export async function restoreBackup(file: File) {
  const zip = await JSZip.loadAsync(file);
  const man = zip.file('manifest.json');
  if (!man) throw new Error("That file isn't an Eagle Project backup.");
  const manifest = JSON.parse(await man.async('string'));
  // an older backup is brought up to today's format before it's written (never loses answers)
  const docs = migrateDocs(JSON.parse(await zip.file('docs.json')!.async('string')), manifest.dataVersion ?? 1).docs;
  const meta = JSON.parse(await zip.file('media.json')!.async('string'));
  await safetyCopy();                       // what was here before can be brought back (Export → Safety copies)
  // clear answers + photos, but keep device bookkeeping (safety copies, sync state, version)
  const d = await db();
  for (const k of await d.getAllKeys('docs')) if (!String(k).startsWith('_')) await d.delete('docs', k);
  await d.clear('media');
  for (const [k, v] of Object.entries(docs)) await putDoc(k, v);
  for (const m of meta) {
    const data = await zip.file(m.file)!.async('blob');
    await putMedia({ id: m.id, blob: new Blob([data], { type: m.type }), type: m.type, w: m.w, h: m.h, name: m.name, createdAt: m.createdAt });
  }
  await loadProject();
  await loadAllDocStores();
}
