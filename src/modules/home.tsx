import { useProject } from '../core/store';
import { SECTIONS, CHECKLIST } from '../workbook/schema';
import { overallProgress, sectionProgress } from '../workbook/progress';
import { isoToUs } from '../ui/fields';
import { MODULES } from './registry';
import { Hero } from '../ui/hero';
import { addDays, allItems, deadline18, daysBetween, phaseOf, relDay, setStatus, timeline, todayIso } from '../timeline/model';

export function Home() {
  const p = useProject();
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

      {(days === null || days >= 7) && (
        <a href="#/export" class="card warn">
          <b>{days === null ? 'No backup yet' : `Last backup ${days} days ago`}</b>
          <span>Everything saves on this device automatically. Save a backup to iCloud Drive so nothing is ever lost.</span>
        </a>
      )}

      <DueSoon />

      <h2 class="h2">Workbook</h2>
      <div class="sec-grid">
        {SECTIONS.map((s) => {
          const sp = sectionProgress(s, v);
          return (
            <a href={`#/workbook/${s.id}`} class="sec-tile">
              <span class="sec-ico">{s.icon}</span>
              <span class="sec-name">{s.title}</span>
              <span class="sec-pages">{s.pages}</span>
              <span class="bar"><span style={{ width: `${sp.pct}%` }} /></span>
              <span class="sec-pct">{sp.pct}%</span>
            </a>
          );
        })}
      </div>

      {dates.length > 0 && (
        <>
          <h2 class="h2">Key dates</h2>
          <div class="card dates">
            {dates.map(([l, d]) => <div class="date-item"><span>{l}</span><b>{isoToUs(d)}</b></div>)}
          </div>
        </>
      )}

      <h2 class="h2">Coming next</h2>
      <div class="soon-list">
        {MODULES.filter((m) => m.phase).sort((a, b) => a.phase! - b.phase!).map((m) => (
          <a href={`#/${m.id}`} class="soon-item"><span class="ti">{m.icon}</span><span><b>{m.title}</b><small>{m.blurb}</small></span></a>
        ))}
      </div>
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
