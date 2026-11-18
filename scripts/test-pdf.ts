// Fills the official workbook with sample data to check every mapping.
// Run: npm run test:pdf  → writes scripts/out/sample_filled.pdf
import fs from 'node:fs';
import { fillWorkbook } from '../src/workbook/pdfExport';
import { ALL_FIELDS } from '../src/workbook/schema';

const v: Record<string, any> = {};
for (const { field: f } of ALL_FIELDS) {
  switch (f.type) {
    case 'text': case 'state': v[f.id] = f.type === 'state' ? 'IL' : `${f.label}`.slice(0, 30); break;
    case 'email': v[f.id] = 'scout@example.com'; break;
    case 'tel': v[f.id] = '312-555-0100'; break;
    case 'money': v[f.id] = '125.50'; break;
    case 'date': v[f.id] = '2027-03-14'; break;
    case 'long': v[f.id] = `${f.label}: ` + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(f.id === 'prop.description' ? 60 : 4); break;
    case 'yesno': v[f.id] = 'Yes'; break;
    case 'choice': v[f.id] = 'Troop'; break;
    case 'sig': v[f.id] = { typed: 'Colin Sample', date: '2027-04-01', name: 'Printed Name' }; break;
    case 'table': v[f.id] = Array.from({ length: (f.pdfRows || 3) + 2 }, (_, i) => Object.fromEntries(f.columns!.map((c) => [c.id, c.type === 'num' ? String(i + 1) : c.type === 'money' ? (c.calc ? '' : '4.25') : c.type === 'choice' ? 'Youth' : `${c.label} ${i + 1}`]))); break;
    case 'hours': v[f.id] = { cand: { h: '10' }, ryouth: { n: '4', h: '12' }, oyouth: { n: '2', h: '3' }, radult: { n: '2', h: '6' }, oadult: { n: '1', h: '2' } }; break;
  }
}
v['cand.fullName'] = 'Colin Sample Stadler';
v['project.title'] = 'Pollinator Garden at Lincoln School';
const tpl = fs.readFileSync('public/workbook-512-927.pdf');
const out = await fillWorkbook(tpl, v, async () => undefined);
fs.mkdirSync('scripts/out', { recursive: true });
fs.writeFileSync('scripts/out/sample_filled.pdf', out);
console.log('ok', out.length);
