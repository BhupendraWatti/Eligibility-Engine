import { getEligibleJobs } from './batch-eligibility';
import { evaluateEligibility, completedYearsAtCutoff, calculateAgeAtCutoff, type RecruitmentCriteria, type UserEligibilityProfile } from './eligibility';

let failures = 0;
function test(name: string, fn: () => void) {
  try { fn(); console.log(`✅ PASSED: ${name}`); }
  catch (error: any) { failures++; console.error(`❌ FAILED: ${name}\n   ${error.message}`); }
}
const eq = (actual: unknown, expected: unknown, message = '') => {
  if (actual !== expected) throw new Error(`${message} expected ${String(expected)}, received ${String(actual)}`);
};

const base: RecruitmentCriteria = {
  minAge: 18, maxAgeGeneral: 33, ageCutoffDate: '2026-01-01',
  ageRelaxationScSt: 5, ageRelaxationObc: 3, ageRelaxationFemale: 5, ageRelaxationEws: 0,
  minQualificationLevel: '10TH', requiresMpDomicile: false, requiresMpEmploymentReg: false,
  requiresCpct: false, genderAllowed: 'ALL',
};
const person = (extra: UserEligibilityProfile = {}): UserEligibilityProfile => ({
  dob: '1995-01-01', gender: 'MALE', category: 'UR', qualificationLevel: 'GRADUATION', ...extra,
});
const rule = (r: ReturnType<typeof evaluateEligibility>, name: string) => r.items.find(i => i.ruleName === name);

// --- Age: completed years vs limits -------------------------------------------------
test('completed years: birthday on cutoff counts, day before does not', () => {
  eq(completedYearsAtCutoff('1993-01-01', '2026-01-01'), 33);
  eq(completedYearsAtCutoff('1993-01-02', '2026-01-01'), 32);
});
test('age 33y 11m passes a 33-year general limit (completed years)', () => {
  eq(rule(evaluateEligibility(person({ dob: '1992-01-02' }), base), 'Age Requirement')?.status, 'MATCH');
});
test('age 34 completed fails a 33-year UR limit', () => {
  eq(rule(evaluateEligibility(person({ dob: '1991-12-31' }), base), 'Age Requirement')?.status, 'FAIL');
});
test('under minimum age fails (17y 11m for min 18)', () => {
  eq(rule(evaluateEligibility(person({ dob: '2008-01-02' }), base), 'Age Requirement')?.status, 'FAIL');
});
test('SC/ST +5, OBC +3, EWS +0 on the boundary', () => {
  const at38 = { dob: '1988-01-01' }; // 38 completed
  eq(rule(evaluateEligibility(person({ ...at38, category: 'SC' }), base), 'Age Requirement')?.status, 'MATCH');
  eq(rule(evaluateEligibility(person({ ...at38, category: 'OBC' }), base), 'Age Requirement')?.status, 'FAIL');
  eq(rule(evaluateEligibility(person({ dob: '1989-01-01', category: 'OBC' }), base), 'Age Requirement')?.status, 'FAIL');
  eq(rule(evaluateEligibility(person({ dob: '1990-01-01', category: 'OBC' }), base), 'Age Requirement')?.status, 'MATCH');
  eq(rule(evaluateEligibility(person({ dob: '1992-01-01', category: 'EWS' }), base), 'Age Requirement')?.status, 'FAIL');
});
test('female relaxation uses max(category, female), never stacks', () => {
  const r = evaluateEligibility(person({ dob: '1987-01-01', gender: 'FEMALE', category: 'SC' }), base); // 39
  eq(rule(r, 'Age Requirement')?.status, 'FAIL', 'SC female must cap at 38, not 43.');
  eq(r.ageRelaxationBreakdown?.effectiveMaxAge, 38);
});
test('missing category/gender is NEEDS_VERIFICATION, not a premature rejection', () => {
  const r = evaluateEligibility({ dob: '1988-01-01', qualificationLevel: 'GRADUATION' }, base); // 38
  eq(rule(r, 'Age Requirement')?.status, 'UNKNOWN');
  eq(r.overallStatus, 'NEEDS_VERIFICATION');
});
test('age beyond every possible relaxation still fails when category unknown', () => {
  const r = evaluateEligibility({ dob: '1980-01-01', qualificationLevel: 'GRADUATION' }, base); // 46
  eq(rule(r, 'Age Requirement')?.status, 'FAIL');
});
test('invalid or future DOB is UNKNOWN, never a crash', () => {
  eq(rule(evaluateEligibility(person({ dob: '2000-02-31' }), base), 'Age Requirement')?.status, 'UNKNOWN');
  eq(rule(evaluateEligibility(person({ dob: '2030-01-01' }), base), 'Age Requirement')?.status, 'UNKNOWN');
  eq(rule(evaluateEligibility(person({ dob: 'not-a-date' }), base), 'Age Requirement')?.status, 'UNKNOWN');
});
test('age math ignores the machine timezone (UTC dates)', () => {
  const age = calculateAgeAtCutoff('2000-01-01', '2026-01-01');
  eq(age, 26);
  eq(completedYearsAtCutoff('2000-02-29', '2026-02-28'), 25, 'Leap-day DOB turns 26 on 1 Mar in this model.');
});

