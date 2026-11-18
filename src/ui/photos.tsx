import { useEffect, useRef, useState } from 'preact/hooks';
import { addImageBlob, addImageFromUrl, mediaUrl, readClipboardImages, type PhotoRef } from '../core/media';

// One "Add image" control used everywhere: camera / camera roll / files,
// paste, web link, and drag-and-drop.
export function Photos({ value, onChange, label }: { value: PhotoRef[]; onChange: (v: PhotoRef[]) => void; label: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [over, setOver] = useState(false);
  const [view, setView] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const latest = useRef(value); latest.current = value;

  const addBlobs = async (blobs: Blob[]) => {
    if (!blobs.length) return;
    setBusy(true); setErr('');
    try {
      const ids: PhotoRef[] = [];
      for (const b of blobs) ids.push({ id: await addImageBlob(b, (b as File).name), caption: '', addedAt: Date.now() });
      onChange([...(latest.current || []), ...ids]);
    } catch (e: any) { setErr(e.message || String(e)); }
    setBusy(false);
  };

  const onPasteEvt = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); addBlobs(files); return; }
    const text = e.clipboardData?.getData('text') || '';
    if (/^https?:\/\//.test(text.trim())) { e.preventDefault(); fromLink(text.trim()); }
  };

  const pasteBtn = async () => {
    setErr('');
    try {
      const b = await readClipboardImages();
      if (b.length) return addBlobs(b);
      const t = await navigator.clipboard.readText?.();
      if (t && /^https?:\/\//.test(t.trim())) return fromLink(t.trim());
      setErr('No image on the clipboard. Copy a photo first (long-press → Copy).');
    } catch (e: any) { setErr(e.message?.includes('Paste') ? e.message : 'Long-press inside the dashed box and choose Paste.'); }
  };

  const fromLink = async (u: string) => {
    setBusy(true); setErr('');
    try { const id = await addImageFromUrl(u); onChange([...(latest.current || []), { id, caption: '', addedAt: Date.now() }]); setLinkOpen(false); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setOver(false);
    const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length) return addBlobs(files);
    const u = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
    if (u && /^https?:\/\//.test(u)) fromLink(u.trim());
  };

  return (
    <div class={`photos${over ? ' over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
      {value.length > 0 && (
        <div class="thumbs">
          {value.map((p, i) => <Thumb key={p.id} p={p} onOpen={() => setView(i)} />)}
        </div>
      )}
      <div class="add-row">
        <button type="button" class="btn small" disabled={busy} onClick={() => fileRef.current?.click()}>📷 Camera / Photos</button>
        <button type="button" class="btn ghost small" disabled={busy} onClick={pasteBtn}>📋 Paste</button>
        <button type="button" class="btn ghost small" disabled={busy} onClick={() => setLinkOpen(!linkOpen)}>🔗 Link</button>
      </div>
      <div class="paste-zone" contentEditable tabIndex={0} aria-label={`Paste or drop images for ${label}`}
        onPaste={onPasteEvt as any} onInput={(e) => { (e.target as HTMLElement).innerHTML = ''; }}>
        {busy ? 'Adding…' : 'Or drop / long-press here to paste'}
      </div>
      {linkOpen && <LinkBox onGo={fromLink} busy={busy} />}
      {err && <p class="err">{err}</p>}
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => {
        const fs = Array.from((e.target as HTMLInputElement).files || []); (e.target as HTMLInputElement).value = ''; addBlobs(fs);
      }} />
      {view !== null && value[view] && (
        <Viewer p={value[view]} onClose={() => setView(null)}
          onCaption={(c) => onChange(value.map((x, i) => (i === view ? { ...x, caption: c } : x)))}
          onDelete={() => { onChange(value.filter((_, i) => i !== view)); setView(null); }}
          onMove={(d) => { const n = [...value]; const j = view + d; if (j < 0 || j >= n.length) return; [n[view], n[j]] = [n[j], n[view]]; onChange(n); setView(j); }} />
      )}
    </div>
  );
}

function LinkBox({ onGo, busy }: { onGo: (u: string) => void; busy: boolean }) {
  const [u, setU] = useState('');
  return (
    <form class="linkbox" onSubmit={(e) => { e.preventDefault(); if (u.trim()) onGo(u.trim()); }}>
      <input class="inp" type="url" inputMode="url" autoCapitalize="off" placeholder="https://…/image.jpg" value={u} onInput={(e: any) => setU(e.target.value)} />
      <button class="btn small" disabled={busy}>Add</button>
    </form>
  );
}

function useMediaUrl(id: string) {
  const [u, setU] = useState<string>();
  useEffect(() => { mediaUrl(id).then(setU); }, [id]);
  return u;
}

function Thumb({ p, onOpen }: { p: PhotoRef; onOpen: () => void }) {
  const u = useMediaUrl(p.id);
  return (
    <button type="button" class="thumb" onClick={onOpen}>
      {u ? <img src={u} alt={p.caption || 'Photo'} loading="lazy" /> : <span class="ph" />}
      {p.caption ? <span class="cap">{p.caption}</span> : null}
    </button>
  );
}

function Viewer({ p, onClose, onCaption, onDelete, onMove }: { p: PhotoRef; onClose: () => void; onCaption: (c: string) => void; onDelete: () => void; onMove: (d: number) => void }) {
  const u = useMediaUrl(p.id);
  const [confirm, setConfirm] = useState(false);
  return (
    <div class="sheet-bg" onClick={onClose}>
      <div class="sheet viewer" onClick={(e) => e.stopPropagation()}>
        {u && <img src={u} alt="" />}
        <input class="inp" placeholder="Add a caption" value={p.caption || ''} onInput={(e: any) => onCaption(e.target.value)} />
        <div class="row-btns">
          <button type="button" class="btn ghost small" onClick={() => onMove(-1)}>◀ Move</button>
          <button type="button" class="btn ghost small" onClick={() => onMove(1)}>Move ▶</button>
          <span class="spacer" />
          {confirm
            ? <button type="button" class="btn danger small" onClick={onDelete}>Really remove</button>
            : <button type="button" class="btn ghost small" onClick={() => setConfirm(true)}>Remove</button>}
          <button type="button" class="btn small" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
