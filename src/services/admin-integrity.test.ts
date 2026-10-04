import {
  isAdminTestBypass,
  parseBooleanInput,
  parseCheckboxInput,
  parseIntegerInput,
  parseOptionalNumberInput,
  parseStringListInput,
  readAdminSubmission,
  resolveRequiredReference,
} from './admin-integrity';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
  console.log(`✅ ${message}`);
}

const records = [
  { id: 'sec_police', slug: 'police-defence-prisons', name: 'Police, Defence & Prisons' },
  { id: 'sec_health', slug: 'public-health-medical', name: 'Public Health & Medical Services' },
];

assert(
  resolveRequiredReference('sec_police', records, 'sector').id === 'sec_police',
  'references resolve by canonical id',
);
assert(
  resolveRequiredReference('PUBLIC-HEALTH-MEDICAL', records, 'sector').id === 'sec_health',
  'references resolve case-insensitively by slug',
);

let rejectedUnknown = false;
try {
  resolveRequiredReference('missing-sector', records, 'sector');
} catch (error) {
  rejectedUnknown = error instanceof Error && error.message === 'Unknown sector: missing-sector';
}
assert(rejectedUnknown, 'unknown references are rejected instead of silently substituted');

assert(parseBooleanInput(false) === false, 'boolean false remains false');
assert(parseBooleanInput('false') === false, 'string false is parsed as false');
assert(parseBooleanInput('1') === true, 'string 1 is parsed as true');
assert(parseCheckboxInput(undefined) === false, 'an unchecked HTML checkbox is false');
assert(parseCheckboxInput('1') === true, 'a checked HTML checkbox is true');
assert(parseIntegerInput(0, 50) === 0, 'zero remains a valid numeric value');
assert(parseIntegerInput(undefined, 50) === 50, 'missing numbers use the explicit default');
assert(parseOptionalNumberInput('0') === 0, 'optional numeric zero remains zero');
assert(parseOptionalNumberInput('') === null, 'blank optional numbers remain absent');
assert(parseStringListInput('Hindi, Typing').join('|') === 'Hindi|Typing', 'comma-separated lists are normalized');

assert(!isAdminTestBypass(undefined, 'true'), 'a request cannot enable bypass without a configured secret');
assert(!isAdminTestBypass('secret', 'true'), 'legacy true bypass headers are rejected');
assert(isAdminTestBypass('secret', 'secret'), 'an exact configured secret enables the test bypass');

const jsonSubmission = await readAdminSubmission(new Request('https://example.test/admin', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ post_id: 'post-001', total_vacancies: 0 }),
}));
assert(jsonSubmission.text('postId', 'post_id') === 'post-001', 'JSON aliases share one decoding interface');
assert(jsonSubmission.value('totalVacancies', 'total_vacancies') === 0, 'JSON decoding preserves zero values');

const form = new FormData();
form.set('organisation_id', 'org-001');
const formSubmission = await readAdminSubmission(new Request('https://example.test/admin', { method: 'POST', body: form }));
assert(formSubmission.text('organisationId', 'organisation_id') === 'org-001', 'form aliases share the JSON decoding interface');

console.log('\n🎉 ADMIN INTEGRITY TESTS PASSED!');
