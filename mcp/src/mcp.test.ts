/**
 * Verification suite for the NIRNAY MCP (read + propose-only):
 * auth boundary -> MCP server -> search_recruitments / proposal tools -> services (fake loaders and stores).
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
import type { ProposalDeps } from '../../src/services/change-proposals';

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
  assert(r.ok && r.actor.mode === 'PROPOSE', 'valid token -> PROPOSE actor (read + queue proposals, never write live data)');

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
  assert(
    tools.tools.map(t => t.name).sort().join() === 'list_my_proposals,propose_new_recruitment,propose_recruitment_update,search_recruitments',
    'tools/list exposes search + proposal tools only (no apply/approve/delete)',
  );
  assert(!JSON.stringify(tools).match(/sql|query_table|insert|update_row|delete/i), 'no SQL/CRUD-style tool or parameter exposed');
  assert(!tools.tools.some(t => /approve|apply|publish|delete|execute/i.test(t.name)), 'no tool can approve, apply, publish or delete');
  const byName = Object.fromEntries(tools.tools.map(t => [t.name, t]));
  assert(byName.search_recruitments.annotations?.readOnlyHint === true && byName.list_my_proposals.annotations?.readOnlyHint === true, 'read tools are annotated read-only');
  assert(byName.propose_recruitment_update.annotations?.destructiveHint === false && byName.propose_new_recruitment.annotations?.destructiveHint === false, 'proposal tools are annotated non-destructive');

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

  // --- Proposal tools (fake store; nothing live is reachable) ----------------------------------------
  const inserted: unknown[] = [];
  const proposalDeps: ProposalDeps = {
    loadRecruitment: async (_d, id) => (id === 'a' ? (DATA[0] as any) : undefined),
    insert: async (_d, row) => { inserted.push(row); },
    countPending: async () => 0,
    list: async (_d, o) => [{ id: 'prop_1', kind: 'UPDATE_RECRUITMENT', recruitmentId: 'a', summary: 's', status: 'PENDING', proposedBy: o.proposedBy, createdAt: new Date('2026-10-05T00:00:00Z'), decidedAt: null, decisionNote: null } as any],
  };
  const pServer = createMcpServer({ d1: fakeD1, actor: { id: 'mcp-client', mode: 'PROPOSE' }, deps, proposalDeps });
  const [c3, s3] = InMemoryTransport.createLinkedPair();
  const client3 = new Client({ name: 'c3', version: '0.0.0' });
  await Promise.all([pServer.connect(s3), client3.connect(c3)]);

  const queued: any = await client3.callTool({ name: 'propose_recruitment_update', arguments: { recruitmentId: 'a', summary: 'Deadline extended', changes: { applicationEnd: '2026-11-05' } } });
  assert(!queued.isError && queued.structuredContent.status === 'PENDING' && inserted.length === 1, 'propose_recruitment_update queues a PENDING proposal');
  assert(/not live|Nothing is live/i.test(queued.structuredContent.message), 'response tells the model nothing is live until approved');

  const forbiddenStatus: any = await client3.callTool({ name: 'propose_recruitment_update', arguments: { recruitmentId: 'a', summary: 'Publish it', changes: { status: 'PUBLISHED' } } });
  assert(forbiddenStatus.isError && forbiddenStatus.structuredContent.error.code === 'INVALID_INPUT' && inserted.length === 1, 'cannot propose a publication status change');
  const unknownTarget: any = await client3.callTool({ name: 'propose_recruitment_update', arguments: { recruitmentId: 'zzz', summary: 'x', changes: { totalVacancies: 5 } } });
  assert(unknownTarget.isError && inserted.length === 1, 'unknown recruitment is a safe tool error');

  const newRec: any = await client3.callTool({ name: 'propose_new_recruitment', arguments: { summary: 'New drive', changes: { title: 'T', postId: 'p', organisationId: 'o', advtNumber: '9/2026', totalVacancies: 5 } } });
  assert(!newRec.isError && inserted.length === 2, 'propose_new_recruitment queues a proposal');
  const incomplete: any = await client3.callTool({ name: 'propose_new_recruitment', arguments: { summary: 'x', changes: { title: 'T' } } });
  assert(incomplete.isError && inserted.length === 2, 'incomplete new recruitment rejected');

  const mine: any = await client3.callTool({ name: 'list_my_proposals', arguments: {} });
  assert(!mine.isError && mine.structuredContent.items[0].id === 'prop_1', 'list_my_proposals returns the proposal status');

  // A READ actor can search but is refused when it tries to propose.
  const roServer = createMcpServer({ d1: fakeD1, actor, deps, proposalDeps });
  const [c4, s4] = InMemoryTransport.createLinkedPair();
  const client4 = new Client({ name: 'c4', version: '0.0.0' });
  await Promise.all([roServer.connect(s4), client4.connect(c4)]);
  const refused: any = await client4.callTool({ name: 'propose_new_recruitment', arguments: { summary: 'x', changes: { title: 'T', postId: 'p', organisationId: 'o', advtNumber: '9/2026', totalVacancies: 5 } } });
  assert(refused.isError && inserted.length === 2 && !JSON.stringify(refused).includes('Operating mode'), 'READ actor cannot queue proposals and no internals leak');

  const searchAsPropose: any = await client3.callTool({ name: 'search_recruitments', arguments: { state: 'MP', limit: 1 } });
  assert(!searchAsPropose.isError && searchAsPropose.structuredContent.items.length === 1, 'PROPOSE actor can still search');

  console.log('\nAll MCP tests passed.');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
