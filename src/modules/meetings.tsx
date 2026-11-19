import { useState } from 'preact/hooks';
import { shareOrDownload } from '../core/backup';
import { agendaItems, agendaPdf, agendaText } from '../meetings/agenda';
import { useProject } from '../core/store';
import { timeline, todayIso, relDay } from '../timeline/model';
import { DateInput } from '../ui/fields';
import { Photos } from '../ui/photos';
import {
  MEETING_KINDS, ROLES, actionsOf, addAction, addMeeting, allMeetings, attendees, deleteAction, deleteMeeting, getMeeting,
  longDate, meetingTitle, meetingsStore, time12, updateAction, updateMeeting, usDate, type Meeting,
} from '../meetings/model';

export function Meetings({ id }: { id?: string }) {
  meetingsStore.use(); timeline.use(); useProject();
  if (id) {
    const m = getMeeting(id);
    return m ? <MeetingEdit m={m} /> : <div class="page"><a class="lnk back" href="#/meetings">‹ Meetings</a><p class="muted">That meeting was deleted.</p></div>;
  }
  const t = todayIso();
  const all = allMeetings();
  const upcoming = all.filter((m) => m.date >= t && !(m.notes || '').trim()).reverse();
  const past = all.filter((m) => !upcoming.includes(m));
  const open = timeline.get().tasks.filter((x) => x.meetingId && x.status !== 'done').length;
  const create = () => { location.hash = `#/meetings/${addMeeting()}`; };
  return (
    <div class="page">
      <div class="sec-head"><h1>Advisor Meetings</h1></div>
      <p class="intro">Notes from every meeting with your coach, Scoutmaster, beneficiary, and council. Action items go straight onto your Timeline.</p>
      {all.length === 0 && (
        <div class="card mt-empty">
          <p><b>No meetings yet.</b> Add one before a meeting to plan your questions, then fill in notes, decisions, and action items afterward.</p>
          <button class="btn wide" onClick={create}>＋ Add a meeting</button>
        </div>
      )}
      {all.length > 0 && (
        <p class="muted">{past.length} held · {upcoming.length} coming up{open ? ` · ${open} open action item${open === 1 ? '' : 's'}` : ''}</p>
      )}
      {upcoming.length > 0 && <><h2 class="h2">Coming up</h2>{upcoming.map((m) => <MeetingCard m={m} />)}</>}
      {past.length > 0 && <><h2 class="h2">Past meetings</h2>{past.map((m) => <MeetingCard m={m} />)}</>}
      {all.length > 0 && <a class="card deck-link" href="#/decks/meetings"><span class="ti">▶</span><span><b>Meeting log presentation</b><small>Every meeting, decision, and action item in one deck</small></span></a>}
      <button type="button" class="fab" aria-label="Add meeting" onClick={create}>＋</button>
    </div>
  );
}

function MeetingCard({ m }: { m: Meeting }) {
  const acts = actionsOf(m.id);
  const openActs = acts.filter((a) => a.status !== 'done').length;
  const who = attendees(m);
  return (
    <a class="card mt-card" href={`#/meetings/${m.id}`}>
      <span class="mt-date"><b>{usDate(m.date)}</b>{m.time ? ` · ${time12(m.time)}` : ''}{/\d (day|week)|today|tomorrow|yesterday/i.test(relDay(m.date)) ? ` · ${relDay(m.date)}` : ''}</span>
      <span class="mt-title">{meetingTitle(m)}</span>
      {who.length > 0 && <span class="mt-who">{who.join(', ')}</span>}
      <span class="mt-meta">
        {m.decisions.filter(Boolean).length > 0 && <span>✔ {m.decisions.filter(Boolean).length} decision{m.decisions.filter(Boolean).length === 1 ? '' : 's'}</span>}
        {acts.length > 0 && <span class={openActs ? 'open' : ''}>☐ {openActs ? `${openActs} of ${acts.length} actions open` : `${acts.length} actions done`}</span>}
        {m.photos.length > 0 && <span>📷 {m.photos.length}</span>}
      </span>
    </a>
  );
}