// --- Qualification ------------------------------------------------------------------
test('higher qualification satisfies a lower minimum; lower fails', () => {
  eq(rule(evaluateEligibility(person(), base), 'Educational Qualification')?.status, 'MATCH');
  eq(rule(evaluateEligibility(person({ qualificationLevel: '8TH' }), base), 'Educational Qualification')?.status, 'FAIL');
});
test('unrecognised minimum qualification never passes silently', () => {
  const r = evaluateEligibility(person(), { ...base, minQualificationLevel: 'PHD' });
  eq(rule(r, 'Educational Qualification')?.status, 'UNKNOWN');
  eq(r.overallStatus, 'NEEDS_VERIFICATION');
});
test('empty minimum qualification means no requirement', () => {
  eq(rule(evaluateEligibility(person({ qualificationLevel: '8TH' }), { ...base, minQualificationLevel: '' }), 'Educational Qualification')?.status, 'MATCH');
});
test('ITI requirement is an exact match', () => {
  const c = { ...base, minQualificationLevel: 'ITI' };
  eq(rule(evaluateEligibility(person({ qualificationLevel: 'ITI' }), c), 'Educational Qualification')?.status, 'MATCH');
  eq(rule(evaluateEligibility(person({ qualificationLevel: 'GRADUATION' }), c), 'Educational Qualification')?.status, 'FAIL');
});

// --- Stream -------------------------------------------------------------------------
test('stream: short entries cannot match every stream', () => {
  const c = { ...base, allowedStreams: ['SCIENCE', 'COMMERCE'] };
  eq(rule(evaluateEligibility(person({ stream: 'a' }), c), 'Degree Subject / Stream')?.status, 'FAIL');
  eq(rule(evaluateEligibility(person({ stream: 'm' }), c), 'Degree Subject / Stream')?.status, 'FAIL');
  eq(rule(evaluateEligibility(person({ stream: 'B.Sc Science' }), c), 'Degree Subject / Stream')?.status, 'MATCH');
});
test('stream: short allowed value matches whole word only', () => {
  const c = { ...base, allowedStreams: ['IT'] };
  eq(rule(evaluateEligibility(person({ stream: 'BSc IT' }), c), 'Degree Subject / Stream')?.status, 'MATCH');
  eq(rule(evaluateEligibility(person({ stream: 'Mathematics' }), c), 'Degree Subject / Stream')?.status, 'FAIL');
});
test('stream ANY skips the rule', () => {
  eq(rule(evaluateEligibility(person(), { ...base, allowedStreams: ['ANY'] }), 'Degree Subject / Stream'), undefined);
});

// --- Registration / domicile / gender ----------------------------------------------
test('legacy MP Rojgar flag still counts when a registrations list lacks it', () => {
  const c = { ...base, requiresMpEmploymentReg: true };
  eq(rule(evaluateEligibility(person({ registrations: ['OTHER'], hasMpRojgarPanjiyan: true }), c), 'Employment Registration')?.status, 'MATCH');
  eq(rule(evaluateEligibility(person({ registrations: [] }), c), 'Employment Registration')?.status, 'FAIL');
  eq(rule(evaluateEligibility(person(), c), 'Employment Registration')?.status, 'UNKNOWN');
});
test('domicile: other state fails, missing is UNKNOWN', () => {
  const c = { ...base, requiresMpDomicile: true, domicileStateCode: 'MP' };
  eq(rule(evaluateEligibility(person({ domicileStateCode: 'UP' }), c), 'State Domicile')?.status, 'FAIL');
  eq(rule(evaluateEligibility(person(), c), 'State Domicile')?.status, 'UNKNOWN');
  eq(rule(evaluateEligibility(person({ domicileStateCode: 'mp' }), c), 'State Domicile')?.status, 'MATCH');
});
test('gender-restricted posts', () => {
  const c = { ...base, genderAllowed: 'FEMALE' as const };
  eq(rule(evaluateEligibility(person({ gender: 'MALE' }), c), 'Gender')?.status, 'FAIL');
  eq(evaluateEligibility(person({ gender: 'FEMALE', dob: '1995-01-01' }), c).overallStatus, 'ELIGIBLE');
});

