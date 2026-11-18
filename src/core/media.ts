import { getMedia, putMedia, type MediaRec } from './db';

const MAX = 2000; // longest edge, px
const urlCache = new Map<string, string>();

export interface PhotoRef { id: string; caption?: string; addedAt?: number }

// Normalize any incoming image (camera, camera roll, paste, link, drop) into a
// compressed JPEG/PNG stored in IndexedDB. Returns the new media id.
export async function addImageBlob(input: Blob, name?: string): Promise<string> {
  if (!input.type.startsWith('image/') && input.type !== '') throw new Error('That file is not an image.');
  let bmp: ImageBitmap | HTMLImageElement;
  try { bmp = await createImageBitmap(input, { imageOrientation: 'from-image' } as any); }
  catch { bmp = await loadImg(input); }
  const w0 = (bmp as any).width, h0 = (bmp as any).height;
  const scale = Math.min(1, MAX / Math.max(w0, h0));
  const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const keepPng = input.type === 'image/png' && input.size < 1.5e6; // diagrams / screenshots stay crisp
  if (!keepPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(bmp as any, 0, 0, w, h);
  const type = keepPng ? 'image/png' : 'image/jpeg';
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not process image'))), type, 0.85));
  const id = crypto.randomUUID();
  await putMedia({ id, blob, type, w, h, name, createdAt: Date.now() });
  return id;
}

function loadImg(b: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read that image.'));
    i.src = URL.createObjectURL(b);
  });
}

export async function addImageFromUrl(url: string): Promise<string> {
  let r: Response;
  try { r = await fetch(url, { mode: 'cors' }); }
  catch { throw new Error("That website won't share the image directly. Instead: long-press the image → Copy, then tap Paste here."); }
  if (!r.ok) throw new Error(`Couldn't download (error ${r.status}).`);
  const b = await r.blob();
  if (!b.type.startsWith('image/')) throw new Error("That link isn't an image. Open it, long-press the picture → Copy, then tap Paste.");
  return addImageBlob(b, url.split('/').pop());
}

export async function readClipboardImages(): Promise<Blob[]> {
  const out: Blob[] = [];
  if (!navigator.clipboard?.read) throw new Error('Paste: long-press inside the box below and choose Paste.');
  const items = await navigator.clipboard.read();
  for (const it of items) {
    const t = it.types.find((x) => x.startsWith('image/'));
    if (t) out.push(await it.getType(t));
  }
  return out;
}

export async function mediaUrl(id: string): Promise<string | undefined> {
  if (urlCache.has(id)) return urlCache.get(id);
  const m = await getMedia(id);
  if (!m) return undefined;
  const u = URL.createObjectURL(m.blob); urlCache.set(id, u); return u;
}

export async function mediaRec(id: string): Promise<MediaRec | undefined> { return getMedia(id); }
