import JSZip from 'jszip';
import { allDocs, allMedia, clearAll, putDoc, putMedia } from './db';
import { flush, loadProject, setMeta } from './store';
import { flushAllDocStores, loadAllDocStores } from './docstore';

// Backup = one .zip containing every module's documents + all images.
// Format is deliberately simple so future sync / native builds can read it.
export async function makeBackup(): Promise<File> {
  await flush();
  await flushAllDocStores();
  const zip = new JSZip();
  const docs = await allDocs();
  const media = await allMedia();
  zip.file('manifest.json', JSON.stringify({ app: 'esp', format: 1, createdAt: new Date().toISOString(), docs: Object.keys(docs), media: media.length }, null, 2));
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
  const docs = JSON.parse(await zip.file('docs.json')!.async('string'));
  const meta = JSON.parse(await zip.file('media.json')!.async('string'));
  await clearAll();
  for (const [k, v] of Object.entries(docs)) await putDoc(k, v);
  for (const m of meta) {
    const data = await zip.file(m.file)!.async('blob');
    await putMedia({ id: m.id, blob: new Blob([data], { type: m.type }), type: m.type, w: m.w, h: m.h, name: m.name, createdAt: m.createdAt });
  }
  await loadProject();
  await loadAllDocStores();
}
