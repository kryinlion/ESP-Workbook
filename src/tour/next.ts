import { project } from '../core/store';
import { CHECKLIST, SECTIONS } from '../workbook/schema';
import { filled, sectionProgress } from '../workbook/progress';
import { allItems, daysBetween, deadline18, relDay, timeline, todayIso } from '../timeline/model';
import { meetingsStore, meetingTitle } from '../meetings/model';
import { moneyStore, giftLabel } from '../money/model';
import { backupDue } from '../ui/backupPrompt';
import { QUESTS } from './quests';

// "What's next?" — ranked suggestions for the ? panel. Decided with Mark 2026-11-20:
//   one big "Do this next" + 2–3 smaller · screen-aware (this screen first, urgent always wins)
//   · urgent items light a badge on the ? button · ? lives in the top bar and slides in from the right.

export interface Suggestion {
  id: string;
  title: string;
  detail: string;
  href: string;
  go: string;          // button label
  level: 3 | 2 | 1;    // 3 urgent · 2 soon · 1 keep going
  screen: string;      // which screen it belongs to (home, workbook, timeline, meetings, money, export)
}

const SKIP = new Set(['calc', 'info', 'photos', 'checklist']);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
// relDay says "Today/Tomorrow/Yesterday"; inside a sentence they should be lowercase
const rel = (d: string) => relDay(d).replace(/^(Today|Tomorrow|Yesterday)$/, (m) => m.toLowerCase());

/** First empty box in a workbook section (for "Go" to land on). */
function firstEmpty(sectionId: string): string | undefined {
  const s = SECTIONS.find((x) => x.id === sectionId); if (!s) return;
  const v = project().values;
  for (const g of s.groups) for (const f of g.fields) {
    if (SKIP.has(f.type) || f.id === 'cand.name' || f.id === 'rep.benOrg') continue;
    if (!filled(f, v[f.id])) return f.id;
  }
}

