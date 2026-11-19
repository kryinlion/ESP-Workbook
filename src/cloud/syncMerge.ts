// Sync (P6b) — pure logic, no Firebase. Every document is split into small "entries"
// (one per workbook answer, task, meeting, donation…) so two devices can edit different
// things at the same time without overwriting each other.
//
// Privacy (decided 2026-11-19): protected workbook fields and signatures NEVER sync. Only a
// flag "pk:<field>" saying "this is filled in on some device" syncs, so a new device can list
// what to re-enter. Donor email/phone/address never sync either.
import { PROTECTED_TEXT, SIG_FIELDS } from './scrub';

export type Entries = Record<string, any>;
export const DELETED = { __deleted: true } as const;
const isDel = (v: any) => v && typeof v === 'object' && v.__deleted === true;

const PROTECTED = new Set([...PROTECTED_TEXT, ...SIG_FIELDS]);
const DONOR_PRIVATE = ['email', 'phone', 'address'];
const empty = (v: any) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const sigFilled = (v: any) => !!v && typeof v === 'object' && (!!String(v.typed || '').trim() || !!v.drawn);

/** Stable JSON (sorted keys) so equal data always compares equal. */
export function stable(v: any): string {
  if (v === undefined) return 'undefined';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
}
export const same = (a: any, b: any) => stable(a) === stable(b);

// ---------- docs → entries ----------
export function toEntries(docs: Record<string, any>): Entries {
  const e: Entries = {};
  const vals = docs.project?.values || {};
  for (const [id, v] of Object.entries<any>(vals)) {
    if (PROTECTED.has(id)) {
      if (SIG_FIELDS.includes(id) ? sigFilled(v) : !empty(v) && v !== '[re-enter]') e[`pk:${id}`] = 1;
      continue;
    }
    if (id === 'checklist') { for (const [i, b] of Object.entries<any>(v || {})) if (b) e[`ck:${i}`] = true; continue; }
    if (!empty(v)) e[`p:${id}`] = v;
  }
  const tl = docs.timeline;
  if (tl) {
    for (const t of tl.tasks || []) e[`t:${t.id}`] = t;
    for (const [i, o] of Object.entries<any>(tl.checklist || {})) if (o && Object.keys(o).length) e[`to:${i}`] = o;
  }
  for (const m of docs.meetings?.meetings || []) e[`m:${m.id}`] = m;
  const mo = docs.money;
  if (mo) {
    if (!empty(mo.goal)) e['$goal'] = mo.goal;
    for (const d of mo.donors || []) { const c = { ...d }; for (const k of DONOR_PRIVATE) delete c[k]; e[`$d:${d.id}`] = c; }
    for (const g of mo.donations || []) e[`$g:${g.id}`] = g;
    for (const x of mo.expenses || []) e[`$x:${x.id}`] = x;
    for (const v of mo.events || []) e[`$e:${v.id}`] = v;
  }
  return e;
}

// ---------- entries → docs (keeps this device's private data) ----------
const byCreated = (a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0);
export function fromEntries(e: Entries, local: Record<string, any>): Record<string, any> {
  const pick = (pre: string) => Object.keys(e).filter((k) => k.startsWith(pre) && !isDel(e[k])).map((k) => [k.slice(pre.length), e[k]] as [string, any]);
  const lp = local.project || {};
  const values: Record<string, any> = {};
  for (const id of PROTECTED) if (lp.values && lp.values[id] !== undefined) values[id] = lp.values[id]; // private stays
  for (const [id, v] of pick('p:')) values[id] = v;
  const ck: Record<string, boolean> = {};
  for (const [i, b] of pick('ck:')) if (b) ck[i] = true;
  if (Object.keys(ck).length || lp.values?.checklist) values.checklist = ck;
  const project = { ...lp, values };

  const timeline = { ...(local.timeline || { schema: 1 }), schema: 1, tasks: pick('t:').map(([, t]) => t).sort(byCreated), checklist: Object.fromEntries(pick('to:')) };
  const meetings = { ...(local.meetings || { schema: 1 }), schema: 1, meetings: pick('m:').map(([, m]) => m).sort(byCreated) };
  const mine = new Map<string, any>((local.money?.donors || []).map((d: any) => [d.id, d]));
  const money = {
    ...(local.money || {}), schema: 1,
    goal: isDel(e['$goal']) ? undefined : e['$goal'],
    donors: pick('$d:').map(([id, d]) => { const l = mine.get(id) || {}; const out = { ...d }; for (const k of DONOR_PRIVATE) if (l[k]) out[k] = l[k]; return out; }).sort(byCreated),
    donations: pick('$g:').map(([, g]) => g).sort(byCreated),
    expenses: pick('$x:').map(([, x]) => x).sort(byCreated),
    events: pick('$e:').map(([, v]) => v).sort(byCreated),
  };
  return { project, timeline, meetings, money };
}

/** Protected fields filled on some device but empty here → "Re-enter these" list. */
export function missingHere(e: Entries, localValues: Record<string, any>): string[] {
  return Object.keys(e).filter((k) => k.startsWith('pk:') && !isDel(e[k])).map((k) => k.slice(3))
    .filter((id) => (SIG_FIELDS.includes(id) ? !sigFilled(localValues[id]) : empty(localValues[id])));
}

/** "pk:" flags mean "filled on SOME device" — a device without the field must not delete another's flag. */
export function withSharedFlags(local: Entries, base: Entries): Entries {
  const out = { ...local };
  for (const k of Object.keys(base)) if (k.startsWith('pk:') && !(k in out)) out[k] = base[k];
  return out;
}

// ---------- three-way merge ----------
/**
 * local = this device now, base = what both sides agreed at the last sync, pulled = entries other
 * devices changed since then (DELETED for removals). Returns the merged entries, the keys to send up,
 * and whether anything came down. If both sides changed the same entry, THIS device wins (it is
 * sending last), and the other device takes it on its next sync — so both always end up the same.
 */
export function merge(local: Entries, base: Entries, pulled: Entries): { result: Entries; push: string[]; changedHere: boolean } {
  const keys = new Set([...Object.keys(local), ...Object.keys(base), ...Object.keys(pulled)]);
  const result: Entries = {};
  const push: string[] = [];
  let changedHere = false;
  for (const k of keys) {
    const l = local[k];
    const b = base[k];
    const has = k in pulled;
    const r = has ? (isDel(pulled[k]) ? undefined : pulled[k]) : b;
    const lc = !same(l, b);
    const rc = has && !same(r, b);
    let v: any;
    if (lc) { v = l; push.push(k); }
    else if (rc) { v = r; changedHere = true; }
    else v = l;
    if (v !== undefined) result[k] = v;
  }
  return { result, push, changedHere };
}
