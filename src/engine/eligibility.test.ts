import { evaluateEligibility, calculateAgeAtCutoff, type RecruitmentCriteria, type UserEligibilityProfile } from './eligibility';

const sampleConstableCriteria: RecruitmentCriteria = {
  minAge: 18,
  maxAgeGeneral: 33,
  ageCutoffDate: '2026-01-01',
  ageRelaxationScSt: 5,
  ageRelaxationObc: 3,
  ageRelaxationFemale: 5,
  minQualificationLevel: '10TH',
  requiresMpDomicile: true,
  requiresMpEmploymentReg: true,
  requiresCpct: false,
  genderAllowed: 'ALL',
  minHeightMaleCm: 168.0,
  minHeightFemaleCm: 158.0,
};

function assert(condition: boolean, testName: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${testName}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${testName}`);
}

console.log('\n--- Running Eligibility Engine Verification Tests ---\n');

// Test 1: Age Cutoff Calculation
const age = calculateAgeAtCutoff('2002-06-15', '2026-01-01');
assert(Math.floor(age) === 23, `Age calculation exact year check (Expected 23, got ${Math.floor(age)})`);

// Test 2: Perfectly Eligible Candidate
const perfectProfile: UserEligibilityProfile = {
  dob: '2000-05-10', // ~25.6 years as of 2026-01-01
  gender: 'MALE',
  category: 'UR',
  isMpDomicile: true,
  hasMpRojgarPanjiyan: true,
  hasCpct: false,
  qualificationLevel: '12TH',
  heightCm: 172,
};
const res1 = evaluateEligibility(perfectProfile, sampleConstableCriteria);
assert(res1.overallStatus === 'ELIGIBLE', 'Perfect profile should be ELIGIBLE');
assert(res1.failedCount === 0, 'Zero rules should fail for perfect profile');
assert(res1.unknownCount === 0, 'Zero rules should be unknown for perfect profile');

// Test 3: Skipped Information Must Yield NEEDS_VERIFICATION, Not NOT_ELIGIBLE
const skippedProfile: UserEligibilityProfile = {
  dob: '2000-05-10',
  gender: 'MALE',
  category: 'UR',
  isMpDomicile: true,
  hasMpRojgarPanjiyan: true,
  qualificationLevel: '10TH',
  heightCm: undefined, // Skipped height!
};
const res2 = evaluateEligibility(skippedProfile, sampleConstableCriteria);
assert(res2.overallStatus === 'NEEDS_VERIFICATION', 'Skipped height must yield NEEDS_VERIFICATION');
assert(res2.unknownCount === 1, 'Unknown count should be exactly 1 for skipped height');
assert(res2.failedCount === 0, 'Failed count must be 0 for skipped height');

// Test 4: Age Relaxation Check (SC Candidate aged 36 is within 33+5=38)
const scProfile: UserEligibilityProfile = {
  dob: '1989-10-15', // ~36.2 years as of 2026-01-01
  gender: 'MALE',
  category: 'SC',
  isMpDomicile: true,
  hasMpRojgarPanjiyan: true,
  qualificationLevel: '10TH',
  heightCm: 170,
};
const res3 = evaluateEligibility(scProfile, sampleConstableCriteria);
assert(res3.overallStatus === 'ELIGIBLE', 'SC candidate within relaxation window should be ELIGIBLE');

// Test 5: Definite Ineligibility (Non-MP Domicile for MP-reserved job)
const outsiderProfile: UserEligibilityProfile = {
  ...perfectProfile,
  isMpDomicile: false,
};
const res4 = evaluateEligibility(outsiderProfile, sampleConstableCriteria);
assert(res4.overallStatus === 'NOT_ELIGIBLE', 'Non-MP domicile candidate must be NOT_ELIGIBLE');
assert(res4.failedCount >= 1, 'Should have at least 1 failed rule for non-MP domicile');

console.log('\n🎉 ALL 5 ELIGIBILITY ENGINE TESTS PASSED CLEANLY!\n');
