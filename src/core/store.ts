import { useEffect, useState } from 'preact/hooks';
import { getDoc, putDoc } from './db';

// The workbook project document. Values are keyed by schema field id.
export interface ProjectDoc {
  schema: 1;
  id: string;
  values: Record<string, any>;
  updatedAt: number;
  meta: { lastBackupAt?: number; createdAt: number };
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

export function setValue(id: string, v: any) {
  doc = { ...doc, values: { ...doc.values, [id]: v }, updatedAt: Date.now() };
  saveState = 'saving';
  emit();
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, 350);
}

export function setMeta(m: Partial<ProjectDoc['meta']>) {
  doc = { ...doc, meta: { ...doc.meta, ...m } };
  emit();
  flush();
}

export function replaceProject(d: ProjectDoc) { doc = d; emit(); return flush(); }

export function flush() {
  clearTimeout(saveTimer);
  const snapshot = doc;
  saving = saving.then(() => putDoc(KEY, snapshot)).then(() => { if (doc === snapshot) { saveState = 'saved'; emit(); } });
  return saving;
}

// Save immediately when the app is backgrounded/closed (iOS kills PWAs freely).
if (typeof window !== 'undefined') {
  const now = () => { if (saveState === 'saving') flush(); };
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
