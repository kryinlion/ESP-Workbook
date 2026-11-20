import { useEffect, useState } from 'preact/hooks';
import { getDoc, putDoc } from './db';

// Generic per-module document store (timeline, money, meetings, ...).
// Same save behavior as the workbook: debounced autosave + flush when backgrounded.
export interface DocStore<T> {
  key: string;
  load(): Promise<void>;
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  flush(): Promise<void>;
  use(): T;
}

const registry: DocStore<any>[] = [];
// Other copies of the app (desktop preview frames, a second tab) announce saves here.
const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('esp-docstores') : null;
const me = Math.random().toString(36).slice(2);
export const docStores = () => registry;
export async function loadAllDocStores() { for (const s of registry) await s.load(); }
export async function flushAllDocStores() { for (const s of registry) await s.flush(); }

export function createDocStore<T>(key: string, blank: () => T, migrate?: (d: any) => T): DocStore<T> {
  let doc: T = blank();
  let timer: number | undefined;
  let saving = Promise.resolve();
  let dirty = false;
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());
  const store: DocStore<T> = {
    key,
    async load() {
      const d = await getDoc<T>(key);
      doc = d ? (migrate ? migrate(d) : d) : blank();
      emit();
    },
    get: () => doc,
    set(next) {
      doc = typeof next === 'function' ? (next as (p: T) => T)(doc) : next;
      dirty = true;
      emit();
      clearTimeout(timer);
      timer = window.setTimeout(() => store.flush(), 350);
    },
    flush() {
      clearTimeout(timer);
      if (!dirty) return saving;
      dirty = false;
      const snap = doc;
      saving = saving.then(() => putDoc(key, snap)).then(() => { chan?.postMessage({ key, from: me }); });
      return saving;
    },
    use() {
      const [, f] = useState(0);
      useEffect(() => { const s = () => f((n) => n + 1); subs.add(s); return () => { subs.delete(s); }; }, []);
      return doc;
    },
  };
  // another copy saved this doc: reload it unless we have unsaved changes of our own
  chan?.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.from === me || e.data?.key !== key || dirty) return;
    store.load();
  });
  registry.push(store);
  return store;
}

if (typeof window !== 'undefined') {
  const now = () => { flushAllDocStores(); };
  document.addEventListener('visibilitychange', now);
  window.addEventListener('pagehide', now);
}
