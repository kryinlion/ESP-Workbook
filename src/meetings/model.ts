import { createDocStore } from '../core/docstore';
import { values } from '../core/store';
import type { PhotoRef } from '../core/media';
import { addTask, isPast, registerTimelineItems, timeline, type Item, type TaskData } from '../timeline/model';

// ── Advisor meetings
// Action items are NOT stored here: each one is a real Timeline task tagged with the meeting's id,
// so it shows on the Timeline, Home "due this week", and decks without being tracked twice.
// Attendees are stored as ROLE keys (sm, coach…) — names come from Contacts on this device, so the
// cloud backup never carries them. "Others" is free text (the screen asks for first names only).

export interface Meeting {
  id: string;
  date: string;          // ISO yyyy-mm-dd
  time?: string;         // HH:MM
  kind: string;          // one of MEETING_KINDS ids
  where?: string;
  roles: string[];       // ROLE ids that attended
  others?: string;       // other attendees, first names
  agenda?: string;       // questions to ask / what to bring
  notes?: string;
  decisions: string[];
  photos: PhotoRef[];
  createdAt: number;
}
interface MeetingsDoc { schema: 1; meetings: Meeting[] }

export const meetingsStore = createDocStore<MeetingsDoc>('meetings', () => ({ schema: 1, meetings: [] }));

export const MEETING_KINDS = [
  { id: 'coach', label: 'Project coach' },
  { id: 'sm', label: 'Scoutmaster' },
  { id: 'ben', label: 'Beneficiary' },
  { id: 'committee', label: 'Unit committee' },
  { id: 'council', label: 'Council / district' },
  { id: 'helpers', label: 'Helpers / planning' },
  { id: 'other', label: 'Other' },
];
export const kindLabel = (k: string) => MEETING_KINDS.find((x) => x.id === k)?.label || 'Other';
export const meetingTitle = (m: Meeting) => `${kindLabel(m.kind)} meeting`;

export const ROLES = [
  { id: 'coach', label: 'Project coach', from: 'coach.name' },
  { id: 'sm', label: 'Scoutmaster', from: 'sm.name' },
  { id: 'benrep', label: 'Beneficiary rep', from: 'benrep.name' },
  { id: 'ucr', label: 'Committee rep', from: 'ucr.name' },
  { id: 'cdrep', label: 'Council / district rep', from: 'cdrep.name' },
  { id: 'parent', label: 'Parent / guardian', from: 'parent.name' },
];
/** "Scoutmaster (Mr. Jones)" using the name from Contacts, if entered. */
export function roleName(id: string) {
  const r = ROLES.find((x) => x.id === id); if (!r) return id;
  const n = String(values()[r.from] || '').trim();
  return n && n !== '[re-enter]' ? `${r.label} (${n})` : r.label;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Email for a role, from the Contacts page (this device only). */
export function roleEmail(id: string): string | undefined {
  const e = String(values()[`${id}.email`] || '').trim();
  return EMAIL_RE.test(e) ? e : undefined;
}
/** Emails of the people marked as attending this meeting. */
export const emailsFor = (m: Meeting) => [...new Set(m.roles.map(roleEmail).filter(Boolean) as string[])];
/** Every adult contact with an email (for sending decks). */
export const allContactEmails = () => [...new Set(ROLES.map((r) => roleEmail(r.id)).filter(Boolean) as string[])];

export function attendees(m: Meeting): string[] {
  const others = (m.others || '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  return [...m.roles.map(roleName), ...others];
}

export const allMeetings = () => [...meetingsStore.get().meetings].sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));
export const getMeeting = (id: string) => meetingsStore.get().meetings.find((m) => m.id === id);

export function addMeeting(p: Partial<Meeting> = {}): string {
  const id = crypto.randomUUID();
  const t = new Date();
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  meetingsStore.set((d) => ({ ...d, meetings: [...d.meetings, { id, date: today, kind: 'coach', roles: [], decisions: [], photos: [], createdAt: Date.now(), ...p }] }));
  return id;
}
export function updateMeeting(id: string, patch: Partial<Meeting>) {
  meetingsStore.set((d) => ({ ...d, meetings: d.meetings.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
}
/** Deleting a meeting keeps its action items on the Timeline (never lose work); they just lose the link. */
export function deleteMeeting(id: string) {
  meetingsStore.set((d) => ({ ...d, meetings: d.meetings.filter((m) => m.id !== id) }));
  timeline.set((d) => ({ ...d, tasks: d.tasks.map((t) => (t.meetingId === id ? { ...t, meetingId: undefined } : t)) }));
}

// ── action items = Timeline tasks with meetingId
export const actionsOf = (id: string): TaskData[] => timeline.get().tasks.filter((t) => t.meetingId === id);
export function addAction(m: Meeting, title = ''): string {
  return addTask({ title, phase: 'other', meetingId: m.id, notes: `From the ${meetingTitle(m).toLowerCase()} on ${usDate(m.date)}.` });
}
export function updateAction(taskId: string, patch: Partial<TaskData>) {
  timeline.set((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, ...patch, doneAt: patch.status === 'done' ? t.doneAt || Date.now() : patch.status ? undefined : t.doneAt } : t)) }));
}
export function deleteAction(taskId: string) {
  timeline.set((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== taskId) }));
}

export function usDate(iso: string) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
export function longDate(iso: string) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
export function time12(t?: string) {
  if (!t) return '';
  const [h, mm] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// Meetings appear on the Timeline as milestones (tap → opens the meeting).
registerTimelineItems((): Item[] => meetingsStore.get().meetings.map((m) => ({
  key: `mtg:${m.id}`, kind: 'milestone', title: `${meetingTitle(m)}${m.time ? ` · ${time12(m.time)}` : ''}`, due: m.date,
  phase: 'other', status: isPast(m.date) ? 'done' : 'todo', href: `#/meetings/${m.id}`,
})));
