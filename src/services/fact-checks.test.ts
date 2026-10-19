/**
 * Mechanical value-vs-quote checks shown to the admin reviewer. Run: `tsx src/services/fact-checks.test.ts`.
 */
import { checkFacts, classifyDomicileClause, datesIn, numbersIn, stateNameMatcher } from './fact-checks';

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
assert(datesIn('न्यूनतम आयु दिनांक 01 जुलाई, 2026 को 21 वर्ष').includes('2026-07-01'), 'Hindi month name (UPESSC 05/2026)');
assert(['2026-12-03', '2026-12-04'].every(d => datesIn('परीक्षा तिथि 03 व 04 दिसम्बर, 2026').includes(d)), 'Hindi day list, सितम्बर/दिसम्बर spelling');
assert(datesIn('15 and 16 December 2026').includes('2026-12-15') && datesIn('15 and 16 December 2026').includes('2026-12-16'), 'English day list');
assert(datesIn('13 अक्तूबर 2026').includes('2026-10-13') && datesIn('13 अक्टूबर 2026').includes('2026-10-13'), 'both spellings of October');
assert(!datesIn('कुल 12 पद 2026').length, 'a Hindi word that is not a month makes no date');

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

// Domicile clause: the state may be written as its name, code, dotted code or in Hindi
const dc = (t: string, state = 'MP') => classifyDomicileClause(t, state);
const named = (t: string, state = 'MP') => { const r = dc(t, state); return r.classification === 'STATE_ONLY' && r.namesState; };
assert(named('Only domiciles of Madhya Pradesh are eligible to apply.'), 'full state name');
assert(named('Only bona fide residents of MP are eligible.') && named('Only residents of M.P. may apply.') && named('Only residents of M. P. may apply.'), 'MP, M.P. and M. P.');
assert(named('The candidate must be a native of M.P.'), '"native of" with obligation wording');
assert(named('केवल मध्य प्रदेश के मूल निवासी आवेदन कर सकते हैं।') && named('अभ्यर्थी मध्यप्रदेश का मूल निवासी होना चाहिए।'), 'Hindi name and मूल निवासी');
assert(named('Only domiciles of Orissa may apply.', 'OD') && named('Only residents of the NCT of Delhi may apply.', 'DL'), 'old spellings and other states');
assert(dc('Only bona fide residents of the State are eligible to apply.').classification === 'STATE_ONLY' && !dc('Only bona fide residents of the State are eligible to apply.').namesState, '"the State" still locks but does not name the state');
assert(!named('Only residents of Rajasthan are eligible.'), 'another state is not this state');
assert(!named('Candidates must be residents of the state up to 1 Jan.'), '"up" in lower case is not UP, and obligation without the name is not a lock');
assert(!stateNameMatcher('AS')!('अभ्यर्थी असमर्थ है') && stateNameMatcher('AS')!('असम के निवासी'), 'whole Hindi words only');
assert(dc('Open to all Indian citizens.').classification === 'OPEN', '"all Indian citizens" is open');
assert(dc('Candidate must be a citizen of India.').classification === 'UNCLEAR', 'the citizenship line alone is not open');
assert(stateNameMatcher('IN') === null, 'Central has no state name');
// Real Hindi clauses refused as UNCLEAR before (MPESB Driver 2026, MPPSC 13/2026, UPSSSC 23-Exam/2026)
assert(dc('ऐसे अभ्यर्थी जो मध्यप्रदेश के स्थाई अधिवासी (domicile) नहीं है, सिर्फ अनारक्षित ओपन के अन्तर्गत ही अपना आवेदन प्रस्तुत कर सकते है। किसी भी प्रकार के आरक्षण की पात्रता हेतु म.प्र. राज्य का स्थाई अधिवासी (domicile) होना अनिवार्य है।').classification === 'OPEN_STATE_QUOTA', 'non-domicile may apply only for unreserved: quota');
assert(dc('आरक्षित पद केवल मध्य प्रदेश के मूल निवासी हेतु आरक्षित है। अन्य प्रदेशों के मूल निवासी ऐसे अभ्यर्थी अनारक्षित पदों हेतु विचारित किया जाएगा।').classification === 'OPEN_STATE_QUOTA', '"reserved posts only for natives" is not a lock');
assert(dc('अभ्यर्थी, जो उ0प्र0 राज्य के मूल निवासी नहीं हैं, उन्हें आरक्षण का लाभ अनुमन्य नहीं है।', 'UP').classification === 'OPEN_STATE_QUOTA', '"not a native ... no reservation" is a quota');
assert(dc('Candidates who are not domiciles of MP are not eligible.').classification === 'STATE_ONLY', 'English "not domiciles ... not eligible" is still a lock');
assert(dc('Candidates of other states may apply only against unreserved posts.').classification === 'OPEN_STATE_QUOTA', 'English unreserved-only is a quota');

