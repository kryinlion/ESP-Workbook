import { openDB, type IDBPDatabase } from 'idb';

// One database per device. "docs" holds JSON documents keyed by name
// (e.g. "project" = workbook values; future modules add "timeline", "money", ...).
// "media" holds compressed image blobs referenced by id from any doc.
export interface MediaRec { id: string; blob: Blob; type: string; w: number; h: number; name?: string; createdAt: number }

let dbp: Promise<IDBPDatabase> | null = null;
export function db() {
  if (!dbp) {
    dbp = openDB('esp', 1, {
      upgrade(d) {
        d.createObjectStore('docs');
        d.createObjectStore('media', { keyPath: 'id' });
      },
    });
  }
  return dbp;
}

export async function getDoc<T>(key: string): Promise<T | undefined> { return (await db()).get('docs', key); }
export async function putDoc(key: string, val: unknown) { return (await db()).put('docs', val, key); }
export async function allDocs(): Promise<Record<string, unknown>> {
  const d = await db(); const keys = await d.getAllKeys('docs'); const out: Record<string, unknown> = {};
  for (const k of keys) out[String(k)] = await d.get('docs', k);
  return out;
}
export async function getMedia(id: string): Promise<MediaRec | undefined> { return (await db()).get('media', id); }
export async function putMedia(m: MediaRec) { return (await db()).put('media', m); }
export async function deleteMedia(id: string) { return (await db()).delete('media', id); }
export async function allMedia(): Promise<MediaRec[]> { return (await db()).getAll('media'); }
export async function clearAll() { const d = await db(); await d.clear('docs'); await d.clear('media'); }

export async function persistStorage(): Promise<boolean> {
  try { if (navigator.storage?.persist) return await navigator.storage.persist(); } catch { /* ignore */ }
  return false;
}
