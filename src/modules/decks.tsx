import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useProject, flush } from '../core/store';
import { timeline } from '../timeline/model';
import { mediaUrl } from '../core/media';
import { shareOrDownload } from '../core/backup';
import { DECKS } from '../decks/decks';
import { allContactEmails, emailsFor, getMeeting, meetingsStore } from '../meetings/model';
import { CopyEmails } from '../ui/emails';
import { FONT, LINE, W, type Prim, type Slide } from '../decks/engine';

// Presentations: pick a deck → see every slide → save as PowerPoint or PDF.
export function Decks({ deckId, arg }: { deckId?: string; arg?: string }) {
  const p = useProject();
  timeline.use(); meetingsStore.use();
  const def = DECKS.find((d) => d.id === deckId);
  if (!def) {
    return (
      <div class="page">
        <div class="sec-head"><h1>Presentations</h1></div>
        <p class="intro">Each presentation is built from your workbook answers and photos, so it's always up to date. Slides you haven't filled in yet are skipped.</p>
        {DECKS.filter((d) => !d.hidden).map((d) => {
          const n = d.build(p.values).slides.length;
          return (
            <a class="card deck-pick" href={`#/decks/${d.id}`}>
              <span class="deck-when">{d.when}</span>
              <h2>{d.title}</h2>
              <p class="muted">{d.blurb}</p>
              <span class="deck-n">{n} slide{n === 1 ? '' : 's'} →</span>
            </a>
          );
        })}
      </div>
    );
  }
  return <DeckView id={def.id} arg={arg} />;
}

function DeckView({ id, arg }: { id: string; arg?: string }) {
  const p = useProject();
  const def = DECKS.find((d) => d.id === id)!;
  meetingsStore.use();
  const deck = useMemo(() => def.build(p.values, arg), [p.values, timeline.get(), meetingsStore.get(), id, arg]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const save = (kind: 'pptx' | 'pdf' | 'handout') => async () => {
    setBusy(kind); setMsg('');
    try {
      await flush();
      const r = await import('../decks/render');
      const v = p.values;
      const f = kind === 'pptx' ? await r.toPptx(deck) : kind === 'pdf' ? await r.toPdf(deck)
        : await r.toHandout(deck, { title: v['project.title'] || 'Eagle Scout Project', sub: v['cand.fullName'] || '' });
      const res = await shareOrDownload(f);
      if (res !== 'cancelled') setMsg(`✓ ${f.name} ready`);
    } catch (e: any) { console.error(e); setMsg(`⚠️ ${e.message || e}`); }
    setBusy('');
  };
  return (
    <div class="page">
      {arg ? <a class="lnk back" href={`#/meetings/${arg}`}>‹ Meeting</a> : <a class="lnk back" href="#/decks">‹ Presentations</a>}
      <div class="sec-head"><h1>{deck.title}</h1></div>
      <p class="muted">{deck.slides.length} slides · {def.when}</p>
      <div class="deck-actions">
        <button class="btn" disabled={!!busy} onClick={save('pptx')}>{busy === 'pptx' ? 'Building…' : '▶ PowerPoint'}</button>
        <button class="btn ghost" disabled={!!busy} onClick={save('pdf')}>{busy === 'pdf' ? 'Building…' : '📄 PDF'}</button>
        <button class="btn ghost" disabled={!!busy} onClick={save('handout')}>{busy === 'handout' ? 'Building…' : '🖨 Handout'}</button>
      </div>
      <p class="hint">Each button opens the share sheet: tap <b>Messages</b> or <b>Mail</b> to send it (for example, to an advisor who missed the meeting), <b>Print</b> to print, or <b>Save to Files</b> to keep a copy. PowerPoint is editable in Keynote, PowerPoint, or Google Slides. Handout prints 3 slides per page with lines for notes. For an Android phone (green bubble), email is safer than a text for big files.</p>
      <CopyEmails emails={arg && getMeeting(arg) ? emailsFor(getMeeting(arg)!) : allContactEmails()} label={arg ? 'Copy attendee emails' : 'Copy contact emails'} />
      {msg && <p class={`toast ${msg.startsWith('⚠') ? 'bad' : ''}`}>{msg}</p>}
      <div class="slides">
        {deck.slides.map((s, i) => <SlideView slide={s} n={i + 1} />)}
      </div>
    </div>
  );
}

/** On-screen slide: the same shapes the PowerPoint/PDF get, drawn with HTML. */
export function SlideView({ slide, n }: { slide: Slide; n: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState(0); // pixels per inch
  useEffect(() => {
    const el = ref.current!; const ro = new ResizeObserver(() => setPx(el.clientWidth / W)); ro.observe(el); return () => ro.disconnect();
  }, []);
  return (
    <figure class="slide-wrap">
      <div ref={ref} class="slide" style={{ background: `#${slide.bg}` }}>
        {px > 0 && slide.prims.map((pr) => <PrimView p={pr} px={px} />)}
      </div>
      <figcaption>{n}</figcaption>
    </figure>
  );
}

function PrimView({ p, px }: { p: Prim; px: number }) {
  const box = { left: `${p.x * px}px`, top: `${p.y * px}px`, width: `${p.w * px}px`, height: `${p.h * px}px` };
  if (p.k === 'rect') return <div class="sp" style={{ ...box, background: `#${p.fill}` }} />;
  if (p.k === 'img') return <SlideImg id={p.id} fit={p.fit} style={box} />;
  const fs = (p.size / 72) * px;
  return (
    <div class="sp st" style={{
      ...box, fontFamily: `${FONT}, Helvetica, sans-serif`, fontSize: `${fs}px`, lineHeight: LINE, color: `#${p.color}`,
      fontWeight: p.bold ? 700 : 400, textAlign: p.align || 'left', textTransform: p.caps ? 'uppercase' : undefined,
      letterSpacing: p.spacing ? `${(p.spacing / 72) * px}px` : undefined,
      justifyContent: p.valign === 'middle' ? 'center' : p.valign === 'bottom' ? 'flex-end' : 'flex-start',
    }}><span>{p.text}</span></div>
  );
}

function SlideImg({ id, fit, style }: { id: string; fit: 'cover' | 'contain'; style: any }) {
  const [u, setU] = useState<string>();
  useEffect(() => { mediaUrl(id).then(setU); }, [id]);
  return u ? <img class="sp" src={u} alt="" style={{ ...style, objectFit: fit }} /> : <div class="sp" style={style} />;
}
