/** Run: npx tsx src/services/selection-stages.test.ts */
import { formatSelectionStages, parseSelectionStages } from './selection-stages';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`PASSED: ${msg}`);
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const stored = [
  { stage: 1, name: 'Written exam', desc: 'Objective, 100 marks' },
  { stage: 2, name: 'Physical test', desc: 'Qualifying', isQualifying: true },
];

assert(formatSelectionStages(stored) === 'Written exam | Objective, 100 marks\nPhysical test | Qualifying', 'stages print one per line');
assert(formatSelectionStages(undefined) === '', 'no stages print as empty');
assert(same(parseSelectionStages(formatSelectionStages(stored), stored), stored), 'printing then reading gives the same stages back');
assert(same(parseSelectionStages('\n  Interview  \n\nDocument check | Originals\n'), [
  { stage: 1, name: 'Interview', desc: '' },
  { stage: 2, name: 'Document check', desc: 'Originals' },
]), 'blank lines are skipped and stages renumbered');
assert(parseSelectionStages('Physical test | Now scored', stored)[0].isQualifying === undefined, 'an edited stage drops the old qualifying flag');
assert(same(parseSelectionStages('  \n '), []), 'empty text means no stages');
assert(same(parseSelectionStages('| nothing'), []), 'a line with only a description is ignored');

console.log('\nAll selection-stage checks passed.');
