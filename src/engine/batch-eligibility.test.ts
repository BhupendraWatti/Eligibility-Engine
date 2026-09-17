/**
 * Batch Eligibility Engine Tests
 *
 * Verifies that getEligibleJobs() correctly categorizes recruitments
 * into eligible/pending/ineligible buckets and generates structured
 * progressive questions.
 */
import { getEligibleJobs, type RecruitmentRecord } from './batch-eligibility';
import type { UserEligibilityProfile, RecruitmentCriteria } from './eligibility';

function assert(condition: boolean, testName: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${testName}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${testName}`);
}

let testCount = 0;
function test(name: string, fn: () => void) {
  testCount++;
  fn();
  console.log(`  Test #${testCount}: ${name}`);
}

// -- Test data: three MP recruitments with different requirements --
const constableCriteria: RecruitmentCriteria = {
  minAge: 18,
  maxAgeGeneral: 33,
  ageCutoffDate: '2026-01-01',
  ageRelaxationScSt: 5,
  ageRelaxationObc: 3,
  ageRelaxationFemale: 5,
  ageRelaxationEws: 0,
  minQualificationLevel: '10TH',
  requiresMpDomicile: true,
  requiresMpEmploymentReg: true,
  requiresCpct: false,
  genderAllowed: 'ALL',
  minHeightMaleCm: 168.0,
  minHeightFemaleCm: 158.0,
  minChestMaleCm: 81.0,
};

const patwariCriteria: RecruitmentCriteria = {
  minAge: 18,
  maxAgeGeneral: 40,
  ageCutoffDate: '2026-01-01',
  ageRelaxationScSt: 5,
  ageRelaxationObc: 5,
  ageRelaxationFemale: 5,
  ageRelaxationEws: 0,
  minQualificationLevel: 'GRADUATION',
  requiresMpDomicile: true,
  requiresMpEmploymentReg: true,
  requiresCpct: true,
  genderAllowed: 'ALL',
};

const forestGuardCriteria: RecruitmentCriteria = {
  minAge: 18,
  maxAgeGeneral: 33,
  ageCutoffDate: '2026-01-01',
  ageRelaxationScSt: 5,
  ageRelaxationObc: 3,
  ageRelaxationFemale: 5,
  ageRelaxationEws: 0,
  minQualificationLevel: '10TH',
  requiresMpDomicile: true,
  requiresMpEmploymentReg: true,
  requiresCpct: false,
  genderAllowed: 'ALL',
  minHeightMaleCm: 163.0,
  minHeightFemaleCm: 150.0,
  minChestMaleCm: 79.0,
};

const allJobs: RecruitmentRecord[] = [
  {
    id: 'rec_constable',
    title: 'MP Police Constable 2026',
    slug: 'constable',
    advtNumber: '04/2026',
    totalVacancies: 7500,
    postTitle: 'Police Constable',
    organisationName: 'MPESB',
    organisationShortName: 'MPESB',
    isFeatured: 1,
    lifecycleStatus: 'OPEN',
    criteria: constableCriteria,
  },
  {
    id: 'rec_patwari',
    title: 'MP Patwari 2026',
    slug: 'patwari',
    advtNumber: '06/2026',
    totalVacancies: 3550,
    postTitle: 'Patwari',
    organisationName: 'MPESB',
    organisationShortName: 'MPESB',
    isFeatured: 1,
    lifecycleStatus: 'UPCOMING',
    criteria: patwariCriteria,
  },
  {
    id: 'rec_forest',
    title: 'MP Forest Guard 2026',
    slug: 'forest-guard',
    advtNumber: '07/2026',
    totalVacancies: 2112,
    postTitle: 'Forest Guard',
    organisationName: 'MPESB',
    organisationShortName: 'MPESB',
    isFeatured: 0,
    lifecycleStatus: 'OPEN',
    criteria: forestGuardCriteria,
  },
];

console.log('\n--- Running Batch Eligibility Engine Tests ---\n');

test('Full profile → correct three-bucket split', () => {
  // 10th pass, no CPCT, no graduation → eligible for constable+forest, not patwari
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    hasCpct: false,
    qualificationLevel: '10TH',
    heightCm: 170,
    chestCm: 82,
  };

  const result = getEligibleJobs(profile, allJobs);
  assert(result.summary.totalEvaluated === 3, 'Should evaluate all 3 jobs');
  assert(result.eligible.length === 2, 'Should be eligible for constable + forest guard');
  assert(result.ineligible.length === 1, 'Should be ineligible for patwari (needs graduation + CPCT)');
  assert(result.pending.length === 0, 'No pending when all data provided');
  assert(result.askNextQuestions.length === 0, 'No questions when all data provided');
});

