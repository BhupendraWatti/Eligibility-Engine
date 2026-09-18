import { evaluateEligibility, calculateAgeAtCutoff, type RecruitmentCriteria, type UserEligibilityProfile } from './eligibility';

const sampleConstableCriteria: RecruitmentCriteria = {
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

const samplePatwariCriteria: RecruitmentCriteria = {
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
  minPercentageRequired: 50,
  additionalSkills: ['Hindi Typing'],
};

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

console.log('\n--- Running Eligibility Engine Verification Tests ---\n');

// =============================================
// Original Tests (preserved + enhanced)
// =============================================

test('Age Cutoff Calculation', () => {
  const age = calculateAgeAtCutoff('2002-06-15', '2026-01-01');
  assert(Math.floor(age) === 23, `Age calculation exact year check (Expected 23, got ${Math.floor(age)})`);
});

test('Perfectly Eligible Candidate', () => {
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    hasCpct: false,
    qualificationLevel: '12TH',
    heightCm: 172,
    chestCm: 83,
  };
  const res = evaluateEligibility(profile, sampleConstableCriteria);
  assert(res.overallStatus === 'ELIGIBLE', 'Perfect profile should be ELIGIBLE');
  assert(res.failedCount === 0, 'Zero rules should fail for perfect profile');
  assert(res.unknownCount === 0, 'Zero rules should be unknown for perfect profile');
});

test('Skipped Height → NEEDS_VERIFICATION, not NOT_ELIGIBLE', () => {
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    qualificationLevel: '10TH',
  };
  const res = evaluateEligibility(profile, sampleConstableCriteria);
  assert(res.overallStatus === 'NEEDS_VERIFICATION', 'Skipped height must yield NEEDS_VERIFICATION');
  assert(res.unknownCount >= 1, 'Unknown count should be >= 1 for skipped height/chest');
  assert(res.failedCount === 0, 'Failed count must be 0 for skipped height');
});

test('SC Candidate Age Relaxation (+5 years)', () => {
  const profile: UserEligibilityProfile = {
    dob: '1989-10-15', // ~36.2 years as of 2026-01-01 → within 33+5=38
    gender: 'MALE',
    category: 'SC',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    qualificationLevel: '10TH',
    heightCm: 170,
    chestCm: 82,
  };
  const res = evaluateEligibility(profile, sampleConstableCriteria);
  assert(res.overallStatus === 'ELIGIBLE', 'SC candidate within relaxation window should be ELIGIBLE');
});

test('Non-MP Domicile → NOT_ELIGIBLE', () => {
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: false,
    hasMpRojgarPanjiyan: true,
    hasCpct: false,
    qualificationLevel: '12TH',
    heightCm: 172,
    chestCm: 83,
  };
  const res = evaluateEligibility(profile, sampleConstableCriteria);
  assert(res.overallStatus === 'NOT_ELIGIBLE', 'Non-MP domicile candidate must be NOT_ELIGIBLE');
  assert(res.failedCount >= 1, 'Should have at least 1 failed rule for non-MP domicile');
});

// =============================================
// NEW: Bug Fix Verification Tests
// =============================================

test('EWS gets ZERO age relaxation (Bug #10)', () => {
  const profile: UserEligibilityProfile = {
    dob: '1992-06-01', // ~33.5 years → over 33 for UR/EWS but within 38 for SC/ST
    gender: 'MALE',
    category: 'EWS',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    qualificationLevel: '10TH',
    heightCm: 170,
    chestCm: 82,
  };
  const res = evaluateEligibility(profile, sampleConstableCriteria);
  assert(res.overallStatus === 'NOT_ELIGIBLE', 'EWS over 33 should be NOT_ELIGIBLE (no relaxation)');
  // Verify the age rule specifically failed
  const ageItem = res.items.find(i => i.ruleName === 'Age Requirement');
  assert(ageItem?.status === 'FAIL', 'Age rule should FAIL for EWS at 33.5');
});

test('OBC gets exactly +3 years (Bug #3 — not same as SC/ST)', () => {
  const profile: UserEligibilityProfile = {
    dob: '1990-03-01', // ~35.8 years → within 33+3=36 for OBC
    gender: 'MALE',
    category: 'OBC',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    qualificationLevel: '10TH',
    heightCm: 170,
    chestCm: 82,
  };
  const res = evaluateEligibility(profile, sampleConstableCriteria);
  assert(res.overallStatus === 'ELIGIBLE', 'OBC at ~35.8 should be ELIGIBLE (33+3=36 max)');
});

test('OBC at 36.5 should be NOT_ELIGIBLE (exceeds +3)', () => {
  const profile: UserEligibilityProfile = {
    dob: '1989-06-01', // ~36.5 years → exceeds 33+3=36 for OBC
    gender: 'MALE',
    category: 'OBC',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    qualificationLevel: '10TH',
    heightCm: 170,
    chestCm: 82,
  };
  const res = evaluateEligibility(profile, sampleConstableCriteria);
  assert(res.overallStatus === 'NOT_ELIGIBLE', 'OBC at ~36.5 should be NOT_ELIGIBLE (exceeds 36 limit)');
});

