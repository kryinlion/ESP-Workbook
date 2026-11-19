import { render } from 'preact';
import { App } from './app';
import { loadProject } from './core/store';
import { persistStorage } from './core/db';
import './styles.css';

// Preview hooks (used by preview.html device frames):
//   ?theme=light|dark  forces the color scheme
//   ?frame=phone|se|tablet  simulates the iPhone notch / home-bar safe areas
const q = new URLSearchParams(location.search);
const theme = q.get('theme');
if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
const frame = q.get('frame');
if (frame === 'phone') { document.documentElement.style.setProperty('--safe-t', '50px'); document.documentElement.style.setProperty('--safe-b', '22px'); }
if (frame === 'se') document.documentElement.style.setProperty('--safe-t', '20px');
if (frame === 'tablet') { document.documentElement.style.setProperty('--safe-t', '24px'); document.documentElement.style.setProperty('--safe-b', '18px'); }

loadProject().then(() => {
  render(<App />, document.getElementById('app')!);
  persistStorage();
});
