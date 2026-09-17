/**
 * Automated Verification Suite for Canonical Recruitment Lifecycle & Metrics
 */
import {
  resolveRecruitmentLifecycle,
  getLifecyclePresentation,
  calculateRecruitmentMetrics,
  isActiveDrive,
  isUpcomingDrive,
  formatSectorVacancySummary,
  type MinimalRecruitmentInput,
} from './lifecycle';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

let testCount = 0;
function test(name: string, fn: () => void) {
  testCount++;
  console.log(`\n--- Test #${testCount}: ${name} ---`);
  fn();
}

const FIXED_TODAY = '2026-09-18';

// -----------------------------------------------------------------------------
// Group 1: Lifecycle State Transitions
// -----------------------------------------------------------------------------
test('Lifecycle: Prior to application start -> NOT_STARTED', () => {
  const rec: MinimalRecruitmentInput = {
    applicationStart: '2026-09-22',
    applicationEnd: '2026-10-06',
    status: 'PUBLISHED',
  };
  const lifecycle = resolveRecruitmentLifecycle(rec, FIXED_TODAY);
  assert(lifecycle === 'NOT_STARTED', 'Future drive must be NOT_STARTED');
  assert(isUpcomingDrive(rec, FIXED_TODAY), 'Must be recognized as upcoming drive');
  assert(!isActiveDrive(rec, FIXED_TODAY), 'Upcoming drive must NOT be active');
});

test('Lifecycle: Active application window (>7 days remaining) -> APPLICATION_OPEN', () => {
  const rec: MinimalRecruitmentInput = {
    applicationStart: '2026-09-01',
    applicationEnd: '2026-09-30', // 12 days left
    status: 'PUBLISHED',
  };
  const lifecycle = resolveRecruitmentLifecycle(rec, FIXED_TODAY);
  assert(lifecycle === 'APPLICATION_OPEN', 'Open drive with >7 days remaining must be APPLICATION_OPEN');
  assert(isActiveDrive(rec, FIXED_TODAY), 'Must be active drive');
});

test('Lifecycle: Active application window (<= 7 days remaining) -> APPLICATION_CLOSING', () => {
  const rec: MinimalRecruitmentInput = {
    applicationStart: '2026-09-09',
    applicationEnd: '2026-09-23', // 5 days left from 18 Sep
    status: 'PUBLISHED',
  };
  const lifecycle = resolveRecruitmentLifecycle(rec, FIXED_TODAY);
  assert(lifecycle === 'APPLICATION_CLOSING', 'Drive with 5 days remaining must be APPLICATION_CLOSING');
  assert(isActiveDrive(rec, FIXED_TODAY), 'Closing soon drive MUST be active drive');
  const presentation = getLifecyclePresentation(lifecycle);
  assert(presentation.label === 'Closing Soon', 'Presentation label must be Closing Soon');
  assert(presentation.isLiveApplication === true, 'isLiveApplication must be true');
});

test('Lifecycle: Past application end with scheduled exam -> EXAM_SCHEDULED', () => {
  const rec: MinimalRecruitmentInput = {
    applicationStart: '2026-08-01',
    applicationEnd: '2026-08-20',
    examDate: '2026-09-25',
    status: 'PUBLISHED',
  };
  const lifecycle = resolveRecruitmentLifecycle(rec, FIXED_TODAY);
  assert(lifecycle === 'EXAM_SCHEDULED', 'Past application with examDate must resolve to EXAM_SCHEDULED');
  assert(!isActiveDrive(rec, FIXED_TODAY), 'Exam scheduled must NOT be active drive');
});

test('Lifecycle: Past application end without exam -> APPLICATION_CLOSED', () => {
  const rec: MinimalRecruitmentInput = {
    applicationStart: '2026-07-01',
    applicationEnd: '2026-07-31',
    status: 'PUBLISHED',
  };
  const lifecycle = resolveRecruitmentLifecycle(rec, FIXED_TODAY);
  assert(lifecycle === 'APPLICATION_CLOSED', 'Past application without exam must resolve to APPLICATION_CLOSED');
});

test('Lifecycle: Authoritative examStatus = COMPLETED -> EXAM_COMPLETED', () => {
  const rec: MinimalRecruitmentInput = {
    applicationStart: '2026-05-01',
    applicationEnd: '2026-05-31',
    examDate: '2026-06-15',
    examStatus: 'COMPLETED',
    status: 'PUBLISHED',
  };
  const lifecycle = resolveRecruitmentLifecycle(rec, FIXED_TODAY);
  assert(lifecycle === 'EXAM_COMPLETED', 'examStatus COMPLETED must resolve to EXAM_COMPLETED');
});

