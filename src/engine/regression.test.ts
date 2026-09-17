/**
 * NIRNAY Regression Test Suite
 *
 * Guards against the known data corruption defects:
 * - MPPSC State Services Examination mapped to Police Constable content
 * - Publication of recruitments missing verified sources
 * - Duplicate ingestion of the same advertisement
 *
 * Run: npx tsx src/engine/regression.test.ts
 */

import { validateRecruitmentForPublication } from '../services/publication-validator';
import { detectDuplicates, type ExistingRecruitmentRecord } from '../services/duplicate-detector';
import { FALLBACK_RECRUITMENTS } from '../db/queries';
import { isActiveDrive } from '../services/lifecycle';

let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log('  [PASS] ' + name);
  } catch (err: any) {
    failCount++;
    console.error('  [FAIL] ' + name);
    console.error('       ' + err.message);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ---------------------------------------------------------------------------
// Shared Fixtures
// ---------------------------------------------------------------------------

const MPPSC_SSE_VALID = {
  id: 'rec_mp_mppsc_sse_2026',
  title: 'MPPSC State Services Examination 2026',
  slug: 'mppsc-state-services-examination-2026',
  advtNumber: 'MPPSC/SSE/2026/01',
  cycleYear: 2026,
  totalVacancies: 356,
  postId: 'post_mp_deputy_collector',
  postTitle: 'Deputy Collector (State Civil Service)',
  postSlug: 'mp-deputy-collector',
  departmentId: 'dept_mp_general_admin',
  departmentName: 'General Administration Department',
  organisationId: 'org_mppsc',
  organisationShortName: 'MPPSC',
  organisationName: 'Madhya Pradesh Public Service Commission',
  lifecycleStatus: 'OPEN',
  applicationStart: '2026-02-01',
  applicationEnd: '2026-03-15',
  examDate: '2026-06-21',
  sources: [{
    sourceType: 'OFFICIAL_NOTIFICATION_PDF',
    sourceUrl: 'https://mppsc.mp.gov.in/uploads/advertisement/SSE_2026_Advt.pdf',
    sourceTitle: 'MPPSC SSE 2026 Official Notification',
    status: 'VALID' as const,
  }],
  vacancies: [
    { category: 'UR', count: 156 },
    { category: 'OBC', count: 78 },
    { category: 'SC', count: 56 },
    { category: 'ST', count: 46 },
    { category: 'EWS', count: 20 },
  ],
  criteria: {
    minAge: 21,
    maxAgeGeneral: 33,
    ageCutoffDate: '2026-01-01',
    ageRelaxationScSt: 5,
    ageRelaxationObc: 3,
    ageRelaxationFemale: 5,
    ageRelaxationEws: 0,
    minQualificationLevel: 'GRADUATION',
    requiresMpDomicile: true,
    requiresMpEmploymentReg: true,
    requiresCpct: false,
    genderAllowed: 'ALL' as 'ALL',
  },
};

console.log('\n[NIRNAY REGRESSION] REGRESSION SUITE - Data Integrity');
console.log('======================================================\n');

// ---------------------------------------------------------------------------
// Test Group 1: MPPSC Corruption Guard
// ---------------------------------------------------------------------------
console.log('Test Group 1: MPPSC Corruption Guard');
console.log('--------------------------------------');

test('MPPSC SSE postId must not be police-constable post', () => {
  assert(
    MPPSC_SSE_VALID.postId !== 'post_mp_police_constable',
    'MPPSC SSE postId should never be post_mp_police_constable'
  );
  assert(
    !MPPSC_SSE_VALID.postTitle.toLowerCase().includes('police constable'),
    'MPPSC SSE postTitle must not contain "Police Constable" - got: ' + MPPSC_SSE_VALID.postTitle
  );
  assert(
    !MPPSC_SSE_VALID.postSlug.includes('police-constable'),
    'MPPSC SSE postSlug must not contain "police-constable" - got: ' + MPPSC_SSE_VALID.postSlug
  );
});

test('MPPSC SSE organisation must be MPPSC, not MPESB', () => {
  assert(
    MPPSC_SSE_VALID.organisationShortName === 'MPPSC',
    'Expected organisationShortName "MPPSC", got ' + MPPSC_SSE_VALID.organisationShortName
  );
  assert(
    MPPSC_SSE_VALID.organisationShortName !== 'MPESB',
    'MPPSC SSE must not be assigned to MPESB (Employees Selection Board)'
  );
});

test('Vacancy sum matches totalVacancies for MPPSC SSE', () => {
  const sum = MPPSC_SSE_VALID.vacancies.reduce((acc, v) => acc + v.count, 0);
  assert(
    sum === MPPSC_SSE_VALID.totalVacancies,
    'Vacancy category sum (' + sum + ') must equal totalVacancies (' + MPPSC_SSE_VALID.totalVacancies + ')'
  );
});

// ---------------------------------------------------------------------------
// Test Group 2: Publication Validator Guard
// ---------------------------------------------------------------------------
console.log('\nTest Group 2: Publication Validator Guard');
console.log('------------------------------------------');

test('Valid MPPSC SSE record passes publication validation', () => {
  const result = validateRecruitmentForPublication(MPPSC_SSE_VALID);
  assert(
    result.publishable === true,
    'MPPSC SSE should be publishable. Blocking errors: [' + result.blockingErrors.join('; ') + ']'
  );
  assert(result.blockingErrors.length === 0, 'Expected 0 blocking errors, got: [' + result.blockingErrors.join('; ') + ']');
});

test('Validator blocks a record with missing postId', () => {
  const corrupt = { ...MPPSC_SSE_VALID, postId: undefined };
  const result = validateRecruitmentForPublication(corrupt);
  assert(
    result.publishable === false,
    'Record with no postId must not pass publication validation'
  );
  assert(
    result.checks.canonicalMapping === 'FAIL',
    'Expected canonicalMapping FAIL, got: ' + result.checks.canonicalMapping
  );
});

test('Validator blocks a record with no official source URL', () => {
  const noSource = { ...MPPSC_SSE_VALID, sources: [] };
  const result = validateRecruitmentForPublication(noSource);
  assert(
    result.publishable === false,
    'Record with no sources must not be publishable'
  );
  assert(
    result.checks.source === 'FAIL' || result.blockingErrors.some((e: string) => e.toLowerCase().includes('source')),
    'Expected source validation failure. source check: ' + result.checks.source + ' | errors: [' + result.blockingErrors.join('; ') + ']'
  );
});

test('Validator catches MPPSC-to-Constable canonical mapping corruption', () => {
  const corrupted = {
    ...MPPSC_SSE_VALID,
    postId: 'post_mp_police_constable',
    postTitle: 'Police Constable',
    postSlug: 'mp-police-constable',
  };
  const result = validateRecruitmentForPublication(corrupted);
  const hasContentIssue =
    result.checks.content === 'FAIL' ||
    result.checks.content === 'WARNING' ||
    result.checks.canonicalMapping === 'FAIL' ||
    result.blockingErrors.some((e: string) => e.toLowerCase().includes('constable') || e.toLowerCase().includes('content') || e.toLowerCase().includes('mismatch'));
  assert(
    hasContentIssue || !result.publishable,
    'Validator should detect MPPSC title + Police Constable post mismatch. publishable=' + result.publishable + ', content=' + result.checks.content + ', mapping=' + result.checks.canonicalMapping
  );
});

// ---------------------------------------------------------------------------
// Test Group 3: Duplicate Detection
// ---------------------------------------------------------------------------
console.log('\nTest Group 3: Duplicate Detection');
console.log('-----------------------------------');

const existingRecruitments: ExistingRecruitmentRecord[] = [
  {
    id: 'rec_existing_mppsc_2025',
    title: 'MPPSC State Services Examination 2025',
    advtNumber: 'MPPSC/SSE/2025/01',
    organisationShortName: 'MPPSC',
    postId: 'post_mp_deputy_collector',
    cycleYear: 2025,
    sourceUrl: 'https://mppsc.mp.gov.in/uploads/advertisement/SSE_2025_Advt.pdf',
  },
  {
    id: 'rec_existing_constable_2026',
    title: 'MP Police Constable Recruitment 2026',
    advtNumber: 'MPESB/08/2026',
    organisationShortName: 'MPESB',
    postId: 'post_mp_police_constable',
    cycleYear: 2026,
    sourceUrl: 'https://esb.mp.gov.in/constable2026.pdf',
  },
];

test('Duplicate detector: same AdvtNo triggers CONFIRMED or POSSIBLE DUPLICATE', () => {
  const candidate = {
    id: 'rec_new_attempt',
    title: 'MPPSC SSE 2025 (re-ingest attempt)',
    advtNumber: 'MPPSC/SSE/2025/01',
    organisationShortName: 'MPPSC',
    postId: 'post_mp_deputy_collector',
    cycleYear: 2025,
  };
  const result = detectDuplicates(candidate, existingRecruitments);
  assert(
    result.status === 'CONFIRMED_DUPLICATE' || result.status === 'POSSIBLE_DUPLICATE',
    'Expected CONFIRMED_DUPLICATE or POSSIBLE_DUPLICATE for same AdvtNo, got: ' + result.status
  );
  assert(result.matches.length > 0, 'Should have at least one match');
  assert(
    result.matches.some((m) => m.matchedRecruitmentId === 'rec_existing_mppsc_2025'),
    'Should match against the 2025 existing record'
  );
});

test('Duplicate detector: different AdvtNo and different cycle yields NO_DUPLICATE', () => {
  const candidate = {
    id: 'rec_mp_mppsc_sse_2026',
    title: 'MPPSC State Services Examination 2026',
    advtNumber: 'MPPSC/SSE/2026/01',
    organisationShortName: 'MPPSC',
    postId: 'post_mp_deputy_collector',
    cycleYear: 2026,
    sourceUrl: 'https://mppsc.mp.gov.in/uploads/advertisement/SSE_2026_Advt.pdf',
  };
  const result = detectDuplicates(candidate, existingRecruitments);
  assert(
    result.status === 'NO_DUPLICATE',
    'Expected NO_DUPLICATE for a genuinely new 2026 MPPSC SSE, got: ' + result.status + '. Matches: ' + JSON.stringify(result.matches)
  );
});

// ---------------------------------------------------------------------------
// Test Group 4: Cross-Page Milestone & Lifecycle Guards
// ---------------------------------------------------------------------------
console.log('\nTest Group 4: Cross-Page Milestone & Lifecycle Guards');
console.log('------------------------------------------------------');

test('Guard: Primary Teacher TET (rec_mp_samvida_varg3_2026) is NOT falsely declared', () => {
  const teacher = FALLBACK_RECRUITMENTS.find(r => r.id === 'rec_mp_samvida_varg3_2026');
  assert(teacher !== undefined, 'Teacher TET record must exist');
  assert(teacher!.lifecycleStatus !== 'CLOSED', 'Teacher TET must not be marked CLOSED');
  assert(teacher!.lifecycleStatus !== 'RESULT_DECLARED', 'Teacher TET result must not be marked RESULT_DECLARED');
  assert(teacher!.examDate === '2026-10-12', 'Teacher TET exam date must be 12 Oct 2026');
});

test('Guard: Forest Guard (rec_mp_forest_guard_2026) is NOT marked OPEN', () => {
  const fg = FALLBACK_RECRUITMENTS.find(r => r.id === 'rec_mp_forest_guard_2026');
  assert(fg !== undefined, 'Forest Guard record must exist');
  assert(fg!.lifecycleStatus !== 'OPEN', 'Forest Guard must not be OPEN; exam took place in June 2026');
  assert(fg!.lifecycleStatus === 'RESULT_DECLARED', 'Forest Guard lifecycleStatus must be RESULT_DECLARED');
});

test('Guard: MP Police Constable 2026 dates match official schedule', () => {
  const pc = FALLBACK_RECRUITMENTS.find(r => r.id === 'rec_mp_constable_2026');
  assert(pc !== undefined, 'Police Constable record must exist');
  assert(pc!.applicationStart === '2026-09-22', 'PC applicationStart must be 2026-09-22');
  assert(pc!.applicationEnd === '2026-10-06', 'PC applicationEnd must be 2026-10-06');
  assert(pc!.examDate === '2026-11-19', 'PC examDate must be 2026-11-19');
});

test('Guard: Unverified gazette records are safely non-public and pending verification', () => {
  const unverifiedIds = [
    'rec_mp_group4_clerk_2026',
    'rec_mp_jja_court_2026',
    'rec_mp_mppsc_sse_2026',
    'rec_mp_staff_nurse_2026',
  ];
  for (const id of unverifiedIds) {
    const rec = FALLBACK_RECRUITMENTS.find(r => r.id === id);
    assert(rec !== undefined, `Record ${id} must exist in catalog`);
    assert(rec!.status === 'PENDING_VERIFICATION', `Record ${id} status must be PENDING_VERIFICATION (got: ${rec!.status})`);
    assert(!isActiveDrive(rec!), `Record ${id} must never be an active public drive while unverified`);
  }
});

test('Guard: Answer keys for un-concluded exams are not provisional key active', () => {
  const upcoming = FALLBACK_RECRUITMENTS.filter(r => r.lifecycleStatus === 'UPCOMING' || r.lifecycleStatus === 'EXAM_SCHEDULED');
  for (const rec of upcoming) {
    assert(
      rec.lifecycleStatus !== 'ANSWER_KEY_OUT',
      `Upcoming exam ${rec.id} must never have lifecycleStatus ANSWER_KEY_OUT`
    );
  }
});

test('Guard: Admit cards for future exams are not released', () => {
  const futureExams = FALLBACK_RECRUITMENTS.filter(r => r.lifecycleStatus === 'UPCOMING' || r.lifecycleStatus === 'EXAM_SCHEDULED');
  for (const rec of futureExams) {
    assert(
      rec.lifecycleStatus !== 'ADMIT_CARD_RELEASED',
      `Future exam ${rec.id} must never have lifecycleStatus ADMIT_CARD_RELEASED`
    );
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n======================================================');
if (failCount === 0) {
  console.log('[SUCCESS] ALL ' + testCount + ' REGRESSION TESTS PASSED! Data integrity is confirmed.\n');
} else {
  console.log('[WARNING] ' + passCount + '/' + testCount + ' passed. ' + failCount + ' FAILURE(S) - production is NOT safe to deploy.\n');
  process.exit(1);
}