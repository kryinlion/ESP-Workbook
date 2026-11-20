import { useEffect, useState } from 'preact/hooks';
import { project, useProject } from '../core/store';
import { timeline } from '../timeline/model';

// ── First quests: five small wins that teach the app. Done-ness is read from real data (so it is
// right on every device); which ones have already been CELEBRATED is remembered per device.

export interface Quest { id: string; icon: string; title: string; why: string; href: string; done: () => boolean }
const filled = (v: any) => v !== undefined && v !== null && String(v).trim() !== '';
const cloudOn = () => { try { return !!JSON.parse(localStorage.getItem('esp.cloud') || '{}').on; } catch { return false; } };

export const QUESTS: Quest[] = [
  { id: 'name', icon: '✎︎', title: 'Add your name and project title', why: 'They go on every page of your workbook and presentations.', href: '#/workbook/start',
    done: () => filled(project().values['cand.fullName']) && filled(project().values['project.title']) },
  { id: 'cover', icon: '▣︎', title: 'Add a cover photo', why: 'It becomes the title slide of your presentations.', href: '#/workbook/start',
    done: () => Array.isArray(project().values['project.cover']) && project().values['project.cover'].length > 0 },
  { id: 'task', icon: '◷︎', title: 'Add a task to your Timeline', why: 'Tap the gold + on the Timeline and give it a date.', href: '#/timeline',
    done: () => timeline.get().tasks.length > 0 },
  { id: 'cloud', icon: '☁︎', title: 'Sign in to cloud backup', why: 'Backs up automatically and syncs your iPhone and iPad.', href: '#/export',
    done: cloudOn },
  { id: 'backup', icon: '⛨︎', title: 'Save a full backup to iCloud', why: 'The one copy that includes your private details.', href: '#/export',
    done: () => !!project().meta.lastBackupAt },
];

const LS = 'esp.quests';
type Saved = { celebrated: string[]; retired?: boolean };
const read = (): Saved | null => { try { const s = localStorage.getItem(LS); return s ? JSON.parse(s) : null; } catch { return null; } };
const write = (s: Saved) => { try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* private mode */ } };

/** Re-renders when answers, tasks, or sign-in change. */
export function useQuestState() {
  useProject(); timeline.use();
  const [, f] = useState(0);
  useEffect(() => { const t = setInterval(() => f((n) => n + 1), 2000); return () => clearInterval(t); }, []); // cloud sign-in lives in localStorage
  return QUESTS.map((q) => ({ ...q, ok: q.done() }));
}

// ── Home card
export function QuestCard() {
  const qs = useQuestState();
  const saved = read();
  const n = qs.filter((q) => q.ok).length;
  if (saved?.retired) return null;
  const next = qs.find((q) => !q.ok);
  return (
    <section class="card quests" data-tour="quests">
      <div class="q-head">
        <span class="q-title">First quests</span>
        <span class="q-count">{n} of {qs.length}</span>
      </div>
      <span class="q-bar"><span style={{ width: `${(n / qs.length) * 100}%` }} /></span>
      <ul class="q-list">
        {qs.map((q) => (
          <li class={q.ok ? 'ok' : q === next ? 'next' : ''}>
            <span class="q-ico">{q.ok ? '✓' : q.icon}</span>
            <span class="q-txt"><b>{q.title}</b>{q === next && <small>{q.why}</small>}</span>
            {!q.ok && <a class={`q-go${q === next ? ' on' : ''}`} href={q.href}>Go →</a>}
          </li>
        ))}
      </ul>
      {n === qs.length && <button type="button" class="lnk-btn" onClick={() => { write({ ...(read() || { celebrated: [] }), retired: true }); location.hash = '#/'; }}>Hide quests</button>}
    </section>
  );
}

// ── Celebration: pops up anywhere in the app the moment a quest is completed
export function QuestCelebrate() {
  const qs = useQuestState();
  const [show, setShow] = useState<{ title: string; all: boolean } | null>(null);
  useEffect(() => {
    const saved = read();
    const doneNow = qs.filter((q) => q.ok).map((q) => q.id);
    if (!saved) { write({ celebrated: doneNow }); return; } // first run: don't celebrate what was already done
    const fresh = doneNow.filter((id) => !saved.celebrated.includes(id));
    if (!fresh.length) return;
    write({ ...saved, celebrated: [...saved.celebrated, ...fresh] });
    const all = doneNow.length === QUESTS.length;
    setShow({ title: QUESTS.find((q) => q.id === fresh[fresh.length - 1])!.title, all });
  });
  useEffect(() => { if (!show) return; const t = setTimeout(() => setShow(null), show.all ? 4200 : 2800); return () => clearTimeout(t); }, [show]);
  if (!show) return null;
  return (
    <div class={`celebrate${show.all ? ' all' : ''}`} onClick={() => setShow(null)} role="status" aria-live="polite">
      <div class="confetti" aria-hidden="true">{CONFETTI.map((c) => <i style={c} />)}</div>
      <div class="cel-card">
        <div class="cel-badge">{show.all ? '🦅' : '✓'}</div>
        <p class="cel-k">{show.all ? 'All first quests complete!' : 'Quest complete'}</p>
        <h3>{show.all ? 'You know your way around. Now go earn that Eagle.' : show.title}</h3>
      </div>
    </div>
  );
}

// 36 pieces, fixed random-looking spread so the burst looks the same every time
// Scouting colors (Mark 2026-11-20): Scouting Red, tan, white, green #006B3F
const COLORS = ['#CE1126', '#D6CEBD', '#FFFFFF', '#CE1126', '#D6CEBD', '#006B3F'];
const CONFETTI = Array.from({ length: 36 }, (_, i) => {
  const a = (i / 36) * Math.PI * 2 + (i % 3) * 0.17;
  const d = 120 + ((i * 37) % 90);
  return {
    '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d - 40}px`, '--rot': `${(i * 47) % 360}deg`,
    background: COLORS[i % COLORS.length], animationDelay: `${(i % 6) * 0.02}s`,
    width: i % 2 ? '7px' : '5px', height: i % 2 ? '11px' : '5px', borderRadius: i % 4 === 0 ? '50%' : '2px',
  } as any;
});
