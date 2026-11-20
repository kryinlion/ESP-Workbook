import { useEffect, useRef, useState } from 'preact/hooks';
import { useProject, useValue, values } from '../core/store';
import { type Column, type Field, HOURS_ROWS, hoursTotals, num, rowValue, tableTotal } from '../workbook/schema';
import { Photos } from './photos';
import { isClean } from '../core/wordFilter';
import { SignaturePad } from './signature';

export const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── dates: stored ISO (YYYY-MM-DD); typed as MM/DD/YYYY with the number keyboard
export function isoToUs(iso?: string) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
}
function usToIso(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const mo = +m[1], d = +m[2], y = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function maskDate(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function DateInput({ value, onChange, id }: { value?: string; onChange: (v: string) => void; id?: string }) {
  const [txt, setTxt] = useState(isoToUs(value));
  const pick = useRef<HTMLInputElement>(null);
  useEffect(() => { if (usToIso(txt) !== value) setTxt(isoToUs(value)); }, [value]);
  return (
    <div class="date-row">
      <input id={id} class="inp" inputMode="numeric" placeholder="MM/DD/YYYY" value={txt} autoComplete="off"
        onInput={(e) => {
          const t = maskDate((e.target as HTMLInputElement).value); setTxt(t);
          const iso = usToIso(t); if (iso) onChange(iso); else if (t === '') onChange('');
        }} />
      <button type="button" class="icon-btn" aria-label="Pick a date" onClick={() => { try { pick.current?.showPicker(); } catch { pick.current?.focus(); } }}>📅</button>
      <input ref={pick} type="date" class="sr-date" tabIndex={-1} value={value || ''} onChange={(e) => onChange((e.target as HTMLInputElement).value)} />
    </div>
  );
}

function AutoText({ value, onInput, placeholder, id }: { value: string; onInput: (v: string) => void; placeholder?: string; id?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => { const t = ref.current; if (t) { t.style.height = 'auto'; t.style.height = `${Math.max(120, t.scrollHeight + 2)}px`; } };
  useEffect(fit, [value]);
  return <textarea id={id} ref={ref} class="inp area" value={value} placeholder={placeholder} autoCapitalize="sentences"
    onInput={(e) => { onInput((e.target as HTMLTextAreaElement).value); fit(); }} />;
}

function Seg({ options, value, onChange }: { options: string[]; value?: string; onChange: (v: string) => void }) {
  return (
    <div class="seg" role="radiogroup">
      {options.map((o) => (
        <button type="button" role="radio" aria-checked={value === o} class={value === o ? 'on' : ''} onClick={() => onChange(value === o ? '' : o)}>{o}</button>
      ))}
    </div>
  );
}

/** Text box with a character limit and/or word filter. A blocked word is never saved. */
function LimitedInput({ id, value, onChange, max, clean }: { id?: string; value?: string; onChange: (v: string) => void; max?: number; clean?: boolean }) {
  const [txt, setTxt] = useState(value ?? '');
  const [bad, setBad] = useState(false);
  useEffect(() => { if (!bad && value !== txt) setTxt(value ?? ''); }, [value]);
  const n = txt.length;
  return (
    <>
      <input id={id} class={`inp${bad ? ' inp-bad' : ''}`} value={txt} maxLength={max} autoCapitalize="words"
        onInput={(e) => {
          const t = (e.target as HTMLInputElement).value.slice(0, max ?? Infinity);
          setTxt(t);
          const ok = !clean || isClean(t);
          setBad(!ok);
          if (ok) onChange(t);
        }} />
      <div class="limit-row">
        {bad ? <span class="limit-bad">Let's pick different words. This title shows on your Home screen and presentations.</span> : <span />}
        {max ? <span class={`limit-n${n >= max ? ' full' : ''}`}>{n}/{max}</span> : null}
      </div>
    </>
  );
}

export function SimpleInput({ type, value, onChange, id, placeholder }: { type: string; value: any; onChange: (v: string) => void; id?: string; placeholder?: string }) {
  const common = { id, class: 'inp', value: value ?? '', placeholder, onInput: (e: any) => onChange(e.target.value) };
  switch (type) {
    case 'email': return <input {...common} type="email" inputMode="email" autoCapitalize="off" autoComplete="email" />;
    case 'tel': return <input {...common} type="tel" inputMode="tel" autoComplete="tel" />;
    case 'num': return <input {...common} inputMode="decimal" />;
    case 'money': return <div class="money"><span>$</span><input {...common} inputMode="decimal" placeholder="0.00" /></div>;
    case 'state': return <input {...common} maxLength={2} autoCapitalize="characters" placeholder="ST" style={{ textTransform: 'uppercase', maxWidth: '6em' }}
      onInput={(e: any) => onChange(e.target.value.toUpperCase())} />;
    default: return <input {...common} type="text" autoCapitalize="words" />;
  }
}

export function FieldView({ f, showLabel }: { f: Field; showLabel: boolean }) {
  const [v, set] = useValue<any>(f.id);
  const id = `f-${f.id}`;
  const label = showLabel && f.type !== 'checklist' ? <label class="lbl" for={id}>{f.label}</label> : null;
  const prompt = f.prompt ? <p class="prompt">{f.prompt}</p> : null;
  const hint = f.hint ? <p class="hint">{f.hint}</p> : null;
  let body;
  switch (f.type) {
    case 'long': body = <AutoText id={id} value={v || ''} onInput={set} placeholder="Type here…" />; break;
    case 'date': body = <DateInput id={id} value={v} onChange={set} />; break;
    case 'yesno': body = <Seg options={['Yes', 'No']} value={v} onChange={set} />; break;
    case 'choice': body = <Seg options={f.options || []} value={v} onChange={set} />; break;
    case 'calc': body = <Calc f={f} />; break;
    case 'photos': body = <Photos value={v || []} onChange={set} label={f.label} />; break;
    case 'table': body = <Table f={f} rows={v || []} onChange={set} />; break;
    case 'hours': body = <Hours f={f} />; break;
    case 'sig': body = <Sig f={f} value={v || {}} onChange={set} />; break;
    case 'checklist': body = <Checklist items={f.items || []} value={v || {}} onChange={set} />; break;
    default:
      if (f.id === 'cand.name') return <NameEcho label="Name" from="cand.fullName" />;
      if (f.id === 'rep.benOrg') return <NameEcho label={f.label} from="ben.org" />;
      body = f.max || f.clean
        ? <LimitedInput id={id} value={v} onChange={set} max={f.max} clean={f.clean} />
        : <SimpleInput id={id} type={f.type} value={v} onChange={set} />;
  }
  return <div class={`field t-${f.type}${f.half ? ' half' : ''}`}>{label}{prompt}{body}{hint}</div>;
}

function NameEcho({ label, from }: { label: string; from: string }) {
  const [v] = useValue<string>(from);
  return <div class="field half"><span class="lbl">{label}</span><div class="echo">{v || <em>Fill in on the cover / beneficiary section</em>}</div></div>;
}

function Calc({ f }: { f: Field }) {
  useProject();
  const n = Number(f.calc!(values()));
  return <div class="calc">{money(n)}</div>;
}

function Checklist({ items, value, onChange }: { items: string[]; value: Record<number, boolean>; onChange: (v: any) => void }) {
  const done = items.filter((_, i) => value[i]).length;
  return (
    <div class="checklist">
      <div class="meter"><div style={{ width: `${(done / items.length) * 100}%` }} /></div>
      <p class="hint">{done} of {items.length} complete</p>
      {items.map((t, i) => (
        <label class={`check${value[i] ? ' done' : ''}`}>
          <input type="checkbox" checked={!!value[i]} onChange={() => onChange({ ...value, [i]: !value[i] })} />
          <span class="num">{i + 1}</span><span>{t}</span>
        </label>
      ))}
    </div>
  );
}

function Table({ f, rows, onChange }: { f: Field; rows: any[]; onChange: (v: any[]) => void }) {
  const cols = f.columns!;
  const shown = rows.length ? rows : [{ id: crypto.randomUUID() }];
  const upd = (i: number, k: string, val: any) => {
    const next = shown.map((r, j) => (j === i ? { ...r, [k]: val } : r));
    onChange(next);
  };
  const add = () => onChange([...shown, { id: crypto.randomUUID() }]);
  const del = (i: number) => onChange(shown.filter((_, j) => j !== i));
  const move = (i: number, d: number) => { const n = [...shown]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); onChange(n); };
  const totalCol = f.totalCol ? cols.find((c) => c.id === f.totalCol) : undefined;
  return (
    <div class="table">
      {f.example && <p class="example"><b>Example:</b> {f.example}</p>}
      {shown.map((r, i) => (
        <div class={`trow${f.pdfRows && i >= f.pdfRows ? ' overflow' : ''}`} key={r.id}>
          <div class="trow-head">
            <span class="rownum">{i + 1}</span>
            {f.pdfRows && i === f.pdfRows && <span class="tag">continues on an extra page</span>}
            <span class="spacer" />
            {i > 0 && <button type="button" class="mini" aria-label="Move up" onClick={() => move(i, -1)}>↑</button>}
            {i < shown.length - 1 && <button type="button" class="mini" aria-label="Move down" onClick={() => move(i, 1)}>↓</button>}
            <button type="button" class="mini danger" aria-label="Delete row" onClick={() => del(i)}>✕</button>
          </div>
          <div class="tcells">
            {cols.map((c) => <Cell c={c} row={r} onChange={(val) => upd(i, c.id, val)} />)}
          </div>
        </div>
      ))}
      <button type="button" class="btn ghost" onClick={add}>＋ Add row</button>
      {totalCol && <div class="total-line"><span>Total cost</span><b>{money(tableTotal(rows, totalCol))}</b></div>}
    </div>
  );
}

function Cell({ c, row, onChange }: { c: Column; row: any; onChange: (v: any) => void }) {
  const wide = (!c.type || c.type === 'text') && !c.half;
  if (c.type === 'choice') return <div class={`cell${c.half ? ' half' : ''}`}><span class="clbl">{c.label}</span><Seg options={c.options!} value={row[c.id]} onChange={onChange} /></div>;
  if (c.calc) {
    const auto = c.calc(row);
    return <div class="cell half"><span class="clbl">{c.label}</span>
      <SimpleInput type={c.type || 'text'} value={row[c.id] ?? ''} onChange={onChange} placeholder={auto ? auto.toFixed(2) : '0.00'} />
      <span class="hint">{row[c.id] ? 'Typed value' : 'Auto: qty × unit cost'}</span>
    </div>;
  }
  return <div class={`cell${wide ? '' : ' half'}`}><span class="clbl">{c.label}</span><SimpleInput type={c.type || 'text'} value={row[c.id]} onChange={onChange} /></div>;
}

export { rowValue };

function Hours({ f }: { f: Field }) {
  const [v, set] = useValue<Record<string, { n?: string; h?: string }>>(f.id);
  const val = v || {};
  useProject();
  const t = hoursTotals(values());
  const upd = (k: string, which: 'n' | 'h', x: string) => set({ ...val, [k]: { ...val[k], [which]: x } });
  const report = f.phase === 'report';
  const pv = (values()['hours.proposal'] || {}) as any, plv = (values()['hours.plan'] || {}) as any;
  return (
    <div class="hours" style={{ '--cols': report ? 5 : 2 } as any}>
      {HOURS_ROWS.map((r) => (
        <div class="hrow">
          <div class="hlabel">{r.label}{'hint' in r && <small>{r.hint}</small>}</div>
          {report && <div class="hcarry"><span>Proposal</span><b>{num(pv[r.key]?.h)}</b></div>}
          {report && <div class="hcarry"><span>Plan</span><b>{num(plv[r.key]?.h)}</b></div>}
          <label class="hcell"><span>{report ? 'Workers' : 'People'}</span>
            {'fixedN' in r ? <div class="fixed">1</div> : <input class="inp" inputMode="numeric" value={val[r.key]?.n ?? ''} onInput={(e: any) => upd(r.key, 'n', e.target.value)} />}
          </label>
          <label class="hcell"><span>Hours</span>
            <input class="inp" inputMode="decimal" value={val[r.key]?.h ?? ''} onInput={(e: any) => upd(r.key, 'h', e.target.value)} />
          </label>
          {report && <div class="hcarry total"><span>Total</span><b>{t.rowTotal(r.key)}</b></div>}
        </div>
      ))}
      <div class="hrow grand">
        <div class="hlabel">{report ? 'Grand total of hours' : 'Grand total'}</div>
        {report ? <>
          <div class="hcarry"><span>Proposal</span><b>{t.proposalH}</b></div>
          <div class="hcarry"><span>Plan</span><b>{t.planH}</b></div>
          <div class="hcarry"><span>Workers</span><b>{t.reportN}</b></div>
          <div class="hcarry"><span>Work</span><b>{t.reportH}</b></div>
          <div class="hcarry total"><span>Total</span><b>{t.grand}</b></div>
        </> : <>
          <div class="hcarry"><span>People</span><b>{f.phase === 'plan' ? t.planN : t.proposalN}</b></div>
          <div class="hcarry"><span>Hours</span><b>{f.phase === 'plan' ? t.planH : t.proposalH}</b></div>
        </>}
      </div>
      {report && <p class="hint">Work hours = total for the group (e.g., 10 Scouts × 5 hours = 50).</p>}
    </div>
  );
}

export interface SigVal { typed?: string; drawn?: string; date?: string; name?: string }
function Sig({ f, value, onChange }: { f: Field; value: SigVal; onChange: (v: SigVal) => void }) {
  const [pad, setPad] = useState(false);
  const set = (k: keyof SigVal, x: any) => onChange({ ...value, [k]: x });
  return (
    <div class="sig">
      {f.namePdf !== undefined ? (
        <div class="cell"><span class="clbl">Printed name</span><SimpleInput type="text" value={value.name} onChange={(x) => set('name', x)} /></div>
      ) : null}
      <div class="cell"><span class="clbl">Signature (type full name)</span>
        <input class="inp sig-typed" value={value.typed ?? ''} autoCapitalize="words" placeholder="Type to sign" onInput={(e: any) => set('typed', e.target.value)} />
      </div>
      <div class="sig-draw">
        {value.drawn ? <SigPreview id={value.drawn} /> : null}
        <button type="button" class="btn ghost small" onClick={() => setPad(true)}>{value.drawn ? 'Redraw' : '✍ Draw with finger instead'}</button>
        {value.drawn && <button type="button" class="btn ghost small" onClick={() => set('drawn', undefined)}>Remove drawing</button>}
      </div>
      <div class="cell half"><span class="clbl">Date</span><DateInput value={value.date} onChange={(x) => set('date', x)} /></div>
      {pad && <SignaturePad onClose={() => setPad(false)} onSave={(id) => { set('drawn', id); setPad(false); }} />}
      <p class="hint">Typed signatures are allowed if your council accepts them. Adults can also sign the printed workbook in ink.</p>
    </div>
  );
}

function SigPreview({ id }: { id: string }) {
  const [u, setU] = useState<string>();
  useEffect(() => { import('../core/media').then((m) => m.mediaUrl(id).then(setU)); }, [id]);
  return u ? <img class="sig-img" src={u} alt="Signature" /> : null;
}
