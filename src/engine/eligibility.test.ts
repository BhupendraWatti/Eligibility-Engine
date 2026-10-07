/**
 * Engine checks built from real notices (MPESB 2026 rulebooks). Plain asserts, no database.
 * Run: `npx tsx src/engine/eligibility.test.ts`
 */
import { evaluateEligibility, parseQualificationByCategory, type RecruitmentCriteria, type UserEligibilityProfile } from './eligibility';
import { getEligibleJobs, type RecruitmentRecord } from './batch-eligibility';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`PASSED: ${msg}`);
}

const base: RecruitmentCriteria = {
  minAge: 18, maxAgeGeneral: 33, ageCutoffDate: '2026-10-08',
  ageRelaxationScSt: 5, ageRelaxationObc: 5, ageRelaxationFemale: 5, ageRelaxationEws: 0,
  minQualificationLevel: '12TH', requiresMpDomicile: false, requiresMpEmploymentReg: false, requiresCpct: false, genderAllowed: 'ALL',
};
const status = (user: UserEligibilityProfile, criteria: RecruitmentCriteria, rule: string) =>
  evaluateEligibility(user, criteria).items.find(i => i.ruleName === rule)?.status;

// ── MPESB Subedar (Steno) 2026: relaxation (to 38) only for MP domicile holders ──────────────────
const subedar: RecruitmentCriteria = { ...base, reservationStateCode: 'MP' };
const age36 = '1990-01-01'; // 36 on 2026-10-08
assert(status({ dob: age36, category: 'SC', gender: 'MALE', domicileStateCode: 'MP' }, subedar, 'Age Requirement') === 'MATCH', 'MP-domicile SC man aged 36 gets the relaxation');
assert(status({ dob: age36, category: 'SC', gender: 'MALE', domicileStateCode: 'BR' }, subedar, 'Age Requirement') === 'FAIL', 'Bihar SC man aged 36 is held to the general limit');
assert(status({ dob: age36, category: 'UR', gender: 'FEMALE', domicileStateCode: 'UP' }, subedar, 'Age Requirement') === 'FAIL', 'UP woman aged 36 gets no women relaxation');
assert(status({ dob: age36, category: 'SC', gender: 'MALE' }, subedar, 'Age Requirement') === 'UNKNOWN', 'unknown domicile is pending, not passed or failed');
assert(status({ dob: '1996-01-01', category: 'SC', gender: 'MALE', domicileStateCode: 'BR' }, subedar, 'Age Requirement') === 'MATCH', 'outsider within the general limit still matches');
assert(status({ dob: age36, category: 'SC', gender: 'MALE', domicileStateCode: 'BR' }, base, 'Age Requirement') === 'MATCH', 'without reservationStateCode (central) relaxation applies to all');
assert(status({ dob: age36, category: 'SC', gender: 'MALE', isMpDomicile: true }, subedar, 'Age Requirement') === 'MATCH', 'legacy isMpDomicile flag still counts as MP domicile');

// ── MPESB Constable (GD) 2026: 10th for UR/SC/OBC, 8th for ST (MP domicile) ───────────────────────
const constable: RecruitmentCriteria = { ...base, minQualificationLevel: '10TH', reservationStateCode: 'MP', qualificationByCategory: { ST: '8TH' } };
const q = 'Educational Qualification';
assert(status({ qualificationLevel: '8TH', category: 'ST', domicileStateCode: 'MP' }, constable, q) === 'MATCH', 'MP ST candidate with Class 8 qualifies');
assert(status({ qualificationLevel: '8TH', category: 'OBC', domicileStateCode: 'MP' }, constable, q) === 'FAIL', 'MP OBC candidate with Class 8 does not');
assert(status({ qualificationLevel: '8TH', category: 'ST', domicileStateCode: 'RJ' }, constable, q) === 'FAIL', 'Rajasthan ST candidate is held to the general 10th');
assert(status({ qualificationLevel: '8TH' }, constable, q) === 'UNKNOWN', 'Class 8 with unknown category is pending');
assert(status({ qualificationLevel: '10TH', category: 'UR', domicileStateCode: 'GJ' }, constable, q) === 'MATCH', '10th pass outsider matches');

// ── Batch: pending results ask for the missing fact, not for what was already given ─────────────
const job = (id: string, criteria: RecruitmentCriteria): RecruitmentRecord => ({ id, title: id, slug: id, advtNumber: '', totalVacancies: 1, postTitle: '', organisationName: '', organisationShortName: '', isFeatured: 0, lifecycleStatus: 'APPLICATION_OPEN', criteria });
const batch = getEligibleJobs({ dob: age36, category: 'SC', gender: 'MALE', qualificationLevel: '12TH' }, [job('subedar', subedar)]);
assert(batch.askNextQuestions[0]?.fieldKey === 'isMpDomicile', 'batch asks for domicile when only domicile decides the age rule');
const batch2 = getEligibleJobs({ dob: '2000-01-01', gender: 'MALE', qualificationLevel: '8TH', domicileStateCode: 'MP' }, [job('constable', constable)]);
assert(batch2.askNextQuestions.some(x => x.fieldKey === 'category'), 'batch asks for category when category-wise qualification decides');

// ── Admin form parser ─────────────────────────────────────────────────────────────────────────────
const parsed = parseQualificationByCategory(' st:8th, XX:10TH, SC:PHD ');
assert(JSON.stringify(parsed) === '{"ST":"8TH"}', 'form parser keeps valid category:level pairs only');
assert(parseQualificationByCategory('') === null, 'empty form input clears the override');

console.log('\nAll engine checks passed.');
