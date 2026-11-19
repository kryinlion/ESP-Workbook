import { useMemo, useState } from 'preact/hooks';
import { useProject, values } from '../core/store';
import { shareOrDownload } from '../core/backup';
import { DateInput } from '../ui/fields';
import { Photos } from '../ui/photos';
import {
  addDays, addTask, allItems, daysBetween, deadline18, deleteTask, iso, type Item, parse, type Phase, PHASES, phaseOf,
  relDay, setStatus, type Status, timeline, todayIso, updateItem,
} from '../timeline/model';
import { buildIcs } from '../timeline/ics';

type View = 'list' | 'cal' | 'trail';
type Filter = 'all' | 'steps' | 'tasks';

export function Timeline({ view: v0 }: { view?: string }) {
  useProject(); timeline.use();
  const view: View = v0 === 'cal' || v0 === 'trail' ? v0 : 'list';
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Item | 'new' | null>(null);
  const [newDue, setNewDue] = useState<string | undefined>();
  const items = allItems();
  const shown = items.filter((i) => filter === 'all' || (filter === 'steps' ? i.kind !== 'task' : i.kind !== 'checklist'));
  const openItem = open && open !== 'new' ? items.find((i) => i.key === open.key) : undefined;

  return (
    <div class="page tlpage">
      <div class="sec-head"><h1>Timeline</h1></div>
      <Countdown />
      <div class="tl-bar">
        <div class="seg">
          {(['list', 'cal', 'trail'] as View[]).map((x) => (
            <a href={`#/timeline/${x}`} class={`segl${view === x ? ' on' : ''}`}>{x === 'list' ? 'List' : x === 'cal' ? 'Calendar' : 'Trail'}</a>
          ))}
        </div>
        <div class="seg small">
          {(['all', 'steps', 'tasks'] as Filter[]).map((x) => (
            <button type="button" class={filter === x ? 'on' : ''} onClick={() => setFilter(x)}>{x === 'all' ? 'All' : x === 'steps' ? 'Workbook steps' : 'My tasks'}</button>
          ))}
        </div>
      </div>

      {view === 'list' && <ListView items={shown} onOpen={setOpen} />}
      {view === 'cal' && <CalView items={shown} onOpen={setOpen} onAdd={(d) => { setNewDue(d); setOpen('new'); }} />}
      {view === 'trail' && <TrailView items={shown} onOpen={setOpen} />}

      <div class="tl-foot">
        <button type="button" class="btn ghost small" onClick={() => exportIcs(items)}>📅 Add dates to my phone calendar</button>
      </div>

      <button type="button" class="fab" aria-label="Add task" onClick={() => { setNewDue(undefined); setOpen('new'); }}>＋</button>
      {open === 'new' && <NewTask due={newDue} onClose={() => setOpen(null)} />}
      {openItem && <ItemSheet it={openItem} onClose={() => setOpen(null)} />}
    </div>
  );
}

async function exportIcs(items: Item[]) {
  const text = buildIcs(items, values()['project.title'] || 'Eagle Project');
  await shareOrDownload(new File([text], 'Eagle_Project_dates.ics', { type: 'text/calendar' }));
}

