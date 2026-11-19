import type { Ctx, Deck, Slide } from './engine';
import { bulletSlides, closingSlide, number, photoSlides, statsSlide, tableSlides, textSlides, titleSlide, type Photo } from './layouts';
import { CHECKLIST, HOURS_ROWS, SECTIONS, hoursTotals, num, rowValue, type Field } from '../workbook/schema';
import { overallProgress } from '../workbook/progress';
import { RANKS, rankFor } from '../ui/hero';
import { allItems, daysBetween, deadline18, phaseOf, todayIso } from '../timeline/model';
import { isoToUs } from '../ui/fields';
import { actionsOf, allMeetings, attendees, getMeeting, longDate, meetingTitle, time12, usDate, type Meeting } from '../meetings/model';
import { agendaItems } from '../meetings/agenda';
import { CATEGORIES, FROM, eventRaised, expenseTotal, giftLabel, sortedDonations, sortedEvents, sortedExpenses, totals as moneyTotals } from '../money/model';

// The decks. Each one is built live from Colin's answers, so it's always up to date —
// slides with nothing filled in are skipped.

export interface DeckDef { id: string; title: string; blurb: string; when: string; hidden?: boolean; build: (v: Record<string, any>, arg?: string) => Deck }

const str = (x: any) => (typeof x === 'string' ? x.trim() : '');
const pics = (v: Record<string, any>, ...ids: string[]): Photo[] => ids.flatMap((id) => (Array.isArray(v[id]) ? v[id] : [])).filter((p: any) => p?.id);
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const safe = (s: string) => (s || '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
const usLong = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); };
const field = (id: string): Field | undefined => { for (const s of SECTIONS) for (const g of s.groups) for (const f of g.fields) if (f.id === id) return f; };

function ctxFor(v: Record<string, any>): Ctx {
  const bits = [str(v['project.title']), str(v['cand.fullName'])].filter(Boolean);
  return { footer: bits.join('  ·  ') || 'Eagle Scout Leadership Service Project', photo: () => undefined };
}
const unitLine = (v: Record<string, any>) => [v['unit.type'] && v['unit.number'] ? `${v['unit.type']} ${v['unit.number']}` : '', str(v['unit.district']), str(v['unit.council'])].filter(Boolean).join('  ·  ');
const cover = (v: Record<string, any>) => pics(v, 'project.cover')[0]?.id;
const titleOf = (v: Record<string, any>) => str(v['project.title']) || 'My Eagle Scout Project';
const fileName = (v: Record<string, any>, kind: string) => `${kind}_${safe(str(v['project.title'])) || safe(str(v['cand.fullName'])) || 'Eagle_Project'}`;

function text(ctx: Ctx, title: string, v: Record<string, any>, id: string, photos: Photo[] = [], kicker?: string): Slide[] {
  const t = str(v[id]);
  return t ? textSlides(ctx, title, t, photos, kicker) : [];
}

function moneyTable(ctx: Ctx, title: string, v: Record<string, any>, id: string, kicker?: string): Slide[] {
  const f = field(id); const rows = (v[id] || []).filter((r: any) => r && Object.values(r).some((x) => x !== '' && x != null));
  if (!f?.columns || !rows.length) return [];
  const cols = f.columns.filter((c) => c.id !== 'desc');
  const isMoney = (c: any) => c.type === 'money' || c.id === 'total';
  const body = rows.map((r: any) => cols.map((c) => (isMoney(c) ? (rowValue(r, c) ? money(rowValue(r, c)) : '') : String(r[c.id] ?? ''))));
  const totalCol = f.columns.find((c) => c.id === 'total')!;
  const total = rows.reduce((a: number, r: any) => a + rowValue(r, totalCol), 0);
  return tableSlides(ctx, title, cols.map((c) => c.label), body, cols.map((c) => (c.id === 'item' ? 3 : c.id === 'source' ? 2.4 : 1.3)), {
    kicker, total: cols.map((c, i) => (i === 0 ? 'Total' : c.id === 'total' ? money(total) : '')), align: cols.map((c) => (isMoney(c) || c.type === 'num' ? 'right' : 'left')),
  });
}

