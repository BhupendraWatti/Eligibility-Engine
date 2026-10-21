/** Run: npx tsx src/services/exam-kind.test.ts */
import { ageRangeLabel, isQualifyingExam, vacancyLabel, vacancyPhrase } from './exam-kind';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`PASSED: ${msg}`);
}

assert(isQualifyingExam('ELIGIBILITY_TEST') && isQualifyingExam('ENTRANCE_EXAM') && !isQualifyingExam('RECRUITMENT') && !isQualifyingExam(undefined), 'only tests and entrance exams are qualifying exams');
assert(vacancyLabel({ examKind: 'ELIGIBILITY_TEST', totalVacancies: 0 }) === 'Qualifying exam, no vacancies', 'an eligibility test never shows 0 vacancies');
assert(vacancyLabel({ examKind: 'ENTRANCE_EXAM', totalVacancies: 0 }).startsWith('Rank based'), 'an entrance exam is rank based');
assert(vacancyLabel({ totalVacancies: 1234 }) === '1,234' && vacancyLabel({ totalVacancies: 0 }, 'N/A') === 'N/A', 'a job shows its count or the fallback');
assert(vacancyPhrase({ totalVacancies: 1 }) === '1 post' && vacancyPhrase({ totalVacancies: 12, examKind: 'RECRUITMENT' }, 'vacancy') === '12 vacancies', 'job phrases are pluralised');
assert(vacancyPhrase({ totalVacancies: 0 }) === null && vacancyPhrase({ examKind: 'ELIGIBILITY_TEST', totalVacancies: 0 }) === 'Eligibility test', 'no count is null for a job and the exam type for a test');
assert(ageRangeLabel({ minAge: 18, maxAgeGeneral: 33 }) === '18-33 yrs' && ageRangeLabel({ minAge: 17, maxAgeGeneral: 33, noUpperAgeLimit: true }) === '17+ yrs (no upper limit)', 'age range label honours no upper limit');

console.log('\nAll exam-kind checks passed.');