test('Missing height → constable and forest go to pending', () => {
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    hasCpct: false,
    qualificationLevel: '10TH',
    // heightCm: not provided → UNKNOWN for constable + forest
    // chestCm: not provided → UNKNOWN for constable + forest
  };

  const result = getEligibleJobs(profile, allJobs);
  assert(result.pending.length === 2, 'Constable + Forest should be pending (missing height/chest)');
  assert(result.ineligible.length === 1, 'Patwari should still be ineligible');
  assert(result.askNextQuestions.length > 0, 'Should have progressive questions');

  // Verify structured questions have Hindi labels
  const heightQ = result.askNextQuestions.find(q => q.fieldKey === 'heightCm');
  assert(heightQ !== undefined, 'Should ask about height');
  assert(heightQ!.labelHindi.length > 0, 'Height question should have Hindi label');
  assert(heightQ!.affectsRecruitmentIds.length === 2, 'Height affects 2 recruitments');
});

test('Graduate with CPCT → eligible for all 3', () => {
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    hasCpct: true,
    qualificationLevel: 'GRADUATION',
    heightCm: 170,
    chestCm: 82,
  };

  const result = getEligibleJobs(profile, allJobs);
  assert(result.eligible.length === 3, 'Graduate with CPCT should be eligible for all 3');
  assert(result.ineligible.length === 0, 'No ineligible');
  assert(result.pending.length === 0, 'No pending');
});

test('Non-MP domicile → all 3 ineligible', () => {
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: false,
    hasMpRojgarPanjiyan: true,
    hasCpct: true,
    qualificationLevel: 'GRADUATION',
    heightCm: 170,
    chestCm: 82,
  };

  const result = getEligibleJobs(profile, allJobs);
  assert(result.ineligible.length === 3, 'Non-MP domicile should be ineligible for all');
});

test('Results are sorted: featured first, then by lifecycle, then by vacancies', () => {
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    hasCpct: true,
    qualificationLevel: 'GRADUATION',
    heightCm: 170,
    chestCm: 82,
  };

  const result = getEligibleJobs(profile, allJobs);
  // Featured=1 + OPEN should come first (constable: 7500 vacancies)
  assert(result.eligible[0].recruitment.id === 'rec_constable', 'Constable should be first (featured + OPEN + most vacancies)');
  // Forest guard is OPEN but not featured
  // Patwari is featured but UPCOMING
  // Featured UPCOMING should come before non-featured OPEN
  assert(result.eligible[1].recruitment.id === 'rec_patwari', 'Patwari should be second (featured + UPCOMING)');
  assert(result.eligible[2].recruitment.id === 'rec_forest', 'Forest should be third (not featured)');
});

test('Questions sorted by impact (most jobs affected first)', () => {
  // Profile missing both domicile and height → domicile affects all 3, height affects 2
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    // isMpDomicile: not provided
    hasMpRojgarPanjiyan: true,
    qualificationLevel: '10TH',
    // heightCm: not provided
  };

  const result = getEligibleJobs(profile, allJobs);
  if (result.askNextQuestions.length >= 2) {
    // Most impactful question should be first
    assert(
      result.askNextQuestions[0].affectsRecruitmentIds.length >= result.askNextQuestions[1].affectsRecruitmentIds.length,
      'Questions should be sorted by impact (most jobs affected first)'
    );
  }
});

test('Empty profile → all pending with max questions', () => {
  const profile: UserEligibilityProfile = {};
  const result = getEligibleJobs(profile, allJobs);
  // With no data at all, everything should be NEEDS_VERIFICATION (not NOT_ELIGIBLE)
  assert(result.ineligible.length === 0, 'Empty profile should NOT disqualify — all should be pending');
  assert(result.pending.length === 3, 'All 3 should be pending');
  assert(result.askNextQuestions.length > 0, 'Should have questions to ask');
});

console.log(`\n🎉 ALL ${testCount} BATCH ELIGIBILITY TESTS PASSED!\n`);