// ───────────── 1. Proposal presentation ─────────────
function proposalDeck(v: Record<string, any>): Deck {
  const ctx = ctxFor(v);
  const s: Slide[] = [titleSlide({ kicker: 'Eagle Scout Project Proposal', title: titleOf(v), sub: str(v['cand.fullName']), meta: unitLine(v), cover: cover(v) })];
  s.push(...text(ctx, 'Who it helps', v, 'prop.beneficiary', pics(v, 'prop.beneficiaryPhotos'), 'The beneficiary'));
  s.push(...text(ctx, 'The project', v, 'prop.description', pics(v, 'prop.descriptionPhotos'), 'What I will do'));
  s.push(...text(ctx, 'Why this project', v, 'prop.motivation', [], 'Motivation'));
  const dates = ([['Proposal approved', 'prop.dateApproved'], ['Plan complete', 'prop.datePlan'], ['Work begins', 'prop.dateBegin'], ['Report complete', 'prop.dateReport']] as const).filter(([, k]) => v[k]);
  if (dates.length) s.push(...tableSlides(ctx, 'Timeline', ['Milestone', 'Target date'], dates.map(([l, k]) => [l, usLong(v[k])]), [3, 2], { kicker: 'When' }));
  s.push(...text(ctx, 'The work', v, 'prop.work', [], 'How it gets done'));
  s.push(...text(ctx, 'Leadership', v, 'prop.leadership', [], 'Who I will lead'));
  s.push(...text(ctx, 'Materials, supplies & tools', v, 'prop.resources', [], 'What we need'));
  const costs = ([['Materials', 'prop.costMaterials'], ['Supplies', 'prop.costSupplies'], ['Tools', 'prop.costTools'], ['Other', 'prop.costOther']] as const).filter(([, k]) => num(v[k]));
  if (costs.length) {
    const total = costs.reduce((a, [, k]) => a + num(v[k]), 0);
    s.push(...tableSlides(ctx, 'Estimated cost', ['Category', 'Estimate'], costs.map(([l, k]) => [l, money(num(v[k]))]), [3, 2], { kicker: 'Budget', total: ['Total', money(total)], align: ['left', 'right'] }));
  }
  s.push(...text(ctx, 'Fundraising', v, 'prop.fundraising', [], 'Paying for it'));
  s.push(...text(ctx, 'Safety', v, 'prop.safety', [], 'Keeping everyone safe'));
  const ph = pics(v, 'prop.photos');
  if (ph.length) s.push(...photoSlides(ctx, 'Photos and drawings', ph, 'Supporting images'));
  s.push(closingSlide('Questions?', 'Thank you for your time and guidance.'));
  return { id: 'proposal', title: 'Proposal presentation', file: fileName(v, 'Proposal'), slides: number(s) };
}

// ───────────── 2. Progress update ─────────────
function progressDeck(v: Record<string, any>): Deck {
  const ctx = ctxFor(v);
  const t = todayIso();
  const all = overallProgress(v);
  const rank = RANKS[rankFor(all.pct)].name;
  const ck = (v.checklist || {}) as Record<number, boolean>;
  const stepsDone = CHECKLIST.filter((_, i) => ck[i]).length;
  const hrs = hoursTotals(v).grand;
  const items = allItems();
  const d18 = deadline18(v);
  const s: Slide[] = [titleSlide({ kicker: 'Progress Update', title: titleOf(v), sub: usLong(t), meta: [str(v['cand.fullName']), unitLine(v)].filter(Boolean).join('  ·  '), cover: cover(v) })];
  const stats = [
    { value: `${all.pct}%`, label: `workbook complete · ${rank} rank` },
    { value: `${stepsDone}/${CHECKLIST.length}`, label: 'workbook steps done' },
    ...(hrs ? [{ value: String(Math.round(hrs * 10) / 10), label: 'service hours logged' }] : []),
    ...(d18 ? [{ value: String(Math.max(0, daysBetween(t, d18))), label: 'days until 18th birthday' }] : []),
  ];
  s.push(statsSlide(ctx, 'Where things stand', stats, 'At a glance'));
  const done = items.filter((i) => i.status === 'done' && i.kind !== 'milestone').map((i) => (i.num ? `Step ${i.num}: ${i.title}` : i.title));
  if (done.length) s.push(...bulletSlides(ctx, 'Done so far', done.slice(-12), 'Completed'));
  const upcoming = items.filter((i) => i.status !== 'done' && i.due && i.due >= t).sort((a, b) => a.due!.localeCompare(b.due!)).slice(0, 9); // one slide
  if (upcoming.length) s.push(...tableSlides(ctx, 'Coming up', ['Date', 'What', 'Phase'], upcoming.map((i) => [isoToUs(i.due!), i.num ? `Step ${i.num}: ${i.title}` : i.title, phaseOf(i.phase).label]), [1.3, 5, 1.3], { kicker: 'Next' }));
  const overdue = items.filter((i) => i.status !== 'done' && i.kind !== 'milestone' && i.due && i.due < t);
  const next = items.filter((i) => i.status !== 'done' && i.kind !== 'milestone' && !i.due).slice(0, 6);
  const todo = [...overdue.map((i) => `${i.title} (was due ${isoToUs(i.due!)})`), ...next.map((i) => (i.num ? `Step ${i.num}: ${i.title}` : i.title))];
  if (todo.length) s.push(...bulletSlides(ctx, 'Next steps', todo.slice(0, 10), 'To do'));
  const recent = [...pics(v, 'rep.photosDuring', 'rep.photosAfter', 'plan.beforePhotos', 'rep.photosBefore', 'prop.descriptionPhotos'),
    ...items.flatMap((i) => i.photos || [])].sort((a: any, b: any) => (b.addedAt || 0) - (a.addedAt || 0));
  if (recent.length) s.push(...photoSlides(ctx, 'Recent photos', recent.slice(0, 4), 'Progress'));
  s.push(closingSlide('Thank you', 'Questions, ideas, or help? I would love to hear them.'));
  return { id: 'progress', title: 'Progress update', file: fileName(v, 'Progress_Update'), slides: number(s) };
}

