/**
 * Small regression set for the failures met while running the real MCP workflow.
 * Run: `npm test` (tsx). Plain asserts, no database: every dependency is a fake.
 */
import { searchRecruitments, type Actor, type RecruitmentQueryDeps } from '../../src/services/recruitment-query';
import { getAllActiveRecruitments } from '../../src/db/queries';
import { detectDuplicates } from '../../src/services/duplicate-detector';
import {
  createProposal,
  sanitizeChanges,
  type NewProposal,
  type ProposalDeps,
  type ProposalRow,
} from '../../src/services/change-proposals';
import { approveProposal, type DecisionDeps } from '../../src/services/change-proposal-decision';
import { proposeMaster, resolveMaster, type MasterDeps, type MasterRecord } from '../../src/services/master-proposals';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`PASSED: ${msg}`);
}

const d1 = {} as D1Database;
const proposer: Actor = { id: 'mcp-client', mode: 'PROPOSE' };
const reader: Actor = { id: 'reader', mode: 'READ' };

// ── 1 + 2. Internal search sees drafts; public/read paths do not ───────────────────────────────────
function row(over: Record<string, unknown>): any {
  return {
    id: 'r', title: 'Police Subedar (Stenographic) 2026', slug: 's', advtNumber: null, cycleYear: 2026, totalVacancies: 135, status: 'PUBLISHED',
    resolvedLifecycle: 'APPLICATION_OPEN', postTitle: 'Subedar', postSlug: 'subedar', organisationName: 'MPESB', organisationShortName: 'MPESB', organisationSlug: 'mpesb',
    stateCode: 'MP', stateName: 'Madhya Pradesh', importantDatesList: [], vacanciesList: [], officialLinksList: [], sourcesList: [], ...over,
  };
}
const DATA = [row({ id: 'pub', status: 'PUBLISHED' }), row({ id: 'draft', status: 'DRAFT' }), row({ id: 'pv', status: 'PENDING_VERIFICATION' })];
let lastOptions: { includeUnpublished: boolean } | undefined;
const queryDeps: RecruitmentQueryDeps = { load: async (_d, o) => { lastOptions = o; return DATA; } };