// ── 18th-birthday countdown (the one hard deadline)
function Countdown() {
  const d18 = deadline18();
  const t = todayIso();
  if (!d18) return <a class="card countdown muted-cd" href="#/workbook/contacts"><b>Add your birth date</b><span>On Contacts. Your report must be signed before your 18th birthday, so we'll count down to it.</span></a>;
  const days = daysBetween(t, d18);
  const ck = (values().checklist || {}) as Record<number, boolean>;
  const signed = ck[14];
  return (
    <div class={`card countdown${days < 90 && !signed ? ' hot' : ''}`}>
      <div class="cd-num">{Math.max(0, days)}</div>
      <div class="cd-txt">
        <b>{signed ? 'Report signed. Deadline met!' : days >= 0 ? 'days until your 18th birthday' : 'Past 18th birthday'}</b>
        <span>Your project report must be completed and signed before {parse(d18).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</span>
      </div>
    </div>
  );
}

// ── List view: Overdue / This week / Later / No date / Done
function ListView({ items, onOpen }: { items: Item[]; onOpen: (i: Item) => void }) {
  const t = todayIso(), wk = addDays(t, 7);
  const [showDone, setShowDone] = useState(false);
  const live = items.filter((i) => i.status !== 'done' && !(i.kind === 'milestone' && i.due! < t));
  const byDate = (a: Item, b: Item) => (a.due || '9').localeCompare(b.due || '9') || (a.num || 99) - (b.num || 99);
  const groups: [string, Item[], string?][] = [
    ['Overdue', live.filter((i) => i.due && i.due < t).sort(byDate), 'bad'],
    ['This week', live.filter((i) => i.due && i.due >= t && i.due <= wk).sort(byDate)],
    ['Coming up', live.filter((i) => i.due && i.due > wk).sort(byDate)],
    ['No date yet', live.filter((i) => !i.due).sort(byDate), 'quiet'],
  ];
  const done = items.filter((i) => i.status === 'done' && i.kind !== 'milestone');
  return (
    <div class="tl-list">
      {groups.map(([title, list, tone]) => list.length > 0 && (
        <section class={`tl-group ${tone || ''}`}>
          <h3>{title} <span class="count">{list.length}</span></h3>
          {list.map((i) => <Row it={i} onOpen={onOpen} />)}
        </section>
      ))}
      {done.length > 0 && (
        <section class="tl-group done">
          <button type="button" class="h3btn" onClick={() => setShowDone(!showDone)}>Done <span class="count">{done.length}</span> {showDone ? '▾' : '▸'}</button>
          {showDone && done.map((i) => <Row it={i} onOpen={onOpen} />)}
        </section>
      )}
    </div>
  );
}

function Row({ it, onOpen }: { it: Item; onOpen: (i: Item) => void }) {
  const p = colorOf(it);
  const t = todayIso();
  const over = it.due && it.due < t && it.status !== 'done';
  if (it.kind === 'milestone') {
    return (
      <button type="button" class={`row ms${it.hard ? ' hard' : ''}`} onClick={() => onOpen(it)} style={{ '--pc': p.color } as any}>
        <span class="diamond" />
        <span class="row-main"><span class="row-title">{it.title}</span><span class="row-sub">{relDay(it.due!)} · milestone</span></span>
      </button>
    );
  }
  const next: Status = it.status === 'done' ? 'todo' : 'done';
  return (
    <div class={`row${it.status === 'done' ? ' is-done' : ''}`} style={{ '--pc': p.color } as any}>
      <button type="button" class={`tick ${it.status}`} aria-label={it.status === 'done' ? 'Mark not done' : 'Mark done'} onClick={() => setStatus(it, next)}>
        {it.status === 'done' ? '✓' : it.status === 'doing' ? '◐' : ''}
      </button>
      <button type="button" class="row-main" onClick={() => onOpen(it)}>
        <span class="row-title">{it.num ? <span class="stepn">Step {it.num}</span> : null}{it.title}</span>
        <span class="row-sub">
          <span class="ph">{p.label}</span>
          {it.due && <span class={over ? 'over' : ''}>{relDay(it.due)}{it.dueAuto ? ' (from workbook)' : ''}</span>}
          {it.owner && <span>👤 {it.owner}</span>}
          {it.photos?.length ? <span>📷 {it.photos.length}</span> : null}
        </span>
      </button>
    </div>
  );
}

const HARD = '#e0564b';
function colorOf(it: Item) { const p = phaseOf(it.phase); return it.hard ? { ...p, color: HARD } : p; }

// ── Calendar view
function CalView({ items, onOpen, onAdd }: { items: Item[]; onOpen: (i: Item) => void; onAdd: (d: string) => void }) {
  const t = todayIso();
  const [month, setMonth] = useState(t.slice(0, 7));
  const [sel, setSel] = useState(t);
  const first = parse(`${month}-01`);
  const start = addDays(`${month}-01`, -first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const byDay = useMemo(() => {
    const m: Record<string, Item[]> = {};
    for (const i of items) if (i.due) (m[i.due] ||= []).push(i);
    return m;
  }, [items]);
  const shift = (n: number) => { const d = parse(`${month}-01`); d.setMonth(d.getMonth() + n); setMonth(iso(d).slice(0, 7)); };
  const list = byDay[sel] || [];
  return (
    <div class="cal">
      <div class="cal-head">
        <button type="button" class="mini" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
        <b>{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
        <button type="button" class="mini" onClick={() => shift(1)} aria-label="Next month">›</button>
      </div>
      <div class="cal-grid">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => <span class="dow">{d}</span>)}
        {days.map((d) => {
          const its = byDay[d] || [];
          const cls = [d.slice(0, 7) !== month && 'out', d === t && 'today', d === sel && 'sel'].filter(Boolean).join(' ');
          return (
            <button type="button" class={`day ${cls}`} onClick={() => setSel(d)}>
              <span class="dn">{+d.slice(8)}</span>
              <span class="dots">
                {its.slice(0, 4).map((i) => <i class={i.kind === 'milestone' ? 'dm' : i.status === 'done' ? 'dd' : ''} style={{ background: colorOf(i).color }} />)}
              </span>
            </button>
          );
        })}
      </div>
      <div class="cal-day">
        <h3>{relDay(sel)} <small>{parse(sel).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</small></h3>
        {list.length ? list.map((i) => <Row it={i} onOpen={onOpen} />) : <p class="muted">Nothing on this day.</p>}
        <button type="button" class="btn ghost small" onClick={() => onAdd(sel)}>＋ Add a task on this day</button>
      </div>
    </div>
  );
}

// ── Trail view: the whole project as a path, today marked
function TrailView({ items, onOpen }: { items: Item[]; onOpen: (i: Item) => void }) {
  const t = todayIso();
  const dated = items.filter((i) => i.due).sort((a, b) => a.due!.localeCompare(b.due!) || (a.kind === 'milestone' ? -1 : 1));
  const undated = items.filter((i) => !i.due && i.status !== 'done').length;
  let todayPlaced = false;
  const nodes: preact.JSX.Element[] = [];
  for (const i of dated) {
    if (!todayPlaced && i.due! >= t) { nodes.push(<TodayNode />); todayPlaced = true; }
    nodes.push(<TrailNode it={i} onOpen={onOpen} />);
  }
  if (!todayPlaced) nodes.push(<TodayNode />);
  return (
    <div class="trail">
      {dated.length === 0 && <p class="muted">Give tasks and workbook steps a date and they'll appear here as a trail from start to Eagle.</p>}
      <ol>{nodes}</ol>
      {undated > 0 && <p class="muted trail-note">{undated} open item{undated === 1 ? '' : 's'} without a date. Add dates in the List view to place them on the trail.</p>}
    </div>
  );
}
function TodayNode() { return <li class="tnode today"><span class="tdot" /><span class="tlabel">Today</span></li>; }
function TrailNode({ it, onOpen }: { it: Item; onOpen: (i: Item) => void }) {
  const p = colorOf(it);
  return (
    <li class={`tnode ${it.kind}${it.status === 'done' ? ' done' : ''}${it.hard ? ' hard' : ''}`} style={{ '--pc': p.color } as any}>
      <span class="tdot" />
      <button type="button" class="tcard" onClick={() => onOpen(it)}>
        <span class="tdate">{parse(it.due!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span class="ttitle">{it.num ? `Step ${it.num} · ` : ''}{it.title}</span>
      </button>
    </li>
  );
}

// ── Editors
function PhasePick({ value, onChange }: { value: Phase; onChange: (p: Phase) => void }) {
  return (
    <div class="phase-pick">
      {PHASES.map((p) => (
        <button type="button" class={value === p.id ? 'on' : ''} style={{ '--pc': p.color } as any} onClick={() => onChange(p.id)}>{p.label}</button>
      ))}
    </div>
  );
}

function StatusPick({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  return (
    <div class="seg">
      {(['todo', 'doing', 'done'] as Status[]).map((s) => (
        <button type="button" class={value === s ? 'on' : ''} onClick={() => onChange(s)}>{s === 'todo' ? 'To do' : s === 'doing' ? 'Doing' : 'Done'}</button>
      ))}
    </div>
  );
}

function NewTask({ due, onClose }: { due?: string; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [d, setD] = useState(due);
  const [phase, setPhase] = useState<Phase>('plan');
  const save = () => { if (title.trim()) addTask({ title: title.trim(), due: d, phase }); onClose(); };
  return (
    <div class="sheet-bg" onClick={onClose}>
      <form class="sheet" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <h3>New task</h3>
        <div class="cell"><span class="clbl">What needs to happen?</span>
          <input class="inp" autoFocus value={title} placeholder="e.g. Call the hardware store about a lumber donation" onInput={(e: any) => setTitle(e.target.value)} />
        </div>
        <div class="cell"><span class="clbl">Due date</span><DateInput value={d} onChange={setD} /></div>
        <div class="cell"><span class="clbl">Phase</span><PhasePick value={phase} onChange={setPhase} /></div>
        <div class="row-btns"><span class="spacer" /><button type="button" class="btn ghost" onClick={onClose}>Cancel</button><button class="btn">Add task</button></div>
      </form>
    </div>
  );
}

function ItemSheet({ it, onClose }: { it: Item; onClose: () => void }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const upd = (p: Partial<Item>) => updateItem(it, p);
  const ms = it.kind === 'milestone';
  return (
    <div class="sheet-bg" onClick={onClose}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <p class="eyebrow-s" style={{ color: phaseOf(it.phase).color }}>{ms ? 'Milestone' : it.kind === 'checklist' ? `Workbook step ${it.num}` : 'Task'} · {phaseOf(it.phase).label}</p>
        {it.kind === 'task'
          ? <input class="inp title-inp" value={it.title} onInput={(e: any) => upd({ title: e.target.value })} />
          : <h3 class="sheet-title">{it.title}</h3>}
        {ms ? (
          it.hard
            ? <p class="muted">Set from your birth date on the Contacts page. This is the one deadline that can't move.</p>
            : <div class="cell"><span class="clbl">Date (also updates your workbook timeline, p. 8)</span><DateInput value={it.due} onChange={(d) => upd({ due: d })} /></div>
        ) : (
          <>
            <div class="cell"><span class="clbl">Status</span><StatusPick value={it.status} onChange={(s) => upd({ status: s })} /></div>
            <div class="cell"><span class="clbl">Due date{it.dueAuto ? ' (from your workbook timeline; set one here to override)' : ''}</span><DateInput value={it.due} onChange={(d) => upd({ due: d })} /></div>
            {it.kind === 'task' && <div class="cell"><span class="clbl">Phase</span><PhasePick value={it.phase} onChange={(p) => upd({ phase: p })} /></div>}
            <div class="cell"><span class="clbl">Who's doing it?</span><input class="inp" value={it.owner || ''} placeholder="Me, a helper, a parent…" autoCapitalize="words" onInput={(e: any) => upd({ owner: e.target.value })} /></div>
            <div class="cell"><span class="clbl">Notes</span><textarea class="inp area" value={it.notes || ''} placeholder="Details, phone numbers, what to bring…" onInput={(e: any) => upd({ notes: e.target.value })} /></div>
            <div class="cell"><span class="clbl">Photos</span><Photos value={it.photos || []} onChange={(ph) => upd({ photos: ph })} label={it.title} /></div>
          </>
        )}
        <div class="row-btns">
          {it.kind === 'task' && (confirmDel
            ? <button type="button" class="btn danger small" onClick={() => { deleteTask(it); onClose(); }}>Really delete</button>
            : <button type="button" class="btn ghost small" onClick={() => setConfirmDel(true)}>Delete task</button>)}
          <span class="spacer" />
          <button type="button" class="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
