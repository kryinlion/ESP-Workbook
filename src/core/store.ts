import { useEffect, useState } from 'preact/hooks';
import { getDoc, putDoc } from './db';

// The workbook project document. Values are keyed by schema field id.
export interface ProjectDoc {
  schema: 1;
  id: string;
  values: Record<string, any>;
  updatedAt: number;
  meta: { lastBackupAt?: number; backupSnoozeUntil?: number; createdAt: number; reenter?: string[] };
}

const KEY = 'project';
let doc: ProjectDoc = blank();
const subs = new Set<() => void>();
let saveTimer: number | undefined;
let saving = Promise.resolve();
export let saveState: 'saved' | 'saving' = 'saved';

function blank(): ProjectDoc {
  return { schema: 1, id: crypto.randomUUID(), values: {}, updatedAt: Date.now(), meta: { createdAt: Date.now() } };
}

export async function loadProject() {
  const d = await getDoc<ProjectDoc>(KEY);
  if (d) doc = d;
  else await putDoc(KEY, doc);
  emit();
}

export function project() { return doc; }
export function values() { return doc.values; }

function emit() { subs.forEach((f) => f()); }
export function subscribe(f: () => void) { subs.add(f); return () => subs.delete(f); }

// Field-level saving. Only the boxes THIS copy of the app changed are written, merged into whatever
// is in storage right now — so another copy (desktop preview frames, a second tab) can never be
// overwritten with stale answers. Other copies are told to reload via a BroadcastChannel.
const dirtyVals = new Set<string>();
const dirtyMeta = new Set<string>();
let fullReplace = false;
const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('esp-docs') : null;
const me = Math.random().toString(36).slice(2);

export function setValue(id: string, v: any) {
  doc = { ...doc, values: { ...doc.values, [id]: v }, updatedAt: Date.now() };
  dirtyVals.add(id);
  saveState = 'saving';
  emit();
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, 350);
}

export function setMeta(m: Partial<ProjectDoc['meta']>) {
  doc = { ...doc, meta: { ...doc.meta, ...m } };
  Object.keys(m).forEach((k) => dirtyMeta.add(k));
  emit();
  flush();
}

/** Replace the whole project (restore, sync). Still merges nothing — this is meant to win. */
export function replaceProject(d: ProjectDoc) { doc = d; fullReplace = true; emit(); return flush(); }

function mergeInto(stored: ProjectDoc | undefined, mine: ProjectDoc, vals: Set<string>, meta: Set<string>): ProjectDoc {
  if (!stored) return mine;
  const values = { ...stored.values };
  for (const k of vals) { if (mine.values[k] === undefined) delete values[k]; else values[k] = mine.values[k]; }
  const m: any = { ...stored.meta };
  for (const k of meta) { const v = (mine.meta as any)[k]; if (v === undefined) delete m[k]; else m[k] = v; }
  return { ...stored, values, meta: m, updatedAt: Math.max(stored.updatedAt || 0, mine.updatedAt || 0) };
}

export function flush() {
  clearTimeout(saveTimer);
  const vals = new Set(dirtyVals), meta = new Set(dirtyMeta), full = fullReplace;
  dirtyVals.clear(); dirtyMeta.clear(); fullReplace = false;
  const mine = doc;
  saving = saving.then(async () => {
    if (!full && !vals.size && !meta.size) return;
    const stored = full ? undefined : await getDoc<ProjectDoc>(KEY);
    const merged = full ? mine : mergeInto(stored, mine, vals, meta);
    await putDoc(KEY, merged);
    // keep anything typed while we were saving, on top of the merged copy
    if (doc !== mine) doc = mergeInto(merged, doc, dirtyVals, dirtyMeta);
    else doc = merged;
    chan?.postMessage({ key: KEY, from: me });
  }).then(() => { if (!dirtyVals.size && !dirtyMeta.size) { saveState = 'saved'; emit(); } });
  return saving;
}

// Another copy of the app saved: reload from storage, keeping our own unsaved typing on top.
chan?.addEventListener('message', async (e: MessageEvent) => {
  if (e.data?.from === me || e.data?.key !== KEY) return;
  const stored = await getDoc<ProjectDoc>(KEY);
  if (!stored) return;
  doc = mergeInto(stored, doc, dirtyVals, dirtyMeta);
  emit();
});

// Save immediately when the app is backgrounded/closed (iOS kills PWAs freely).
if (typeof window !== 'undefined') {
  const now = () => { if (dirtyVals.size || dirtyMeta.size || fullReplace) flush(); };
  document.addEventListener('visibilitychange', now);
  window.addEventListener('pagehide', now);
}

export function useProject() {
  const [, set] = useState(0);
  useEffect(() => subscribe(() => set((n) => n + 1)), []);
  return doc;
}

export function useValue<T = any>(id: string): [T, (v: T) => void] {
  const d = useProject();
  return [d.values[id], (v: T) => setValue(id, v)];
}