async function run() {
  let res = await searchRecruitments(d1, proposer, { title: 'Subedar' }, queryDeps);
  assert(res.items.map(i => i.id).sort().join() === 'draft,pub,pv' && lastOptions?.includeUnpublished === true, 'internal (PROPOSE) search finds draft and pending-verification records by default');
  res = await searchRecruitments(d1, proposer, { title: 'Subedar', includeUnpublished: false }, queryDeps);
  assert(res.items.map(i => i.id).join() === 'pub', 'internal search can still be limited to published rows');
  res = await searchRecruitments(d1, reader, { title: 'Subedar' }, queryDeps);
  assert(res.items.map(i => i.id).join() === 'pub' && lastOptions?.includeUnpublished === false, 'READ search hides drafts');
  const publicList = await getAllActiveRecruitments(undefined);
  assert(publicList.length > 0 && publicList.every(r => r.status === 'PUBLISHED'), 'the public query layer still returns PUBLISHED rows only');

  // ── 3 + 4. Master reuse, and a proposal only for a genuinely missing master ─────────────────────
  const orgs: MasterRecord[] = [{ id: 'org_mppsc', name: 'Madhya Pradesh Public Service Commission', slug: 'mppsc', shortName: 'MPPSC', stateId: 'st_mp', websiteUrl: 'https://mppsc.mp.gov.in/' }];
  assert(resolveMaster('organisation', { name: 'MPPSC', parentId: 'st_mp' }, orgs).status === 'MATCH', 'an existing organisation is matched by short name and reused');
  assert(resolveMaster('organisation', { name: 'Madhya Pradesh Public Service Commission', parentId: 'st_mp' }, orgs).status === 'MATCH', 'an existing organisation is matched by its official name');
  assert(resolveMaster('organisation', { name: 'Some Other Board', shortName: 'SOB', websiteUrl: 'https://mppsc.mp.gov.in/x', parentId: 'st_mp' }, orgs).status === 'POSSIBLE_MATCH', 'a shared official website is only a POSSIBLE_MATCH');
  assert(resolveMaster('organisation', { name: 'Staff Selection Commission', shortName: 'SSC', parentId: 'st_in' }, orgs).status === 'NOT_FOUND', 'an unrelated organisation is NOT_FOUND');

  const masters: MasterDeps = {
    organisations: async () => orgs,
    departments: async () => [{ id: 'dept_gad', name: 'General Administration Department', slug: 'general-administration', organisationId: 'org_mppsc' }],
    posts: async () => [],
    stateIds: async () => ['st_mp', 'st_in'],
    sectorIds: async () => ['sec_admin'],
  };
  const inserted: NewProposal[] = [];
  const store: ProposalRow[] = [];
  const base = (): ProposalDeps => ({
    loadRecruitment: async () => undefined,
    insert: async (_d, r) => { inserted.push(r); store.push({ ...r, status: 'PENDING', decidedBy: null, decidedAt: null, decisionNote: null, createdAt: new Date() } as ProposalRow); },
    countPending: async () => 0,
    list: async () => store.filter(p => p.status === 'PENDING'),
    get: async () => undefined,
    findOpen: async () => [],
    withdraw: async () => true,
    supersede: async () => true,
    postExists: async () => true,
    orgExists: async () => true,
    checkDuplicate: async () => ({ status: 'NO_DUPLICATE', matches: [], summary: '' }),
  });
  const deps = base();
  const ssc = { stateId: 'st_in', name: 'Staff Selection Commission', shortName: 'SSC', websiteUrl: 'https://ssc.gov.in/' };

  let out = await proposeMaster(d1, proposer, { type: 'organisation', summary: 'Add MPPSC', fields: { stateId: 'st_mp', name: 'MPPSC', shortName: 'MPPSC', websiteUrl: 'https://mppsc.mp.gov.in/' } }, deps, masters);
  assert(out.status === 'MATCH' && !out.queued && inserted.length === 0, 'an existing master is reused and no proposal is queued');
  out = await proposeMaster(d1, proposer, { type: 'organisation', summary: 'Add SSC', fields: ssc, dryRun: true }, deps, masters);
  assert(out.status === 'NOT_FOUND' && !out.queued && inserted.length === 0, 'dryRun resolves without queuing');
  out = await proposeMaster(d1, proposer, { type: 'organisation', summary: 'Add SSC', fields: ssc, evidence: [{ field: 'name', sourceUrl: 'https://ssc.gov.in/', method: 'NATIVE', confidence: 0.9 }] }, deps, masters);
  assert(out.status === 'NOT_FOUND' && out.queued && inserted.length === 1 && inserted[0].kind === 'CREATE_ORGANISATION' && inserted[0].payload.slug === 'ssc', 'a missing master queues exactly one CREATE_ORGANISATION proposal');
  out = await proposeMaster(d1, proposer, { type: 'organisation', summary: 'Add SSC again', fields: ssc }, deps, masters);
  assert(out.status === 'POSSIBLE_MATCH' && !out.queued && inserted.length === 1, 'the same missing master is not queued twice');
  let rejected = false;
  try { await proposeMaster(d1, proposer, { type: 'department', summary: 'x', fields: { organisationId: 'org_unknown', name: 'Dept' } }, deps, masters); } catch { rejected = true; }
  assert(rejected, 'a master with an unknown parent is refused');

  // ── 5. Same source URL alone is not a duplicate; the same post is ───────────────────────────────
  const rulebook = 'https://esb.mp.gov.in/Rulebooks/RB_2026/Steno_ASI_2026_Rulebook_17092026.pdf';
  const subedar = { id: 'rec_sub', title: 'Subedar (Stenographic) 2026', advtNumber: null, postId: 'post_mp_subedar_steno', cycleYear: 2026, sourceUrls: [rulebook] };
  let dup = detectDuplicates({ title: 'ASI (Stenographic) 2026', advtNumber: null, postId: 'post_mp_asi_steno', cycleYear: 2026, sourceUrls: [rulebook] }, [subedar]);
  assert(dup.status === 'NO_DUPLICATE', 'the same rulebook URL for a different post is not a duplicate');
  dup = detectDuplicates({ title: 'Subedar again', advtNumber: null, postId: 'post_mp_subedar_steno', cycleYear: 2026, sourceUrls: [rulebook] }, [subedar]);
  assert(dup.status === 'CONFIRMED_DUPLICATE', 'the same rulebook URL for the same post is a confirmed duplicate');

  // ── 6. A notice with no advertisement number is accepted ───────────────────────────────────────
  const create = sanitizeChanges('CREATE_RECRUITMENT', { title: 'ASI (Stenographic) 2026', postId: 'post_mp_asi_steno', organisationId: 'org_mpesb', totalVacancies: 520 });
  assert(create.advtNumber === undefined && create.totalVacancies === 520, 'a create without advtNumber is valid');

  // ── 6b. State-scoped reservation and category-wise qualification can be proposed ──────────────
  const scoped = sanitizeChanges('UPDATE_RECRUITMENT', { reservationStateCode: 'mp', qualificationByCategory: { ST: '8TH' } });
  assert(scoped.reservationStateCode === 'MP' && (scoped.qualificationByCategory as Record<string, string>).ST === '8TH', 'reservation state and category-wise qualification are accepted and normalised');
  let refused = 0;
  for (const bad of [{ qualificationByCategory: { MBC: '8TH' } }, { qualificationByCategory: { ST: 'PHD' } }, { reservationStateCode: 'Madhya Pradesh' }]) {
    try { sanitizeChanges('UPDATE_RECRUITMENT', bad); } catch { refused++; }
  }
  assert(refused === 3, 'unknown categories, levels and non-code states are rejected');

  // ── 7. Evidence is stored beside the payload ───────────────────────────────────────────────────
  const evDeps = base();
  const made = await createProposal(d1, proposer, {
    kind: 'CREATE_RECRUITMENT', summary: 'ASI (Stenographic) per rulebook', changes: create,
    evidence: [{ field: 'totalVacancies', sourceUrl: rulebook, page: 5, snippet: 'Post codes 03-06: 100 + 370 + 25 + 25', method: 'VISION', confidence: 0.9 }],
  }, evDeps);
  const ev = (store[store.length - 1]?.meta as any)?.evidence?.[0];
  assert(made.status === 'PENDING' && !made.evidenceMissing.includes('totalVacancies'), 'evidence for totalVacancies clears the evidence-missing flag');
  assert(!!ev && ev.field === 'totalVacancies' && ev.page === 5 && ev.method === 'VISION' && ev.snippet.startsWith('Post codes'), 'field-level evidence (field, page, snippet, method) is preserved on the queued proposal');

  // A second PENDING create for the same post and source is refused, while a different post may share the PDF.
  const queuedCreate = { id: 'prop_q', kind: 'CREATE_RECRUITMENT', payload: { ...create, sources: [{ sourceType: 'OFFICIAL_NOTIFICATION_PDF', sourceTitle: 't', sourceUrl: rulebook }] }, status: 'PENDING', createdAt: new Date() } as unknown as ProposalRow;
  const withQueue: ProposalDeps = { ...base(), list: async () => [queuedCreate] };
  let blockedCode = '';
  try { await createProposal(d1, proposer, { kind: 'CREATE_RECRUITMENT', summary: 'dup', changes: { ...create, sources: [{ sourceType: 'OFFICIAL_NOTIFICATION_PDF', sourceTitle: 't', sourceUrl: rulebook }] } }, withQueue); } catch (e: any) { blockedCode = e.code; }
  assert(blockedCode === 'CONFIRMED_DUPLICATE', 'a PENDING create for the same notice and post blocks a second one');
  const otherPost = await createProposal(d1, proposer, { kind: 'CREATE_RECRUITMENT', summary: 'Subedar', changes: { ...create, title: 'Subedar (Stenographic) 2026', postId: 'post_mp_subedar_steno', sources: [{ sourceType: 'OFFICIAL_NOTIFICATION_PDF', sourceTitle: 't', sourceUrl: rulebook }] } }, withQueue);
  assert(otherPost.status === 'PENDING', 'a different post under the same rulebook URL can be queued');

  // ── 7b. MCP proposals (requireEvidence) must quote the official source for every changed fact ──────
  const strictDeps = base();
  const strict = async (changes: Record<string, unknown>, evidence?: unknown) => {
    try { await createProposal(d1, proposer, { kind: 'CREATE_RECRUITMENT', summary: 'strict', changes, evidence, requireEvidence: true }, strictDeps); return 'QUEUED'; }
    catch (e: any) { return `${e.code}:${(e.details?.fields ?? []).join(',')}`; }
  };
  const quote = (field: string) => ({ field, sourceUrl: rulebook, page: 1, snippet: 'quoted line', method: 'NATIVE' });
  const strictCreate = { ...create, title: 'Strict test 2026', postId: 'post_strict' };
  assert(await strict(strictCreate) === 'EVIDENCE_REQUIRED:title,totalVacancies', 'a strict proposal without evidence is refused and names the unsupported fields');
  assert(await strict(strictCreate, [quote('title'), { ...quote('totalVacancies'), snippet: undefined }]) === 'EVIDENCE_REQUIRED:totalVacancies', 'evidence without a quoted snippet does not count');
  assert(await strict({ ...strictCreate, seoTitle: 'SEO copy' }, [quote('title'), quote('totalVacancies')]) === 'QUEUED', 'quoted evidence for every fact queues it; SEO copy and master ids are exempt');

  // ── 8. Approving a proposal changes the intended field only ────────────────────────────────────
  const live: any = {
    id: 'rec_1', postId: 'post_1', title: 'T', slug: 't', advtNumber: null, shortSummary: 's', cycleYear: 2026, totalVacancies: 135, status: 'DRAFT', lifecycleStatus: 'NOT_STARTED',
    examStatus: 'NOT_SCHEDULED', resultStatus: 'NOT_DECLARED', isFeatured: 0, robotsIndex: 1, organisationShortName: 'MPESB', stateId: 'st_mp',
    applicationStart: '2026-09-24', applicationEnd: '2026-10-08', examDate: undefined, selectionStages: [], vacanciesList: [], importantDatesList: [], sourcesList: [], officialLinksList: [],
    criteria: { minAge: 18, maxAgeGeneral: 33, ageCutoffDate: '2026-10-08', ageRelaxationScSt: 5, ageRelaxationObc: 3, ageRelaxationFemale: 5, ageRelaxationEws: 0, minQualificationLevel: '12TH', requiresMpDomicile: false, requiresMpEmploymentReg: false, requiresCpct: false, genderAllowed: 'ALL', experienceMonths: 0 },
  };
  const pending: ProposalRow = { id: 'prop_1', kind: 'UPDATE_RECRUITMENT', recruitmentId: 'rec_1', summary: 'OBC relaxation', payload: { ageRelaxationObc: 5 }, baseSnapshot: { ageRelaxationObc: 3 }, status: 'PENDING', supersedesId: null, meta: null, proposedBy: 'mcp-client', decidedBy: null, decidedAt: null, decisionNote: null, createdAt: new Date() };
  let updated: any;
  const finalized: string[] = [];
  const decision: DecisionDeps = {
    get: async () => pending, claim: async () => true, release: async () => {},
    finalize: async (_d, _i, _f, fields) => { finalized.push(fields.status); return true; },
    loadRecruitment: async () => live,
    create: async () => ({ success: true, id: 'new' } as any),
    update: async (_id, input) => { updated = input; return { success: true, id: 'rec_1' } as any; },
    masters: masters,
    createMaster: async () => 'org_new',
  };
  const approved = await approveProposal(d1, 'prop_1', 'admin@x.in', {}, decision);
  assert(approved.ok && finalized.includes('APPROVED'), 'an approved proposal is marked APPROVED');
  assert(updated.ageRelaxationObc === 5 && updated.maxAgeGeneral === 33 && updated.applicationEnd === '2026-10-08' && updated.status === 'DRAFT', 'approval changes the proposed field and leaves the other fields and status untouched');

  // An approved master proposal creates the master once, and is refused if the master appeared meanwhile.
  const masterProposal: ProposalRow = { ...pending, id: 'prop_m', kind: 'CREATE_ORGANISATION', recruitmentId: null, payload: { stateId: 'st_in', name: 'Staff Selection Commission', shortName: 'SSC', slug: 'ssc', websiteUrl: 'https://ssc.gov.in/' }, baseSnapshot: null };
  let createdKind = '';
  const mdeps: DecisionDeps = { ...decision, get: async () => masterProposal, createMaster: async k => { createdKind = k; return 'org_ssc'; } };
  const m1 = await approveProposal(d1, 'prop_m', 'admin@x.in', {}, mdeps);
  assert(m1.ok && createdKind === 'CREATE_ORGANISATION', 'an approved master proposal creates the master through the admin writer');
  createdKind = '';
  const withSsc: MasterDeps = { ...masters, organisations: async () => [...orgs, { id: 'org_ssc', name: 'Staff Selection Commission', slug: 'ssc', shortName: 'SSC', stateId: 'st_in' }] };
  const m2 = await approveProposal(d1, 'prop_m', 'admin@x.in', {}, { ...mdeps, masters: withSsc });
  assert(!m2.ok && createdKind === '', 'approval refuses to create a master that already exists');

  console.log('\nAll regression checks passed.');
}

run().catch(e => { console.error(e); process.exit(1); });