export function suggestions(): Suggestion[] {
  const out: Suggestion[] = [];
  const t = todayIso();
  const v = project().values;

  // ── 3 · urgent
  const items = allItems().filter((i) => i.kind !== 'milestone' && i.status !== 'done' && i.due);
  const overdue = items.filter((i) => i.due! < t).sort((a, b) => a.due!.localeCompare(b.due!));
  if (overdue.length) {
    const o = overdue[0];
    out.push({ id: 'overdue', level: 3, screen: 'timeline', href: '#/timeline', go: 'Open Timeline',
      title: overdue.length === 1 ? `Overdue: ${o.num ? `Step ${o.num}` : o.title}` : `${plural(overdue.length, 'task')} overdue`,
      detail: overdue.length === 1 ? `${o.num ? o.title : ''} Was due ${rel(o.due!)}.`.trim() : `The oldest: “${o.title}” (${rel(o.due!)}). Do it, give it a new date, or mark it done.` });
  }
  const soon = meetingsStore.get().meetings.filter((m) => m.date >= t && daysBetween(t, m.date) <= 3 && !(m.agenda || '').trim());
  for (const m of soon.slice(0, 1)) out.push({ id: `agenda-${m.id}`, level: 3, screen: 'meetings', href: `#/meetings/${m.id}`, go: 'Write agenda',
    title: `Write your agenda for the ${meetingTitle(m).toLowerCase()}`, detail: `It's ${rel(m.date)}. Send it ahead so everyone comes prepared.` });
  const d18 = deadline18(v);
  const signed = !!(v['rep.candSig']?.typed || v['rep.candSig']?.drawn);
  if (d18 && !signed && daysBetween(t, d18) <= 90) out.push({ id: 'deadline', level: 3, screen: 'timeline', href: '#/timeline', go: 'See Timeline',
    title: `${daysBetween(t, d18)} days to your 18th birthday`, detail: 'Your project report must be completed and signed before then. Plan your remaining steps now.' });

  // ── 2 · soon
  const dueSoon = items.filter((i) => i.due! >= t && daysBetween(t, i.due!) <= 2);
  if (dueSoon.length) { const d = dueSoon[0]; out.push({ id: 'duesoon', level: 2, screen: 'timeline', href: '#/timeline', go: 'Open Timeline',
    title: d.num ? `Step ${d.num} is due ${rel(d.due!)}` : `Due ${rel(d.due!)}: ${d.title}`, detail: d.num ? d.title : (dueSoon.length > 1 ? `Plus ${plural(dueSoon.length - 1, 'more task')} in the next 2 days.` : 'Check it off on the Timeline when it\'s done.') }); }
  const owed = moneyStore.get().donations.filter((g) => !g.thanked && (g.donorId || g.kind === 'inkind'));
  if (owed.length) {
    const oldest = [...owed].sort((a, b) => a.date.localeCompare(b.date))[0];
    const days = daysBetween(oldest.date, t);
    out.push({ id: 'thanks', level: days >= 7 ? 2 : 1, screen: 'money', href: '#/money/donations', go: 'See donations',
      title: `Send ${plural(owed.length, 'thank-you')}`, detail: `${giftLabel(oldest)} gave ${days === 0 ? 'today' : `${plural(days, 'day')} ago`}. A quick note or card goes a long way.` });
  }
  if (backupDue()) out.push({ id: 'backup', level: 2, screen: 'export', href: '#/export', go: 'Back up', title: 'Save a full backup', detail: 'Your weekly backup file is due. It\'s the only copy with your private details.' });
  const recent = meetingsStore.get().meetings.filter((m) => m.date < t && daysBetween(m.date, t) <= 7 && !(m.notes || '').trim());
  for (const m of recent.slice(0, 1)) out.push({ id: `notes-${m.id}`, level: 2, screen: 'meetings', href: `#/meetings/${m.id}`, go: 'Add notes',
    title: `Add notes from your ${meetingTitle(m).toLowerCase()}`, detail: `It was ${rel(m.date)}. Write down advice, decisions, and action items while you remember.` });

  // ── 1 · keep going
  const q = QUESTS.find((x) => !x.done());
  if (q) out.push({ id: `quest-${q.id}`, level: 1, screen: 'home', href: q.href, go: 'Go', title: `Quest: ${q.title}`, detail: q.why });
  const ck = (v.checklist || {}) as Record<number, boolean>;
  const step = CHECKLIST.findIndex((_, i) => !ck[i]);
  const sec = SECTIONS.find((s) => sectionProgress(s, v).pct < 100);
  if (sec) {
    const sp = sectionProgress(sec, v);
    const fid = firstEmpty(sec.id);
    out.push({ id: `section-${sec.id}`, level: 1, screen: 'workbook', href: `#/workbook/${sec.id}${fid ? `/${fid}` : ''}`, go: 'Continue',
      title: `Keep going on ${sec.title}`, detail: `${plural(sp.total - sp.done, 'answer')} left on workbook ${sec.pages}. Go takes you to the first empty box.` });
  }
  if (step >= 0) out.push({ id: 'step', level: 1, screen: 'timeline', href: '#/timeline', go: 'Open Timeline',
    title: `Next workbook step: Step ${step + 1} of ${CHECKLIST.length}`, detail: CHECKLIST[step] });
  if (!meetingsStore.get().meetings.length) out.push({ id: 'first-meeting', level: 1, screen: 'meetings', href: '#/meetings', go: 'Add meeting',
    title: 'Plan your first advisor meeting', detail: 'Add it before it happens and write an agenda. Your coach will thank you.' });
  if (!timeline.get().tasks.length && !q) out.push({ id: 'first-task', level: 1, screen: 'timeline', href: '#/timeline', go: 'Add task', title: 'Add your first task', detail: 'Break your next step into small to-dos with dates.' });
  return out;
}

/** Ranked for a screen: urgent first, then this screen's items, then the rest. */
export function ranked(screen: string): Suggestion[] {
  // Home is the overview, so nothing gets a "this screen" boost there — urgency alone decides
  const here = (s: Suggestion) => (screen !== 'home' && s.screen === screen ? 1 : 0);
  return suggestions().sort((a, b) => (b.level === 3 ? 1 : 0) - (a.level === 3 ? 1 : 0) || here(b) - here(a) || b.level - a.level);
}

export const hasUrgent = () => suggestions().some((s) => s.level === 3);