function MeetingEdit({ m }: { m: Meeting }) {
  const [del, setDel] = useState(false);
  const up = (p: Partial<Meeting>) => updateMeeting(m.id, p);
  const acts = actionsOf(m.id);
  const v = useProject().values;
  const future = m.date > todayIso();
  return (
    <div class="page mt-edit">
      <a class="lnk back" href="#/meetings">‹ Meetings</a>
      <div class="sec-head"><h1>{meetingTitle(m)}</h1></div>
      <p class="muted">{longDate(m.date)}{m.time ? ` · ${time12(m.time)}` : ''}</p>

      <section class="card">
        <h3>When & where</h3>
        <div class="grid2">
          <div class="cell half"><span class="clbl">Date</span><DateInput value={m.date} onChange={(d) => d && up({ date: d })} /></div>
          <div class="cell half"><span class="clbl">Time</span><input class="inp" type="time" value={m.time || ''} onInput={(e: any) => up({ time: e.target.value || undefined })} /></div>
        </div>
        <div class="cell"><span class="clbl">Where</span><input class="inp" value={m.where || ''} placeholder="Troop hall, video call, the site…" onInput={(e: any) => up({ where: e.target.value })} /></div>
        <div class="cell"><span class="clbl">Meeting with</span>
          <div class="pick">{MEETING_KINDS.map((k) => <button type="button" class={m.kind === k.id ? 'on' : ''} onClick={() => up({ kind: k.id })}>{k.label}</button>)}</div>
        </div>
      </section>

      <section class="card">
        <h3>Who was there</h3>
        <div class="pick">
          {ROLES.map((r) => {
            const on = m.roles.includes(r.id);
            const n = String(v[r.from] || '').trim();
            return <button type="button" class={on ? 'on' : ''} onClick={() => up({ roles: on ? m.roles.filter((x) => x !== r.id) : [...m.roles, r.id] })}>{on ? '✓ ' : ''}{r.label}{n && n !== '[re-enter]' ? ` · ${n}` : ''}</button>;
          })}
        </div>
        <div class="cell"><span class="clbl">Others</span><input class="inp" value={m.others || ''} placeholder="First names, separated by commas" autoCapitalize="words" onInput={(e: any) => up({ others: e.target.value })} /></div>
        <p class="hint">Names for each role come from your Contacts page, so they stay private on this device.</p>
      </section>

      <section class="card">
        <h3>Agenda</h3>
        <p class="hint" style={{ marginTop: '-4px', marginBottom: '8px' }}>What you want to talk about — one topic per line. {future ? 'Send it ahead so everyone comes prepared.' : ''}</p>
        <textarea class="inp area" value={m.agenda || ''} placeholder={'Review my project idea\nIs the budget realistic?\nWho needs to sign the proposal?'} onInput={(e: any) => up({ agenda: e.target.value })} />
        <AgendaSend m={m} />
      </section>

      <section class="card">
        <h3>Notes</h3>
        <textarea class="inp area tall" value={m.notes || ''} placeholder="What was discussed, advice you got, ideas…" onInput={(e: any) => up({ notes: e.target.value })} />
      </section>

      <section class="card">
        <h3>Decisions</h3>
        {m.decisions.map((d, i) => (
          <div class="mt-line">
            <input class="inp" value={d} placeholder="What was decided" onInput={(e: any) => up({ decisions: m.decisions.map((x, j) => (j === i ? e.target.value : x)) })} />
            <button type="button" class="x-btn" aria-label="Remove decision" onClick={() => up({ decisions: m.decisions.filter((_, j) => j !== i) })}>×</button>
          </div>
        ))}
        <button type="button" class="btn ghost small" onClick={() => up({ decisions: [...m.decisions, ''] })}>＋ Add decision</button>
      </section>

      <section class="card">
        <h3>Action items</h3>
        <p class="hint" style={{ marginTop: '-4px', marginBottom: '10px' }}>Each one is added to your Timeline. Check it off here or there.</p>
        {acts.map((a) => (
          <div class={`mt-act${a.status === 'done' ? ' done' : ''}`}>
            <div class="mt-line">
              <button type="button" class={`ck ${a.status === 'done' ? 'on' : ''}`} aria-label={a.status === 'done' ? 'Mark not done' : 'Mark done'} onClick={() => updateAction(a.id, { status: a.status === 'done' ? 'todo' : 'done' })}>{a.status === 'done' ? '✓' : ''}</button>
              <input class="inp" value={a.title} placeholder="What needs to happen" onInput={(e: any) => updateAction(a.id, { title: e.target.value })} />
              <button type="button" class="x-btn" aria-label="Remove action item" onClick={() => deleteAction(a.id)}>×</button>
            </div>
            <div class="grid2 mt-act-sub">
              <div class="cell half"><span class="clbl">Who</span><input class="inp" value={a.owner || ''} placeholder="Me, Dad, coach…" autoCapitalize="words" onInput={(e: any) => updateAction(a.id, { owner: e.target.value })} /></div>
              <div class="cell half"><span class="clbl">Due</span><DateInput value={a.due} onChange={(d) => updateAction(a.id, { due: d || undefined })} /></div>
            </div>
          </div>
        ))}
        <button type="button" class="btn ghost small" onClick={() => addAction(m)}>＋ Add action item</button>
      </section>

      <section class="card">
        <h3>Photos & documents</h3>
        <Photos value={m.photos} onChange={(ph) => up({ photos: ph })} label={meetingTitle(m)} />
      </section>

      <a class="btn wide" href={`#/decks/meeting/${m.id}`}>▶ Meeting presentation</a>
      <p class="hint" style={{ textAlign: 'center' }}>A summary deck to share with anyone who missed the meeting.</p>

      <div class="row-btns" style={{ marginTop: '24px' }}>
        {del
          ? <><button type="button" class="btn ghost" onClick={() => setDel(false)}>Cancel</button><button type="button" class="btn danger" onClick={() => { deleteMeeting(m.id); location.hash = '#/meetings'; }}>Delete this meeting</button></>
          : <button type="button" class="btn ghost small" onClick={() => setDel(true)}>Delete meeting…</button>}
      </div>
      {del && <p class="hint">Its action items stay on your Timeline.</p>}
    </div>
  );
}

