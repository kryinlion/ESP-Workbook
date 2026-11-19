import { useState } from 'preact/hooks';
import { useProject } from '../core/store';
import { DateInput, SimpleInput, isoToUs, money } from '../ui/fields';
import { Photos } from '../ui/photos';
import {
  CATEGORIES, FROM, METHODS, addDonation, addDonor, addEvent, addExpense, catLabel, copyIntoWorkbook, donorName, eventRaised,
  expenseTotal, fromLabel, giftLabel, moneyStore, remove, setGoal, sortedDonations, sortedDonors, sortedEvents, sortedExpenses,
  totals, update, workbookCopyPlan, type Donation, type Donor, type Expense, type FundEvent,
} from '../money/model';
import { num } from '../workbook/schema';

const TABS = [['', 'Overview'], ['donations', 'Donations'], ['expenses', 'Expenses'], ['donors', 'Donors'], ['events', 'Events']] as const;
const go = (h: string) => { location.hash = h; };

export function Money({ parts }: { parts: string[] }) {
  moneyStore.use(); useProject();
  const [a, b] = parts;
  const d = moneyStore.get();
  if (a === 'donation') { const g = d.donations.find((x) => x.id === b); return g ? <DonationEdit g={g} /> : <Gone />; }
  if (a === 'expense') { const e = d.expenses.find((x) => x.id === b); return e ? <ExpenseEdit e={e} /> : <Gone />; }
  if (a === 'donor') { const p = d.donors.find((x) => x.id === b); return p ? <DonorEdit p={p} /> : <Gone />; }
  if (a === 'event') { const ev = d.events.find((x) => x.id === b); return ev ? <EventEdit ev={ev} /> : <Gone />; }
  const tab = a || '';
  return (
    <div class="page">
      <div class="sec-head"><h1>Money</h1></div>
      <nav class="chips">{TABS.map(([id, l]) => <a href={`#/money${id ? '/' + id : ''}`} class={tab === id ? 'on' : ''}>{l}</a>)}</nav>
      {tab === '' && <Overview />}
      {tab === 'donations' && <DonationList />}
      {tab === 'expenses' && <ExpenseList />}
      {tab === 'donors' && <DonorList />}
      {tab === 'events' && <EventList />}
    </div>
  );
}
function Gone() { return <div class="page"><a class="lnk back" href="#/money">‹ Money</a><p class="muted">That item was deleted.</p></div>; }
function Back({ to = '#/money', label = 'Money' }: { to?: string; label?: string }) { return <a class="lnk back" href={to}>‹ {label}</a>; }