// ───────────── 3. Final project report ─────────────
function reportDeck(v: Record<string, any>): Deck {
  const ctx = ctxFor(v);
  const s: Slide[] = [titleSlide({ kicker: 'Eagle Scout Project Report', title: titleOf(v), sub: str(v['cand.fullName']), meta: unitLine(v), cover: cover(v) })];
  const brief = str(v['rep.brief']) || str(v['appr.brief']);
  if (brief) s.push(...textSlides(ctx, 'The project', brief, [], str(v['ben.org']) ? `For ${str(v['ben.org'])}` : 'Summary'));
  for (const [title, id] of [['Before', 'rep.photosBefore'], ['During', 'rep.photosDuring'], ['After', 'rep.photosAfter']] as const) {
    const ph = pics(v, id, ...(id === 'rep.photosBefore' ? ['plan.beforePhotos'] : []));
    if (ph.length) s.push(...photoSlides(ctx, title, ph, 'Photos'));
  }
  const h = hoursTotals(v);
  const people = HOURS_ROWS.reduce((a, r) => a + ('fixedN' in r ? 0 : num(v['hours.report']?.[r.key]?.n)), 0);
  const stats = [
    ...(h.grand ? [{ value: String(Math.round(h.grand * 10) / 10), label: 'total hours (all phases)' }] : []),
    ...(people ? [{ value: String(people), label: 'helpers on work days' }] : []),
    ...(num(v['rep.collected']) ? [{ value: money(num(v['rep.collected'])), label: 'collected' }] : []),
    ...(num(v['rep.spent']) ? [{ value: money(num(v['rep.spent'])), label: 'spent' }] : []),
  ];
  if (stats.length) s.push(statsSlide(ctx, 'By the numbers', stats, 'Results'));
  s.push(...text(ctx, 'What went well', v, 'rep.observations', [], 'Reflection'));
  s.push(...text(ctx, 'Challenges', v, 'rep.challenges', [], 'Reflection'));
  s.push(...text(ctx, 'Changes along the way', v, 'rep.changes', [], 'Reflection'));
  s.push(...text(ctx, 'What I learned about leadership', v, 'rep.leadershipStyle', [], 'Leadership'));
  s.push(...text(ctx, 'Most rewarding, most challenging', v, 'rep.rewarding', [], 'Leadership'));
  s.push(...moneyTable(ctx, 'Where the money went', v, 'rep.spending', 'Spending'));
  s.push(...text(ctx, 'Thank you', v, 'rep.acknowledgment', [], 'Acknowledgments'));
  s.push(closingSlide('Thank you', str(v['ben.org']) ? `Proudly built for ${str(v['ben.org'])}.` : undefined));
  return { id: 'report', title: 'Project report', file: fileName(v, 'Project_Report'), slides: number(s) };
}

