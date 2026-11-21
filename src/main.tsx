import { render } from 'preact';
import { App } from './app';
import { loadProject } from './core/store';
import { persistStorage } from './core/db';
import { loadAllDocStores } from './core/docstore';
import './timeline/model';
import './meetings/model';
import './money/model';
import { autoStartCloud } from './ui/cloudCard';
import { prepareData } from './core/upgrade';
import { startUpdateWatch } from './ui/updatePrompt';
import './styles.css';
import './ui/theme';

// Preview hooks (used by preview.html device frames):
//   ?theme=dark|light|ha|space|craft  forces a look (not saved)
//   ?frame=phone|se|tablet  simulates the iPhone notch / home-bar safe areas
const q = new URLSearchParams(location.search);
const theme = q.get('theme');
if (theme && ['light', 'dark', 'ha', 'space', 'craft'].includes(theme)) document.documentElement.dataset.theme = theme;
const frame = q.get('frame');
if (frame === 'phone') { document.documentElement.style.setProperty('--safe-t', '50px'); document.documentElement.style.setProperty('--safe-b', '22px'); }
if (frame === 'se') document.documentElement.style.setProperty('--safe-t', '20px');
if (frame === 'tablet') { document.documentElement.style.setProperty('--safe-t', '24px'); document.documentElement.style.setProperty('--safe-b', '18px'); }

// Safety copy + any data upgrade run BEFORE anything reads the data.
prepareData().then(() => Promise.all([loadProject(), loadAllDocStores()])).then(() => {
  render(<App />, document.getElementById('app')!);
  persistStorage();
  autoStartCloud();
  startUpdateWatch();
});
