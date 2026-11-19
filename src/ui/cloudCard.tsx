import { useEffect, useState } from 'preact/hooks';
import { setMeta, useProject } from '../core/store';
import { ALL_FIELDS } from '../workbook/schema';
import { isReentered, labelOf } from '../cloud/scrub';

type Cloud = typeof import('../cloud/cloud');
let mod: Promise<Cloud> | null = null;
export const loadCloud = () => (mod ??= import('../cloud/cloud'));

/** True once this device has signed in to cloud backup. */
export function cloudOn(): boolean {
  try { return !!JSON.parse(localStorage.getItem('esp.cloud') || '{}').on; } catch { return false; }
}

/** Start automatic cloud backup on launch if this device signed in before (keeps Firebase off the first paint). */
export function autoStartCloud() {
  if (cloudOn()) loadCloud();
}

const ago = (t: number | null) => {
  if (!t) return 'never';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
};

export function CloudCard() {
  const [c, setC] = useState<Cloud | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { loadCloud().then((m) => { setC(m); m.subscribeCloud(() => tick((n) => n + 1)); }); }, []);
  if (!c || !c.cloudState().ready) {
    return <section class="card"><h2>☁ Cloud backup <small class="h2-tag">automatic</small></h2><p class="muted">Loading…</p></section>;
  }
  const s = c.cloudState();
  return (
    <section class="card cloud">
      <h2>☁ Cloud backup <small class="h2-tag">automatic</small></h2>
      {s.email ? <SignedIn c={c} /> : <SignIn c={c} />}
      {s.error && <p class="toast bad">⚠️ {s.error}</p>}
    </section>
  );
}

function SignIn({ c }: { c: Cloud }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [mode, setMode] = useState<'in' | 'new'>('in');
  const [note, setNote] = useState('');
  const go = (e: Event) => {
    e.preventDefault();
    setNote('');
    (mode === 'in' ? c.signIn(email, pw) : c.signUp(email, pw)).catch(() => {});
  };
  const reset = () => {
    if (!email) { setNote('Type your email first, then tap “Forgot password?”.'); return; }
    c.resetPassword(email).then(() => setNote('Check your email for a link to set a new password.')).catch(() => {});
  };
  return (
    <form onSubmit={go}>
      <p class="intro">Sign in once and your project backs itself up to the cloud automatically while you work, photos included. Your name, address, phone numbers, other people's contact details, and signatures stay only on this device.</p>
      <div class="cell"><span class="clbl">Email</span>
        <input class="inp" type="email" autoComplete="username" autoCapitalize="off" value={email} onInput={(e: any) => setEmail(e.target.value)} required />
      </div>
      <div class="cell" style={{ marginTop: '8px' }}><span class="clbl">Password</span>
        <input class="inp" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={pw} onInput={(e: any) => setPw(e.target.value)} required minLength={6} />
      </div>
      <button class="btn wide" type="submit">{mode === 'in' ? 'Sign in' : 'Create account'}</button>
      <div class="row-btns cloud-links">
        <button type="button" class="lnk-btn" onClick={() => setMode(mode === 'in' ? 'new' : 'in')}>{mode === 'in' ? 'First time? Create an account' : 'Have an account? Sign in'}</button>
        {mode === 'in' && <button type="button" class="lnk-btn" onClick={reset}>Forgot password?</button>}
      </div>
      {note && <p class="muted">{note}</p>}
    </form>
  );
}

function SignedIn({ c }: { c: Cloud }) {
  const s = c.cloudState();
  const [ask, setAsk] = useState<null | { createdAt: string; photos: number } | 'none'>(null);
  const [msg, setMsg] = useState('');
  const backup = () => { setMsg(''); c.backupToCloud(true).then(() => setMsg('✓ Backed up to the cloud')).catch(() => {}); };
  const check = () => { setMsg(''); c.cloudInfo().then((i) => setAsk(i ?? 'none')).catch(() => {}); };
  const restore = () => {
    c.restoreFromCloud().then((r) => { setAsk(null); setMsg(r.length ? `✓ Restored. ${r.length} private item${r.length === 1 ? '' : 's'} to re-enter — see the list on Home.` : '✓ Restored'); }).catch(() => {});
  };
  return (
    <>
      <p class="cloud-on"><span class="dot" /> On · <b>{s.email}</b></p>
      <p class="muted">{s.busy === 'backup' ? 'Backing up…' : `Last cloud backup: ${ago(s.lastAt)}. It backs up by itself every few minutes while you work. Private details (names, addresses, phones, signatures) stay off the cloud.`}</p>
      <button class="btn wide" disabled={!!s.busy} onClick={backup}>{s.busy === 'backup' ? 'Backing up…' : '☁ Back up to cloud now'}</button>
      {!ask && <button class="btn ghost wide" disabled={!!s.busy} onClick={check}>⟲ Restore from cloud…</button>}
      {ask === 'none' && <p class="muted">There's no cloud backup yet for this account.</p>}
      {ask && ask !== 'none' && (
        <div class="confirm">
          <p><b>Restore the cloud backup</b> from {new Date(ask.createdAt).toLocaleString()} ({ask.photos} photo{ask.photos === 1 ? '' : 's'})? Your answers on this device are replaced by the cloud copy. Photos on this device are kept, and private details already on this device stay.</p>
          <div class="row-btns">
            <button class="btn ghost" onClick={() => setAsk(null)}>Cancel</button>
            <button class="btn danger" disabled={!!s.busy} onClick={restore}>{s.busy === 'restore' ? 'Restoring…' : 'Restore'}</button>
          </div>
        </div>
      )}
      {msg && <p class="toast">{msg}</p>}
      <button type="button" class="lnk-btn" onClick={() => c.signOut().catch(() => {})}>Sign out of cloud backup</button>
    </>
  );
}

const SECTION_OF: Record<string, string> = Object.fromEntries(ALL_FIELDS.map(({ section, field }) => [field.id, section.id]));

/** Home card after a cloud restore: private items to type back in. Disappears when all are done. */
export function ReenterCard() {
  const p = useProject();
  const list = p.meta.reenter || [];
  const left = list.filter((id) => !isReentered(id, p.values));
  if (!list.length) return null;
  if (!left.length) { queueMicrotask(() => setMeta({ reenter: [] })); return null; }
  return (
    <div class="card warn reenter">
      <b>Re-enter these private details</b>
      <span>They were kept off the cloud for privacy. Each one disappears from this list once it's filled in.</span>
      <ul>
        {left.slice(0, 8).map((id) => <li><a class="lnk" href={id === 'money.donorContacts' ? '#/money/donors' : `#/workbook/${SECTION_OF[id] || 'contacts'}`}>{labelOf(id)}</a></li>)}
      </ul>
      {left.length > 8 && <span>+ {left.length - 8} more</span>}
      <button type="button" class="lnk-btn" onClick={() => setMeta({ reenter: [] })}>Dismiss list</button>
    </div>
  );
}
