import { render } from 'preact';
import { App } from './app';
import { loadProject } from './core/store';
import { persistStorage } from './core/db';
import './styles.css';

loadProject().then(() => {
  render(<App />, document.getElementById('app')!);
  persistStorage();
});
