import { useProject } from '../core/store';
import { SECTIONS, CHECKLIST } from '../workbook/schema';
import { overallProgress, sectionProgress } from '../workbook/progress';
import { isoToUs } from '../ui/fields';
import { MODULES } from './registry';

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
      <section class="hero">
        <p class="eyebrow">Eagle Scout Leadership Service Project</p>
        <h1>{v['project.title'] || 'Your Eagle Project'}</h1>
        <p class="who">{v['cand.fullName'] || <a href="#/workbook/start">Add your name and project title →</a>}</p>
        <div class="ring-row">
          <Ring pct={all.pct} />
          <div>
            <b>{all.done} of {all.total}</b> workbook answers filled in
            {nextStep >= 0 && <p class="next">Next step {nextStep + 1}: {CHECKLIST[nextStep]}</p>}
          </div>
        </div>
      </section>

      {(days === null || days >= 7) && (
        <a href="#/export" class="card warn">
          <b>{days === null ? 'No backup yet' : `Last backup ${days} days ago`}</b>
          <span>Everything saves on this device automatically. Save a backup to iCloud Drive so nothing is ever lost.</span>
        </a>
      )}

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

function Ring({ pct }: { pct: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg class="ring" viewBox="0 0 64 64" width="64" height="64" aria-label={`${pct}% complete`}>
      <circle cx="32" cy="32" r={r} class="ring-bg" />
      <circle cx="32" cy="32" r={r} class="ring-fg" stroke-dasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="37" text-anchor="middle">{pct}%</text>
    </svg>
  );
}
