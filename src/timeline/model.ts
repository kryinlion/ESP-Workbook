import { createDocStore } from '../core/docstore';
import { setValue, values } from '../core/store';
import type { PhotoRef } from '../core/media';
import { CHECKLIST } from '../workbook/schema';

// ── Timeline data
// Custom tasks live in the "timeline" doc. The 18 workbook checklist steps are
// built-in tasks: their done state IS the workbook checklist (two-way), and any
// extra details (due date, owner, notes, photos) are stored as overrides here.
// Milestones come from workbook dates (pp. 8) and the 18th-birthday deadline;
// editing a milestone date here writes it back into the workbook.

export type Status = 'todo' | 'doing' | 'done';
export type Phase = 'proposal' | 'plan' | 'execute' | 'report' | 'other';

export const PHASES: { id: Phase; label: string; color: string }[] = [
  { id: 'proposal', label: 'Proposal', color: '#4f8fd6' },
  { id: 'plan', label: 'Plan', color: '#3f9a7c' },
  { id: 'execute', label: 'Work', color: '#e0a92e' },
  { id: 'report', label: 'Report', color: '#9a74d6' },
  { id: 'other', label: 'Other', color: '#8a98a6' },
];
export const phaseOf = (p?: Phase) => PHASES.find((x) => x.id === p) || PHASES[4];

export interface TaskData {
  id: string;
  title: string;
  due?: string; // ISO yyyy-mm-dd
  status: Status;
  phase: Phase;
  owner?: string;
  notes?: string;
  photos?: PhotoRef[];
  createdAt: number;
  doneAt?: number;
  meetingId?: string; // action item from an advisor meeting
}

export interface Override { due?: string; owner?: string; notes?: string; photos?: PhotoRef[]; doing?: boolean }

export interface TimelineDoc {
  schema: 1;
  tasks: TaskData[];
  checklist: Record<number, Override>; // overrides for built-in checklist tasks
}

export const timeline = createDocStore<TimelineDoc>('timeline', () => ({ schema: 1, tasks: [], checklist: {} }));

// Which phase / which workbook date each checklist step belongs to
const CK_PHASE: Phase[] = ['proposal', 'proposal', 'proposal', 'proposal', 'proposal', 'proposal', 'proposal', 'proposal', 'proposal',
  'plan', 'plan', 'plan', 'execute', 'execute', 'report', 'report', 'report', 'report'];
const CK_DUE_FROM: Record<number, string> = { 7: 'prop.dateApproved', 10: 'prop.datePlan', 11: 'prop.datePlan', 12: 'prop.dateBegin', 14: 'prop.dateReport' };

// A unified item for every view
export interface Item {
  key: string; // 'task:<id>' | 'ck:<n>' | 'ms:<id>'
  kind: 'task' | 'checklist' | 'milestone';
  title: string;
  due?: string;
  dueAuto?: boolean; // date inherited from a workbook milestone
  status: Status;
  phase: Phase;
  owner?: string;
  notes?: string;
  photos?: PhotoRef[];
  num?: number; // checklist step number
  hard?: boolean; // the 18th-birthday deadline
  href?: string; // open this screen instead of editing here (e.g. a scheduled meeting)
  meetingId?: string;
}

// Other modules (meetings, money…) can add their own dated items to the Timeline.
const extra: (() => Item[])[] = [];
export function registerTimelineItems(f: () => Item[]) { extra.push(f); }

export const MILESTONES = [
  { id: 'approved', field: 'prop.dateApproved', title: 'Proposal approved', phase: 'proposal' as Phase },
  { id: 'plan', field: 'prop.datePlan', title: 'Plan complete', phase: 'plan' as Phase },
  { id: 'begin', field: 'prop.dateBegin', title: 'Work begins', phase: 'execute' as Phase },
  { id: 'report', field: 'prop.dateReport', title: 'Project report complete', phase: 'report' as Phase },
];

export function deadline18(v = values()): string | undefined {
  const b = v['cand.birth'];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b || '');
  if (!m) return undefined;
  return `${+m[1] + 18}-${m[2]}-${m[3]}`;
}

