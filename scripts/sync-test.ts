// Sync merge test: two devices editing at once never lose each other's work, and private data never syncs.
import { DELETED, fromEntries, merge, missingHere, toEntries, withSharedFlags, type Entries } from '../src/cloud/syncMerge';

let pass = 0, fail = 0;
const ok = (name: string, c: boolean) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', name); };

// A tiny "cloud": key → value (DELETED for removals), plus a change log per device cursor.
const cloud: Entries = {};
const log: { k: string; v: any }[] = [];
function device(docs: Record<string, any>) {
  let base: Entries = {}; let cursor = 0;
  return {
    docs,
    sync() {
      const pulled: Entries = {};
      for (const { k, v } of log.slice(cursor)) pulled[k] = v;
      const local = withSharedFlags(toEntries(this.docs), base);
      const { result, push } = merge(local, base, pulled);
      if (process.env.DBG && push.length) console.log("PUSH", push.join(","), push.map(k=>JSON.stringify(local[k])+" vs base "+JSON.stringify(base[k])).join(" ; "));
      for (const k of push) { const v = k in result ? result[k] : DELETED; cloud[k] = v; log.push({ k, v }); }
      cursor = log.length;
      base = result;
      this.docs = fromEntries(result, this.docs);
      return result;
    },
  };
}
const blank = () => ({ project: { schema: 1, id: 'x', values: {}, meta: { createdAt: 1 } }, timeline: { schema: 1, tasks: [], checklist: {} }, meetings: { schema: 1, meetings: [] }, money: { schema: 1, donors: [], donations: [], expenses: [], events: [] } });

// iPhone has existing work; iPad is brand new
const phone = device(blank());
Object.assign(phone.docs.project.values, {
  'project.title': 'Trail Marking', 'prop.work': 'Dig holes', 'cand.fullName': 'Colin Example', 'cand.phone': '555-0100',
  'appr.candSig': { typed: 'Colin Example', date: '2026-11-19' }, checklist: { 0: true, 1: true },
});
phone.docs.timeline.tasks.push({ id: 't1', title: 'Call naturalist', status: 'todo', createdAt: 1 });
phone.docs.money.donors.push({ id: 'd1', name: 'Commerce Lumber', email: 'sales@lumber.example', createdAt: 1 });
phone.sync();
const cloudText = JSON.stringify(cloud);
ok('private: candidate name never reaches the cloud', !cloudText.includes('Colin Example'));
ok('private: phone number never reaches the cloud', !cloudText.includes('555-0100'));
ok('private: signature never reaches the cloud', !cloudText.includes('appr.candSig"') || !cloudText.includes('typed'));
ok('private: donor email never reaches the cloud', !cloudText.includes('sales@lumber'));
ok('donor NAME does sync', cloudText.includes('Commerce Lumber'));

const ipad = device(blank());
ipad.sync();
ok('iPad gets the answers', ipad.docs.project.values['prop.work'] === 'Dig holes');
ok('iPad gets checklist ticks', ipad.docs.project.values.checklist?.[1] === true);
ok('iPad gets tasks', ipad.docs.timeline.tasks[0]?.title === 'Call naturalist');
ok('iPad gets donor name but not email', ipad.docs.money.donors[0]?.name === 'Commerce Lumber' && !ipad.docs.money.donors[0]?.email);
ok('iPad does NOT get the private name', !ipad.docs.project.values['cand.fullName']);
const miss = missingHere(toEntries(phone.docs) as any, ipad.docs.project.values);
ok('iPad knows which private fields to re-enter', miss.includes('cand.fullName') && miss.includes('cand.phone') && miss.includes('appr.candSig'));

// Both edit DIFFERENT things before syncing → both kept
phone.docs.project.values['prop.work'] = 'Dig 12 holes';
ipad.docs.timeline.tasks.push({ id: 't2', title: 'Buy gravel', status: 'todo', createdAt: 2 });
ipad.docs.project.values.checklist = { ...ipad.docs.project.values.checklist, 2: true };
phone.docs.project.values.checklist = { ...phone.docs.project.values.checklist, 3: true };
ipad.sync(); phone.sync(); ipad.sync();
ok('phone edit reaches iPad', ipad.docs.project.values['prop.work'] === 'Dig 12 holes');
ok('iPad task reaches phone', phone.docs.timeline.tasks.some((t: any) => t.id === 't2'));
ok('checklist ticks from both devices kept', [0, 1, 2, 3].every((i) => phone.docs.project.values.checklist[i] && ipad.docs.project.values.checklist[i]));

// Private data still on the phone after syncing
ok('phone keeps its private name', phone.docs.project.values['cand.fullName'] === 'Colin Example');
ok('phone keeps donor email', phone.docs.money.donors[0].email === 'sales@lumber.example');

// Same field edited on both → they end up the same
phone.docs.project.values['project.title'] = 'Phone title';
ipad.docs.project.values['project.title'] = 'iPad title';
phone.sync(); ipad.sync(); phone.sync();
ok('same-field conflict: both devices agree', phone.docs.project.values['project.title'] === ipad.docs.project.values['project.title']);

// Deletes sync
ipad.docs.timeline.tasks = ipad.docs.timeline.tasks.filter((t: any) => t.id !== 't1');
ipad.sync(); phone.sync();
ok('deleted task disappears on the other device', !phone.docs.timeline.tasks.some((t: any) => t.id === 't1'));
delete phone.docs.project.values['prop.work'];
phone.sync(); ipad.sync();
ok('cleared answer clears on the other device', !ipad.docs.project.values['prop.work']);

// Nothing changed → nothing sent
const before = log.length; phone.sync(); ipad.sync();
ok('no changes → nothing uploaded', log.length === before);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
