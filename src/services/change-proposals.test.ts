// @ts-expect-error Node built-ins are available to the tsx test runner, not the Worker bundle.
import { readFileSync, readdirSync } from 'node:fs';
import {
  InvalidProposalError,
  MAX_PENDING_PROPOSALS,
  buildDiff,
  createProposal,
  listProposals,
  sanitizeChanges,
  staleFields,
  type NewProposal,
  type ProposalDeps,
  type ProposalRow,
} from './change-proposals';
import {
  approveProposal,
  mergeUpdateInput,
  rejectProposal,
  type DecisionDeps,
} from './change-proposal-decision';
import type { Actor } from './recruitment-query';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

async function rejects(fn: () => Promise<unknown> | unknown, kind?: new (...a: any[]) => Error): Promise<boolean> {
  try { await fn(); } catch (e) { return kind ? e instanceof kind : true; }
  return false;
}

const d1 = {} as D1Database;
const proposer: Actor = { id: 'mcp-client', mode: 'PROPOSE' };

function recruitment(over: Record<string, unknown> = {}): any {
  return {
    id: 'rec_1', postId: 'post_1', title: 'MP Police Constable 2026', slug: 'mp-police-2026', advtNumber: '01/2026',
    shortSummary: 'summary', overviewMarkdown: null, cycleYear: 2026, totalVacancies: 100, status: 'PUBLISHED',
    lifecycleStatus: 'OPEN', examStatus: 'NOT_SCHEDULED', resultStatus: 'NOT_DECLARED', isFeatured: 0, robotsIndex: 1,
    organisationShortName: 'MPESB', stateId: 'st_mp',
    applicationStart: '2026-09-01', applicationEnd: '2026-10-20', examDate: undefined,
    selectionStages: [{ stage: 1, name: 'Written', desc: 'x' }],
    vacanciesList: [{ category: 'UR', count: 100, gender: 'ALL' }],
    importantDatesList: [
      { event: 'Notification', desc: '', date: '2026-08-20', status: '', eventType: 'NOTIFICATION', isTentative: 0, notes: 'n' },
      { event: 'Start', desc: '', date: '2026-09-01', status: '', eventType: 'APPLICATION_START', isTentative: 0 },
      { event: 'End', desc: '', date: '2026-10-20', status: '', eventType: 'APPLICATION_END', isTentative: 0 },
    ],
    sourcesList: [{ sourceType: 'OFFICIAL_NOTIFICATION_PDF', sourceUrl: 'https://esb.mp.gov.in/n.pdf', sourceTitle: 'Notice', publicationDate: null, lastVerifiedAt: null }],
    officialLinksList: [{ linkType: 'APPLY_ONLINE', title: 'Apply', url: 'https://esb.mp.gov.in', isActive: 1 }],
    criteria: {
      minAge: 18, maxAgeGeneral: 33, ageCutoffDate: '2026-01-01', ageRelaxationScSt: 5, ageRelaxationObc: 3, ageRelaxationFemale: 5,
      ageRelaxationEws: 0, minQualificationLevel: '12TH', requiresMpDomicile: true, domicileStateCode: 'MP',
      requiresMpEmploymentReg: false, requiresCpct: false, genderAllowed: 'ALL', experienceMonths: 0,
    },
    ...over,
  };
}

function makeProposalDeps(live: any = recruitment(), pending = 0) {
  const inserted: NewProposal[] = [];
  const deps: ProposalDeps = {
    loadRecruitment: async (_d, id) => (id === live?.id ? live : undefined),
    insert: async (_d, row) => { inserted.push(row); },
    countPending: async () => pending,
    list: async (_d, o) => [{ id: 'p1', proposedBy: o.proposedBy } as unknown as ProposalRow],
  };
  return { deps, inserted };
}

