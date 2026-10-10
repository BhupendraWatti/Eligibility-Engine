/**
 * Mechanical value-vs-quote checks shown to the admin reviewer. Run: `tsx src/services/fact-checks.test.ts`.
 */
import { checkFacts, datesIn, numbersIn } from './fact-checks';

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
// Numbers written as words
const words = (t: string) => numbersIn(t);
assert(words('not less than thirty-five years of age and not more than sixty years').includes(35) && words('not more than sixty years').includes(60), 'English number words, hyphenated or not');
assert(words('stamp paper of at least Rs. 100.00 (Rupees One Hundred)').includes(100), '"One Hundred"');
assert(words('one hundred and twenty five posts').includes(125) && words('two thousand five hundred').includes(2500), 'compound English numbers');
assert(words('आयु पैंतीस वर्ष से कम नहीं तथा साठ वर्ष से अधिक नहीं।').includes(35) && words('अधिकतम साठ वर्ष।').includes(60), 'Hindi number words, also before a danda (।)');
assert(words('पाँच सौ पद').includes(500) && words('एक सौ पच्चीस').includes(125) && words('दो हज़ार').includes(2000), 'Hindi with sau and hazaar, chandrabindu and nukta spellings');
assert(words('अड़तीस वर्ष').includes(38) && words('पन्द्रह दिन').includes(15), 'common spelling variants');
assert(!words('सातवीं कक्षा').includes(7) && !words('someone seventh').includes(7), 'only whole words count, not parts of longer words');
assert(!words('five six').includes(11), '"five six" is not eleven');
{
  const age = checkFacts({ minAge: 35, maxAgeGeneral: 60 }, [q('minAge', 'not be less than thirty-five years of age'), q('maxAgeGeneral', 'not more than sixty years of age')]);
  assert(age.matched === 2, 'ages written in words pass the value check');
  const wrong = checkFacts({ maxAgeGeneral: 65 }, [q('maxAgeGeneral', 'not more than sixty years of age')]);
  assert(wrong.notInQuote.includes('maxAgeGeneral'), 'a wrong age is still caught when the quote uses words');
}

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

// Risk flags
s = checkFacts({ applicationEnd: '2026-10-26' }, [q('applicationEnd', '26.10.26', { method: 'VISION', handwritten: true })]);
assert(s.fromImage[0] === 'applicationEnd' && s.handwritten[0] === 'applicationEnd', 'scanned and handwritten values are flagged');

console.log('\nAll fact-check tests passed.');
