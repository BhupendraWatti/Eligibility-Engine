function assert(condition: boolean, testName: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${testName}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${testName}`);
}
// @ts-expect-error Node built-ins are available to the tsx test runner, not the Worker bundle.
import { readFileSync } from 'node:fs';
import {
  getOrganisationBySlug,
  getCanonicalPostBySlug,
  getRecruitmentWithRelations,
  getSectorBySlug,
  resolveOrganisationTarget,
  resolveCanonicalPostTarget,
  resolveRecruitmentTarget,
  getAllOrganisations,
  getAllCanonicalPosts,
  FALLBACK_ORGANISATIONS,
  FALLBACK_POSTS,
  FALLBACK_RECRUITMENTS,
} from '../db/queries';
import { resolveSectorRoute } from '../services/sector-routing';

async function runTests() {
  console.log('\n--- Running Public Detail Routes & Lookup Tests ---');

  // Test 1: Real organisation slugs and aliases
  console.log('Test 1: Organisation lookup by slug, shortName, ID, and alias');
  const org1 = await getOrganisationBySlug('mpesb');
  assert(org1 !== undefined, 'mpesb must resolve');
  assert(org1?.shortName === 'MPESB', 'mpesb shortName must be MPESB');

  const org2 = await getOrganisationBySlug('MPESB');
  assert(org2 !== undefined, 'MPESB (uppercase) must resolve');

  const org3 = await getOrganisationBySlug('mp-esb');
  assert(org3 !== undefined, 'mp-esb (hyphenated) must resolve');

  const org4 = await getOrganisationBySlug('mppsc');
  assert(org4 !== undefined, 'mppsc must resolve');

  const org5 = await getOrganisationBySlug('mphc');
  assert(org5 !== undefined, 'mphc must resolve');

  const org6 = await getOrganisationBySlug('org_mpesb');
  assert(org6 !== undefined, 'org_mpesb (id) must resolve');

  const orgMissing = await getOrganisationBySlug('nonexistent-org-slug');
  assert(orgMissing === undefined, 'nonexistent organisation slug must return undefined');
  console.log('✅ PASSED: Organisation lookups succeed for real slugs & return undefined for non-existent');

  // Test 2: Sector lookup by slug and aliases
  console.log('Test 2: Sector lookup by canonical slug, aliases, and underscores');
  const sec1 = await getSectorBySlug('police-defence-prisons');
  assert(sec1 !== undefined && sec1.id === 'sec_police', 'canonical police-defence-prisons must resolve');

  const sec2 = await getSectorBySlug('police');
  assert(sec2 !== undefined && sec2.id === 'sec_police', 'short alias police must resolve');

  const sec3 = await getSectorBySlug('sec_police');
  assert(sec3 !== undefined && sec3.id === 'sec_police', 'id sec_police must resolve');

  const sec4 = await getSectorBySlug('education');
  assert(sec4 !== undefined && sec4.id === 'sec_teaching', 'alias education must resolve');

  const sec5 = await getSectorBySlug('health');
  assert(sec5 !== undefined && sec5.id === 'sec_health', 'alias health must resolve');

  const sec6 = await getSectorBySlug('civil-services');
  assert(sec6 !== undefined && sec6.id === 'sec_civil_services', 'alias civil-services must resolve');

  const secMissing = await getSectorBySlug('nonexistent-sector-xyz');
  assert(secMissing === undefined, 'nonexistent sector slug must return undefined');
  console.log('✅ PASSED: Sector lookups succeed for real slugs & return undefined for non-existent');

  // Test 3: Canonical post lookup by slug, id, prefix-stripped, and alias
  console.log('Test 3: Canonical post lookup by slug, id, without mp- prefix');
  const post1 = await getCanonicalPostBySlug('mp-police-constable');
  assert(post1 !== undefined, 'mp-police-constable must resolve');
  assert(post1?.id === 'post_mp_constable', 'must resolve post_mp_constable');

  const post2 = await getCanonicalPostBySlug('post_mp_constable');
  assert(post2 !== undefined, 'post_mp_constable (by id) must resolve');

  const post3 = await getCanonicalPostBySlug('police-constable');
  assert(post3 !== undefined, 'police-constable (without mp- prefix) must resolve');

  const post4 = await getCanonicalPostBySlug('mp-dsp');
  assert(post4 !== undefined, 'mp-dsp must resolve');

  const post5 = await getCanonicalPostBySlug('mp-civil-judge');
  assert(post5 !== undefined, 'mp-civil-judge must resolve');

  const postMissing = await getCanonicalPostBySlug('nonexistent-post-slug');
  assert(postMissing === undefined, 'nonexistent post slug must return undefined');
  console.log('✅ PASSED: Canonical post lookups succeed for real slugs & return undefined for non-existent');

  // Test 4: Recruitment lookup by slug, id, post-slug
  console.log('Test 4: Recruitment lookup by slug, id, and post slug');
  const rec1 = await getRecruitmentWithRelations('mp-police-constable-recruitment-2026');
  assert(rec1 !== undefined, 'mp-police-constable-recruitment-2026 must resolve');
  assert(rec1?.id === 'rec_mp_constable_2026', 'must match rec_mp_constable_2026');

  const rec2 = await getRecruitmentWithRelations('rec_mp_constable_2026');
  assert(rec2 !== undefined, 'rec_mp_constable_2026 (by id) must resolve');

  const rec3 = await getRecruitmentWithRelations('MP-POLICE-CONSTABLE-RECRUITMENT-2026');
  assert(rec3 !== undefined, 'case-insensitive recruitment slug must resolve');

  const rec4 = await getRecruitmentWithRelations('mp-police-constable');
  assert(rec4 !== undefined, 'recruitment by post slug must resolve');

  const recMissing = await getRecruitmentWithRelations('nonexistent-recruitment-slug');
  assert(recMissing === undefined, 'nonexistent recruitment slug must return undefined');
  console.log('✅ PASSED: Recruitment lookups succeed for real slugs & return undefined for non-existent');

  console.log('Test 5: HTTP route and admin-integrity regression guards');
  for (const route of [
    'src/pages/organisations/[slug].astro',
    'src/pages/posts/[slug].astro',
    'src/pages/recruitments/[slug].astro',
    'src/pages/sectors/[sector].astro',
  ]) {
    const source = readFileSync(route, 'utf8');
    assert(source.includes('Astro.response.status = 404'), `${route} must set a real 404 status`);
  }

  const middleware = readFileSync('src/middleware.ts', 'utf8');
  assert(middleware.includes('ADMIN_TEST_BYPASS_TOKEN'), 'admin bypass requires a server-configured token');
  assert(!/(x-test-bypass|searchParams\.get\('test_bypass'\)|includes\('testsprite'\)|includes\('playwright'\))/i.test(middleware), 'caller-controlled legacy auth bypasses stay removed');

  const documentsPage = readFileSync('src/pages/admin/documents.astro', 'utf8');
  assert(!documentsPage.includes('recruitments.length'), 'document POST does not read display fixtures before initialization');

  const notFoundPage = readFileSync('src/pages/404.astro', 'utf8');
  assert(notFoundPage.includes('Astro.url.pathname'), 'the global 404 identifies the requested path');

  const auditLogPage = readFileSync('src/pages/admin/audit-log.astro', 'utf8');
  assert(auditLogPage.includes('getAuditLogs().catch'), 'the authenticated audit shell survives audit data-loading errors');

  const recruitmentPage = readFileSync('src/pages/admin/recruitments/new.astro', 'utf8');
  assert(!recruitmentPage.includes("sourceUrl = 'https://esb.mp.gov.in/notifications/official-rulebook.pdf'"), 'recruitment intake never fabricates an official source');
  assert(!recruitmentPage.includes('if (!totalVacancies)'), 'zero-vacancy recruitments remain valid');

  console.log('\n🎉 ALL PUBLIC DETAIL ROUTE LOOKUP TESTS PASSED!\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
