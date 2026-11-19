// Cloud backup (P6a) — Firebase Auth + Cloud Storage + Firestore (lite).
// Loaded lazily: the Firebase code only downloads once someone opens the cloud card or has signed in.
//
// Layout (owner-only per firestore.rules / storage.rules):
//   Storage   users/{uid}/backup/latest.json          every backup (placeholders, no photo bytes)
//             users/{uid}/backup/days/YYYY-MM-DD.json  one copy per day = history
//             users/{uid}/media/{id}.{jpg|png}         each photo, uploaded once, never deleted by the app
//   Firestore users/{uid}                              small status doc (last backup, counts)
import { initializeApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut as fbSignOut, type User,
} from 'firebase/auth';
import { getStorage, ref, uploadBytes, getBytes, listAll } from 'firebase/storage';
import { getFirestore, doc as fsDoc, setDoc } from 'firebase/firestore/lite';
import { firebaseConfig } from './config';
import { scrubValues, mergeRestore } from './scrub';
import { allDocs, allMedia, putDoc, putMedia } from '../core/db';
import { flush, loadProject } from '../core/store';
import { flushAllDocStores, loadAllDocStores } from '../core/docstore';

const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
const storage = getStorage(app);
const fs = getFirestore(app);

export interface CloudState {
  ready: boolean;          // auth state known
  email: string | null;
  busy: '' | 'backup' | 'restore';
  lastAt: number | null;   // last successful cloud backup (this device)
  error: string;
}
const LS = 'esp.cloud';
const saved = (() => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } })();
let state: CloudState = { ready: false, email: null, busy: '', lastAt: saved.lastAt ?? null, error: '' };
const subs = new Set<() => void>();
const set = (p: Partial<CloudState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
export const cloudState = () => state;
export function subscribeCloud(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
const persist = (p: Record<string, any>) => { try { localStorage.setItem(LS, JSON.stringify({ ...JSON.parse(localStorage.getItem(LS) || '{}'), ...p })); } catch { /* private mode */ } };

let user: User | null = null;
onAuthStateChanged(auth, (u) => {
  user = u;
  set({ ready: true, email: u?.email ?? null });
  persist({ on: !!u });
  if (u) schedule(4000);
});

// ---------- account ----------
const friendly = (e: any): string => {
  const c = String(e?.code || '');
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'That email and password don’t match.';
  if (c.includes('email-already-in-use')) return 'That email already has an account. Use “Sign in” instead.';
  if (c.includes('weak-password')) return 'Use a password of at least 6 characters.';
  if (c.includes('invalid-email')) return 'That doesn’t look like an email address.';
  if (c.includes('too-many-requests')) return 'Too many tries. Wait a few minutes and try again.';
  if (c.includes('network')) return 'No internet connection right now.';
  if (c.includes('admin-restricted-operation') || c.includes('operation-not-allowed')) return 'New accounts are turned off for this app. Ask your dad to set you up.';
  if (c.includes('unauthorized') || c.includes('permission')) return 'The cloud refused access (permission rules).';
  return e?.message || String(e);
};
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  set({ error: '' });
  try { return await fn(); } catch (e) { const m = friendly(e); set({ error: m }); throw new Error(m); }
}
export const signIn = (email: string, pw: string) => guard(() => signInWithEmailAndPassword(auth, email.trim(), pw));
export const signUp = (email: string, pw: string) => guard(() => createUserWithEmailAndPassword(auth, email.trim(), pw));
export const resetPassword = (email: string) => guard(() => sendPasswordResetEmail(auth, email.trim()));
export const signOut = () => guard(async () => { await fbSignOut(auth); persist({ hash: null }); });

// ---------- backup ----------
async function sha(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
}
const ext = (type: string) => (type === 'image/png' ? 'png' : 'jpg');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Back up now. Skips the upload when nothing changed since the last cloud backup (unless force). */
export async function backupToCloud(force = false): Promise<'done' | 'unchanged' | 'skipped'> {
  if (!user || state.busy) return 'skipped';
  const uid = user.uid;
  set({ busy: 'backup', error: '' });
  try {
    await flush(); await flushAllDocStores();
    const docs: Record<string, any> = await allDocs();
    const media = await allMedia();
    const proj = docs.project;
    const { values, skipMedia } = scrubValues(proj?.values || {});
    const cloudDocs = { ...docs, project: proj ? { ...proj, values, meta: { ...proj.meta, backupSnoozeUntil: undefined } } : proj };
    const keep = media.filter((m) => !skipMedia.includes(m.id));
    const mediaMeta = keep.map((m) => ({ id: m.id, type: m.type, w: m.w, h: m.h, name: m.name, createdAt: m.createdAt, path: `media/${m.id}.${ext(m.type)}` }));
    // hash ignores fields that change on every save but carry no answers
    const hash = await sha(JSON.stringify([cloudDocs.project?.values, Object.keys(docs).filter((k) => k !== 'project').map((k) => docs[k]), mediaMeta.map((m) => m.id)]));
    const prev = JSON.parse(localStorage.getItem(LS) || '{}');
    if (!force && prev.hash === hash && prev.uid === uid) { set({ busy: '' }); return 'unchanged'; }

    // photos: upload only the ones the cloud doesn't have yet
    const have = new Set((await listAll(ref(storage, `users/${uid}/media`))).items.map((i) => i.name));
    for (const m of keep) {
      const name = `${m.id}.${ext(m.type)}`;
      if (!have.has(name)) await uploadBytes(ref(storage, `users/${uid}/media/${name}`), m.blob, { contentType: m.type });
    }
    const payload = JSON.stringify({ app: 'esp', format: 1, createdAt: new Date().toISOString(), docs: cloudDocs, media: mediaMeta });
    const blob = new Blob([payload], { type: 'application/json' });
    await uploadBytes(ref(storage, `users/${uid}/backup/latest.json`), blob, { contentType: 'application/json' });
    await uploadBytes(ref(storage, `users/${uid}/backup/days/${today()}.json`), blob, { contentType: 'application/json' });
    const now = Date.now();
    await setDoc(fsDoc(fs, 'users', uid), { lastBackupAt: now, photos: keep.length, bytes: payload.length, format: 1 }, { merge: true });
    persist({ hash, uid, lastAt: now });
    set({ busy: '', lastAt: now });
    return 'done';
  } catch (e) {
    set({ busy: '', error: friendly(e) });
    throw e;
  }
}

// ---------- restore ----------
/** What's in the cloud (for the confirm screen). */
export async function cloudInfo(): Promise<{ createdAt: string; photos: number } | null> {
  if (!user) return null;
  try {
    const j = JSON.parse(new TextDecoder().decode(await getBytes(ref(storage, `users/${user.uid}/backup/latest.json`))));
    return { createdAt: j.createdAt, photos: j.media?.length || 0 };
  } catch (e: any) {
    if (String(e?.code).includes('object-not-found')) return null;
    throw new Error(friendly(e));
  }
}

/**
 * Restore the latest cloud backup onto this device.
 * - Answers come from the cloud; protected fields keep this device's real values (placeholders never overwrite).
 * - Photos on this device are kept; cloud photos are added.
 * - Returns the ids that need re-entering (also saved to project.meta.reenter for the Home checklist).
 */
export async function restoreFromCloud(): Promise<string[]> {
  if (!user) throw new Error('Sign in first.');
  const uid = user.uid;
  set({ busy: 'restore', error: '' });
  try {
    await flush(); await flushAllDocStores();
    const j = JSON.parse(new TextDecoder().decode(await getBytes(ref(storage, `users/${uid}/backup/latest.json`))));
    if (j.app !== 'esp') throw new Error('The cloud backup is not an Eagle Project backup.');
    const local: Record<string, any> = await allDocs();
    const have = new Set((await allMedia()).map((m) => m.id));
    for (const m of j.media || []) {
      if (have.has(m.id)) continue;
      const bytes = await getBytes(ref(storage, `users/${uid}/${m.path}`));
      await putMedia({ id: m.id, blob: new Blob([bytes], { type: m.type }), type: m.type, w: m.w, h: m.h, name: m.name, createdAt: m.createdAt });
    }
    const cp = j.docs.project;
    const lp = local.project;
    const { values, reenter } = mergeRestore(cp?.values || {}, lp?.values || {});
    for (const [k, v] of Object.entries<any>(j.docs)) {
      if (k === 'project') continue;
      await putDoc(k, v);
    }
    await putDoc('project', {
      ...(cp || lp),
      values,
      updatedAt: Date.now(),
      meta: { ...(cp?.meta || {}), ...(lp?.meta ? { lastBackupAt: lp.meta.lastBackupAt, createdAt: lp.meta.createdAt } : {}), reenter },
    });
    await loadProject();
    await loadAllDocStores();
    set({ busy: '' });
    return reenter;
  } catch (e) {
    set({ busy: '', error: friendly(e) });
    throw e;
  }
}

// ---------- automatic ----------
let timer: number | undefined;
function schedule(ms: number) {
  clearTimeout(timer);
  timer = window.setTimeout(() => { backupToCloud().catch(() => {}).finally(() => schedule(3 * 60_000)); }, ms);
}
if (typeof document !== 'undefined') {
  // leaving the app → try to back up right away (iOS may suspend us, so this is best-effort)
  document.addEventListener('visibilitychange', () => { if (document.hidden && user) backupToCloud().catch(() => {}); });
}
export function startAuto() { /* importing this module starts the auth listener + schedule */ }
