import { ALL_FIELDS } from '../workbook/schema';

// Protected data never leaves the device. Cloud copies get PLACEHOLDER instead.
// Decided 2026-11-19 (docs/ROADMAP.md "Decisions").
export const PLACEHOLDER = '[re-enter]';

const CAND = ['cand.fullName', 'cand.street', 'cand.city', 'cand.state', 'cand.email', 'cand.phone', 'cand.memberId', 'cand.birth'];
// Every field in these people blocks (names, addresses, emails, phones). ben.org (organization name) is kept.
const PEOPLE = ['parent.', 'sm.', 'ucr.', 'benrep.', 'csc.', 'cdrep.', 'coach.'];
const BEN = ['ben.street', 'ben.city', 'ben.state', 'ben.email', 'ben.phone'];
const EXTRA = ['plan.firstAidSpecialist'];

export const PROTECTED_TEXT: string[] = ALL_FIELDS
  .map(({ field }) => field.id)
  .filter((id) => CAND.includes(id) || BEN.includes(id) || EXTRA.includes(id) || PEOPLE.some((p) => id.startsWith(p)));
export const SIG_FIELDS: string[] = ALL_FIELDS.filter(({ field }) => field.type === 'sig').map(({ field }) => field.id);

const LABEL: Record<string, string> = Object.fromEntries(ALL_FIELDS.map(({ section, field }) => {
  const group = section.groups.find((g) => g.fields.some((f) => f.id === field.id));
  return [field.id, `${section.short}: ${group && group.title !== field.label ? group.title + ' — ' : ''}${field.label}`];
}));
export const labelOf = (id: string) => LABEL[id] || id;

const filled = (v: any) => v !== undefined && v !== null && v !== '' && v !== PLACEHOLDER;

/** Copy of the project values with protected data replaced. Also returns media ids to keep off the cloud (drawn signatures). */
export function scrubValues(values: Record<string, any>): { values: Record<string, any>; skipMedia: string[] } {
  const out: Record<string, any> = { ...values };
  const skipMedia: string[] = [];
  for (const id of PROTECTED_TEXT) if (filled(out[id])) out[id] = PLACEHOLDER;
  for (const id of SIG_FIELDS) {
    const s = out[id];
    if (!s || typeof s !== 'object') continue;
    const c: any = { ...s };
    if (filled(c.typed)) c.typed = PLACEHOLDER;
    if (filled(c.name)) c.name = PLACEHOLDER;
    if (c.drawn) { skipMedia.push(c.drawn); c.drawn = PLACEHOLDER; }
    out[id] = c;
  }
  return { values: out, skipMedia };
}

/**
 * Restore: take the cloud values, but protected fields come from the device (a placeholder NEVER
 * overwrites a real value). Returns the ids still needing re-entry.
 */
export function mergeRestore(cloud: Record<string, any>, local: Record<string, any>): { values: Record<string, any>; reenter: string[] } {
  const out: Record<string, any> = { ...cloud };
  const reenter: string[] = [];
  for (const id of PROTECTED_TEXT) {
    if (filled(local[id])) out[id] = local[id];
    else if (cloud[id] === PLACEHOLDER) { delete out[id]; reenter.push(id); }
  }
  for (const id of SIG_FIELDS) {
    const c = cloud[id], l = local[id] || {};
    if (!c || typeof c !== 'object') { if (l && Object.keys(l).length) out[id] = l; continue; }
    const m: any = { ...c };
    let need = false;
    for (const k of ['typed', 'name', 'drawn']) {
      if (filled(l[k])) m[k] = l[k];
      else if (c[k] === PLACEHOLDER) { delete m[k]; need = true; }
    }
    out[id] = m;
    if (need && !filled(m.typed) && !m.drawn) reenter.push(id);
  }
  return { values: out, reenter };
}

/** Is a re-enter item done yet? */
export function isReentered(id: string, values: Record<string, any>): boolean {
  const v = values[id];
  if (SIG_FIELDS.includes(id)) return !!v && (filled(v.typed) || !!v.drawn);
  return filled(v);
}