// --- Physical -----------------------------------------------------------------------
test('height/chest: unknown gender is UNKNOWN when standards differ by gender', () => {
  const c = { ...base, minHeightMaleCm: 168, minHeightFemaleCm: 155, minChestMaleCm: 81 };
  const r = evaluateEligibility({ dob: '1995-01-01', category: 'UR', qualificationLevel: '12TH', heightCm: 160 }, c);
  eq(rule(r, 'Physical Standards (Height)')?.status, 'UNKNOWN');
  eq(rule(r, 'Physical Standards (Chest)')?.status, 'UNKNOWN');
});
test('height/chest: known gender uses the right standard; chest not applied to women', () => {
  const c = { ...base, minHeightMaleCm: 168, minHeightFemaleCm: 155, minChestMaleCm: 81 };
  const f = evaluateEligibility(person({ gender: 'FEMALE', heightCm: 160 }), c);
  eq(rule(f, 'Physical Standards (Height)')?.status, 'MATCH');
  eq(rule(f, 'Physical Standards (Chest)'), undefined);
  const m = evaluateEligibility(person({ gender: 'MALE', heightCm: 160, chestCm: 85 }), c);
  eq(rule(m, 'Physical Standards (Height)')?.status, 'FAIL');
  eq(rule(m, 'Physical Standards (Chest)')?.status, 'MATCH');
});

// --- Skills / percentage / experience / composite ----------------------------------
test('percentage, skills and experience thresholds', () => {
  const c = { ...base, minPercentageRequired: 50, additionalSkills: ['CPCT'], experienceMonths: 12 };
  eq(rule(evaluateEligibility(person({ percentage: 49.9, additionalSkills: ['cpct'], experienceMonths: 12 }), c), 'Minimum Percentage')?.status, 'FAIL');
  eq(rule(evaluateEligibility(person({ percentage: 50, additionalSkills: ['cpct'], experienceMonths: 12 }), c), 'Additional Skills / Certifications')?.status, 'MATCH');
  eq(rule(evaluateEligibility(person({ percentage: 50, additionalSkills: ['TYPING'], experienceMonths: 11 }), c), 'Experience')?.status, 'FAIL');
});
test('composite: any FAIL beats UNKNOWN; UNKNOWN beats ELIGIBLE', () => {
  const c = { ...base, requiresCpct: true };
  eq(evaluateEligibility(person({ hasCpct: false }), c).overallStatus, 'NOT_ELIGIBLE');
  eq(evaluateEligibility(person(), c).overallStatus, 'NEEDS_VERIFICATION');
  eq(evaluateEligibility(person({ hasCpct: true }), c).overallStatus, 'ELIGIBLE');
  eq(evaluateEligibility(person({ hasCpct: undefined, qualificationLevel: '8TH' }), c).overallStatus, 'NOT_ELIGIBLE');
});

// --- Batch: progressive questions must map to real rule names ----------------------
test('batch asks for domicile, registration and category when they block a job', () => {
  const job = {
    id: 'j1', title: 'T', slug: 't', advtNumber: 'A', totalVacancies: 1, postTitle: 'P',
    organisationName: 'O', organisationShortName: 'O', isFeatured: 0, lifecycleStatus: 'OPEN',
    criteria: { ...base, requiresMpDomicile: true, domicileStateCode: 'MP', requiresMpEmploymentReg: true },
  };
  const result = getEligibleJobs({ dob: '1988-01-01', qualificationLevel: 'GRADUATION', gender: 'MALE' }, [job]); // 38, category unknown
  const keys = result.askNextQuestions.map(q => q.fieldKey);
  eq(result.pending.length, 1);
  for (const expected of ['isMpDomicile', 'hasMpRojgarPanjiyan', 'category']) {
    if (!keys.includes(expected as any)) throw new Error(`missing question ${expected}; got ${keys.join(', ')}`);
  }
});

if (failures > 0) {
  console.error(`\n${failures} eligibility rule test(s) failed.`);
  process.exit(1);
}
console.log('\nAll eligibility rule tests passed.');
