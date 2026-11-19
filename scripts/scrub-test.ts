// Privacy test: protected data never reaches the cloud copy, and restore never overwrites real values.
import { scrubValues, mergeRestore, PLACEHOLDER, PROTECTED_TEXT, SIG_FIELDS, isReentered, scrubMoney, mergeMoney } from '../src/cloud/scrub';

let pass = 0, fail = 0;
const ok = (name: string, c: boolean) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', name); };

const local: Record<string, any> = {
  'cand.fullName': 'Colin Example', 'cand.street': '1 Elm St', 'cand.city': 'Troy', 'cand.state': 'MI',
  'cand.email': 'c@example.com', 'cand.phone': '555-0100', 'cand.memberId': '123456', 'cand.birth': '2010-05-01',
  'parent.name': 'Parent Example', 'sm.name': 'SM Example', 'sm.phone': '555-0101', 'coach.email': 'coach@example.com',
  'ben.org': 'Troy Nature Center', 'ben.phone': '555-0102', 'benrep.name': 'Rep Example', 'csc.contact': 'Office',
  'plan.firstAidSpecialist': 'Medic Example', 'project.title': 'Trail Bridge', 'prop.work': 'Build a bridge',
  'unit.number': '123', 'appr.candSig': { typed: 'Colin Example', drawn: 'sig1', date: '2026-11-19' },
  'appr.smSig': { name: 'SM Example', typed: 'SM Example', date: '2026-11-20' },
};
console.log(`Protected text fields: ${PROTECTED_TEXT.length}, signature fields: ${SIG_FIELDS.length}`);
const { values: cloud, skipMedia } = scrubValues(local);
const blob = JSON.stringify(cloud);
for (const secret of ['Colin Example', '1 Elm St', 'Troy"', 'c@example.com', '555-01', '123456', '2010-05-01', 'Parent Example', 'SM Example', 'coach@example.com', 'Rep Example', 'Medic Example'])
  ok(`cloud copy has no "${secret}"`, !blob.includes(secret));
ok('drawn signature image is kept off the cloud', skipMedia.includes('sig1') && cloud['appr.candSig'].drawn === PLACEHOLDER);
ok('signature date is kept', cloud['appr.candSig'].date === '2026-11-19');
ok('project answers are kept', cloud['project.title'] === 'Trail Bridge' && cloud['prop.work'] === 'Build a bridge');
ok('organization name + unit number kept', cloud['ben.org'] === 'Troy Nature Center' && cloud['unit.number'] === '123');
ok('scrub does not change the device copy', local['cand.fullName'] === 'Colin Example');

// Restore onto the SAME device: every real value survives.
const same = mergeRestore(cloud, local);
ok('restore on same device: nothing to re-enter', same.reenter.length === 0);
ok('restore on same device: real name kept', same.values['cand.fullName'] === 'Colin Example');
ok('restore on same device: drawn signature kept', same.values['appr.candSig'].drawn === 'sig1');
ok('restore: no placeholder anywhere', !JSON.stringify(same.values).includes(PLACEHOLDER));

// Restore onto a NEW device (empty): protected fields blank + listed.
const fresh = mergeRestore(cloud, {});
ok('new device: no placeholder text left in answers', !JSON.stringify(fresh.values).includes(PLACEHOLDER));
ok('new device: name listed to re-enter', fresh.reenter.includes('cand.fullName'));
ok('new device: signature listed to re-enter', fresh.reenter.includes('appr.candSig'));
ok('new device: answers restored', fresh.values['prop.work'] === 'Build a bridge');
ok('new device: signature date kept', fresh.values['appr.candSig'].date === '2026-11-19');
ok('re-entered check works', isReentered('cand.fullName', { 'cand.fullName': 'X' }) && !isReentered('cand.fullName', {}));

// Money: donor names stay, contact details don't
const money = { schema: 1, donors: [{ id: 'd1', name: 'Commerce Lumber', email: 'sales@lumber.example', phone: '555-0199', address: '9 Mill Rd' }], donations: [{ id: 'g1', donorId: 'd1', amount: '120' }], expenses: [], events: [] };
const mc = JSON.stringify(scrubMoney(money));
ok('money cloud copy keeps donor name', mc.includes('Commerce Lumber'));
ok('money cloud copy has no donor email/phone/address', !mc.includes('sales@lumber') && !mc.includes('555-0199') && !mc.includes('9 Mill Rd'));
ok('money cloud copy keeps amounts', mc.includes('"amount":"120"'));
ok('scrubMoney does not change the device copy', money.donors[0].email === 'sales@lumber.example');
const mSame = mergeMoney(scrubMoney(money), money);
ok('money restore on same device keeps contact details', mSame.doc.donors[0].phone === '555-0199' && !mSame.reenter);
const mNew = mergeMoney(scrubMoney(money), undefined);
ok('money restore on new device: blank + re-enter flag', !JSON.stringify(mNew.doc).includes(PLACEHOLDER) && mNew.reenter);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