export function allItems(): Item[] {
  const v = values();
  const t = timeline.get();
  const ck = (v.checklist || {}) as Record<number, boolean>;
  const out: Item[] = [];
  CHECKLIST.forEach((title, i) => {
    const o = t.checklist[i] || {};
    const auto = CK_DUE_FROM[i] ? v[CK_DUE_FROM[i]] : undefined;
    out.push({
      key: `ck:${i}`, kind: 'checklist', num: i + 1, title, phase: CK_PHASE[i],
      due: o.due || auto || undefined, dueAuto: !o.due && !!auto,
      status: ck[i] ? 'done' : o.doing ? 'doing' : 'todo',
      owner: o.owner, notes: o.notes, photos: o.photos,
    });
  });
  for (const task of t.tasks) out.push({ key: `task:${task.id}`, kind: 'task', ...task });
  for (const m of MILESTONES) {
    if (v[m.field]) out.push({ key: `ms:${m.id}`, kind: 'milestone', title: m.title, due: v[m.field], phase: m.phase, status: isPast(v[m.field]) ? 'done' : 'todo' });
  }
  const d18 = deadline18(v);
  if (d18) out.push({ key: 'ms:18', kind: 'milestone', title: '18th birthday: report must be signed before this day', due: d18, phase: 'report', status: 'todo', hard: true });
  for (const f of extra) out.push(...f());
  return out;
}

// ── mutations
export function setStatus(it: Item, s: Status) {
  if (it.kind === 'checklist') {
    const i = it.num! - 1;
    setValue('checklist', { ...(values().checklist || {}), [i]: s === 'done' });
    timeline.set((d) => ({ ...d, checklist: { ...d.checklist, [i]: { ...d.checklist[i], doing: s === 'doing' } } }));
  } else if (it.kind === 'task') {
    const id = it.key.slice(5);
    timeline.set((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === id ? { ...x, status: s, doneAt: s === 'done' ? Date.now() : undefined } : x)) }));
  }
}

export function updateItem(it: Item, patch: Partial<Item>) {
  if (it.kind === 'checklist') {
    const i = it.num! - 1;
    const { due, owner, notes, photos } = patch;
    timeline.set((d) => ({ ...d, checklist: { ...d.checklist, [i]: clean({ ...d.checklist[i], ...pick({ due, owner, notes, photos }) }) } }));
    if (patch.status) setStatus(it, patch.status);
  } else if (it.kind === 'task') {
    const id = it.key.slice(5);
    timeline.set((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === id ? { ...x, ...(pick(patch) as any), doneAt: patch.status === 'done' ? x.doneAt || Date.now() : patch.status ? undefined : x.doneAt } : x)) }));
  } else if (it.kind === 'milestone' && !it.hard && patch.due !== undefined) {
    const m = MILESTONES.find((x) => `ms:${x.id}` === it.key);
    if (m) setValue(m.field, patch.due);
  }
}

export function addTask(t: Partial<TaskData>): string {
  const id = crypto.randomUUID();
  timeline.set((d) => ({ ...d, tasks: [...d.tasks, { id, title: t.title || 'New task', status: 'todo', phase: t.phase || 'other', due: t.due, owner: t.owner, notes: t.notes, photos: t.photos, createdAt: Date.now(), ...(t.meetingId ? { meetingId: t.meetingId } : {}) }] }));
  return id;
}

export function deleteTask(it: Item) {
  if (it.kind !== 'task') return;
  const id = it.key.slice(5);
  timeline.set((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== id) }));
}

function pick(o: Record<string, any>) { const r: Record<string, any> = {}; for (const k of Object.keys(o)) if (o[k] !== undefined && k !== 'key' && k !== 'kind') r[k] = o[k]; return r; }
function clean(o: Record<string, any>) { for (const k of Object.keys(o)) if (o[k] === '' || o[k] === undefined) delete o[k]; return o; }

// ── dates
export const todayIso = () => iso(new Date());
export function iso(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function parse(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(s: string, n: number) { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
export function daysBetween(a: string, b: string) { return Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5); }
export function isPast(s: string) { return daysBetween(todayIso(), s) < 0; }
export function relDay(s: string) {
  const n = daysBetween(todayIso(), s);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n} days ago`;
  if (n < 7) return parse(s).toLocaleDateString('en-US', { weekday: 'long' });
  return parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: parse(s).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
