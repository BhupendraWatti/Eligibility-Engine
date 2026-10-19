/**
 * SEO keywords: a state job targets its own state first and the national terms after; central jobs target "central government jobs".
 * Run: `npx tsx src/services/seo.test.ts`
 */
import { clip, DESCRIPTION_MAX, noticeBaseSalary, recruitmentSeo, stateListingSeo, stateKeywordName, TITLE_MAX } from './seo';

let failures = 0;
function assert(condition: boolean, msg: string) {
  if (condition) return console.log(`PASSED: ${msg}`);
  failures++;
  console.error(`FAILED: ${msg}`);
}

const assam = recruitmentSeo({ title: 'SEBA Assistant Teacher Recruitment 2026', postTitle: 'Assistant Teacher', stateCode: 'AS', totalVacancies: 1200, minQualificationLevel: '12TH', cycleYear: 2026, applicationEnd: '2026-11-30' });
assert(assam.keywords[0] === 'assam govt jobs' && assam.keywords.includes('assam govt job vacancy'), 'a state job leads with its own state');
assert(assam.keywords.includes('government jobs 2026') && assam.keywords.includes('latest govt jobs'), 'a state job also carries the national terms');
assert(assam.keywords.includes('government jobs after 12th'), 'the qualification adds its keyword');
assert(assam.title.length <= TITLE_MAX && assam.title.includes('Assam'), `title fits and names the state (${assam.title})`);
assert(!/2026.*2026/.test(assam.title), 'the year is not repeated when the notice title has it');
assert(assam.description.length <= DESCRIPTION_MAX && assam.description.startsWith('Assam govt job vacancy 2026'), 'description fits and targets the state');
assert(assam.description.includes('30 Nov 2026'), 'description gives the last date');

const central = recruitmentSeo({ title: 'SSC CGL', stateCode: 'IN', cycleYear: 2026 });
assert(central.keywords[0] === 'central government jobs' && !central.keywords.some(k => k.includes('assam')), 'a central job targets central government jobs');
assert(central.title === 'SSC CGL – Central Govt Job 2026', `central title (${central.title})`);

assert(stateKeywordName('IN') === null && stateKeywordName('XX') === null && stateKeywordName('tg') === 'Telangana', 'state names only for real states');
assert(stateListingSeo('AS', 2026).title.startsWith('Assam Govt Jobs 2026'), 'state listing title');
assert(clip('one two three four', 10) === 'one two…', 'clip cuts at a word');

// baseSalary: only from the notice's pay text, monthly rupees, nothing guessed.
const range = (t: string) => { const v = noticeBaseSalary(t)?.value as any; return v ? `${v.minValue ?? v.value}-${v.maxValue ?? v.value}` : null; };
assert(range('Rs 35,400 - 1,12,400 (Level 6)') === '35400-112400', 'a pay range reads Indian digit grouping');
assert(range('Rs 29,200 - 92,300 (Level 5) / Rs 35,400 - 1,12,400 (Level 6)') === '29200-112400', 'several ranges span lowest to highest');
assert(range('Rs 21,700 - 1,12,400 (Level 3 to Level 6, by post)') === '21700-112400', 'pay levels in brackets are not read as rupees');
assert(range('Rs. 19,500 - 62,000/- (Pay Matrix Level 4)') === '19500-62000' && range('₹56,100 to ₹1,77,500') === '56100-177500', 'Rs./-, ₹ and "to" are read');
assert((noticeBaseSalary('Rs 25,000 fixed')?.value as any)?.value === 25000, 'a single amount is a value, not a range');
assert(noticeBaseSalary('Rs 35,400 - 1,12,400')?.value.unitText === 'MONTH' && noticeBaseSalary('Rs 1')?.currency === 'INR', 'monthly INR');
assert(noticeBaseSalary(null) === null && noticeBaseSalary('As per rules') === null && noticeBaseSalary('Level 6') === null, 'no rupee amount, no salary');
assert(noticeBaseSalary('Rs 6 lakh per annum') === null && noticeBaseSalary('Rs 500 per day') === null, 'another period or unit is left out');
assert(range('Group A Officers 2026: Rs 56,100 - 1,77,500') === '56100-177500', '"Group A" is not per annum, "Officers 2026" is not rupees');
assert(noticeBaseSalary('Rs 7,20,000 p.a.') === null, 'p.a. is left out');

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
