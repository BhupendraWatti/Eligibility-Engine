/**
 * Notification Extraction Tests
 *
 * Verifies regex-based extraction from sample MP government notification text
 * in both Hindi and English formats.
 */
import { extractNotification, extractedToCriteria } from './extract-notification';

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

console.log('\n--- Running Notification Extraction Tests ---\n');

// -- Sample MP Police Constable notification text (bilingual) --
const constableNotification = `
MADHYA PRADESH EMPLOYEES SELECTION BOARD (MPESB)
Advt No. 04/2026

Recruitment for Police Constable (General Duty) - 7,500 Vacancies

Eligibility:
- Age: 18 to 33 years (age calculated as on 01/01/2026)
- SC/ST: 5 years relaxation
- OBC: 3 years relaxation
- Female: 5 years relaxation
- Educational Qualification: 10th pass (High School) from recognized board
- MP domicile mandatory (permanent resident of Madhya Pradesh)
- Employment exchange registration required (mprojgar.gov.in)
- Physical Standards:
  - Male height: 168 cm, chest: 81 cm
  - Female height: 158 cm
`;

test('Constable notification — organisation extraction', () => {
  const result = extractNotification(constableNotification);
  assert(result.organisation?.value === 'MPESB', 'Should extract MPESB');
  assert(result.organisation?.confidence === 'HIGH', 'Organisation confidence should be HIGH');
});

test('Constable notification — advt number', () => {
  const result = extractNotification(constableNotification);
  assert(result.advtNumber?.value === '04/2026', `Should extract advt number (got: ${result.advtNumber?.value})`);
});

test('Constable notification — vacancy count', () => {
  const result = extractNotification(constableNotification);
  assert(result.totalVacancies?.value === 7500, `Should extract 7500 vacancies (got: ${result.totalVacancies?.value})`);
});

test('Constable notification — age range', () => {
  const result = extractNotification(constableNotification);
  assert(result.minAge?.value === 18, 'Min age should be 18');
  assert(result.maxAgeGeneral?.value === 33, 'Max age should be 33');
});

test('Constable notification — age cutoff date', () => {
  const result = extractNotification(constableNotification);
  assert(result.ageCutoffDate?.value === '2026-01-01', `Cutoff should be 2026-01-01 (got: ${result.ageCutoffDate?.value})`);
});

test('Constable notification — relaxation extraction', () => {
  const result = extractNotification(constableNotification);
  assert(result.ageRelaxationScSt?.value === 5, 'SC/ST relaxation should be 5');
  assert(result.ageRelaxationObc?.value === 3, 'OBC relaxation should be 3');
  assert(result.ageRelaxationFemale?.value === 5, 'Female relaxation should be 5');
});

test('Constable notification — qualification', () => {
  const result = extractNotification(constableNotification);
  assert(result.minQualificationLevel?.value === '10TH', `Should extract 10TH (got: ${result.minQualificationLevel?.value})`);
});

test('Constable notification — domicile requirement', () => {
  const result = extractNotification(constableNotification);
  assert(result.requiresMpDomicile?.value === true, 'Should detect MP domicile requirement');
});

test('Constable notification — employment registration', () => {
  const result = extractNotification(constableNotification);
  assert(result.requiresMpEmploymentReg?.value === true, 'Should detect employment registration');
});

test('Constable notification — physical standards', () => {
  const result = extractNotification(constableNotification);
  assert(result.minHeightMaleCm?.value === 168, `Male height should be 168 (got: ${result.minHeightMaleCm?.value})`);
  assert(result.minHeightFemaleCm?.value === 158, `Female height should be 158 (got: ${result.minHeightFemaleCm?.value})`);
  assert(result.minChestMaleCm?.value === 81, `Chest should be 81 (got: ${result.minChestMaleCm?.value})`);
});

// -- Sample Patwari notification (Hindi) --
const patwariNotification = `
मध्य प्रदेश कर्मचारी चयन मंडल (MPESB)
विज्ञापन क्र 06/2026

पटवारी एवं संयुक्त समूह-2 उपसमूह-4 भर्ती परीक्षा 2026
कुल पद: 3,550

पात्रता:
- आयु: 18 से 40 वर्ष (आयु की गणना 01/01/2026 को)
- शैक्षणिक योग्यता: स्नातक (Graduation) किसी भी मान्यता प्राप्त विश्वविद्यालय से
- CPCT स्कोरकार्ड अनिवार्य
- हिंदी टाइपिंग प्रमाणपत्र आवश्यक
- मध्य प्रदेश का मूल निवासी होना अनिवार्य
- रोज़गार पंजीयन अनिवार्य
`;

test('Hindi Patwari notification — qualification', () => {
  const result = extractNotification(patwariNotification);
  assert(result.minQualificationLevel?.value === 'GRADUATION', `Should extract GRADUATION (got: ${result.minQualificationLevel?.value})`);
});

test('Hindi Patwari notification — CPCT detection', () => {
  const result = extractNotification(patwariNotification);
  assert(result.requiresCpct?.value === true, 'Should detect CPCT requirement');
});

test('Hindi Patwari notification — skills extraction', () => {
  const result = extractNotification(patwariNotification);
  assert(result.additionalSkills !== null, 'Should extract additional skills');
  assert(result.additionalSkills?.value.includes('Hindi Typing'), 'Should detect Hindi Typing skill');
});

test('Hindi Patwari notification — age range', () => {
  const result = extractNotification(patwariNotification);
  assert(result.minAge?.value === 18, 'Min age should be 18');
  assert(result.maxAgeGeneral?.value === 40, 'Max age should be 40');
});

// -- extractedToCriteria conversion --
test('extractedToCriteria — produces DB-ready output with defaults', () => {
  const extracted = extractNotification(constableNotification);
  const { criteria, warnings } = extractedToCriteria(extracted);

  assert(criteria.minAge === 18, 'Criteria minAge should be 18');
  assert(criteria.maxAgeGeneral === 33, 'Criteria maxAgeGeneral should be 33');
  assert(criteria.ageRelaxationEws === 0, 'EWS relaxation should default to 0');
  assert(criteria.requiresMpDomicile === true, 'Domicile should be true');
});

test('extractedToCriteria — missing fields generate warnings', () => {
  const extracted = extractNotification('Some random text without any notification data');
  const { warnings } = extractedToCriteria(extracted);

  assert(warnings.length > 0, 'Should have warnings for missing fields');
});

test('Extraction score — well-formed notification scores high', () => {
  const result = extractNotification(constableNotification);
  assert(result.extractionScore >= 50, `Score should be ≥ 50 for well-formed notification (got: ${result.extractionScore})`);
});

test('Extraction score — garbage text scores low', () => {
  const result = extractNotification('Hello world, this is not a notification');
  assert(result.extractionScore < 25, `Score should be < 25 for garbage (got: ${result.extractionScore})`);
});

console.log(`\n🎉 ALL ${testCount} NOTIFICATION EXTRACTION TESTS PASSED!\n`);
