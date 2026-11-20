// Update-safety test: every saved sample backup (scripts/fixtures/v*-backup.json) is run through every
// data upgrade in src/core/upgrade.ts. Fails if ANY answer would be lost. Run: npm run test:upgrade
import { readFileSync, readdirSync } from 'node:fs';
import JSZip from 'jszip';
import { DATA_VERSION, MIGRATIONS, migrateDocs, type Migration } from '../src/core/upgrade';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, why = '') => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', n, c ? '' : why); };

/** Every answer (text, number, yes/no) anywhere in the data, counted. Upgrades may MOVE answers, never drop them. */
function answers(o: any, out = new Map<string, number>()) {
  if (o === null || o === undefined) return out;
  if (typeof o === 'object') { for (const v of Object.values(o)) answers(v, out); return out; }
  const k = `${typeof o}:${o}`; out.set(k, (out.get(k) || 0) + 1); return out;
}
function lost(before: any, after: any): string[] {
  const a = answers(before), b = answers(after), miss: string[] = [];
  for (const [k, n] of a) if ((b.get(k) || 0) < n) miss.push(k);
  return miss;
}

ok(`DATA_VERSION (${DATA_VERSION}) matches the newest upgrade`, DATA_VERSION === (MIGRATIONS.at(-1)?.to ?? 1));

const files = readdirSync('scripts/fixtures').filter((f) => /^v\d+-backup\.json$/.test(f)).sort();
ok('there is at least one saved sample backup', files.length > 0);
for (const f of files) {
  const fx = JSON.parse(readFileSync(`scripts/fixtures/${f}`, 'utf8'));
  const { docs, to } = migrateDocs(fx.docs, fx.dataVersion);
  ok(`${f}: upgrades from v${fx.dataVersion} to v${DATA_VERSION}`, to === DATA_VERSION);
  const miss = lost(fx.docs, docs);
  ok(`${f}: no answer lost`, miss.length === 0, `missing: ${miss.slice(0, 5).join(', ')}`);
  ok(`${f}: every document still there`, Object.keys(fx.docs).every((k) => k in docs));
  // the same data packed as a backup file (.zip), then read back the way Restore does
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify({ app: 'esp', format: 1, dataVersion: fx.dataVersion }));
  zip.file('docs.json', JSON.stringify(fx.docs));
  const back = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }));
  const man = JSON.parse(await back.file('manifest.json')!.async('string'));
  const restored = migrateDocs(JSON.parse(await back.file('docs.json')!.async('string')), man.dataVersion ?? 1).docs;
  ok(`${f}: backup file round-trip keeps every answer`, lost(fx.docs, restored).length === 0);
}

// Prove this test would catch a bad upgrade: one that drops a field must be flagged.
const bad: Migration[] = [{ to: 2, note: 'BAD: drops the project title', run: (d) => { delete d.project.values['project.title']; return d; } }];
const fx1 = JSON.parse(readFileSync('scripts/fixtures/v1-backup.json', 'utf8'));
ok('self-check: a data-dropping upgrade IS detected', lost(fx1.docs, migrateDocs(fx1.docs, 1, bad).docs).length > 0);
const good: Migration[] = [{ to: 2, note: 'moves phone to a new key', run: (d) => { const v = d.project.values; v['cand.mobile'] = v['cand.phone']; delete v['cand.phone']; return d; } }];
ok('self-check: an upgrade that only MOVES an answer passes', lost(fx1.docs, migrateDocs(fx1.docs, 1, good).docs).length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