// ───────── Overview
function Overview() {
  const t = totals();
  const d = moneyStore.get();
  const [editGoal, setEditGoal] = useState(false);
  return (
    <>
      <section class="card mn-goal">
        <div class="mn-goal-top">
          <span class="mn-big">{money(t.raised + t.inKind)}</span>
          <span class="muted">of {t.goal ? money(t.goal) : 'no goal yet'}</span>
        </div>
        <span class="bar big"><span style={{ width: `${t.pct}%` }} /></span>
        <p class="muted" style={{ margin: '8px 0 0' }}>
          {money(t.raised)} raised{t.inKind ? ` + ${money(t.inKind)} in donated items` : ''} · {t.pct}% of goal
          {t.goalIsEstimate ? ' (goal = your cost estimate from the proposal)' : ''}
        </p>
        {editGoal
          ? <div class="cell" style={{ marginTop: '10px' }}><span class="clbl">Fundraising goal</span><SimpleInput type="money" value={d.goal} onChange={setGoal} /><button type="button" class="lnk-btn" onClick={() => setEditGoal(false)}>Done</button></div>
          : <button type="button" class="lnk-btn" onClick={() => setEditGoal(true)}>{num(d.goal) ? 'Change goal' : 'Set a goal'}</button>}
      </section>

      <div class="mn-stats">
        <div class="card"><span class="mn-k">Raised</span><b>{money(t.raised)}</b></div>
        <div class="card"><span class="mn-k">Spent</span><b>{money(t.spent)}</b></div>
        <div class="card"><span class="mn-k">Balance</span><b class={t.balance < 0 ? 'neg' : ''}>{money(t.balance)}</b></div>
        <a class="card" href="#/money/donations"><span class="mn-k">Thank-yous to send</span><b class={t.thankYous.length ? 'warn-t' : ''}>{t.thankYous.length}</b></a>
      </div>

      <div class="deck-actions">
        <button class="btn" onClick={() => go(`#/money/donation/${addDonation()}`)}>＋ Donation</button>
        <button class="btn ghost" onClick={() => go(`#/money/expense/${addExpense()}`)}>＋ Expense</button>
      </div>

      {t.raised > 0 && (
        <section class="card" style={{ marginTop: '14px' }}>
          <h3>Who's holding the money</h3>
          {t.held.map(([k, n]) => <div class="mn-line"><span>{k}</span><b>{money(n)}</b></div>)}
          <p class="hint">Money for an Eagle project is usually held by your unit or the beneficiary, not by you.</p>
        </section>
      )}

      {(t.raised > 0 || t.spent > 0) && (
        <section class="card">
          <h3>Where it came from</h3>
          {FROM.map((f) => <div class="mn-line"><span>{f.label}</span><b>{money(t.byFrom[f.id])}</b></div>)}
          <div class="mn-line"><span>Donated items (value)</span><b>{money(t.inKind)}</b></div>
          <h3 style={{ marginTop: '14px' }}>Where it went</h3>
          {CATEGORIES.map((c) => <div class="mn-line"><span>{c.label}</span><b>{money(t.byCat[c.id])}</b></div>)}
          {t.estimate > 0 && <p class="hint">Your proposal estimated {money(t.estimate)} in total costs.</p>}
        </section>
      )}

      <CopyCard />

      <a href="#/decks/fundraising" class="card deck-link"><span class="ti">▶</span><span><b>Fundraising presentation</b><small>Goal, progress, events, sources, and spending — for donors and your board of review</small></span></a>
    </>
  );
}

function CopyCard() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState('');
  const p = workbookCopyPlan();
  const changed = p.fields.filter((r) => num(r.current) !== num(r.next));
  return (
    <section class="card">
      <h3>Copy into workbook</h3>
      <p class="intro">Fill the workbook's money boxes (Plan p.17 and Report p.21) from this tracker. Nothing changes in your workbook until you tap Copy.</p>
      {!open && <button class="btn ghost wide" onClick={() => { setOpen(true); setDone(''); }}>Review what will change…</button>}
      {open && (
        <>
          <table class="mn-copy">
            <thead><tr><th>Workbook box</th><th>Now</th><th>New</th></tr></thead>
            <tbody>
              {p.fields.map((r) => <tr class={num(r.current) !== num(r.next) ? 'chg' : ''}><td>{r.label}</td><td>{r.current === '' ? '—' : money(num(r.current))}</td><td>{money(num(r.next))}</td></tr>)}
              <tr class={p.spendingRows.length ? 'chg' : ''}><td>Report p.21 · Spending table</td><td>—</td><td>{p.spendingRows.length} row{p.spendingRows.length === 1 ? '' : 's'}</td></tr>
            </tbody>
          </table>
          <div class="row-btns">
            <button class="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button class="btn" onClick={() => { copyIntoWorkbook({ fields: true, spending: p.spendingRows.length > 0 }); setOpen(false); setDone(`✓ Copied ${changed.length} amount${changed.length === 1 ? '' : 's'}${p.spendingRows.length ? ` and ${p.spendingRows.length} spending rows` : ''} into your workbook`); }}>Copy into workbook</button>
          </div>
          {p.spendingRows.length > 9 && <p class="hint">The printed workbook has room for 9 spending rows; the rest go on an attachment page.</p>}
        </>
      )}
      {done && <p class="toast">{done}</p>}
    </section>
  );
}