test('Female relaxation uses max(category, female) (Bug #3 continued)', () => {
  const profile: UserEligibilityProfile = {
    dob: '1988-06-01', // ~37.5 years → within 33+5=38 for female, within 33+5=38 for SC
    gender: 'FEMALE',
    category: 'SC',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    qualificationLevel: '10TH',
    heightCm: 160,
  };
  const res = evaluateEligibility(profile, sampleConstableCriteria);
  assert(res.overallStatus === 'ELIGIBLE', 'SC Female at 37.5 should be ELIGIBLE (max(38, 38)=38)');
});

test('Gender restriction — MALE only post rejects FEMALE', () => {
  const maleOnlyCriteria: RecruitmentCriteria = {
    ...sampleConstableCriteria,
    genderAllowed: 'MALE',
  };
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'FEMALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    qualificationLevel: '10TH',
    heightCm: 160,
  };
  const res = evaluateEligibility(profile, maleOnlyCriteria);
  assert(res.overallStatus === 'NOT_ELIGIBLE', 'Female should be NOT_ELIGIBLE for MALE-only post');
});

test('Percentage filter — missing percentage → UNKNOWN (Bug #8)', () => {
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    hasCpct: true,
    qualificationLevel: 'GRADUATION',
    // percentage not provided
  };
  const res = evaluateEligibility(profile, samplePatwariCriteria);
  const pctItem = res.items.find(i => i.ruleName === 'Minimum Percentage');
  assert(pctItem?.status === 'UNKNOWN', 'Missing percentage should be UNKNOWN, not FAIL');
  assert(res.overallStatus !== 'NOT_ELIGIBLE', 'Missing percentage should NOT disqualify');
});

test('Percentage filter — 45% below 50% min → FAIL', () => {
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    hasCpct: true,
    qualificationLevel: 'GRADUATION',
    percentage: 45,
  };
  const res = evaluateEligibility(profile, samplePatwariCriteria);
  const pctItem = res.items.find(i => i.ruleName === 'Minimum Percentage');
  assert(pctItem?.status === 'FAIL', 'Percentage 45% should FAIL against 50% requirement');
});

test('Chest measurement — too low → FAIL', () => {
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    qualificationLevel: '10TH',
    heightCm: 170,
    chestCm: 75, // Below 81cm minimum
  };
  const res = evaluateEligibility(profile, sampleConstableCriteria);
  const chestItem = res.items.find(i => i.ruleName === 'Physical Standards (Chest)');
  assert(chestItem?.status === 'FAIL', 'Chest 75cm should FAIL against 81cm minimum');
});

test('Additional skills — missing → UNKNOWN', () => {
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    hasCpct: true,
    qualificationLevel: 'GRADUATION',
    percentage: 60,
  };
  const res = evaluateEligibility(profile, samplePatwariCriteria);
  const skillItem = res.items.find(i => i.ruleName === 'Additional Skills / Certifications');
  assert(skillItem?.status === 'UNKNOWN', 'Missing skills should be UNKNOWN');
});

test('Additional skills — have required skill → MATCH', () => {
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    hasCpct: true,
    qualificationLevel: 'GRADUATION',
    percentage: 60,
    additionalSkills: ['Hindi Typing'],
  };
  const res = evaluateEligibility(profile, samplePatwariCriteria);
  const skillItem = res.items.find(i => i.ruleName === 'Additional Skills / Certifications');
  assert(skillItem?.status === 'MATCH', 'Having required skills should be MATCH');
});

test('Qualification hierarchy — 8TH < 10TH (Bug #4)', () => {
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    qualificationLevel: '8TH', // Below 10TH requirement
    heightCm: 170,
    chestCm: 82,
  };
  const res = evaluateEligibility(profile, sampleConstableCriteria);
  const eduItem = res.items.find(i => i.ruleName === 'Educational Qualification');
  assert(eduItem?.status === 'FAIL', '8TH should fail against 10TH requirement');
});

test('Qualification hierarchy — DIPLOMA satisfies GRADUATION? No.', () => {
  const profile: UserEligibilityProfile = {
    dob: '2000-05-10',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    hasCpct: true,
    qualificationLevel: 'DIPLOMA',
  };
  const res = evaluateEligibility(profile, samplePatwariCriteria);
  const eduItem = res.items.find(i => i.ruleName === 'Educational Qualification');
  assert(eduItem?.status === 'FAIL', 'DIPLOMA (rank 4) should fail against GRADUATION (rank 5)');
});

test('Required experience is evaluated instead of ignored', () => {
  const result = evaluateEligibility({
    dob: '2000-05-10', gender: 'MALE', category: 'UR', isMpDomicile: true,
    hasMpRojgarPanjiyan: true, qualificationLevel: '10TH', experienceMonths: 6,
  }, { ...sampleConstableCriteria, minHeightMaleCm: null, minChestMaleCm: null, experienceMonths: 12 });
  assert(result.items.find(item => item.ruleName === 'Experience')?.status === 'FAIL', '6 months must fail a 12-month requirement');
});

test('Invalid date of birth yields verification, not a false eligibility decision', () => {
  const result = evaluateEligibility({
    dob: 'not-a-date', gender: 'MALE', category: 'UR', isMpDomicile: true,
    hasMpRojgarPanjiyan: true, qualificationLevel: '10TH', heightCm: 170, chestCm: 82,
  }, sampleConstableCriteria);
  assert(result.items.find(item => item.ruleName === 'Age Requirement')?.status === 'UNKNOWN', 'Invalid DOB must remain unknown');
});

console.log(`\n🎉 ALL ${testCount} ELIGIBILITY ENGINE TESTS PASSED!\n`);
