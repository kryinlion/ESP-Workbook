// Security-rules test against the local Firebase emulators (no real data, no real project).
// Run: npm run test:rules
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

const env = await initializeTestEnvironment({
  projectId: 'demo-esp',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
});
let pass = 0, fail = 0;
async function t(name, p) { try { await p; pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '—', e.message); } }

const colin = env.authenticatedContext('colin');
const other = env.authenticatedContext('stranger');
const anon = env.unauthenticatedContext();
const json = (o) => new TextEncoder().encode(JSON.stringify(o));
const J = { contentType: 'application/json' };

console.log('Firestore');
await t('owner can write own status doc', assertSucceeds(setDoc(doc(colin.firestore(), 'users/colin'), { lastBackupAt: 1 })));
await t('owner can read own status doc', assertSucceeds(getDoc(doc(colin.firestore(), 'users/colin'))));
await t('owner can write nested doc', assertSucceeds(setDoc(doc(colin.firestore(), 'users/colin/x/y'), { a: 1 })));
await t('stranger cannot read Colin', assertFails(getDoc(doc(other.firestore(), 'users/colin'))));
await t('stranger cannot write Colin', assertFails(setDoc(doc(other.firestore(), 'users/colin'), { evil: 1 })));
await t('stranger cannot read Colin nested', assertFails(getDoc(doc(other.firestore(), 'users/colin/x/y'))));
await t('signed-out cannot read', assertFails(getDoc(doc(anon.firestore(), 'users/colin'))));
await t('signed-out cannot write', assertFails(setDoc(doc(anon.firestore(), 'users/colin'), { evil: 1 })));
await t('nobody can write outside users/', assertFails(setDoc(doc(colin.firestore(), 'public/x'), { a: 1 })));

await t('owner can write a sync entry', assertSucceeds(setDoc(doc(colin.firestore(), 'users/colin/entries/p%3Aproject.title'), { k: 'p:project.title', v: '"x"' })));
await t('stranger cannot read Colin sync entries', assertFails(getDoc(doc(other.firestore(), 'users/colin/entries/p%3Aproject.title'))));
await t('stranger cannot write Colin sync entries', assertFails(setDoc(doc(other.firestore(), 'users/colin/entries/evil'), { k: 'evil' })));

console.log('Storage');
const cs = colin.storage(), os = other.storage(), as = anon.storage();
await t('owner can upload backup json', assertSucceeds(uploadBytes(ref(cs, 'users/colin/backup/latest.json'), json({ a: 1 }), J)));
await t('owner can upload photo', assertSucceeds(uploadBytes(ref(cs, 'users/colin/media/p1.jpg'), new Uint8Array([255, 216, 255]), { contentType: 'image/jpeg' })));
await t('owner can read own backup', assertSucceeds(getBytes(ref(cs, 'users/colin/backup/latest.json'))));
await t('stranger cannot read Colin backup', assertFails(getBytes(ref(os, 'users/colin/backup/latest.json'))));
await t('stranger cannot read Colin photo', assertFails(getBytes(ref(os, 'users/colin/media/p1.jpg'))));
await t('stranger cannot overwrite Colin backup', assertFails(uploadBytes(ref(os, 'users/colin/backup/latest.json'), json({ evil: 1 }), J)));
await t('signed-out cannot read', assertFails(getBytes(ref(as, 'users/colin/backup/latest.json'))));
await t('signed-out cannot upload', assertFails(uploadBytes(ref(as, 'users/colin/x.json'), json({}), J)));
await t('owner cannot upload other file types', assertFails(uploadBytes(ref(cs, 'users/colin/x.exe'), new Uint8Array([1]), { contentType: 'application/octet-stream' })));
await t('owner cannot upload 16 MB file', assertFails(uploadBytes(ref(cs, 'users/colin/big.jpg'), new Uint8Array(16 * 1024 * 1024), { contentType: 'image/jpeg' })));
await t('nobody can write outside users/', assertFails(uploadBytes(ref(cs, 'public/x.json'), json({}), J)));

await env.cleanup();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
