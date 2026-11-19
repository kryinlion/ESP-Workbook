import { createDocStore } from '../core/docstore';
import { setValue, values } from '../core/store';
import type { PhotoRef } from '../core/media';
import { num } from '../workbook/schema';
import { isPast, registerTimelineItems, type Item } from '../timeline/model';

// ── Money tracker (P5)
// Decided with Mark 2026-11-19:
//  • Donor NAMES go to the cloud backup; donor emails/phones/addresses get [re-enter] placeholders.
//  • Workbook money fields are filled only when Colin taps "Copy into workbook" — never automatically.
//  • One overall goal + fundraising events (events show on the Timeline).
//  • Each donation records payment type and who is holding the money.

export type From = 'beneficiary' | 'exempt' | 'others';
export type Method = 'cash' | 'check' | 'online' | 'other';
export type Category = 'materials' | 'supplies' | 'tools' | 'other';

export interface Donor { id: string; name: string; email?: string; phone?: string; address?: string; notes?: string; createdAt: number }
export interface Donation {
  id: string; date: string; donorId?: string; kind: 'money' | 'inkind';
  amount: string;             // money given, or the VALUE of an in-kind gift
  item?: string;              // in-kind: what was given
  from: From;                 // workbook p.17 buckets
  method?: Method; heldBy?: string;
  eventId?: string;
  thanked?: boolean; thankedOn?: string;
  photos: PhotoRef[]; notes?: string; createdAt: number;
}
export interface Expense {
  id: string; date: string; item: string; desc?: string; qty?: string; unit?: string; total: string;
  vendor?: string; category: Category; paidBy?: string; photos: PhotoRef[]; notes?: string; createdAt: number;
}
export interface FundEvent { id: string; title: string; date?: string; goal?: string; where?: string; notes?: string; createdAt: number }
export interface MoneyDoc { schema: 1; goal?: string; donors: Donor[]; donations: Donation[]; expenses: Expense[]; events: FundEvent[] }

export const moneyStore = createDocStore<MoneyDoc>('money', () => ({ schema: 1, donors: [], donations: [], expenses: [], events: [] }));

export const FROM: { id: From; label: string; hint: string }[] = [
  { id: 'others', label: 'Others', hint: 'Donors, fundraisers, store discounts, crowdfunding' },
  { id: 'exempt', label: 'Family or unit', hint: 'Exempt sources: your family, your troop/crew/ship' },
  { id: 'beneficiary', label: 'Beneficiary', hint: 'The organization the project helps' },
];
export const METHODS: { id: Method; label: string }[] = [
  { id: 'cash', label: 'Cash' }, { id: 'check', label: 'Check' }, { id: 'online', label: 'Online' }, { id: 'other', label: 'Other' },
];
export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'materials', label: 'Materials' }, { id: 'supplies', label: 'Supplies' }, { id: 'tools', label: 'Tools' }, { id: 'other', label: 'Other' },
];
export const fromLabel = (f: From) => FROM.find((x) => x.id === f)?.label || f;
export const catLabel = (c: Category) => CATEGORIES.find((x) => x.id === c)?.label || c;

