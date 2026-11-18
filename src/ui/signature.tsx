import { useEffect, useRef } from 'preact/hooks';
import { addImageBlob } from '../core/media';

export function SignaturePad({ onSave, onClose }: { onSave: (id: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drew = useRef(false);
  useEffect(() => {
    const c = ref.current!; const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr; c.height = r.height * dpr;
    const ctx = c.getContext('2d')!; ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b2545';
    let down = false;
    const pt = (e: PointerEvent) => { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    const start = (e: PointerEvent) => { down = true; drew.current = true; c.setPointerCapture(e.pointerId); const [x, y] = pt(e); ctx.beginPath(); ctx.moveTo(x, y); e.preventDefault(); };
    const move = (e: PointerEvent) => { if (!down) return; const [x, y] = pt(e); ctx.lineTo(x, y); ctx.stroke(); e.preventDefault(); };
    const end = () => { down = false; };
    c.addEventListener('pointerdown', start); c.addEventListener('pointermove', move); c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    return () => { c.removeEventListener('pointerdown', start); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', end); };
  }, []);
  const clear = () => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); drew.current = false; };
  const save = async () => {
    if (!drew.current) return onClose();
    const blob: Blob = await new Promise((res) => ref.current!.toBlob((b) => res(b!), 'image/png'));
    onSave(await addImageBlob(blob, 'signature.png'));
  };
  return (
    <div class="sheet-bg" onClick={onClose}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Sign with your finger</h3>
        <canvas ref={ref} class="sigpad" />
        <div class="row-btns">
          <button type="button" class="btn ghost" onClick={clear}>Clear</button>
          <span class="spacer" />
          <button type="button" class="btn ghost" onClick={onClose}>Cancel</button>
          <button type="button" class="btn" onClick={save}>Use signature</button>
        </div>
      </div>
    </div>
  );
}
