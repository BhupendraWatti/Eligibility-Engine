/**
 * Domicile scope: the admin-picked state survives saves the MCP approval path makes, and Central defaults to OPEN.
 * Run: `npx tsx src/services/domicile-scope.test.ts`
 */
import { deriveDomicileColumns, nextScope } from './domicile-scope';

let failures = 0;
function assert(condition: boolean, msg: string) {
  if (condition) return console.log(`PASSED: ${msg}`);
  failures++;
  console.error(`FAILED: ${msg}`);
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const throws = (fn: () => unknown) => { try { fn(); return false; } catch { return true; } };

assert(same(nextScope({ requested: 'STATE_ONLY', stateCode: 'MP' }), { scope: 'STATE_ONLY', state: 'MP' }), 'a state recruitment defaults to its own state');
assert(same(nextScope({ requested: 'UNKNOWN', stateCode: 'IN' }), { scope: 'OPEN', state: 'IN' }), 'Central with no picked state is OPEN');
assert(same(nextScope({ requested: 'STATE_ONLY', requestedState: 'dl', stateCode: 'IN' }), { scope: 'STATE_ONLY', state: 'DL' }), 'an admin can limit a Central post to Delhi');
assert(throws(() => nextScope({ requested: 'STATE_ONLY', stateCode: 'IN' })), 'a Central lock without a state is refused, not silently opened');
assert(throws(() => nextScope({ requested: 'STATE_ONLY', requestedState: 'ZZ', stateCode: 'MP' })), 'an unknown state code is refused');
assert(throws(() => nextScope({ requested: 'STATE_ONLY', requestedState: 'IN', stateCode: 'MP' })), 'Central is not a domicile state');
// The approval path sends the merged scope but never a state: the admin's pick must survive.
assert(same(nextScope({ stored: 'STATE_ONLY', storedState: 'DL', requested: 'STATE_ONLY', stateCode: 'IN', previousStateCode: 'IN' }), { scope: 'STATE_ONLY', state: 'DL' }), 'an MCP-approved update keeps the admin-picked state');
assert(same(nextScope({ stored: 'STATE_ONLY', storedState: 'DL', requested: 'STATE_ONLY', requestedState: '', stateCode: 'MP' }), { scope: 'STATE_ONLY', state: 'MP' }), "an admin picking 'own state' clears the override");
assert(same(nextScope({ stored: 'STATE_ONLY', storedState: 'DL', stateCode: 'MP', previousStateCode: 'UP' }), { scope: 'UNKNOWN', state: 'MP' }), 'moving the recruitment to another state resets scope and state');
assert(deriveDomicileColumns('STATE_ONLY', 'DL').domicileStateCode === 'DL', 'columns follow the picked state');

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