async function run() {
  // --- Allowlist & validation ----------------------------------------------------------------------
  assert(await rejects(() => sanitizeChanges('UPDATE_RECRUITMENT', { status: 'PUBLISHED' }), InvalidProposalError), 'publication status cannot be proposed');
  assert(await rejects(() => sanitizeChanges('UPDATE_RECRUITMENT', { slug: 'x' }), InvalidProposalError), 'slug cannot be proposed');
  assert(await rejects(() => sanitizeChanges('UPDATE_RECRUITMENT', { postId: 'p' }), InvalidProposalError), 'postId is create-only');
  assert(await rejects(() => sanitizeChanges('UPDATE_RECRUITMENT', { adminEmail: 'a@b.c' }), InvalidProposalError), 'adminEmail cannot be proposed');
  assert(await rejects(() => sanitizeChanges('UPDATE_RECRUITMENT', {}), InvalidProposalError), 'empty change set rejected');
  assert(await rejects(() => sanitizeChanges('UPDATE_RECRUITMENT', { applicationEnd: '20/10/2026' }), InvalidProposalError), 'non-ISO date rejected');
  assert(await rejects(() => sanitizeChanges('UPDATE_RECRUITMENT', { totalVacancies: -4 }), InvalidProposalError), 'negative vacancies rejected');
  assert(await rejects(() => sanitizeChanges('UPDATE_RECRUITMENT', { officialLinks: [{ linkType: 'APPLY_ONLINE', title: 't', url: 'javascript:alert(1)' }] }), InvalidProposalError), 'non-http link rejected');
  assert(await rejects(() => sanitizeChanges('UPDATE_RECRUITMENT', { examStatus: 'MAYBE' }), InvalidProposalError), 'enum value enforced');
  assert(await rejects(() => sanitizeChanges('UPDATE_RECRUITMENT', { overviewMarkdown: 'x'.repeat(20_001) }), InvalidProposalError), 'oversized text rejected');
  assert(await rejects(() => sanitizeChanges('CREATE_RECRUITMENT', { title: 'New' }), InvalidProposalError), 'create requires title, post, organisation, advt, vacancies');
  const ok = sanitizeChanges('UPDATE_RECRUITMENT', { applicationEnd: '2026-11-05', totalVacancies: 120 });
  assert(ok.applicationEnd === '2026-11-05' && ok.totalVacancies === 120, 'valid update accepted');
  const create = sanitizeChanges('CREATE_RECRUITMENT', { title: 'New', postId: 'post_1', organisationId: 'org_1', advtNumber: '02/2026', totalVacancies: 10 });
  assert(create.postId === 'post_1', 'valid create accepted');

  // --- createProposal ------------------------------------------------------------------------------
  let { deps, inserted } = makeProposalDeps();
  assert(await rejects(() => createProposal(d1, { id: 'x', mode: 'READ' }, { kind: 'UPDATE_RECRUITMENT', recruitmentId: 'rec_1', summary: 's', changes: { totalVacancies: 1 } }, deps)), 'READ actor cannot propose');
  assert(await rejects(() => createProposal(undefined, proposer, { kind: 'UPDATE_RECRUITMENT', recruitmentId: 'rec_1', summary: 's', changes: { totalVacancies: 1 } }, deps)), 'missing D1 refuses');
  assert(await rejects(() => createProposal(d1, proposer, { kind: 'UPDATE_RECRUITMENT', recruitmentId: 'nope', summary: 's', changes: { totalVacancies: 1 } }, deps), InvalidProposalError), 'unknown recruitment rejected');
  assert(await rejects(() => createProposal(d1, proposer, { kind: 'UPDATE_RECRUITMENT', recruitmentId: 'rec_1', summary: '  ', changes: { totalVacancies: 1 } }, deps), InvalidProposalError), 'summary required');
  assert(await rejects(() => createProposal(d1, proposer, { kind: 'CREATE_RECRUITMENT', recruitmentId: 'rec_1', summary: 's', changes: create }, deps), InvalidProposalError), 'recruitmentId invalid on create');

  const made = await createProposal(d1, proposer, { kind: 'UPDATE_RECRUITMENT', recruitmentId: 'rec_1', summary: 'Deadline extended per corrigendum', changes: { applicationEnd: '2026-11-05' } }, deps);
  assert(made.status === 'PENDING' && inserted.length === 1 && inserted[0].proposedBy === 'mcp-client', 'update proposal queued as PENDING by the MCP actor');
  assert(inserted[0].baseSnapshot?.applicationEnd === '2026-10-20', 'snapshot records the live value for the stale guard');
  const madeCreate = await createProposal(d1, proposer, { kind: 'CREATE_RECRUITMENT', summary: 'New drive', changes: create }, deps);
  assert(madeCreate.recruitmentId === null && inserted[1].baseSnapshot === null, 'create proposal has no target or snapshot');

  ({ deps } = makeProposalDeps(recruitment(), MAX_PENDING_PROPOSALS));
  assert(await rejects(() => createProposal(d1, proposer, { kind: 'CREATE_RECRUITMENT', summary: 's', changes: create }, deps), InvalidProposalError), 'pending queue is capped');

  const listed = await listProposals(d1, proposer, {}, makeProposalDeps().deps);
  assert((listed[0] as any).proposedBy === 'mcp-client', 'MCP only lists its own proposals');
  assert(await rejects(() => listProposals(d1, proposer, { limit: 500 }, makeProposalDeps().deps), InvalidProposalError), 'list limit capped');

  // --- Diff & stale guard --------------------------------------------------------------------------
  const live = recruitment();
  const diff = buildDiff({ applicationEnd: '2026-11-05', totalVacancies: 100 }, live);
  assert(diff.find(d => d.field === 'applicationEnd')!.changed && !diff.find(d => d.field === 'totalVacancies')!.changed, 'diff marks only real changes');
  assert(staleFields({ applicationEnd: '2026-10-20' }, live).length === 0, 'unchanged record is not stale');
  assert(staleFields({ applicationEnd: '2026-10-20' }, recruitment({ applicationEnd: '2026-10-25' })).join() === 'applicationEnd', 'moved record is stale');

  // --- Merge ---------------------------------------------------------------------------------------
  const merged = mergeUpdateInput(live, { applicationEnd: '2026-11-05' }, 'owner@example.com');
  assert(merged.status === 'PUBLISHED' && merged.adminEmail === 'owner@example.com', 'status preserved and approver recorded');
  assert(merged.title === live.title && merged.maxAgeGeneral === 33 && merged.domicileStateCode === 'MP', 'untouched fields carried over from the live record');
  assert(merged.vacanciesBreakdown === undefined && merged.sources === undefined && merged.officialLinks === undefined, 'child lists untouched unless proposed');
  const end = merged.importantDates!.filter(d => d.eventType === 'APPLICATION_END');
  assert(end.length === 1 && end[0].eventDate === '2026-11-05' && merged.importantDates!.some(d => d.eventType === 'NOTIFICATION'), 'headline date rows are kept in step');
  const explicit = mergeUpdateInput(live, { importantDates: [{ eventType: 'EXAM_DATE', eventDate: '2026-12-01' }] }, 'o@e.c');
  assert(explicit.importantDates!.length === 1, 'explicit importantDates replace the list');
  assert((() => { try { mergeUpdateInput(recruitment({ postId: undefined }), {}, 'o@e.c'); return false; } catch { return true; } })(), 'record without a canonical post is not auto-updated');

  // --- Approve / reject ----------------------------------------------------------------------------
  const state = { row: undefined as ProposalRow | undefined, calls: [] as string[], finalized: [] as any[], claimOk: true, createOk: true };
  const baseRow = (over: Partial<ProposalRow>): ProposalRow => ({
    id: 'prop_1', kind: 'UPDATE_RECRUITMENT', recruitmentId: 'rec_1', summary: 'Deadline extended', payload: { applicationEnd: '2026-11-05' },
    baseSnapshot: { applicationEnd: '2026-10-20' }, status: 'PENDING', proposedBy: 'mcp-client', decidedBy: null, decidedAt: null,
    decisionNote: null, createdAt: new Date(), ...over,
  });
  let liveNow: any = recruitment();
  const dd: DecisionDeps = {
    get: async () => state.row,
    claim: async () => { state.calls.push('claim'); return state.claimOk; },
    release: async () => { state.calls.push('release'); },
    finalize: async (_d, _id, from, fields, audit) => { state.finalized.push({ from, ...fields, audit }); return true; },
    loadRecruitment: async () => liveNow,
    create: async (input) => { state.calls.push(`create:${(input as any).status}`); return state.createOk ? { success: true, id: 'rec_new', validation: null } : { success: false, id: '', validation: null, errors: ['Missing official source'] }; },
    update: async (id, input) => { state.calls.push(`update:${id}:${input.status}:${input.adminEmail}`); return { success: true, id, validation: null }; },
  };
  const reset = (row: ProposalRow) => { state.row = row; state.calls = []; state.finalized = []; state.claimOk = true; state.createOk = true; liveNow = recruitment(); };

  assert(await rejects(() => approveProposal(d1, 'prop_1', '', {}, dd)), 'approval requires an admin identity');

  reset(baseRow({}));
  let res = await approveProposal(d1, 'prop_1', 'owner@example.com', {}, dd);
  assert(res.ok && state.calls.join() === 'claim,update:rec_1:PUBLISHED:owner@example.com', 'approved update goes through the existing writer as the admin');
  assert(state.finalized[0].status === 'APPROVED' && state.finalized[0].audit.entityId === 'prop_1' && state.finalized[0].audit.action === 'APPROVE', 'approval is audit-logged against the proposal');

  reset(baseRow({ status: 'APPROVED' }));
  res = await approveProposal(d1, 'prop_1', 'owner@example.com', {}, dd);
  assert(!res.ok && res.code === 'NOT_PENDING' && state.calls.length === 0, 'already-decided proposal is not re-applied');

  reset(baseRow({}));
  state.claimOk = false;
  res = await approveProposal(d1, 'prop_1', 'owner@example.com', {}, dd);
  assert(!res.ok && res.code === 'NOT_PENDING' && !state.calls.some(c => c.startsWith('update')), 'double-click cannot apply twice (claim lost)');

  reset(baseRow({}));
  liveNow = recruitment({ applicationEnd: '2026-10-25' });
  res = await approveProposal(d1, 'prop_1', 'owner@example.com', {}, dd);
  assert(!res.ok && res.code === 'STALE' && res.staleFields?.join() === 'applicationEnd' && state.calls.join() === 'claim,release', 'stale record blocks approval and releases the claim');
  res = await approveProposal(d1, 'prop_1', 'owner@example.com', { confirmStale: true }, dd);
  assert(res.ok && state.calls.some(c => c.startsWith('update:rec_1')), 'stale record applies once the admin confirms');

  reset(baseRow({ kind: 'CREATE_RECRUITMENT', recruitmentId: null, baseSnapshot: null, payload: { title: 'New' } }));
  res = await approveProposal(d1, 'prop_1', 'owner@example.com', {}, dd);
  assert(res.ok && res.recruitmentId === 'rec_new' && state.calls.includes('create:DRAFT'), 'new recruitment is created as DRAFT by default');
  reset(baseRow({ kind: 'CREATE_RECRUITMENT', recruitmentId: null, baseSnapshot: null, payload: { title: 'New' } }));
  await approveProposal(d1, 'prop_1', 'owner@example.com', { publish: true }, dd);
  assert(state.calls.includes('create:PUBLISHED'), 'publish is an explicit admin choice');

  reset(baseRow({ kind: 'CREATE_RECRUITMENT', recruitmentId: null, baseSnapshot: null, payload: { title: 'New' } }));
  state.createOk = false;
  res = await approveProposal(d1, 'prop_1', 'owner@example.com', { publish: true }, dd);
  assert(!res.ok && res.code === 'FAILED' && state.finalized[0].status === 'FAILED' && state.finalized[0].note.includes('Missing official source'), 'writer rejection is recorded as FAILED with the reason');

  reset(baseRow({}));
  liveNow = undefined;
  res = await approveProposal(d1, 'prop_1', 'owner@example.com', {}, dd);
  assert(!res.ok && res.code === 'FAILED' && !state.calls.some(c => c.startsWith('update')), 'missing target fails without writing');

  reset(baseRow({}));
  res = await rejectProposal(d1, 'prop_1', 'owner@example.com', 'Wrong source', dd);
  assert(res.ok && res.status === 'REJECTED' && state.finalized[0].status === 'REJECTED' && !state.calls.some(c => c.startsWith('update')), 'reject changes nothing live');

  // --- Structural guard: the MCP can never reach the writers ---------------------------------------
  const forbidden = /createRecruitmentAtomic|updateRecruitmentAtomic|updateRecruitmentStatus|change-proposal-decision/;
  const mcpFiles: string[] = readdirSync('mcp/src').filter((f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const offenders = [...mcpFiles.map(f => `mcp/src/${f}`), 'src/services/change-proposals.ts'].filter(f => forbidden.test(readFileSync(f, 'utf8')));
  assert(offenders.length === 0, `MCP and the shared proposal module never reference the writers or the decision module (${offenders.join(', ') || 'clean'})`);

  console.log('\nAll change-proposal tests passed.');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