// Age limits as notices write them (MPPSC 13/2026, MPESB Driver 2026)
{
  const mppsc = '21 वर्ष की आयु पूर्ण कर ली हो किन्तु 40 वर्ष की आयु पूर्ण न की हो।';
  assert(!checkFacts({ maxAgeGeneral: 39 }, [q('maxAgeGeneral', mppsc)]).notInQuote.includes('maxAgeGeneral'), '"must not have completed 40" supports 39 completed years');
  assert(checkFacts({ maxAgeGeneral: 38 }, [q('maxAgeGeneral', mppsc)]).notInQuote.includes('maxAgeGeneral'), 'but not any lower number');
  assert(checkFacts({ maxAgeGeneral: 39 }, [q('maxAgeGeneral', 'अधिकतम आयु 40 वर्ष से अधिक नहीं होनी चाहिए।')]).notInQuote.includes('maxAgeGeneral'), '"not more than 40" does not support 39');
  assert(!checkFacts({ maxAgeGeneral: 39 }, [q('maxAgeGeneral', 'must not have completed 40 years of age')]).notInQuote.includes('maxAgeGeneral'), 'English "not have completed" too');
  const driver = 'आरक्षित श्रेणी (अनु.जाति/अ.ज.जा./अ.पि.व.) का अभ्यर्थी 38 वर्ष';
  assert(!checkFacts({ maxAgeGeneral: 33, ageRelaxationScSt: 5 }, [q('maxAgeGeneral', 'मध्यप्रदेश के अनारक्षित 33 वर्ष'), q('ageRelaxationScSt', driver)]).notInQuote.includes('ageRelaxationScSt'), 'a relaxation printed as the relaxed limit (38 vs 33) supports 5');
  assert(checkFacts({ maxAgeGeneral: 33, ageRelaxationScSt: 3 }, [q('maxAgeGeneral', 'मध्यप्रदेश के अनारक्षित 33 वर्ष'), q('ageRelaxationScSt', driver)]).notInQuote.includes('ageRelaxationScSt'), 'a wrong relaxation is still caught');
}

{
  // Places of posting: PIN codes are compared (also "462 001" and Devanagari digits); town names are left to the reader.
  const place = (p: object[], quote: string) => checkFacts({ postingPlaces: p }, [q('postingPlaces', quote)]);
  assert(place([{ locality: 'Bhopal', stateCode: 'MP', postalCode: '462001' }], 'कलेक्टर कार्यालय, भोपाल - 462 001').matched === 1, 'a PIN printed with a space matches, the Hindi town name is not compared');
  assert(place([{ locality: 'Bhopal', stateCode: 'MP', postalCode: '462001' }], 'भोपाल - ४६२००१').matched === 1, 'a PIN in Devanagari digits matches');
  assert(place([{ locality: 'Bhopal', stateCode: 'MP', postalCode: '462011' }], 'Collectorate, Bhopal 462001').notInQuote.includes('postingPlaces'), 'a wrong PIN is caught');
  assert(!place([{ locality: 'Bhopal', stateCode: 'MP' }], 'Posting at Bhopal').notInQuote.includes('postingPlaces'), 'a place without a PIN is left to the reader');
}

console.log('\nAll fact-check tests passed.');
