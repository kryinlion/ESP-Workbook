// Update safety (docs/ROADMAP.md "Update safety", rules 2, 4, 5).
//
//  • DATA_VERSION is the shape of Colin's saved data. Today = 1.
//  • When a change needs saved data reshaped, add a MIGRATION { to: 2, … } below and bump DATA_VERSION.
//    Migrations only ADD or TRANSFORM — they never drop answers. `npm run test:upgrade` runs every
//    migration over the saved sample backups in scripts/fixtures/ and fails if any answer goes missing.
//  • Every time a NEW VERSION of the app starts for the first time (or data is about to be upgraded),
//    a safety copy of all answers is saved on the device first ("_snap_…", newest 3 kept).
//    Export & Backup → "Safety copies" can roll back to one.

import { allDocs, getDoc, putDoc, db } from './db';

export const DATA_VERSION = 1;

export interface Migration { to: number; note: string; run: (docs: Record<string, any>) => Record<string, any> }

// Add future upgrades here, oldest first. Example (do not uncomment):
// { to: 2, note: 'Split cand.phone into phone + mobile', run: (d) => ({ ...d, project: { ...d.project, values: { ...d.project.values, 'cand.mobile': d.project.values['cand.phone'] } } }) },
export const MIGRATIONS: Migration[] = [];

/** Pure: bring a set of docs from `from` up to DATA_VERSION. Used at startup, on restore, and in tests. */
export function migrateDocs(docs: Record<string, any>, from: number, list: Migration[] = MIGRATIONS): { docs: Record<string, any>; to: number } {
  let out = docs, v = from;
  for (const m of list) if (m.to > v) { out = m.run(JSON.parse(JSON.stringify(out))); v = m.to; }
  return { docs: out, to: Math.max(v, from) };
}

declare const __APP_BUILD__: string;
export const APP_BUILD = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev';

interface Meta { dataVersion: number; appBuild: string }
export interface Snapshot { key: string; at: number; fromBuild: string; toBuild: string; dataVersion: number; docs: Record<string, any> }
const SNAP = '_snap_';
const KEEP = 3;

/** Runs before the app loads its data. Never throws: on any problem the data is left exactly as it was. */
export async function prepareData(): Promise<{ upgraded: boolean; snapshot?: string; error?: string }> {
  try {
    const meta = await getDoc<Meta>('_meta');
    const docs = await allDocs();
    const hasData = Object.keys(docs).length > 0;
    const from = meta?.dataVersion ?? 1;              // data saved before this feature existed is version 1
    const newBuild = !meta || meta.appBuild !== APP_BUILD;
    const needsMigration = from < DATA_VERSION;
    let snapshot: string | undefined;
    if (hasData && (newBuild || needsMigration)) snapshot = await saveSnapshot(docs, meta?.appBuild ?? 'unknown', from);
    if (needsMigration) {
      const { docs: next } = migrateDocs(docs, from);
      for (const [k, v] of Object.entries(next)) await putDoc(k, v);
    }
    await putDoc('_meta', { dataVersion: DATA_VERSION, appBuild: APP_BUILD } satisfies Meta);
    return { upgraded: needsMigration, snapshot };
  } catch (e: any) {
    console.error('prepareData', e);
    return { upgraded: false, error: String(e?.message || e) };
  }
}

async function saveSnapshot(docs: Record<string, any>, fromBuild: string, dataVersion: number): Promise<string> {
  const key = `${SNAP}${Date.now()}`;
  await putDoc(key, { key, at: Date.now(), fromBuild, toBuild: APP_BUILD, dataVersion, docs } satisfies Snapshot);
  const all = (await listSnapshots()).slice(KEEP);       // newest first → drop the rest
  const d = await db();
  for (const s of all) await d.delete('docs', s.key);
  return key;
}

/** Save a safety copy right now (e.g. before restoring a backup over the current answers). */
export async function safetyCopy(): Promise<string | undefined> {
  const docs = await allDocs();
  if (!Object.keys(docs).length) return;
  const meta = await getDoc<Meta>('_meta');
  return saveSnapshot(docs, meta?.appBuild ?? APP_BUILD, meta?.dataVersion ?? DATA_VERSION);
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const d = await db();
  const keys = (await d.getAllKeys('docs')).map(String).filter((k) => k.startsWith(SNAP));
  const snaps: Snapshot[] = [];
  for (const k of keys) { const s = await d.get('docs', k); if (s) snaps.push(s); }
  return snaps.sort((a, b) => b.at - a.at);
}

/** Put every answer back the way it was in a safety copy (photos are never touched by updates). */
export async function restoreSnapshot(key: string) {
  const s = await getDoc<Snapshot>(key);
  if (!s) throw new Error('That safety copy is gone.');
  const { docs } = migrateDocs(s.docs, s.dataVersion);   // a copy from an older format is brought up to date
  for (const [k, v] of Object.entries(docs)) await putDoc(k, v);
}