test('Lifecycle: Authoritative resultStatus = DECLARED -> RESULT_DECLARED', () => {
  const rec: MinimalRecruitmentInput = {
    applicationStart: '2026-02-28',
    applicationEnd: '2026-04-30',
    examDate: '2026-06-04',
    examStatus: 'COMPLETED',
    resultStatus: 'DECLARED',
    status: 'PUBLISHED',
  };
  const lifecycle = resolveRecruitmentLifecycle(rec, FIXED_TODAY);
  assert(lifecycle === 'RESULT_DECLARED', 'resultStatus DECLARED must resolve to RESULT_DECLARED');
  const pres = getLifecyclePresentation(lifecycle);
  assert(pres.label === 'Result Declared', 'Presentation label must be Result Declared');
});

// -----------------------------------------------------------------------------
// Group 2: Publication Status Isolation
// -----------------------------------------------------------------------------
test('Publication: Draft and Unverified records NEVER count as public active drives', () => {
  const unverified: MinimalRecruitmentInput = {
    applicationStart: '2026-09-01',
    applicationEnd: '2026-09-30',
    status: 'PENDING_VERIFICATION',
  };
  assert(!isActiveDrive(unverified, FIXED_TODAY), 'PENDING_VERIFICATION must not be public active drive');

  const draft: MinimalRecruitmentInput = {
    applicationStart: '2026-09-01',
    applicationEnd: '2026-09-30',
    status: 'DRAFT',
  };
  assert(!isActiveDrive(draft, FIXED_TODAY), 'DRAFT must not be public active drive');
});

// -----------------------------------------------------------------------------
// Group 3: Metrics Calculation & Sector Header Display
// -----------------------------------------------------------------------------
test('Metrics: Known Police sector scenario (1 Active SI 850 + 1 Upcoming Constable 7500)', () => {
  const policeDrives: MinimalRecruitmentInput[] = [
    {
      applicationStart: '2026-09-09',
      applicationEnd: '2026-09-23', // Active (Closing Soon)
      totalVacancies: 850,
      status: 'PUBLISHED',
    },
    {
      applicationStart: '2026-09-22',
      applicationEnd: '2026-10-06', // Upcoming
      totalVacancies: 7500,
      status: 'PUBLISHED',
    },
  ];

  const metrics = calculateRecruitmentMetrics(policeDrives, FIXED_TODAY);
  assert(metrics.activeDriveCount === 1, 'Active drive count must be exactly 1');
  assert(metrics.activeVacancyCount === 850, 'Active vacancies must be 850, not 8350');
  assert(metrics.upcomingDriveCount === 1, 'Upcoming drive count must be 1');
  assert(metrics.upcomingVacancyCount === 7500, 'Upcoming vacancies must be 7500');
  assert(metrics.totalAnnouncedVacancies === 8350, 'Total announced vacancies must be 8350');

  const header = formatSectorVacancySummary(metrics);
  assert(
    header === '1 Active Drive · 8,350 Total Vacancies (850 Open Now)',
    `Expected header "1 Active Drive · 8,350 Total Vacancies (850 Open Now)", got: "${header}"`
  );
});

test('Metrics: Known Forest sector scenario (0 Active + 1 Result Declared 2112)', () => {
  const forestDrives: MinimalRecruitmentInput[] = [
    {
      applicationStart: '2026-02-28',
      applicationEnd: '2026-04-30',
      examDate: '2026-06-04',
      resultStatus: 'DECLARED',
      totalVacancies: 2112,
      status: 'PUBLISHED',
    },
  ];

  const metrics = calculateRecruitmentMetrics(forestDrives, FIXED_TODAY);
  assert(metrics.activeDriveCount === 0, 'Active drive count must be 0');
  assert(metrics.activeVacancyCount === 0, 'Active vacancies must be 0 (never include result declared)');
  assert(metrics.resultDeclaredDriveCount === 1, 'Result declared drive count must be 1');
  assert(metrics.resultDeclaredVacancyCount === 2112, 'Result declared vacancies must be 2112');
  assert(metrics.totalAnnouncedVacancies === 2112, 'Total announced vacancies must be 2112');

  const header = formatSectorVacancySummary(metrics);
  assert(
    header === '0 Active Drives · 2,112 Total Vacancies (0 Open Now)',
    `Expected header "0 Active Drives · 2,112 Total Vacancies (0 Open Now)", got: "${header}"`
  );
});

test('Metrics: Zero vacancy drive (e.g. MP Teacher TET qualifying exam)', () => {
  const tetDrive: MinimalRecruitmentInput[] = [
    {
      applicationStart: '2026-08-21',
      applicationEnd: '2026-09-18', // Closes today
      examDate: '2026-10-12',
      totalVacancies: 0,
      status: 'PUBLISHED',
    },
  ];

  const metrics = calculateRecruitmentMetrics(tetDrive, FIXED_TODAY);
  assert(metrics.activeDriveCount === 1, 'TET drive closing today is counted as active drive');
  assert(metrics.activeVacancyCount === 0, '0 vacancies handled safely without NaN');
  assert(metrics.totalAnnouncedVacancies === 0, 'Total announced vacancies is 0');
});

console.log(`\n🎉 ALL ${testCount} LIFECYCLE & METRICS TESTS PASSED SUCCESSFULLY!\n`);
