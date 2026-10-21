/**
 * SEO keywords: a state job targets its own state first and the national terms after; central jobs target "central government jobs".
 * Run: `npx tsx src/services/seo.test.ts`
 */
import { clip, DESCRIPTION_MAX, recruitmentSeo, stateListingSeo, stateKeywordName, TITLE_MAX } from './seo';

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

const net = recruitmentSeo({ title: 'UGC NET December 2026', stateCode: 'IN', cycleYear: 2026, examKind: 'ELIGIBILITY_TEST', minQualificationLevel: 'POST_GRADUATION' });
assert(net.title === 'UGC NET December 2026 – Eligibility Test' && !net.keywords.some(k => k.includes('govt job')), `an eligibility test is not called a govt job (${net.title})`);
assert(net.description.startsWith('National eligibility test 2026'), 'a central eligibility test is described as national');
const jee = recruitmentSeo({ title: 'JEE Main', stateCode: 'IN', cycleYear: 2027, examKind: 'ENTRANCE_EXAM' });
assert(jee.title === 'JEE Main 2027 – Entrance Exam' && jee.keywords.includes('entrance exam 2027'), `an entrance exam gets exam wording (${jee.title})`);

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