// ───────────── 4. One meeting (summary to share) ─────────────
function meetingSlides(ctx: Ctx, m: Meeting, opts: { full: boolean }): Slide[] {
  const s: Slide[] = [];
  const who = attendees(m);
  const head = `${meetingTitle(m)} · ${usDate(m.date)}`;
  if (who.length) s.push(...bulletSlides(ctx, opts.full ? 'Who was there' : head, who, opts.full ? 'Attendees' : 'Attendees'));
  const ag = agendaItems(m);
  if (opts.full && ag.length) s.push(...bulletSlides(ctx, 'Agenda', ag, 'What we planned to cover'));
  if (opts.full && (m.notes || '').trim()) s.push(...textSlides(ctx, 'Discussion', m.notes!.trim(), [], 'Notes'));
  const dec = m.decisions.map((d) => d.trim()).filter(Boolean);
  if (dec.length) s.push(...bulletSlides(ctx, opts.full ? 'Decisions' : `Decisions — ${usDate(m.date)}`, dec, opts.full ? 'What we agreed' : meetingTitle(m)));
  const acts = actionsOf(m.id).filter((a) => a.title.trim());
  if (acts.length) s.push(...tableSlides(ctx, opts.full ? 'Action items' : `Action items — ${usDate(m.date)}`, ['What', 'Who', 'Due', 'Status'],
    acts.map((a) => [a.title, a.owner || '', a.due ? isoToUs(a.due) : '', a.status === 'done' ? 'Done' : a.status === 'doing' ? 'In progress' : 'Open']),
    [5, 1.8, 1.4, 1.3], { kicker: opts.full ? 'Next steps' : meetingTitle(m) }));
  if (m.photos.length) s.push(...photoSlides(ctx, opts.full ? 'Photos' : `Photos — ${usDate(m.date)}`, m.photos, meetingTitle(m)));
  void head;
  return s;
}

function meetingDeck(v: Record<string, any>, id?: string): Deck {
  const ctx = ctxFor(v);
  const m = id ? getMeeting(id) : undefined;
  if (!m) return { id: 'meeting', title: 'Meeting summary', file: 'Meeting', slides: [closingSlide('Meeting not found')] };
  const s: Slide[] = [titleSlide({ kicker: 'Meeting summary', title: meetingTitle(m), sub: `${longDate(m.date)}${m.time ? ` · ${time12(m.time)}` : ''}`, meta: [titleOf(v), str(v['cand.fullName'])].filter(Boolean).join('  ·  '), cover: cover(v) })];
  s.push(...meetingSlides(ctx, m, { full: true }));
  s.push(closingSlide('Thank you', 'Questions or changes? Let me know.'));
  return { id: 'meeting', title: `${meetingTitle(m)} — ${usDate(m.date)}`, file: `Meeting_${safe(meetingTitle(m))}_${m.date.replace(/-/g, '')}`, slides: number(s) };
}

// ───────────── 5. Meeting log (all meetings) ─────────────
function meetingLogDeck(v: Record<string, any>): Deck {
  const ctx = ctxFor(v);
  const t = todayIso();
  const held = allMeetings().filter((m) => m.date <= t).reverse(); // oldest first
  const acts = held.flatMap((m) => actionsOf(m.id));
  const decisions = held.reduce((a, m) => a + m.decisions.filter((d) => d.trim()).length, 0);
  const s: Slide[] = [titleSlide({ kicker: 'Meeting log', title: titleOf(v), sub: str(v['cand.fullName']), meta: unitLine(v), cover: cover(v) })];
  if (held.length) {
    s.push(statsSlide(ctx, 'Meetings at a glance', [
      { value: String(held.length), label: `meeting${held.length === 1 ? '' : 's'} held` },
      { value: String(decisions), label: 'decisions made' },
      { value: `${acts.filter((a) => a.status === 'done').length}/${acts.length}`, label: 'action items done' },
    ], 'Summary'));
    s.push(...tableSlides(ctx, 'All meetings', ['Date', 'Meeting', 'Who'], held.map((m) => [usDate(m.date), meetingTitle(m), attendees(m).join(', ')]), [1.4, 2.4, 5], { kicker: 'Log' }));
    for (const m of held) s.push(...meetingSlides(ctx, m, { full: false }));
  }
  s.push(closingSlide('Thank you', 'For every hour of advice along the way.'));
  return { id: 'meetings', title: 'Meeting log', file: fileName(v, 'Meeting_Log'), slides: number(s) };
}