// ───────── Lists
function Row({ href, title, sub, amt, flag }: { href: string; title: string; sub: string; amt?: string; flag?: string }) {
  return (
    <a class="mn-row" href={href}>
      <span class="mn-row-main"><b>{title}</b><small>{sub}</small></span>
      <span class="mn-row-end">{amt && <b>{amt}</b>}{flag && <small class="warn-t">{flag}</small>}</span>
    </a>
  );
}
function Empty({ text, add, label }: { text: string; add: () => void; label: string }) {
  return <div class="card"><p class="muted" style={{ marginTop: 0 }}>{text}</p><button class="btn wide" onClick={add}>{label}</button></div>;
}

function DonationList() {
  const gs = sortedDonations();
  const addIt = () => go(`#/money/donation/${addDonation()}`);
  if (!gs.length) return <Empty text="Every gift goes here: money, and donated items or services like lumber or a store discount." add={addIt} label="＋ Add a donation" />;
  return (
    <>
      <div class="card mn-list">{gs.map((g) => <Row href={`#/money/donation/${g.id}`} title={giftLabel(g)}
        sub={`${isoToUs(g.date)} · ${g.kind === 'inkind' ? `Item: ${g.item || '—'}` : `${fromLabel(g.from)}${g.method ? ' · ' + g.method : ''}`}`}
        amt={money(num(g.amount))} flag={!g.thanked && (g.donorId || g.kind === 'inkind') ? 'thank-you due' : undefined} />)}</div>
      <button type="button" class="fab" aria-label="Add donation" onClick={addIt}>＋</button>
    </>
  );
}
function ExpenseList() {
  const es = sortedExpenses();
  const addIt = () => go(`#/money/expense/${addExpense()}`);
  if (!es.length) return <Empty text="Log what you buy. Snap a photo of each receipt so the numbers are easy to prove later." add={addIt} label="＋ Add an expense" />;
  return (
    <>
      <div class="card mn-list">{es.map((e) => <Row href={`#/money/expense/${e.id}`} title={e.item || 'Expense'}
        sub={`${isoToUs(e.date)} · ${catLabel(e.category)}${e.vendor ? ' · ' + e.vendor : ''}${e.photos.length ? ' · 🧾' : ''}`} amt={money(expenseTotal(e))} />)}</div>
      <button type="button" class="fab" aria-label="Add expense" onClick={addIt}>＋</button>
    </>
  );
}
function DonorList() {
  const ds = sortedDonors();
  const addIt = () => go(`#/money/donor/${addDonor()}`);
  const gifts = moneyStore.get().donations;
  if (!ds.length) return <Empty text="People and businesses who give. Their contact details stay on this device; only names go to the cloud backup." add={addIt} label="＋ Add a donor" />;
  return (
    <>
      <div class="card mn-list">{ds.map((p) => {
        const mine = gifts.filter((g) => g.donorId === p.id);
        const owed = mine.filter((g) => !g.thanked).length;
        return <Row href={`#/money/donor/${p.id}`} title={p.name || 'Unnamed donor'} sub={`${mine.length} gift${mine.length === 1 ? '' : 's'}`}
          amt={money(mine.reduce((a, g) => a + num(g.amount), 0))} flag={owed ? 'thank-you due' : undefined} />;
      })}</div>
      <button type="button" class="fab" aria-label="Add donor" onClick={addIt}>＋</button>
    </>
  );
}
function EventList() {
  const es = sortedEvents();
  const addIt = () => go(`#/money/event/${addEvent()}`);
  if (!es.length) return <Empty text="Car washes, pancake breakfasts, bake sales… Each event gets its own goal and shows on your Timeline." add={addIt} label="＋ Add a fundraising event" />;
  return (
    <>
      <div class="card mn-list">{es.map((e) => {
        const r = eventRaised(e.id), g = num(e.goal);
        return <Row href={`#/money/event/${e.id}`} title={e.title || 'Fundraiser'} sub={`${e.date ? isoToUs(e.date) : 'No date yet'}${g ? ` · goal ${money(g)}` : ''}`} amt={money(r)} />;
      })}</div>
      <button type="button" class="fab" aria-label="Add event" onClick={addIt}>＋</button>
    </>
  );
}

