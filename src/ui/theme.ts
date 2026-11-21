// App looks (Mark 2026-11-21). Dark is the default on every device, whatever the phone is set to.
// Light is only ever used when picked in Settings. The skins keep Scouting colors where they can.
// Saved per device (localStorage 'esp.theme'); index.html applies it before the first paint.
import '@fontsource/orbitron/latin-500.css';
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/antonio/latin-400.css';
import '@fontsource/antonio/latin-700.css';
import '@fontsource/pixelify-sans/latin-500.css';
import '@fontsource/pixelify-sans/latin-700.css';
import '../themes/ha.css';
import '../themes/space.css';
import '../themes/craft.css';

export type ThemeId = 'dark' | 'light' | 'ha' | 'space' | 'craft';
export interface ThemeInfo { id: ThemeId; name: string; blurb: string; bar: string; swatches: string[] }

export const THEMES: ThemeInfo[] = [
  { id: 'dark', name: 'Dark', blurb: 'The standard look. Easy on the eyes.', bar: '#0f1d2b', swatches: ['#0b141d', '#13212f', '#d6ab38', '#006B3F', '#CE1126'] },
  { id: 'light', name: 'Light', blurb: 'Grey and bright, for sunny days outside.', bar: '#0f1d2b', swatches: ['#808080', '#4d4d4d', '#d6ab38', '#006B3F', '#CE1126'] },
  { id: 'ha', name: 'H.A.', blurb: 'A glowing heads-up display, like a suit of high-tech armor.', bar: '#02070b', swatches: ['#03080d', '#5ee9ff', '#d6ab38', '#2fd08a', '#ff5a6e'] },
  { id: 'space', name: 'OuterSpace', blurb: 'A starship computer: black space, curved color bars, tall letters.', bar: '#000000', swatches: ['#000000', '#ff9900', '#ffcc99', '#dd5555', '#99ccff'] },
  { id: 'craft', name: 'Eagle Crafting', blurb: 'Build it block by block. Pixel blocks, stone buttons, grass and dirt.', bar: '#3b2a1c', swatches: ['#2b2b2b', '#5d9b3a', '#7a5534', '#8b8b8b', '#CE1126'] },
];

const LS = 'esp.theme';
export function currentTheme(): ThemeId {
  const t = document.documentElement.dataset.theme as ThemeId;
  return THEMES.some((x) => x.id === t) ? t : 'dark';
}
export function setTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  try { localStorage.setItem(LS, id); } catch { /* private mode */ }
  const info = THEMES.find((x) => x.id === id)!;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', info.bar);
}
