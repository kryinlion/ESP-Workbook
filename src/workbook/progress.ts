import { type Field, type Section, SECTIONS } from './schema';

const SKIP = new Set(['calc', 'info', 'photos', 'checklist']);

export function filled(f: Field, v: any): boolean {
  if (v === undefined || v === null || v === '') return false;
  switch (f.type) {
    case 'table': return Array.isArray(v) && v.some((r) => f.columns!.some((c) => r[c.id] !== undefined && r[c.id] !== ''));
    case 'hours': return Object.values(v as Record<string, any>).some((r: any) => r?.h !== undefined && r.h !== '');
    case 'sig': return !!(v.typed || v.drawn);
    default: return String(v).trim().length > 0;
  }
}

export function sectionProgress(s: Section, values: Record<string, any>) {
  let total = 0, done = 0;
  for (const g of s.groups) for (const f of g.fields) {
    if (SKIP.has(f.type) || f.id === 'cand.name' || f.id === 'rep.benOrg') continue;
    total++; if (filled(f, values[f.id])) done++;
  }
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function overallProgress(values: Record<string, any>) {
  let total = 0, done = 0;
  for (const s of SECTIONS) { const p = sectionProgress(s, values); total += p.total; done += p.done; }
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}