// ── CRUD
const today = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
type ListKey = 'donors' | 'donations' | 'expenses' | 'events';
function add<K extends ListKey>(k: K, rec: MoneyDoc[K][number]) { moneyStore.set((d) => ({ ...d, [k]: [...d[k], rec] })); return rec.id; }
export function update<K extends ListKey>(k: K, id: string, patch: Partial<MoneyDoc[K][number]>) {
  moneyStore.set((d) => ({ ...d, [k]: (d[k] as any[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
}
export function remove(k: ListKey, id: string) {
  moneyStore.set((d) => {
    const next: MoneyDoc = { ...d, [k]: (d[k] as any[]).filter((x) => x.id !== id) };
    // unlink (never delete) gifts that pointed at a removed donor / event
    if (k === 'donors') next.donations = next.donations.map((g) => (g.donorId === id ? { ...g, donorId: undefined } : g));
    if (k === 'events') next.donations = next.donations.map((g) => (g.eventId === id ? { ...g, eventId: undefined } : g));
    return next;
  });
}
export const addDonor = (p: Partial<Donor> = {}) => add('donors', { id: crypto.randomUUID(), name: '', createdAt: Date.now(), ...p });
export const addDonation = (p: Partial<Donation> = {}) => add('donations', { id: crypto.randomUUID(), date: today(), kind: 'money', amount: '', from: 'others', photos: [], createdAt: Date.now(), ...p });
export const addExpense = (p: Partial<Expense> = {}) => add('expenses', { id: crypto.randomUUID(), date: today(), item: '', total: '', category: 'materials', photos: [], createdAt: Date.now(), ...p });
export const addEvent = (p: Partial<FundEvent> = {}) => add('events', { id: crypto.randomUUID(), title: '', createdAt: Date.now(), ...p });
export const setGoal = (g: string) => moneyStore.set((d) => ({ ...d, goal: g }));

export const donorName = (id?: string) => (id ? moneyStore.get().donors.find((d) => d.id === id)?.name || '' : '');
export const giftLabel = (g: Donation) => donorName(g.donorId) || (g.kind === 'inkind' ? g.item || 'In-kind gift' : 'Donation');
export const expenseTotal = (e: Expense) => (e.total !== '' && e.total != null ? num(e.total) : num(e.qty) * num(e.unit));
const byDate = <T extends { date?: string; createdAt: number }>(a: T, b: T) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt;

// ── totals
export function totals(d = moneyStore.get()) {
  const cash = d.donations.filter((g) => g.kind === 'money');
  const inkind = d.donations.filter((g) => g.kind === 'inkind');
  const sum = (xs: Donation[]) => xs.reduce((a, g) => a + num(g.amount), 0);
  const raised = sum(cash);
  const inKind = sum(inkind);
  const spent = d.expenses.reduce((a, e) => a + expenseTotal(e), 0);
  const byFrom = Object.fromEntries(FROM.map((f) => [f.id, sum(cash.filter((g) => g.from === f.id))])) as Record<From, number>;
  const byCat = Object.fromEntries(CATEGORIES.map((c) => [c.id, d.expenses.filter((e) => e.category === c.id).reduce((a, e) => a + expenseTotal(e), 0)])) as Record<Category, number>;
  const estimate = num(values()['prop.costMaterials']) + num(values()['prop.costSupplies']) + num(values()['prop.costTools']) + num(values()['prop.costOther']);
  const goal = num(d.goal) || estimate;
  const thankYous = d.donations.filter((g) => !g.thanked && (g.donorId || g.kind === 'inkind'));
  const held = Object.entries(cash.reduce((a: Record<string, number>, g) => { const k = (g.heldBy || '').trim() || 'Not recorded'; a[k] = (a[k] || 0) + num(g.amount); return a; }, {}));
  return { raised, inKind, spent, balance: raised - spent, byFrom, byCat, goal, goalIsEstimate: !num(d.goal) && estimate > 0, estimate, pct: goal ? Math.min(100, Math.round(((raised + inKind) / goal) * 100)) : 0, thankYous, held };
}
export const eventRaised = (id: string) => moneyStore.get().donations.filter((g) => g.eventId === id).reduce((a, g) => a + num(g.amount), 0);
export const sortedDonations = () => [...moneyStore.get().donations].sort(byDate);
export const sortedExpenses = () => [...moneyStore.get().expenses].sort(byDate);
export const sortedEvents = () => [...moneyStore.get().events].sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
export const sortedDonors = () => [...moneyStore.get().donors].sort((a, b) => a.name.localeCompare(b.name));

// ── "Copy into workbook" (only when Colin taps it)
const m2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
export interface CopyRow { id: string; label: string; current: string; next: string }
export function workbookCopyPlan(): { fields: CopyRow[]; spendingRows: any[] } {
  const t = totals(); const v = values();
  const f = (id: string, label: string, n: number): CopyRow => ({ id, label, current: v[id] ?? '', next: m2(n) });
  const fields = [
    f('plan.fromBeneficiary', 'Plan p.17 · Contribution from beneficiary', t.byFrom.beneficiary),
    f('plan.fromExempt', 'Plan p.17 · Contributions from family / unit', t.byFrom.exempt),
    f('plan.fromOthers', 'Plan p.17 · Contributions from others', t.byFrom.others),
    f('plan.inKind', 'Plan p.17 · Donations of materials / tools', t.inKind),
    f('rep.collected', 'Report p.21 · How much was collected', t.raised),
    f('rep.spent', 'Report p.21 · How much was spent', t.spent),
  ];
  const spendingRows = sortedExpenses().reverse().map((e) => ({
    item: e.item, desc: e.desc || '', qty: e.qty || '', unit: e.unit || '', total: m2(expenseTotal(e)), source: e.vendor || '',
  }));
  return { fields, spendingRows };
}
export function copyIntoWorkbook(opts: { fields: boolean; spending: boolean }) {
  const p = workbookCopyPlan();
  if (opts.fields) for (const r of p.fields) setValue(r.id, r.next);
  if (opts.spending) setValue('rep.spending', p.spendingRows);
}

// Fundraising events appear on the Timeline (tap → opens the event).
registerTimelineItems((): Item[] => moneyStore.get().events.filter((e) => e.date).map((e) => ({
  key: `fund:${e.id}`, kind: 'milestone', title: `Fundraiser: ${e.title || 'event'}`, due: e.date, phase: 'plan',
  status: isPast(e.date!) ? 'done' : 'todo', href: `#/money/event/${e.id}`,
})));
