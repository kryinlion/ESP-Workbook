import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { useProject } from '../core/store';
import { SECTIONS, CHECKLIST } from '../workbook/schema';
import { overallProgress, sectionProgress } from '../workbook/progress';
import { isoToUs } from '../ui/fields';
import { MODULES } from './registry';
import { Hero } from '../ui/hero';
import { openBackup, backupEveryDays } from '../ui/backupPrompt';
import { ReenterCard } from '../ui/cloudCard';
import { QuestCard } from '../tour/quests';
import { moneyStore, totals } from '../money/model';
import { money } from '../ui/fields';
import { addDays, allItems, deadline18, daysBetween, phaseOf, relDay, setStatus, timeline, todayIso } from '../timeline/model';

// Where each tile's icon starts in its 60 s glow cycle (negative = already part-way through), scattered so no two pulse together.
const GLOW_AT = [0, -37, -14, -51, -23, -6];

export function Home() {
  const p = useProject();
  const gridRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (gridRef.current) alignTileIcons(gridRef.current); });
  useEffect(() => {
    const f = () => { if (gridRef.current) alignTileIcons(gridRef.current); };
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  const v = p.values;
  const all = overallProgress(v);
  const ck = (v.checklist || {}) as Record<number, boolean>;
  const nextStep = CHECKLIST.findIndex((_, i) => !ck[i]);
  const days = p.meta.lastBackupAt ? Math.floor((Date.now() - p.meta.lastBackupAt) / 864e5) : null;
  const dates = [
    ['Proposal approved', v['prop.dateApproved']], ['Plan complete', v['prop.datePlan']],
    ['Work begins', v['prop.dateBegin']], ['Report complete', v['prop.dateReport']],
  ].filter(([, d]) => d) as [string, string][];

  return (
    <div class="page">
      <Hero pct={all.pct} done={all.done} total={all.total} below={
        <div class="hero-meta">
          {v['cand.fullName'] || v['project.title']
            ? <p class="who"><b>{v['cand.fullName']}</b>{v['cand.fullName'] && v['project.title'] ? ' · ' : ''}{v['project.title']}</p>
            : <a class="who-link" href="#/workbook/start">Add your name and project title →</a>}
          <p class="next">{all.done} of {all.total} answers{nextStep >= 0 ? <> · <b>Next step {nextStep + 1}:</b> {CHECKLIST[nextStep]}</> : null}</p>
        </div>
      } />

      <ReenterCard />

      <QuestCard />

      {(days === null || days >= backupEveryDays()) && (
        <button type="button" class="card warn bk-card" onClick={openBackup}>
          <b>{days === null ? 'No backup yet' : `Last backup ${days} days ago`}</b>
          <span>Tap to back up your project to iCloud Drive.</span>
        </button>
      )}

      <DueSoon />

      <h2 class="h2">Workbook</h2>
      <div class="sec-grid" ref={gridRef} data-tour="workbook">
        {SECTIONS.map((s, i) => {
          const sp = sectionProgress(s, v);
          return (
            <a href={`#/workbook/${s.id}`} class={`sec-tile holo${sp.pct >= 100 ? ' done' : ''}`}>
              <span class="sec-ico" style={{ '--glow-at': `${GLOW_AT[i % GLOW_AT.length]}s` } as any}>{s.icon + '\uFE0E'}</span>
              <span class="sec-name">{s.title.split(' ').map((w) => <span class="w">{w}</span>)}</span>
              <span class="sec-pages">{s.pages}</span>
              <span class="bar"><span style={{ width: `${sp.pct}%` }} /></span>
              <span class="sec-pct">{sp.pct}%</span>
            </a>
          );
        })}
      </div>

      <MoneyCard />

      <a href="#/decks" class="card deck-link" data-tour="decks">
        <span class="ti">▶</span>
        <span><b>Presentations</b><small>Proposal, progress update, and project report — PowerPoint or PDF</small></span>
      </a>

      {dates.length > 0 && (
        <>
          <h2 class="h2">Key dates</h2>
          <div class="card dates">
            {dates.map(([l, d]) => <div class="date-item"><span>{l}</span><b>{isoToUs(d)}</b></div>)}
          </div>
        </>
      )}

      {MODULES.some((m) => m.phase) && (
        <>
          <h2 class="h2">Coming next</h2>
          <div class="soon-list">
            {MODULES.filter((m) => m.phase).sort((a, b) => a.phase! - b.phase!).map((m) => (
              <a href={`#/${m.id}`} class="soon-item"><span class="ti">{m.icon}</span><span><b>{m.title}</b><small>{m.blurb}</small></span></a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DueSoon() {
  timeline.use();
  const t = todayIso(), wk = addDays(t, 7);
  const items = allItems().filter((i) => i.kind !== 'milestone' && i.status !== 'done' && i.due && i.due <= wk)
    .sort((a, b) => a.due!.localeCompare(b.due!));
  const ms = allItems().filter((i) => i.kind === 'milestone' && i.due! >= t).sort((a, b) => a.due!.localeCompare(b.due!))[0];
  const d18 = deadline18();
  return (
    <>
      <h2 class="h2">Due this week</h2>
      <div class="card due-card">
        {items.length === 0 && <p class="muted" style={{ margin: 0 }}>Nothing due in the next 7 days. <a href="#/timeline" class="lnk">Plan ahead on the Timeline →</a></p>}
        {items.slice(0, 5).map((i) => (
          <div class="due-row" style={{ '--pc': phaseOf(i.phase).color } as any}>
            <button type="button" class="tick" aria-label="Mark done" onClick={() => setStatus(i, 'done')} />
            <a href="#/timeline" class="due-main"><span>{i.num ? `Step ${i.num}: ` : ''}{i.title}</span><small class={i.due! < t ? 'over' : ''}>{relDay(i.due!)}</small></a>
          </div>
        ))}
        {items.length > 5 && <a href="#/timeline" class="lnk">+ {items.length - 5} more</a>}
        {(ms || d18) && (
          <div class="due-foot">
            {ms && <span>◆ Next milestone: <b>{ms.title}</b> {relDay(ms.due!)}</span>}
            {d18 && <span>⏳ <b>{Math.max(0, daysBetween(t, d18))}</b> days to 18th birthday</span>}
          </div>
        )}
      </div>
    </>
  );
}

function MoneyCard() {
  moneyStore.use();
  const t = totals();
  const any = t.raised || t.spent || t.inKind;
  return (
    <a href="#/money" class="card deck-link mn-home">
      <span class="ti">$</span>
      <span style={{ flex: 1 }}>
        <b>Money</b>
        {any || t.goal
          ? <><small>{money(t.raised + t.inKind)} of {t.goal ? money(t.goal) : 'goal'} · spent {money(t.spent)}{t.thankYous.length ? ` · ${t.thankYous.length} thank-you${t.thankYous.length === 1 ? '' : 's'} to send` : ''}</small>
            {t.goal > 0 && <span class="bar"><span style={{ width: `${t.pct}%` }} /></span>}</>
          : <small>Track donations, expenses, donors, and fundraisers</small>}
      </span>
    </a>
  );
}

// Line each big tile icon's INK top up with the top of the title letters. Glyphs carry different
// empty space above them (and iOS fonts differ from desktop), so measure the real ink on-device.
let mctx: CanvasRenderingContext2D | null = null;
function inkTop(el: HTMLElement, text: string): number {
  const cs = getComputedStyle(el);
  mctx ??= document.createElement('canvas').getContext('2d')!;
  mctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const m = mctx.measureText(text);
  const size = parseFloat(cs.fontSize);
  const lh = cs.lineHeight === 'normal' ? size * 1.2 : parseFloat(cs.lineHeight);
  const A = m.fontBoundingBoxAscent ?? size * 0.8, D = m.fontBoundingBoxDescent ?? size * 0.2;
  return (lh - (A + D)) / 2 + A - m.actualBoundingBoxAscent; // px from the line box top to the first inked pixel
}
function alignTileIcons(grid: HTMLElement) {
  // shared light sweep: tell each tile where it sits in the grid so its sweep layer lines up with the others
  const g = grid.getBoundingClientRect();
  grid.querySelectorAll<HTMLElement>('.sec-tile.holo').forEach((tile) => {
    const r = tile.getBoundingClientRect();
    tile.style.setProperty('--ox', `${r.left - g.left + tile.clientLeft}px`);
    tile.style.setProperty('--oy', `${r.top - g.top + tile.clientTop}px`);
    tile.style.setProperty('--gw', `${g.width}px`);
    tile.style.setProperty('--gh', `${g.height}px`);
  });
  grid.querySelectorAll<HTMLElement>('.sec-tile.holo').forEach((tile) => {
    const ico = tile.querySelector<HTMLElement>('.sec-ico');
    const w = tile.querySelector<HTMLElement>('.sec-name .w');
    if (!ico || !w) return;
    ico.style.marginTop = '0px';
    const titleInk = w.getBoundingClientRect().top + inkTop(w, w.textContent || 'A');
    const iconInk = ico.getBoundingClientRect().top + inkTop(ico, ico.textContent || '');
    ico.style.marginTop = `${Math.round((titleInk - iconInk) * 10) / 10}px`;
  });
}
