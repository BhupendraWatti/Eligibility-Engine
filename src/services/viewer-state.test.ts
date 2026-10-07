/**
 * Viewer State resolver and region aliases. Plain asserts, no runtime.
 * Run: `npx tsx src/services/viewer-state.test.ts`
 */
import { resolveRegionAlias } from '../data/india-jurisdictions';
import { homeValueToSave, parseHomeValue, resolveViewerState } from './viewer-state';

let failures = 0;
function assert(condition: boolean, msg: string) {
  if (!condition) {
    failures++;
    console.error(`FAILED: ${msg}`);
    return;
  }
  console.log(`PASSED: ${msg}`);
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// --- Region aliases: current and pre-2023 ISO 3166-2:IN codes map to ours ---
for (const [iso, ours] of [['TS', 'TG'], ['DH', 'DN'], ['DD', 'DN'], ['OR', 'OD'], ['CT', 'CG'], ['UT', 'UK'], ['UL', 'UK']]) {
  assert(resolveRegionAlias(iso) === ours, `alias ${iso} -> ${ours}`);
}
assert(resolveRegionAlias('up') === 'UP', 'alias is case-insensitive');
assert(resolveRegionAlias('ZZ') === null, 'unknown region code is null');
assert(resolveRegionAlias('') === null && resolveRegionAlias(undefined) === null, 'empty region code is null');

// --- parseHomeValue: allowlist, Central rejected, sentinel accepted ---
assert(parseHomeValue('IN') === null, 'Central is never a Home State');
assert(parseHomeValue('<script>') === null, 'markup is rejected');
assert(parseHomeValue('UP'.repeat(20)) === null, 'oversized value is rejected');
assert(parseHomeValue('%00') === null, 'encoded garbage is rejected');
assert(parseHomeValue('none') === 'none' && parseHomeValue('NONE') === 'none', 'none sentinel accepted');
assert(parseHomeValue(' mp ') === 'MP', 'trimmed, case-insensitive code accepted');

// --- Priority: url > cookie > geo > none ---
const cfUP = { country: 'IN', regionCode: 'UP' };
assert(same(resolveViewerState({ home: 'BR', cookie: 'MP', cf: cfUP }), { code: 'BR', source: 'url' }), 'url beats cookie and geo');
assert(same(resolveViewerState({ cookie: 'MP', cf: cfUP }), { code: 'MP', source: 'cookie' }), 'cookie beats geo');
assert(same(resolveViewerState({ cf: cfUP }), { code: 'UP', source: 'geo' }), 'geo used when nothing saved');
assert(same(resolveViewerState({}), { code: null, source: 'none' }), 'no signal is the national view');
assert(same(resolveViewerState({ home: 'ZZ', cookie: 'garbage', cf: cfUP }), { code: 'UP', source: 'geo' }), 'invalid url and cookie fall through to geo');
assert(same(resolveViewerState({ home: 'IN', cf: cfUP }), { code: 'UP', source: 'geo' }), '?home=IN is ignored');

// All India: an explicit choice beats the geo guess (eng E1)
assert(same(resolveViewerState({ cookie: 'none', cf: cfUP }), { code: null, source: 'cookie' }), 'saved "none" beats geo');
assert(same(resolveViewerState({ home: 'none', cookie: 'MP', cf: cfUP }), { code: null, source: 'url' }), '?home=none shows all-India');

// Geo: only for Indian visitors, through the alias map
assert(same(resolveViewerState({ cf: { country: 'US', regionCode: 'CA' } }), { code: null, source: 'none' }), 'non-India visitor gets no guess');
assert(same(resolveViewerState({ cf: { country: 'IN', regionCode: 'TS' } }), { code: 'TG', source: 'geo' }), 'Telangana ISO code resolves');
assert(same(resolveViewerState({ cf: { country: 'IN', regionCode: null } }), { code: null, source: 'none' }), 'India without region gets no guess');
assert(same(resolveViewerState({ cf: null }), { code: null, source: 'none' }), 'missing cf (dev, bots) gets no guess');

// --- Saving: only an explicit picker submit (remember=1) saves (CEO D4) ---
assert(homeValueToSave('UP', null) === null, 'shared ?home link does not save');
assert(homeValueToSave('UP', '1') === 'UP', 'picker submit saves the state');
assert(homeValueToSave('none', '1') === 'none', 'All India saves the none sentinel');
assert(homeValueToSave('ZZ', '1') === null, 'invalid state is never saved');
assert(homeValueToSave('UP', 'yes') === null, 'remember must be exactly 1');

if (failures > 0) {
  console.error(`${failures} viewer-state check(s) failed`);
  process.exit(1);
}
