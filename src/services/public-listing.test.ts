/**
 * Public Listing: loading, merge order, Relevance Tiers and /jobs filter regressions.
 * Plain asserts with a fake loader, no database.
 * Run: `npx tsx src/services/public-listing.test.ts`
 */
import type { RecruitmentWithDetails } from '../db/queries';
import {
  inRelevanceOrder,
  listPublicRecruitments,
  loadPublicRecruitments,
  queryListing,
  rankByRelevance,
  type PublicListingDeps,
} from './public-listing';

let failures = 0;
function assert(condition: boolean, msg: string) {
  if (!condition) {
    failures++;
    console.error(`FAILED: ${msg}`);
    return;
  }
  console.log(`PASSED: ${msg}`);
}
const ids = (rows: RecruitmentWithDetails[]) => rows.map(r => r.id).join(',');

function rec(id: string, stateCode: string, extra: Partial<RecruitmentWithDetails> & { domicile?: string | null } = {}): RecruitmentWithDetails {
  const { domicile, criteria, ...rest } = extra;
  return {
    id,
    title: `Recruitment ${id}`,
    postTitle: 'Constable',
    organisationShortName: `ORG-${stateCode}`,
    organisationName: `Board of ${stateCode}`,
    advtNumber: null,
    shortSummary: '',
    stateCode,
    cycleYear: 2026,
    totalVacancies: 10,
    resolvedLifecycle: 'APPLICATION_OPEN',
    lifecycleStatus: 'APPLICATION_OPEN',
    status: 'PUBLISHED',
    criteria: { minQualificationLevel: '12TH', requiresMpDomicile: false, domicileStateCode: domicile ?? null, ...criteria },
    ...rest,
  } as unknown as RecruitmentWithDetails;
}

function fakeDeps(byStateId: Record<string, RecruitmentWithDetails[]>, national: RecruitmentWithDetails[], failing: string[] = []) {
  const calls: Array<string | undefined> = [];
  const deps: PublicListingDeps = {
    load: async ({ stateId }) => {
      calls.push(stateId);
      if (stateId && failing.includes(stateId)) throw new Error(`D1 error for ${stateId}`);
      return stateId ? byStateId[stateId] ?? [] : national;
    },
  };
  return { deps, calls };
}