function AgendaSend({ m }: { m: Meeting }) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const n = agendaItems(m).length;
  const pdf = async () => {
    setBusy('pdf'); setMsg('');
    try { const r = await shareOrDownload(await agendaPdf(m)); if (r !== 'cancelled') setMsg('✓ Agenda ready'); }
    catch (e: any) { setMsg(`⚠️ ${e.message || e}`); }
    setBusy('');
  };
  const txt = async () => {
    setMsg('');
    const t = agendaText(m);
    const nav: any = navigator;
    try {
      if (nav.share) { await nav.share({ text: t }); return; }
    } catch (e: any) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(t); setMsg('✓ Copied — paste it into a text or email'); }
    catch { setMsg('⚠️ Could not open sharing on this device.'); }
  };
  return (
    <>
      <div class="deck-actions" style={{ marginTop: '10px' }}>
        <button type="button" class="btn ghost" disabled={!n || !!busy} onClick={pdf}>{busy === 'pdf' ? 'Building…' : '📄 Agenda PDF'}</button>
        <button type="button" class="btn ghost" disabled={!n} onClick={txt}>💬 Send as text</button>
      </div>
      <p class="hint">{n ? 'Opens the share sheet: Messages, Mail, Print, or Save to Files. The PDF has lines under each topic for notes.' : 'Add at least one topic to send the agenda.'}</p>
      {msg && <p class={`toast ${msg.startsWith('⚠') ? 'bad' : ''}`}>{msg}</p>}
    </>
  );
}
