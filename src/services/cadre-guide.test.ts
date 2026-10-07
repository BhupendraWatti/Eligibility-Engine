/**
 * Cadre Guide builder. Plain asserts, no runtime.
 * Run: `npx tsx src/services/cadre-guide.test.ts`
 */
import type { RecruitmentWithDetails } from '../db/queries';
import { buildCadreGuide, formatGuideDate } from './cadre-guide';

let failures = 0;
function assert(condition: boolean, msg: string) {
  if (!condition) {
    failures++;
    console.error(`FAILED: ${msg}`);
    return;
  }
  console.log(`PASSED: ${msg}`);
}

type RecOverrides = Partial<Omit<RecruitmentWithDetails, 'criteria'>> & { criteria?: Partial<RecruitmentWithDetails['criteria']> };

function rec(over: RecOverrides = {}): RecruitmentWithDetails {
  const { criteria, ...rest } = over;
  return {
    id: 'rec_a', title: 'Constable 2026', slug: 'constable-2026', advtNumber: null, shortSummary: '', cycleYear: 2026,
    totalVacancies: 7500, status: 'PUBLISHED', lifecycleStatus: 'APPLICATION_OPEN', resolvedLifecycle: 'APPLICATION_OPEN',
    presentation: {} as any, isFeatured: 0, postTitle: 'Constable', postSlug: 'constable', organisationName: 'Selection Board',
    organisationShortName: 'SB', organisationUrl: '', stateName: 'Madhya Pradesh',
    applicationStart: '2026-09-22', applicationEnd: '2026-10-06',
    payScale: 'MASTER DEFAULT PAY', payScaleOverride: null,
    sourcesList: [{ sourceType: 'OFFICIAL_RULEBOOK', sourceUrl: 'https://example.gov.in/rb.pdf', sourceTitle: 'Rule Book', publicationDate: '2026-09-09', lastVerifiedAt: new Date('2026-10-01T00:00:00Z') }],
    officialLinksList: [{ linkType: 'APPLY_ONLINE', title: 'Apply', url: 'https://apply.example.gov.in', isActive: 1 }],
    ...rest,
    criteria: {
      minAge: 18, maxAgeGeneral: 33, ageCutoffDate: '2026-10-06', ageRelaxationScSt: 5, ageRelaxationObc: 3, ageRelaxationFemale: 5,
      ageRelaxationEws: 0, minQualificationLevel: '10TH', requiresMpDomicile: false, requiresMpEmploymentReg: false, requiresCpct: false,
      genderAllowed: 'ALL', ...criteria,
    },
  } as RecruitmentWithDetails;
}

const body = { name: 'Selection Board', shortName: 'SB', websiteUrl: 'https://sb.example.gov.in' };
const stepIds = (g: ReturnType<typeof buildCadreGuide>) => g.steps.map(s => s.id).join(',');

// --- No notice: nothing invented, only the hiring body and an honest note ---
{
  const g = buildCadreGuide({ recruitments: [], hiringBody: body, referenceDate: '2026-10-01' });
  assert(g.facts === null, 'no notice means no facts');
  assert(stepIds(g) === 'watch,come-back', 'no notice: watch the official site, then come back');
  assert(g.steps[0].links[0]?.url === body.websiteUrl, 'watch step links the hiring body website');
  const bare = buildCadreGuide({ recruitments: [] });
  assert(stepIds(bare) === 'come-back', 'no notice and no hiring body: only the come-back step');
}

// --- Drafts never reach the guide ---
{
  const g = buildCadreGuide({ recruitments: [rec({ status: 'DRAFT' })], referenceDate: '2026-10-01' });
  assert(g.facts === null && g.live.length === 0, 'a DRAFT recruitment is ignored');
}

// --- Live notice: apply step first, with the notice's own apply link ---
{
  const g = buildCadreGuide({ recruitments: [rec()], hiringBody: body, referenceDate: '2026-09-25' });
  assert(g.live.length === 1, 'open window is live');
  assert(g.steps[0].id === 'apply' && g.steps[0].title === `Apply by ${formatGuideDate('2026-10-06')}`, 'apply step comes first with the closing date');
  assert(g.steps[0].links.some(l => l.url === 'https://apply.example.gov.in'), 'apply step uses the notice apply link');
  assert(!g.steps.some(s => s.id === 'watch'), 'no "watch for the next notice" while one is open');
  assert(g.steps.some(s => s.id === 'eligibility'), 'eligibility step shown while applications are open');
}

// --- Unverified values never leak ---
{
  const g = buildCadreGuide({ recruitments: [rec()], referenceDate: '2026-09-25' });
  assert(g.facts!.pay === null, 'master default pay is not shown when the notice states none');
  assert(g.facts!.relaxationNotes === null, 'numeric relaxation defaults are not turned into text');
  const withPay = buildCadreGuide({ recruitments: [rec({ payScaleOverride: 'Rs. 19,500 - 62,000' })], referenceDate: '2026-09-25' });
  assert(withPay.facts!.pay === 'Rs. 19,500 - 62,000', 'the notice pay is shown');
}

// --- Requirements become a preparation step ---
{
  const g = buildCadreGuide({ recruitments: [rec({ criteria: { requiresCpct: true, requiresMpEmploymentReg: true, domicileStateCode: 'UP' } })], referenceDate: '2026-09-25' });
  const req = g.steps.find(s => s.id === 'requirements');
  assert(!!req && req.body.includes('CPCT certificate') && req.body.includes('employment office'), 'CPCT and registration listed');
  assert(!!req && req.body.includes('Uttar Pradesh'), 'domicile names the notice state, not MP');
  const none = buildCadreGuide({ recruitments: [rec()], referenceDate: '2026-09-25' });
  assert(!none.steps.some(s => s.id === 'requirements'), 'no requirements step when the notice has none');
}

// --- Stages only when the notice has them ---
{
  const without = buildCadreGuide({ recruitments: [rec()], referenceDate: '2026-09-25' });
  assert(!without.steps.some(s => s.id === 'stages') && without.facts!.selectionStages.length === 0, 'no stages invented');
  const withStages = buildCadreGuide({ recruitments: [rec({ selectionStages: [{ name: 'Written test', desc: '' }, { name: 'Physical test', desc: '' }] })], referenceDate: '2026-09-25' });
  assert(withStages.steps.find(s => s.id === 'stages')?.body === 'The 2026 notice had 2 stages: Written test, then Physical test.', 'stages step lists the notice stages');
}

// --- Closed notice: watch step quotes the last window; newest notice drives the facts ---
{
  const old = rec({ id: 'rec_old', slug: 'c-2024', cycleYear: 2024, applicationStart: '2024-01-01', applicationEnd: '2024-01-20' });
  const g = buildCadreGuide({ recruitments: [old, rec()], hiringBody: body, referenceDate: '2026-12-01' });
  assert(g.facts!.notice.id === 'rec_a', 'newest cycle drives the facts');
  assert(g.live.length === 0 && g.past.length === 2, 'both notices are past after the window');
  const watch = g.steps.find(s => s.id === 'watch');
  assert(!!watch && watch.body.includes(formatGuideDate('2026-09-22')) && watch.body.includes(formatGuideDate('2026-10-06')), 'watch step quotes the last application window');
  assert(!g.steps.some(s => s.id === 'eligibility'), 'no eligibility step when nothing is open');
}

assert(formatGuideDate('not a date') === 'not a date' && formatGuideDate(null) === '', 'unparseable dates are passed through, never invented');

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll cadre guide assertions passed.');