async function main() {
  // --- 2am test: a Home State row outside the 100-row national window still ranks first ---
  const window100 = Array.from({ length: 100 }, (_, i) => rec(`n${i}`, i % 2 ? 'MP' : 'RJ'));
  const upOld = rec('up-101', 'UP');
  {
    const { deps, calls } = fakeDeps({ st_up: [upOld], st_in: [] }, window100);
    const result = await listPublicRecruitments({}, 'UP', deps);
    assert(result.tiers?.home.length === 1 && result.tiers.home[0].id === 'up-101', 'home row #101 lands in the home tier');
    assert(calls.includes('st_up') && calls.includes('st_in') && calls.includes(undefined), 'loads national, home and Central');
  }

  // --- No signal: order identical to today's national load, no extra loads ---
  {
    const national = [rec('a', 'MP'), rec('b', 'IN'), rec('c', 'UP')];
    const { deps, calls } = fakeDeps({}, national);
    const result = await listPublicRecruitments({}, null, deps);
    assert(ids(result.items) === 'a,b,c' && result.tiers === null, 'no Home State keeps national order, no tiers');
    assert(calls.length === 1, 'no Home State makes one load');
  }

  // --- Merge: national first, then extras; de-dupe keeps first occurrence (dev fallback returns the same rows 3x) ---
  {
    const national = [rec('a', 'UP'), rec('b', 'IN')];
    const { deps } = fakeDeps({ st_up: [rec('a', 'UP'), rec('z', 'UP')], st_in: [rec('b', 'IN'), rec('y', 'IN')] }, national);
    const all = await loadPublicRecruitments('UP', deps);
    assert(ids(all) === 'a,b,z,y', 'merge keeps national order, appends extras, removes duplicates');
  }

  // --- Degraded: optional load fails -> warn, still tier the window (CEO D6, D11) ---
  {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (msg: string) => { warnings.push(msg); };
    const { deps } = fakeDeps({ st_in: [] }, [rec('m', 'MP'), rec('u', 'UP')], ['st_up']);
    const result = await listPublicRecruitments({}, 'UP', deps);
    console.warn = originalWarn;
    assert(result.tiers?.home[0]?.id === 'u', 'failed home load still tiers rows from the window');
    assert(warnings.some(w => w.includes('"event":"listing_load_degraded"') && w.includes('"which":"home"')), 'degraded load is logged');
  }
  {
    const { deps } = fakeDeps({}, [], []);
    const failingNational: PublicListingDeps = { load: async ({ stateId }) => { if (!stateId) throw new Error('down'); return deps.load({ stateId }); } };
    let threw = false;
    try { await loadPublicRecruitments('UP', failingNational); } catch { threw = true; }
    assert(threw, 'national load failure still throws (unchanged)');
  }

  // --- Tiers: home > central > open > locked, stable ---
  {
    const rows = [
      rec('lockedMP', 'MP', { domicile: 'MP' }),
      rec('central', 'IN'),
      rec('openRJ', 'RJ'),
      rec('home', 'UP', { domicile: 'UP' }),
      rec('legacyMP', 'MP', { criteria: { requiresMpDomicile: true } as never }),
      rec('central2', 'IN'),
    ];
    const tiers = rankByRelevance(rows, 'UP')!;
    assert(ids(tiers.home) === 'home', 'home tier holds the Home State');
    assert(ids(tiers.central) === 'central,central2', 'central tier keeps order');
    assert(ids(tiers.open) === 'openRJ', 'other state without domicile rule is open');
    assert(ids(tiers.locked) === 'lockedMP,legacyMP', 'domicile rules (incl. legacy flag) are locked');
    const crossDomicile = rankByRelevance([rec('x', 'DL', { domicile: 'UP' })], 'UP')!;
    assert(crossDomicile.open.length === 1, "another state's post requiring the visitor's own domicile is open, not locked");
    assert(ids(inRelevanceOrder({ homeCode: 'UP', items: rows, tiers })) === 'home,central,central2,openRJ,lockedMP,legacyMP', 'relevance order flattens tiers');
  }

  // --- Empty home tier (CEO D8) ---
  {
    const result = queryListing([rec('c', 'IN')], {}, 'LA');
    assert(result.tiers?.home.length === 0 && result.tiers.central.length === 1, 'empty home tier is reported, others intact');
  }

  // --- /jobs regression table: filters behave as before (CRITICAL) ---
  const jobs = [
    rec('j1', 'MP', { title: 'MP Police Constable', organisationShortName: 'MPESB', advtNumber: '05/2026', totalVacancies: 50, applicationEnd: '2026-11-20', cycleYear: 2025 }),
    rec('j2', 'UP', { title: 'UP Lekhpal', organisationShortName: 'UPSSSC', organisationName: 'UP Subordinate Services', shortSummary: 'Revenue clerk', totalVacancies: 500, applicationEnd: '2026-10-30', cycleYear: 2026, criteria: { minQualificationLevel: 'GRADUATION' } as never }),
    rec('j3', 'IN', { title: 'SSC GD', postTitle: 'General Duty', organisationShortName: 'SSC', totalVacancies: 5, cycleYear: 2024 }),
  ];
  const q = (query: Parameters<typeof queryListing>[1]) => ids(queryListing(jobs, query, null).items);
  assert(q({ q: 'lekhpal' }) === 'j2', 'q matches title');
  assert(q({ q: 'general duty' }) === 'j3', 'q matches post title');
  assert(q({ q: 'mpesb' }) === 'j1', 'q matches organisation short name');
  assert(q({ q: 'subordinate' }) === 'j2', 'q matches organisation name');
  assert(q({ q: '05/2026' }) === 'j1', 'q matches advertisement number');
  assert(q({ q: 'revenue' }) === 'j2', 'q matches summary');
  assert(q({ qualification: 'GRADUATION' }) === 'j2', 'qualification is an exact match');
  assert(q({ org: 'SSC' }) === 'j3', 'org is an exact match');
  assert(q({ state: 'up' }) === 'j2', 'state filter keeps only that jurisdiction (eng D5)');
  assert(q({ sort: 'vacancies_desc' }) === 'j2,j1,j3', 'sort by vacancies');
  assert(q({ sort: 'closing_asc' }) === 'j2,j1,j3', 'sort by closing date, missing dates last');
  assert(q({ sort: 'recent' }) === 'j2,j1,j3', 'sort by cycle year');

  // Status uses the canonical lifecycle only (CEO D9): a stale stored OPEN is not Open
  const statusRows = [
    rec('open', 'MP'),
    rec('closing', 'MP', { resolvedLifecycle: 'APPLICATION_CLOSING' } as never),
    rec('upcoming', 'MP', { resolvedLifecycle: 'NOT_STARTED' } as never),
    rec('stale', 'MP', { resolvedLifecycle: 'APPLICATION_CLOSED', lifecycleStatus: 'OPEN' } as never),
    rec('result', 'MP', { resolvedLifecycle: 'RESULT_DECLARED' } as never),
  ];
  const s = (status: string) => ids(queryListing(statusRows, { status }, null).items);
  assert(s('OPEN') === 'open,closing', 'OPEN = open + closing, stale stored OPEN excluded');
  assert(s('CLOSING_SOON') === 'closing', 'CLOSING_SOON');
  assert(s('UPCOMING') === 'upcoming', 'UPCOMING');
  assert(s('CONCLUDED') === 'stale,result', 'CONCLUDED');
  assert(s('RESULT_DECLARED') === 'result', 'exact lifecycle value');

  // Sort applies within tiers, never across them
  {
    const result = queryListing(jobs, { sort: 'vacancies_desc' }, 'MP');
    assert(ids(inRelevanceOrder(result)) === 'j1,j3,j2', 'home first even when another tier sorts higher');
  }

  // `all` is the de-duplicated union before filters (eng E2)
  {
    const { deps } = fakeDeps({ st_up: [rec('u', 'UP')], st_in: [rec('c', 'IN')] }, [rec('c', 'IN'), rec('m', 'MP')]);
    const result = await listPublicRecruitments({ state: 'MP' }, 'UP', deps);
    assert(ids(result.all) === 'c,m,u' && ids(result.items) === 'm', '`all` ignores filters and holds every loaded row once');
  }

  if (failures > 0) {
    console.error(`${failures} public-listing check(s) failed`);
    process.exit(1);
  }
}

main();
