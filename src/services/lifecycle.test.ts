/**
 * Lifecycle: "today" is the date in India (IST), and a drive's application card follows its whole window.
 * Run: `npx tsx src/services/lifecycle.test.ts`
 */
import {
  todayIST,
  weekdayIST,
  formatDayMonthIST,
  formatDateIST,
  resolveRecruitmentLifecycle,
  resolveApplicationWindow,
  groupExamDates,
} from './lifecycle';

let failures = 0;
function assert(condition: boolean, msg: string) {
  if (condition) return console.log(`PASSED: ${msg}`);
  failures++;
  console.error(`FAILED: ${msg}`);
}

// 00:30 IST on 14 Oct is still 13 Oct in UTC.
const justAfterMidnightIST = new Date('2026-10-13T19:00:00Z');
assert(todayIST(justAfterMidnightIST) === '2026-10-14', 'today is the IST date, not the UTC date');
assert(
  resolveRecruitmentLifecycle({ applicationStart: '2026-10-14', applicationEnd: '2026-11-04' }, justAfterMidnightIST) === 'APPLICATION_OPEN',
  'a drive opening 14 Oct is open at 00:30 IST on 14 Oct',
);
assert(weekdayIST('2026-10-14') === 'Wed', '14 Oct 2026 is a Wednesday');
assert(formatDayMonthIST('2026-09-16') === '16 Sep', 'short date is day and month');

// A drive that has not opened must never be shown as open, whatever its closing date.
const notOpened = resolveApplicationWindow('2026-10-15', '2026-10-29', '2026-10-13');
assert(notOpened.category === 'UPCOMING', 'a drive before its start date is upcoming');
assert(notOpened.summary === 'Opens 15 Oct · Closes 29 Oct', 'an upcoming drive says "Opens"');

const closing = resolveApplicationWindow('2026-09-16', '2026-10-15', '2026-10-13');
assert(closing.category === 'CLOSING_SOON', 'a drive closing in 2 days is closing soon');
assert(closing.summary === 'Opened 16 Sep · Closes 15 Oct', 'a drive whose start date has passed says "Opened"');

const open = resolveApplicationWindow('2026-10-14', '2026-11-04', '2026-10-14');
assert(open.category === 'OPEN_NOW', 'a drive opens on its start date');

const closed = resolveApplicationWindow('2026-09-16', '2026-10-15', '2026-10-20');
assert(closed.category === 'PAST' && closed.summary === 'Opened 16 Sep · Closed 15 Oct', 'a drive after its end date is closed');

// Consecutive exam days collapse into one range; separate days stay separate.
const groups = groupExamDates(['2026-12-04', '2026-12-03', '2026-12-15', '2026-12-16', '2027-01-10']);
assert(groups.length === 3, 'two ranges and a single day');
assert(groups[0].start === '2026-12-03' && groups[0].end === '2026-12-04' && groups[0].label === '3–4 Dec', 'a two-day exam is one range');
assert(groups[2].label === '10 Jan', 'a single exam day has no range');

assert(formatDateIST('2026-12-20') === '20 Dec 2026', 'a full date reads day, month and year');
assert(formatDateIST('Tentative') === 'Tentative' && formatDateIST(undefined) === '', 'a non-date is left as it is');

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
