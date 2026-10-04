import { evaluateEligibility, type RecruitmentCriteria, type UserEligibilityProfile } from './eligibility';

const assertEqual = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
};

const criteria = (state: string, registration: string): RecruitmentCriteria => ({
  minAge: 18,
  maxAgeGeneral: 35,
  ageCutoffDate: '2026-01-01',
  ageRelaxationScSt: 5,
  ageRelaxationObc: 3,
  ageRelaxationFemale: 5,
  ageRelaxationEws: 0,
  minQualificationLevel: '10TH',
  requiresMpDomicile: true,
  domicileStateCode: state,
  requiresMpEmploymentReg: true,
  employmentRegistrationLabel: registration,
  requiresCpct: false,
  genderAllowed: 'ALL',
});

const candidate: UserEligibilityProfile = {
  dob: '2000-01-01',
  gender: 'MALE',
  category: 'UR',
  qualificationLevel: 'GRADUATION',
  domicileStateCode: 'UP',
  registrations: ['UP_SEWAYOJAN'],
};

const upResult = evaluateEligibility(candidate, criteria('UP', 'UP_SEWAYOJAN'));
assertEqual(upResult.overallStatus, 'ELIGIBLE', 'UP candidate should pass UP recruitment');
assertEqual(upResult.items.find(item => item.ruleName === 'State Domicile')?.status, 'MATCH', 'UP domicile should match');
assertEqual(upResult.items.find(item => item.ruleName === 'Employment Registration')?.status, 'MATCH', 'UP registration should match');

const mpResult = evaluateEligibility(candidate, criteria('MP', 'MP_ROJGAR'));
assertEqual(mpResult.overallStatus, 'NOT_ELIGIBLE', 'UP candidate should not pass MP-only recruitment');
assertEqual(mpResult.items.find(item => item.ruleName === 'State Domicile')?.status, 'FAIL', 'UP domicile should not match MP');
assertEqual(mpResult.items.find(item => item.ruleName === 'Employment Registration')?.status, 'FAIL', 'UP registration should not match MP');

const openIndia = evaluateEligibility(candidate, { ...criteria('UP', 'UP_SEWAYOJAN'), requiresMpDomicile: false, domicileStateCode: null, requiresMpEmploymentReg: false });
assertEqual(openIndia.overallStatus, 'ELIGIBLE', 'Candidate should pass an all-India recruitment');

console.log('Multi-state eligibility checks passed.');
