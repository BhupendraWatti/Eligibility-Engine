/**
 * Mechanical value-vs-quote checks shown to the admin reviewer. Run: `tsx src/services/fact-checks.test.ts`.
 */
import { checkFacts, datesIn, fullyMachineChecked, numbersIn } from './fact-checks';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`PASSED: ${msg}`);
}

const q = (field: string, snippet: string, extra: Record<string, unknown> = {}) => ({ field, snippet, method: 'NATIVE', ...extra });

// Reading numbers and dates
assert(numbersIn('Total 7,500 posts').includes(7500), 'Indian-grouped numbers are read');
assert(numbersIn('No. of vacant positions 06').includes(6), 'a leading zero does not hide the number');
assert(numbersIn('उम्र सीमा 01.01.2026 को १९ से ४० वर्ष').includes(19) && numbersIn('१९ से ४०').includes(40), 'Devanagari digits are read');
assert(numbersIn('26.10.26').includes(10), 'a dotted date is not mistaken for one decimal');
assert(datesIn('Last date 10.10.2026').includes('2026-10-10'), 'dd.mm.yyyy');
assert(datesIn('दिनांक 11.10.26 से 26.10.26').includes('2026-10-26'), 'dd.mm.yy inside Hindi text');
assert(datesIn('Last date to apply - 15/10/2026 11:59 PM').includes('2026-10-15'), 'dd/mm/yyyy');
assert(datesIn('Dated.- 10-09-2026').includes('2026-09-10'), 'dd-mm-yyyy');
assert(datesIn('closes on 14 October 2026').includes('2026-10-14') && datesIn('October 14, 2026').includes('2026-10-14'), 'month names both ways');
assert(!datesIn('31.02.2026 and 13.13.2026').includes('2026-13-13'), 'an impossible month is not a date');

// Field checks
let s = checkFacts({ totalVacancies: 6, applicationEnd: '2026-10-10' }, [q('totalVacancies', 'No. of vacant positions 06'), q('applicationEnd', 'The last date for receipt of completed Application Forms is 10.10.2026')]);
assert(s.matched === 2 && s.total === 2 && s.notInQuote.length === 0, 'values found in their own quotes pass');

s = checkFacts({ applicationEnd: '2026-10-15' }, [q('applicationEnd', 'The last date for receipt of completed Application Forms is 10.10.2026')]);
assert(s.notInQuote[0] === 'applicationEnd' && s.fields[0].detail.includes('2026-10-10'), 'a wrong date is caught and the reviewer is told what the quote says');

s = checkFacts({ totalVacancies: 772, vacanciesBreakdown: [{ category: 'Rural', count: 635 }, { category: 'Urban', count: 137 }] },
  [q('vacanciesBreakdown', 'कुल– 318 317 635'), q('vacanciesBreakdown', 'कुल– 68 69 ... 137'), q('totalVacancies', 'ग्रामीण 635, शहरी 137')]);
assert(s.matched === 2, 'a total printed nowhere passes when it is exactly the sum of checked rows');
s = checkFacts({ totalVacancies: 773, vacanciesBreakdown: [{ category: 'Rural', count: 635 }, { category: 'Urban', count: 137 }] },
  [q('vacanciesBreakdown', '635 and 137'), q('totalVacancies', '635 and 137')]);
assert(s.notInQuote.includes('totalVacancies'), 'a total that is not the sum fails');

s = checkFacts({ advtNumber: '01/2026' }, [q('advtNumber', 'विज्ञापन संख्या–01/2026')]);
assert(s.matched === 1, 'an advertisement number is matched inside Hindi text');

s = checkFacts({ minQualificationLevel: 'GRADUATION', qualificationDetailsMarkdown: 'Degree and 7 years with children', seoTitle: 'x', postId: 'p', organisationId: 'o' },
  [q('minQualificationLevel', 'a degree'), q('qualificationDetailsMarkdown', 'degree with at least seven years')]);
assert(s.total === 2 && s.matched === 0 && s.needsReading.length === 2, 'summaries and categories are never counted as checked; SEO and ids are not facts');

s = checkFacts({ totalVacancies: 6 }, []);
assert(s.notInQuote.includes('totalVacancies') && s.fields[0].status === 'NO_QUOTE', 'a fact without a quote is flagged');

// Risk flags and the auto-publish gate
s = checkFacts({ applicationEnd: '2026-10-26' }, [q('applicationEnd', '26.10.26', { method: 'VISION', handwritten: true })], ['applicationEnd']);
assert(s.fromImage[0] === 'applicationEnd' && s.handwritten[0] === 'applicationEnd', 'scanned and handwritten values are flagged');
assert(!fullyMachineChecked(s), 'a scanned or handwritten value can never auto-publish');
s = checkFacts({ applicationEnd: '2026-10-26' }, [q('applicationEnd', 'Last date 26.10.2026')]);
assert(!fullyMachineChecked(s), 'a value matching only its quote, with the quote unchecked against the page, cannot auto-publish');
s = checkFacts({ applicationEnd: '2026-10-26' }, [q('applicationEnd', 'Last date 26.10.2026')], ['applicationEnd']);
assert(fullyMachineChecked(s), 'auto-publish needs the value in its quote and the quote in the page text');

console.log('\nAll fact-check tests passed.');
