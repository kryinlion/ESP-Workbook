import { useEffect, useRef } from 'preact/hooks';
import { useProject } from '../core/store';
import { SECTIONS } from '../workbook/schema';
import { sectionProgress } from '../workbook/progress';
import { FieldView } from '../ui/fields';
import { bandOf } from '../workbook/bands';

export function Workbook({ sectionId, focusId }: { sectionId?: string; focusId?: string }) {
  const p = useProject();
  const idx = Math.max(0, SECTIONS.findIndex((s) => s.id === sectionId));
  const s = SECTIONS[idx];
  const sp = sectionProgress(s, p.values);
  const chips = useRef<HTMLDivElement>(null);
  useEffect(() => { chips.current?.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [idx]);
  // "Go" from the ? panel lands on a specific box: scroll to it and glow it briefly
  useEffect(() => {
    if (!focusId) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-fid="${focusId}"]`);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.remove('jump'); void el.offsetWidth; el.classList.add('jump');
    }, 250);
    return () => clearTimeout(t);
  }, [focusId, idx]);
  const prev = SECTIONS[idx - 1], next = SECTIONS[idx + 1];
  return (
    <div class="page wb">
      <div class="chips" ref={chips}>
        {SECTIONS.map((x) => {
          const xp = sectionProgress(x, p.values);
          return <a href={`#/workbook/${x.id}`} class={x.id === s.id ? 'on' : ''}>{x.short}{xp.pct === 100 ? ' ✓' : ''}</a>;
        })}
      </div>
      <div class="sec-head">
        <h1>{s.title}</h1>
        <span class="muted">Workbook {s.pages} · {sp.done}/{sp.total} answered</span>
        <span class="bar"><span style={{ width: `${sp.pct}%` }} /></span>
      </div>
      {s.groups.map((g, gi) => (
        <section class={`card group${g.title && bandOf(s.id, gi) ? ` band band-${bandOf(s.id, gi)}` : ''}`} data-g={`${s.id}-${gi}`}>
          {g.title && <h2>{g.title}</h2>}
          {g.intro && <p class="intro">{g.intro}</p>}
          <div class="fields">
            {g.fields.map((f) => <FieldView f={f} showLabel={g.fields.length > 1 || !g.title} />)}
          </div>
        </section>
      ))}
      <div class="pager">
        {prev ? <a class="btn ghost" href={`#/workbook/${prev.id}`}>← {prev.short}</a> : <span />}
        {next ? <a class="btn" href={`#/workbook/${next.id}`}>{next.short} →</a> : <a class="btn" href="#/export">Export →</a>}
      </div>
    </div>
  );
}
