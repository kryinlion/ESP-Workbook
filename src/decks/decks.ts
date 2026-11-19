import type { Ctx, Deck, Slide } from './engine';
import { bulletSlides, closingSlide, number, photoSlides, statsSlide, tableSlides, textSlides, titleSlide, type Photo } from './layouts';
import { CHECKLIST, HOURS_ROWS, SECTIONS, hoursTotals, num, rowValue, type Field } from '../workbook/schema';
import { overallProgress } from '../workbook/progress';
import { RANKS, rankFor } from '../ui/hero';
import { allItems, daysBetween, deadline18, phaseOf, todayIso } from '../timeline/model';
import { isoToUs } from '../ui/fields';

// The decks. Each one is built live from Colin's answers, so it's always up to date —
// slides with nothing filled in are skipped.

export interface DeckDef { id: string; title: string; blurb: string; when: string; build: (v: Record<string, any>) => Deck }

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

export const DECKS: DeckDef[] = [
  { id: 'proposal', title: 'Proposal presentation', when: 'For proposal approval meetings', blurb: 'Your project idea, beneficiary, timeline, cost, and safety — for your Scoutmaster, committee, beneficiary, and council.', build: proposalDeck },
  { id: 'progress', title: 'Progress update', when: 'Anytime', blurb: 'Where things stand: % complete, steps done, what\'s next, and recent photos.', build: progressDeck },
  { id: 'report', title: 'Project report', when: 'After the work is done', blurb: 'Before, during, and after photos, the numbers, and what you learned — for your board of review.', build: reportDeck },
];
