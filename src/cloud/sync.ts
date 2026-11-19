// Sync (P6b) — keeps iPhone and iPad in step through Firestore.
//   Firestore users/{uid}/entries/{key}: { k, v (JSON), del, at (server time), dev }
// Each device remembers the last state both sides agreed on ("base", in IndexedDB "_sync")
// and the newest server time it has seen. Every cycle: pull entries newer than that, three-way
// merge with this device's data (src/cloud/syncMerge.ts), apply what came down, send what changed here.
import { collection, doc, getDocs, query, where, writeBatch, serverTimestamp, Timestamp, type Firestore } from 'firebase/firestore/lite';
import { ref, uploadBytes, getBytes, listAll, type FirebaseStorage } from 'firebase/storage';
import { DELETED, fromEntries, merge, missingHere, same, toEntries, withSharedFlags, type Entries } from './syncMerge';
import { scrubValues } from './scrub';
import { allDocs, allMedia, getDoc, putDoc, putMedia } from '../core/db';
import { flush, project, replaceProject, setMeta } from '../core/store';
import { flushAllDocStores } from '../core/docstore';
import { timeline } from '../timeline/model';
import { meetingsStore } from '../meetings/model';
import { moneyStore } from '../money/model';

interface SyncState { uid: string; base: Entries; cursor: number; joined: boolean }
const KEY = '_sync';
const DEVICE = (() => { try { let d = localStorage.getItem('esp.device'); if (!d) { d = crypto.randomUUID().slice(0, 8); localStorage.setItem('esp.device', d); } return d; } catch { return 'dev'; } })();
const ext = (type: string) => (type === 'image/png' ? 'png' : 'jpg');

export interface SyncStatus { on: boolean; running: boolean; lastAt: number | null; error: string; pulled: number; pushed: number }

export function createSync(fs: Firestore, storage: FirebaseStorage, onStatus: (s: Partial<SyncStatus>) => void) {
  let uid: string | null = null;
  let running = false;
  let mediaCheckedAt = 0;

  async function load(): Promise<SyncState> {
    const s = await getDoc<SyncState>(KEY);
    return s && s.uid === uid ? s : { uid: uid!, base: {}, cursor: 0, joined: false };
  }

  async function docsNow() {
    await flush(); await flushAllDocStores();
    return await allDocs() as Record<string, any>;
  }

  async function cycle(): Promise<void> {
    if (!uid || running) return;
    running = true; onStatus({ running: true, error: '' });
    try {
      const st = await load();
      const docs = await docsNow();
      const local = withSharedFlags(toEntries(docs), st.base);

      // 1. pull what other devices changed
      const col = collection(fs, 'users', uid, 'entries');
      const snap = await getDocs(query(col, where('at', '>', Timestamp.fromMillis(st.cursor))));
      const pulled: Entries = {};
      let cursor = st.cursor;
      snap.forEach((d) => {
        const x = d.data() as any;
        pulled[x.k] = x.del ? DELETED : JSON.parse(x.v);
        const ms = (x.at as Timestamp)?.toMillis?.() ?? 0;
        if (ms > cursor) cursor = ms;
      });

      // 2. merge
      const { result, push, changedHere } = merge(local, st.base, pulled);

      // 3. apply what came down — unless Colin typed something while we were working (try again next cycle)
      if (changedHere) {
        const now = withSharedFlags(toEntries(await docsNow()), st.base);
        if (!same(now, local)) { running = false; onStatus({ running: false }); return; }
        const next = fromEntries(result, docs);
        if (!same(next.project.values, docs.project?.values)) await replaceProject({ ...project(), values: next.project.values, updatedAt: Date.now() });
        if (!same(next.timeline, docs.timeline)) timeline.set(next.timeline as any);
        if (!same(next.meetings, docs.meetings)) meetingsStore.set(next.meetings as any);
        if (!same(next.money, docs.money)) moneyStore.set(next.money as any);
        await flushAllDocStores();
      }

      // 4. send what changed here
      for (let i = 0; i < push.length; i += 400) {
        const batch = writeBatch(fs);
        for (const k of push.slice(i, i + 400)) {
          const del = !(k in result);
          const v = del ? null : JSON.stringify(result[k]);
          if (v && v.length > 900_000) continue; // Firestore limit is 1 MB per entry
          batch.set(doc(col, encodeURIComponent(k)), { k, v, del, at: serverTimestamp(), dev: DEVICE });
        }
        await batch.commit();
      }

      // 5. first time on this device: list the private fields to type in here
      if (!st.joined) {
        const miss = missingHere(result, project().values);
        if (miss.length) setMeta({ reenter: [...new Set([...(project().meta.reenter || []), ...miss])] });
      }

      await putDoc(KEY, { uid, base: result, cursor, joined: true } satisfies SyncState);

      // 6. photos: send new ones, fetch ones added on the other device (at most every 2 minutes, or when something came down)
      if (changedHere || push.length || Date.now() - mediaCheckedAt > 120_000) { await syncMedia(docs); mediaCheckedAt = Date.now(); }

      onStatus({ running: false, lastAt: Date.now(), pulled: Object.keys(pulled).length, pushed: push.length });
    } catch (e: any) {
      onStatus({ running: false, error: e?.code ? String(e.code).replace('firestore/', '').replace('storage/', '') : String(e?.message || e) });
    }
    running = false;
  }

  async function syncMedia(docs: Record<string, any>) {
    const { skipMedia } = scrubValues(docs.project?.values || {}); // drawn signatures stay on this device
    const cloud = new Map((await listAll(ref(storage, `users/${uid}/media`))).items.map((i) => [i.name.replace(/\.(jpg|png)$/, ''), i.name]));
    const mine = await allMedia();
    const have = new Set(mine.map((m) => m.id));
    for (const m of mine) {
      if (skipMedia.includes(m.id) || cloud.has(m.id)) continue;
      await uploadBytes(ref(storage, `users/${uid}/media/${m.id}.${ext(m.type)}`), m.blob, { contentType: m.type });
    }
    for (const [id, name] of cloud) {
      if (have.has(id)) continue;
      const bytes = await getBytes(ref(storage, `users/${uid}/media/${name}`));
      const type = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const blob = new Blob([bytes], { type });
      let w = 0, h = 0;
      try { const b = await createImageBitmap(blob); w = b.width; h = b.height; } catch { /* still store it */ }
      await putMedia({ id, blob, type, w, h, createdAt: Date.now() });
    }
  }

  let timer: number | undefined;
  const tick = () => { clearTimeout(timer); timer = window.setTimeout(async () => { if (!document.hidden) await cycle(); tick(); }, 30_000); };
  document.addEventListener('visibilitychange', () => { if (uid) cycle(); });

  return {
    start(u: string) { uid = u; onStatus({ on: true }); setTimeout(cycle, 1500); tick(); },
    stop() { uid = null; clearTimeout(timer); onStatus({ on: false }); },
    now: cycle,
  };
}
