import { isClean } from '../src/core/wordFilter';
let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { c ? pass++ : fail++; if (!c) console.log('  ✗', n); };
const good = ['Trail Marking the Wise Loop', 'Class Assistant Bench', 'Bass Pond Dock', 'Dickens Park Benches', 'Cocktail Garden?', 'Assembly Hall Shelves',
  'Spice Garden Beds', 'Fire Retardant Shed', 'Push It Forward Library', 'Hoe and Rake Rack', 'Scout Hut Repair', 'Cumberland Trail', 'Crappie Pond Pier',
  'Sussex Bird Boxes', 'Pass the Torch', 'Hitchcock Woods', 'Shuttle Stop Bench', 'Grassy Knoll Path', 'Pushing Hills Walk', 'Therapist Garden'];
const badT = ['F U C K this trail', 'fuuuck', 'Sh1t Trail', 'a$$ bench', 'Big Ass Bench', 'dumbass loop', 'TrailFuckers', 'bitches garden', 'B1tch', 's h i t', 'Bull$hit Bridge', 'WTF Path'];
for (const t of good) ok(`clean: ${t}`, isClean(t));
for (const t of badT) ok(`blocked: ${t}`, !isClean(t));
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