// ───────────── 6. Fundraising & budget ─────────────
function fundraisingDeck(v: Record<string, any>): Deck {
  const ctx = ctxFor(v);
  const t = moneyTotals();
  const s: Slide[] = [titleSlide({ kicker: 'Fundraising & Budget', title: titleOf(v), sub: str(v['cand.fullName']), meta: unitLine(v), cover: cover(v) })];
  const stats = [
    ...(t.goal ? [{ value: money(t.goal), label: t.goalIsEstimate ? 'goal (cost estimate)' : 'fundraising goal' }] : []),
    { value: money(t.raised + t.inKind), label: t.inKind ? 'raised, incl. donated items' : 'raised so far' },
    ...(t.goal ? [{ value: `${t.pct}%`, label: 'of goal' }] : []),
    ...(t.spent ? [{ value: money(t.spent), label: 'spent' }] : []),
  ];
  s.push(statsSlide(ctx, 'Where we stand', stats, 'Progress'));
  s.push(...text(ctx, 'How I will raise the money', v, 'prop.fundraising', [], 'The plan'));
  const evs = sortedEvents();
  if (evs.length) s.push(...tableSlides(ctx, 'Fundraising events', ['Date', 'Event', 'Goal', 'Raised'],
    evs.map((e) => [e.date ? isoToUs(e.date) : 'TBD', e.title || 'Fundraiser', num(e.goal) ? money(num(e.goal)) : '', money(eventRaised(e.id))]),
    [1.4, 4, 1.5, 1.5], { kicker: 'Events', align: ['left', 'left', 'right', 'right'] }));
  if (t.raised || t.inKind) s.push(...tableSlides(ctx, 'Where the money comes from', ['Source', 'Amount'],
    [...FROM.map((f) => [f.label, money(t.byFrom[f.id])]), ['Donated items (value)', money(t.inKind)]], [4, 2],
    { kicker: 'Sources', total: ['Total', money(t.raised + t.inKind)], align: ['left', 'right'] }));
  const est: Record<string, number> = { materials: num(v['prop.costMaterials']), supplies: num(v['prop.costSupplies']), tools: num(v['prop.costTools']), other: num(v['prop.costOther']) };
  if (t.spent || t.estimate) s.push(...tableSlides(ctx, 'Budget vs. actual', ['Category', 'Estimated', 'Spent'],
    CATEGORIES.map((c) => [c.label, est[c.id] ? money(est[c.id]) : '', money(t.byCat[c.id])]), [3, 2, 2],
    { kicker: 'Spending', total: ['Total', money(t.estimate), money(t.spent)], align: ['left', 'right', 'right'] }));
  const ex = sortedExpenses().reverse();
  if (ex.length) s.push(...tableSlides(ctx, 'Purchases', ['Date', 'Item', 'Where from', 'Total'],
    ex.map((e) => [isoToUs(e.date), e.item, e.vendor || '', money(expenseTotal(e))]), [1.3, 4, 2.4, 1.4],
    { kicker: 'Spending', total: ['Total', '', '', money(t.spent)], align: ['left', 'left', 'left', 'right'] }));
  const donors = [...new Set(sortedDonations().filter((g) => g.donorId).map(giftLabel))].sort();
  if (donors.length) s.push(...bulletSlides(ctx, 'Thank you to our donors', donors, 'Gratitude'));
  s.push(closingSlide('Thank you', 'Every dollar and donated item goes into the project.'));
  return { id: 'fundraising', title: 'Fundraising & budget', file: fileName(v, 'Fundraising'), slides: number(s) };
}

export const DECKS: DeckDef[] = [
  { id: 'proposal', title: 'Proposal presentation', when: 'For proposal approval meetings', blurb: 'Your project idea, beneficiary, timeline, cost, and safety — for your Scoutmaster, committee, beneficiary, and council.', build: proposalDeck },
  { id: 'progress', title: 'Progress update', when: 'Anytime', blurb: 'Where things stand: % complete, steps done, what\'s next, and recent photos.', build: progressDeck },
  { id: 'fundraising', title: 'Fundraising & budget', when: 'For donors and your board of review', blurb: 'Your goal and progress, fundraising events, where the money comes from, budget vs. actual, and a thank-you to donors.', build: fundraisingDeck },
  { id: 'meetings', title: 'Meeting log', when: 'For your board of review', blurb: 'Every advisor meeting: who was there, what was decided, and which action items got done.', build: meetingLogDeck },
  { id: 'meeting', title: 'Meeting summary', when: 'After a meeting', hidden: true, blurb: '', build: meetingDeck },
  { id: 'report', title: 'Project report', when: 'After the work is done', blurb: 'Before, during, and after photos, the numbers, and what you learned — for your board of review.', build: reportDeck },
];
