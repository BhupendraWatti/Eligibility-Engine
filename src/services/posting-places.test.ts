/**
 * Places of posting: only what the notice names, a valid state and PIN for each, and Google's jobLocation built from them.
 * Run: `npx tsx src/services/posting-places.test.ts`
 */
import { cleanPostingPlaces, parsePostingPlaces, postingPlaceJobLocations, postingPlaceLabel, postingPlacesFromForm, postingPlacesJson, PostingPlaceError } from './posting-places';

let failures = 0;
function assert(condition: boolean, msg: string) {
  if (condition) return console.log(`PASSED: ${msg}`);
  failures++;
  console.error(`FAILED: ${msg}`);
}
function refused(fn: () => unknown, includes: string, msg: string) {
  try {
    fn();
    assert(false, `${msg} (accepted)`);
  } catch (e) {
    assert(e instanceof PostingPlaceError && e.message.includes(includes), `${msg} (${(e as Error).message})`);
  }
}

const bhopal = cleanPostingPlaces([{ locality: ' Bhopal ', postalCode: '462 001', streetAddress: 'Collectorate,  Jail Road' }], 'MP');
assert(bhopal.length === 1 && bhopal[0].locality === 'Bhopal' && bhopal[0].postalCode === '462001' && bhopal[0].streetAddress === 'Collectorate, Jail Road', 'text is tidied and the PIN loses its space');
assert(bhopal[0].stateCode === 'MP', 'a place without a state is in the recruitment\'s own state');
assert(cleanPostingPlaces([{ locality: 'Guwahati', stateCode: 'as' }], 'IN')[0].stateCode === 'AS', 'a central recruitment names each place\'s state');
refused(() => cleanPostingPlaces([{ locality: 'Guwahati' }], 'IN'), 'needs its state', 'a central place without a state is refused');
refused(() => cleanPostingPlaces([{ locality: 'Guwahati' }], null), 'needs its state', 'no recruitment state counts as central');
refused(() => cleanPostingPlaces([{ locality: 'Delhi', stateCode: 'IN' }], 'IN'), 'not a state', '"IN" is not a place\'s state');
refused(() => cleanPostingPlaces([{ locality: 'Bhopal', postalCode: '46200' }], 'MP'), '6 digits', 'a 5-digit PIN is refused');
refused(() => cleanPostingPlaces([{ locality: 'Bhopal', postalCode: '062001' }], 'MP'), '6 digits', 'a PIN cannot start with 0');
refused(() => cleanPostingPlaces([{ postalCode: '462001' }], 'MP'), 'city or town', 'a place needs its city or town');
refused(() => cleanPostingPlaces('Bhopal', 'MP'), 'list', 'a string is not a list');
refused(() => cleanPostingPlaces(Array.from({ length: 51 }, (_, i) => ({ locality: `Town ${i}` })), 'MP'), 'At most 50', 'at most 50 places');
assert(cleanPostingPlaces([{ locality: '', stateCode: '', postalCode: '', streetAddress: '' }, { locality: 'Indore' }, { locality: 'indore' }], 'MP').length === 1, 'blank rows are dropped and repeats kept once');
assert(cleanPostingPlaces(undefined, 'MP').length === 0 && cleanPostingPlaces(null, 'MP').length === 0, 'nothing means no places');

assert(postingPlacesJson([]) === null && parsePostingPlaces(postingPlacesJson(bhopal))[0].postalCode === '462001', 'stored as JSON, none stored as null');
assert(parsePostingPlaces('not json').length === 0 && parsePostingPlaces('[{"locality":1}]').length === 0, 'a broken column reads as none');

const form = new FormData();
for (const [l, s, p, a] of [['Jaipur', 'RJ', '302001', ''], ['', '', '', '']]) {
  form.append('placeLocality', l); form.append('placeState', s); form.append('placePostalCode', p); form.append('placeStreet', a);
}
const fromForm = cleanPostingPlaces(postingPlacesFromForm(form), 'IN');
assert(fromForm.length === 1 && fromForm[0].stateCode === 'RJ' && fromForm[0].postalCode === '302001', 'form rows become places and the blank row is dropped');

assert(postingPlaceLabel(bhopal[0]) === 'Collectorate, Jail Road, Bhopal, Madhya Pradesh 462001', `label (${postingPlaceLabel(bhopal[0])})`);
const [loc] = postingPlaceJobLocations(bhopal);
assert(loc['@type'] === 'Place' && loc.address.streetAddress === 'Collectorate, Jail Road' && loc.address.addressLocality === 'Bhopal'
  && loc.address.addressRegion === 'Madhya Pradesh' && loc.address.postalCode === '462001' && loc.address.addressCountry === 'IN', 'jobLocation carries every address field Google asks for');
const bare = postingPlaceJobLocations(cleanPostingPlaces([{ locality: 'Patna', stateCode: 'BR' }], 'IN'))[0].address;
assert(!('postalCode' in bare) && !('streetAddress' in bare) && bare.addressRegion === 'Bihar', 'fields the notice did not give are left out');

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
