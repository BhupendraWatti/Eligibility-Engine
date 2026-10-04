/**
 * Verification suite for the READ-only NIRNAY MCP slice:
 * auth boundary -> MCP server -> search_recruitments -> RecruitmentQueryService (fake loader).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { authenticateMcpRequest } from './auth';
import { createMcpServer } from './server';
import {
  searchRecruitments,
  decodeCursor,
  InvalidSearchInputError,
  type Actor,
  type RecruitmentQueryDeps,
} from '../../src/services/recruitment-query';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

const actor: Actor = { id: 'test', mode: 'READ' };
const fakeD1 = {} as D1Database;
const TOKEN = 'test-token-0123456789-abcdefghij';

function rec(over: Record<string, unknown>): any {
  return {
    id: 'r1',
    advtNumber: '01/2026',
    title: 'MP Police Constable Recruitment 2026',
    slug: 'mp-police-constable-2026',
    cycleYear: 2026,
    totalVacancies: 100,
    status: 'PUBLISHED',
    resolvedLifecycle: 'APPLICATION_OPEN',
    postTitle: 'Police Constable',
    postSlug: 'mp-police-constable',
    organisationName: 'Madhya Pradesh Employees Selection Board',
    organisationShortName: 'MPESB',
    organisationSlug: 'mpesb',
    departmentName: 'Home Department',
    departmentSlug: 'home',
    sectorName: 'Police & Defence',
    sectorSlug: 'police-defence',
    stateCode: 'MP',
    stateName: 'Madhya Pradesh',
    importantDatesList: [{ event: 'APPLICATION END', eventType: 'APPLICATION_END', date: '2026-10-20', isTentative: 0, notes: null }],
    vacanciesList: [{ category: 'UR', count: 50, gender: 'ALL' }],
    officialLinksList: [
      { linkType: 'APPLY_ONLINE', title: 'Apply', url: 'https://esb.mp.gov.in', isActive: 1 },
      { linkType: 'RESULT', title: 'Old', url: 'https://example.gov.in/old', isActive: 0 },
    ],
    sourcesList: [
      { sourceType: 'OFFICIAL_PORTAL', sourceUrl: 'https://esb.mp.gov.in', sourceTitle: 'x', publicationDate: null, lastVerifiedAt: new Date('2026-09-01T00:00:00Z') },
    ],
    ...over,
  };
}

const DATA = [
  rec({ id: 'a', title: 'MP Police Constable 2026', cycleYear: 2026 }),
  rec({ id: 'b', title: 'MPPSC State Service 2026', slug: 'mppsc-sse', postTitle: 'Deputy Collector', organisationShortName: 'MPPSC', organisationName: 'MP Public Service Commission', organisationSlug: 'mppsc', resolvedLifecycle: 'NOT_STARTED' }),
  rec({ id: 'c', title: 'Rajasthan Patwari 2025', stateCode: 'RJ', stateName: 'Rajasthan', cycleYear: 2025, resolvedLifecycle: 'RESULT_DECLARED' }),
  rec({ id: 'd', title: 'Draft leak', status: 'DRAFT' }),
];

let lastLoadOptions: unknown;
const deps: RecruitmentQueryDeps = {
  load: async (_d1, options) => {
    lastLoadOptions = options;
    return DATA;
  },
};

async function run() {
  // --- Auth boundary -------------------------------------------------------
  const mk = (h?: string) => new Request('https://x/mcp', { method: 'POST', headers: h ? { authorization: h } : {} });
  let r = await authenticateMcpRequest(mk(`Bearer ${TOKEN}`), undefined);
  assert(!r.ok && r.status === 503, 'unset token fails closed (503)');
  r = await authenticateMcpRequest(mk(`Bearer ${TOKEN}`), 'short');
  assert(!r.ok && r.status === 503, 'too-short configured token fails closed (503)');
  r = await authenticateMcpRequest(mk(), TOKEN);
  assert(!r.ok && r.status === 401, 'missing Authorization header -> 401');
  r = await authenticateMcpRequest(mk('Bearer wrong-token-wrong-token-wrong'), TOKEN);
  assert(!r.ok && r.status === 401, 'wrong token -> 401');
  r = await authenticateMcpRequest(mk(`Basic ${TOKEN}`), TOKEN);
  assert(!r.ok && r.status === 401, 'non-bearer scheme -> 401');
  r = await authenticateMcpRequest(mk(`Bearer ${TOKEN}`), TOKEN);
  assert(r.ok && r.actor.mode === 'READ', 'valid token -> READ actor');

  // --- Service -------------------------------------------------------------
  let res = await searchRecruitments(fakeD1, actor, {}, deps);
  assert((lastLoadOptions as any).includeUnpublished === false, 'loader is always called with includeUnpublished=false');
  assert(res.items.length === 3 && !res.items.some(i => i.id === 'd'), 'unpublished rows never returned');
  assert(res.items[0].cycleYear >= res.items[2].cycleYear, 'newest cycle first');

  res = await searchRecruitments(fakeD1, actor, { state: 'mp' }, deps);
  assert(res.total === 2 && res.items.every(i => i.jurisdiction.stateCode === 'MP'), 'state filter (case-insensitive)');
  res = await searchRecruitments(fakeD1, actor, { organisation: 'mppsc' }, deps);
  assert(res.items.length === 1 && res.items[0].id === 'b', 'organisation filter');
  res = await searchRecruitments(fakeD1, actor, { applicationStatus: 'OPEN' }, deps);
  assert(res.items.map(i => i.id).join() === 'a', 'applicationStatus=OPEN derived from lifecycle');
  res = await searchRecruitments(fakeD1, actor, { applicationStatus: 'UPCOMING' }, deps);
  assert(res.items.map(i => i.id).join() === 'b', 'applicationStatus=UPCOMING');
  res = await searchRecruitments(fakeD1, actor, { lifecycle: 'RESULT_DECLARED' }, deps);
  assert(res.items.map(i => i.id).join() === 'c', 'lifecycle filter');
  res = await searchRecruitments(fakeD1, actor, { cycleYear: 2025 }, deps);
  assert(res.items.map(i => i.id).join() === 'c', 'cycleYear filter');
  res = await searchRecruitments(fakeD1, actor, { post: 'deputy collector' }, deps);
  assert(res.items.map(i => i.id).join() === 'b', 'post filter (canonical post, not recruitment title)');

  const page1 = await searchRecruitments(fakeD1, actor, { limit: 2 }, deps);
  assert(page1.items.length === 2 && page1.nextCursor !== null && page1.total === 3, 'pagination: first page + cursor');
  const page2 = await searchRecruitments(fakeD1, actor, { limit: 2, cursor: page1.nextCursor! }, deps);
  assert(page2.items.length === 1 && page2.nextCursor === null, 'pagination: last page has no cursor');
  assert(new Set([...page1.items, ...page2.items].map(i => i.id)).size === 3, 'pagination: no overlap or gaps');

  const summary = (await searchRecruitments(fakeD1, actor, { state: 'MP', organisation: 'mpesb' }, deps)).items[0];
  assert(summary.officialLinks.length === 1 && summary.officialLinks[0].linkType === 'APPLY_ONLINE', 'inactive official links omitted');
  assert(summary.sourceSummary.count === 1 && summary.sourceSummary.lastVerifiedAt === '2026-09-01T00:00:00.000Z', 'sourceSummary derived');
  assert(summary.canonicalPost.slug === 'mp-police-constable' && summary.title !== summary.canonicalPost.title, 'Post and Recruitment kept distinct');

  let threw = false;
  try { await searchRecruitments(fakeD1, actor, { limit: 500 }, deps); } catch (e) { threw = e instanceof InvalidSearchInputError; }
  assert(threw, 'limit above max rejected');
  threw = false;
  try { decodeCursor('not-base64-json'); } catch (e) { threw = e instanceof InvalidSearchInputError; }
  assert(threw, 'garbage cursor rejected');
  threw = false;
  try { await searchRecruitments(undefined, actor, {}, deps); } catch { threw = true; }
  assert(threw, 'missing D1 binding refuses (no demo fallback)');
  threw = false;
  try { await searchRecruitments(fakeD1, { id: 'x', mode: 'DRAFT' as never }, {}, deps); } catch { threw = true; }
  assert(threw, 'non-READ operating mode rejected');

  // --- MCP protocol (in-memory client <-> server) --------------------------
  const server = createMcpServer({ d1: fakeD1, actor, deps });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);

  const tools = await client.listTools();
  assert(tools.tools.map(t => t.name).join() === 'search_recruitments', 'tools/list exposes only search_recruitments');
  assert(!JSON.stringify(tools).match(/sql|query_table|insert|update_row|delete/i), 'no SQL/CRUD-style tool or parameter exposed');

  const ok: any = await client.callTool({ name: 'search_recruitments', arguments: { state: 'MP', limit: 1 } });
  assert(!ok.isError && ok.structuredContent.items.length === 1 && ok.structuredContent.total === 2, 'tools/call returns structured results');
  assert(!JSON.stringify(ok).includes(TOKEN), 'no secret in response');

  const bad: any = await client.callTool({ name: 'search_recruitments', arguments: { limit: 9999 } });
  assert(!!bad.isError, 'invalid input is a safe tool error');
  const badCursor: any = await client.callTool({ name: 'search_recruitments', arguments: { cursor: '@@@' } });
  assert(badCursor.isError && badCursor.structuredContent.error.code === 'INVALID_INPUT', 'invalid cursor -> INVALID_INPUT');

  const failing = createMcpServer({ d1: fakeD1, actor, deps: { load: async () => { throw new Error('D1_ERROR: SELECT secret FROM x'); } } });
  const [c2, s2] = InMemoryTransport.createLinkedPair();
  const client2 = new Client({ name: 'c2', version: '0.0.0' });
  await Promise.all([failing.connect(s2), client2.connect(c2)]);
  const boom: any = await client2.callTool({ name: 'search_recruitments', arguments: {} });
  assert(boom.isError && !JSON.stringify(boom).includes('SELECT'), 'internal errors do not leak details');

  console.log('\nAll MCP tests passed.');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