// ───────── Editors
function Pick<T extends string>({ opts, value, onChange }: { opts: { id: T; label: string }[]; value?: T; onChange: (v: T) => void }) {
  return <div class="pick">{opts.map((o) => <button type="button" class={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>;
}
function Del({ onDel, what, note }: { onDel: () => void; what: string; note?: string }) {
  const [ask, setAsk] = useState(false);
  return (
    <div class="row-btns" style={{ marginTop: '22px' }}>
      {ask ? <><button class="btn ghost" onClick={() => setAsk(false)}>Cancel</button><button class="btn danger" onClick={onDel}>Delete {what}</button>{note && <p class="hint" style={{ width: '100%' }}>{note}</p>}</>
        : <button class="btn ghost small" onClick={() => setAsk(true)}>Delete {what}…</button>}
    </div>
  );
}
const C = ({ label, children, half }: { label: string; children: any; half?: boolean }) => <div class={`cell${half ? ' half' : ''}`}><span class="clbl">{label}</span>{children}</div>;

function DonorPicker({ value, onChange }: { value?: string; onChange: (id?: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const ds = sortedDonors();
  if (adding) {
    return (
      <div class="mt-line">
        <input class="inp" autoFocus value={name} placeholder="Donor's name (person or business)" autoCapitalize="words" onInput={(e: any) => setName(e.target.value)} />
        <button type="button" class="btn small" onClick={() => { if (name.trim()) onChange(addDonor({ name: name.trim() })); setAdding(false); setName(''); }}>Add</button>
      </div>
    );
  }
  return (
    <div class="mt-line">
      <select class="inp" value={value || ''} onChange={(e: any) => onChange(e.target.value || undefined)}>
        <option value="">— Not from a specific donor —</option>
        {ds.map((p) => <option value={p.id}>{p.name || 'Unnamed donor'}</option>)}
      </select>
      <button type="button" class="btn ghost small" onClick={() => setAdding(true)}>＋ New</button>
    </div>
  );
}

function DonationEdit({ g }: { g: Donation }) {
  const up = (p: Partial<Donation>) => update('donations', g.id, p);
  const evs = sortedEvents();
  const inkind = g.kind === 'inkind';
  return (
    <div class="page mt-edit">
      <Back to="#/money/donations" label="Donations" />
      <div class="sec-head"><h1>{giftLabel(g) || 'Donation'}</h1></div>
      <section class="card">
        <Pick opts={[{ id: 'money', label: '💵 Money' }, { id: 'inkind', label: '📦 Item or service' }]} value={g.kind} onChange={(k) => up({ kind: k })} />
        <C label="From"><DonorPicker value={g.donorId} onChange={(id) => up({ donorId: id })} /></C>
        {inkind && <C label="What was given"><input class="inp" value={g.item || ''} placeholder="e.g. 12 cedar posts, 20% lumber discount" onInput={(e: any) => up({ item: e.target.value })} /></C>}
        <div class="grid2">
          <C label={inkind ? 'Value' : 'Amount'} half><SimpleInput type="money" value={g.amount} onChange={(v) => up({ amount: v })} /></C>
          <C label="Date" half><DateInput value={g.date} onChange={(v) => v && up({ date: v })} /></C>
        </div>
        {!inkind && <C label="Source (for your workbook, p.17)"><Pick opts={FROM} value={g.from} onChange={(f) => up({ from: f })} /></C>}
        {!inkind && <p class="hint">{FROM.find((f) => f.id === g.from)?.hint}</p>}
      </section>
      {!inkind && (
        <section class="card">
          <h3>Payment</h3>
          <Pick opts={METHODS} value={g.method} onChange={(m) => up({ method: m })} />
          <C label="Who is holding it?"><input class="inp" value={g.heldBy || ''} placeholder="e.g. Ship 170 treasurer, Nature Center" autoCapitalize="words" onInput={(e: any) => up({ heldBy: e.target.value })} /></C>
        </section>
      )}
      <section class="card">
        {evs.length > 0 && (
          <C label="Fundraising event">
            <select class="inp" value={g.eventId || ''} onChange={(e: any) => up({ eventId: e.target.value || undefined })}>
              <option value="">— None —</option>
              {evs.map((e) => <option value={e.id}>{e.title || 'Fundraiser'}{e.date ? ` (${isoToUs(e.date)})` : ''}</option>)}
            </select>
          </C>
        )}
        <label class="mn-check"><input type="checkbox" checked={!!g.thanked} onChange={(e: any) => up({ thanked: e.target.checked, thankedOn: e.target.checked ? g.thankedOn || new Date().toISOString().slice(0, 10) : undefined })} /> Thank-you sent{g.thankedOn ? ` (${isoToUs(g.thankedOn)})` : ''}</label>
        <C label="Photos (check, receipt, letter)"><Photos value={g.photos} onChange={(ph) => up({ photos: ph })} label="Donation" /></C>
        <C label="Notes"><textarea class="inp area" value={g.notes || ''} onInput={(e: any) => up({ notes: e.target.value })} /></C>
      </section>
      <Del what="donation" onDel={() => { remove('donations', g.id); go('#/money/donations'); }} />
    </div>
  );
}

function ExpenseEdit({ e }: { e: Expense }) {
  const up = (p: Partial<Expense>) => update('expenses', e.id, p);
  const calc = num(e.qty) * num(e.unit);
  return (
    <div class="page mt-edit">
      <Back to="#/money/expenses" label="Expenses" />
      <div class="sec-head"><h1>{e.item || 'Expense'}</h1></div>
      <section class="card">
        <C label="Item"><input class="inp" value={e.item} placeholder="e.g. Cedar 4x4 posts" onInput={(x: any) => up({ item: x.target.value })} /></C>
        <C label="Category"><Pick opts={CATEGORIES} value={e.category} onChange={(c) => up({ category: c })} /></C>
        <div class="grid2">
          <C label="Quantity" half><SimpleInput type="num" value={e.qty} onChange={(v) => up({ qty: v })} /></C>
          <C label="Unit cost" half><SimpleInput type="money" value={e.unit} onChange={(v) => up({ unit: v })} /></C>
        </div>
        <div class="grid2">
          <C label="Total" half><SimpleInput type="money" value={e.total} onChange={(v) => up({ total: v })} placeholder={calc ? calc.toFixed(2) : '0.00'} /></C>
          <C label="Date" half><DateInput value={e.date} onChange={(v) => v && up({ date: v })} /></C>
        </div>
        {!e.total && calc > 0 && <p class="hint">Total = quantity × unit cost ({money(calc)}). Type a total to override.</p>}
        <C label="Where from (store, vendor)"><input class="inp" value={e.vendor || ''} autoCapitalize="words" onInput={(x: any) => up({ vendor: x.target.value })} /></C>
        <C label="Description"><input class="inp" value={e.desc || ''} placeholder="Size, grade, color…" onInput={(x: any) => up({ desc: x.target.value })} /></C>
        <C label="Paid by"><input class="inp" value={e.paidBy || ''} placeholder="e.g. Ship 170 treasurer" autoCapitalize="words" onInput={(x: any) => up({ paidBy: x.target.value })} /></C>
      </section>
      <section class="card">
        <C label="Receipt photos"><Photos value={e.photos} onChange={(ph) => up({ photos: ph })} label="Receipt" /></C>
        <C label="Notes"><textarea class="inp area" value={e.notes || ''} onInput={(x: any) => up({ notes: x.target.value })} /></C>
      </section>
      <Del what="expense" onDel={() => { remove('expenses', e.id); go('#/money/expenses'); }} />
    </div>
  );
}

function DonorEdit({ p }: { p: Donor }) {
  const up = (x: Partial<Donor>) => update('donors', p.id, x);
  const gifts = sortedDonations().filter((g) => g.donorId === p.id);
  return (
    <div class="page mt-edit">
      <Back to="#/money/donors" label="Donors" />
      <div class="sec-head"><h1>{p.name || 'New donor'}</h1></div>
      <section class="card">
        <C label="Name (person or business)"><input class="inp" value={p.name} autoCapitalize="words" onInput={(e: any) => up({ name: e.target.value })} /></C>
        <div class="grid2">
          <C label="Email" half><SimpleInput type="email" value={p.email} onChange={(v) => up({ email: v })} /></C>
          <C label="Phone" half><SimpleInput type="tel" value={p.phone} onChange={(v) => up({ phone: v })} /></C>
        </div>
        <C label="Mailing address (for thank-you notes)"><textarea class="inp area short" value={p.address || ''} onInput={(e: any) => up({ address: e.target.value })} /></C>
        <p class="hint">Email, phone, and address stay on this device only.</p>
        <C label="Notes"><textarea class="inp area short" value={p.notes || ''} onInput={(e: any) => up({ notes: e.target.value })} /></C>
      </section>
      <section class="card">
        <h3>Gifts</h3>
        {gifts.map((g) => (
          <div class="mn-gift">
            <a href={`#/money/donation/${g.id}`}><b>{money(num(g.amount))}</b> {g.kind === 'inkind' ? `· ${g.item || 'item'}` : ''} · {isoToUs(g.date)}</a>
            <label class="mn-check"><input type="checkbox" checked={!!g.thanked} onChange={(e: any) => update('donations', g.id, { thanked: e.target.checked, thankedOn: e.target.checked ? new Date().toISOString().slice(0, 10) : undefined })} /> Thanked</label>
          </div>
        ))}
        <button class="btn ghost small" onClick={() => go(`#/money/donation/${addDonation({ donorId: p.id })}`)}>＋ Add a gift from {p.name || 'this donor'}</button>
      </section>
      <Del what="donor" note="Their gifts stay in your records, just without a name." onDel={() => { remove('donors', p.id); go('#/money/donors'); }} />
    </div>
  );
}

function EventEdit({ ev }: { ev: FundEvent }) {
  const up = (x: Partial<FundEvent>) => update('events', ev.id, x);
  const gifts = sortedDonations().filter((g) => g.eventId === ev.id);
  const raised = eventRaised(ev.id), goal = num(ev.goal);
  return (
    <div class="page mt-edit">
      <Back to="#/money/events" label="Events" />
      <div class="sec-head"><h1>{ev.title || 'Fundraising event'}</h1></div>
      <section class="card">
        <C label="Event"><input class="inp" value={ev.title} placeholder="e.g. Pancake breakfast" autoCapitalize="sentences" onInput={(e: any) => up({ title: e.target.value })} /></C>
        <div class="grid2">
          <C label="Date" half><DateInput value={ev.date} onChange={(v) => up({ date: v || undefined })} /></C>
          <C label="Goal" half><SimpleInput type="money" value={ev.goal} onChange={(v) => up({ goal: v })} /></C>
        </div>
        <C label="Where"><input class="inp" value={ev.where || ''} onInput={(e: any) => up({ where: e.target.value })} /></C>
        <C label="Plan and notes"><textarea class="inp area" value={ev.notes || ''} placeholder="What you'll sell, who's helping, supplies, approvals…" onInput={(e: any) => up({ notes: e.target.value })} /></C>
        <p class="hint">Fundraising events usually need approval first (workbook Appendix D, Fundraising Application).</p>
      </section>
      <section class="card">
        <h3>Raised: {money(raised)}{goal ? ` of ${money(goal)}` : ''}</h3>
        {goal > 0 && <span class="bar big"><span style={{ width: `${Math.min(100, Math.round((raised / goal) * 100))}%` }} /></span>}
        {gifts.map((g) => <Row href={`#/money/donation/${g.id}`} title={giftLabel(g)} sub={isoToUs(g.date)} amt={money(num(g.amount))} />)}
        <button class="btn ghost small" style={{ marginTop: '10px' }} onClick={() => go(`#/money/donation/${addDonation({ eventId: ev.id, from: 'others' })}`)}>＋ Add money raised at this event</button>
      </section>
      <Del what="event" note="Donations from it stay in your records." onDel={() => { remove('events', ev.id); go('#/money/events'); }} />
    </div>
  );
}

export { donorName };
