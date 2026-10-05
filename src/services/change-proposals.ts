/**
 * ChangeProposalService (PROPOSE). The private MCP may only describe a change; it never applies one.
 *
 *   MCP tool -> createProposal() -> change_proposals (PENDING)
 *   Admin    -> the admin-only decision module -> the existing atomic recruitment writers
 *
 * This module must NOT import or call those writers (the MCP bundles it). A test enforces that.
 * Field allowlists keep publication status, ids, slugs and audit data out of anything the MCP can propose.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { getAllActiveRecruitments, getAllCanonicalPosts, getAllOrganisations, getRecruitmentById, type RecruitmentWithDetails } from '../db/queries';
import { detectDuplicates, type DuplicateCheckResult, type RecruitmentCandidate } from './duplicate-detector';
import type { Actor } from './recruitment-query';

export const PROPOSAL_KINDS = ['CREATE_RECRUITMENT', 'UPDATE_RECRUITMENT'] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];
/**
 * APPLYING is a short-lived claim held while an admin approval is being written (stops double-approve).
 * WITHDRAWN is the proposer taking back (or superseding) its own PENDING proposal.
 */
export const PROPOSAL_STATUSES = ['PENDING', 'APPLYING', 'APPROVED', 'REJECTED', 'FAILED', 'WITHDRAWN'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export class InvalidProposalError extends Error {}

/** A well-formed proposal that must not be queued (pending conflict, confirmed duplicate, unknown post). */
export class ProposalBlockedError extends InvalidProposalError {
  constructor(
    readonly code: 'PENDING_CHANGE_CONFLICT' | 'CONFIRMED_DUPLICATE' | 'UNKNOWN_POST',
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const MAX_PENDING_PROPOSALS = 50;
export const MAX_PAYLOAD_BYTES = 40_000;
export const MAX_SUMMARY = 300;
export const MAX_EVIDENCE = 30;
export const MAX_EVIDENCE_BYTES = 20_000;
export const EVIDENCE_METHODS = ['NATIVE', 'OCR', 'VISION'] as const;

export const QUALIFICATIONS = ['8TH', '10TH', '12TH', 'ITI', 'DIPLOMA', 'GRADUATION', 'POST_GRADUATION'];
export const EXAM_STATUSES = ['NOT_SCHEDULED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'POSTPONED'];
export const RESULT_STATUSES = ['NOT_DECLARED', 'DECLARED'];
export const GENDERS = ['ALL', 'MALE', 'FEMALE'];

type FieldSpec =
  | 'string' | 'text' | 'int' | 'bool' | 'date' | 'stringList'
  | 'nullableString' | 'nullableNumber'
  | { enum: string[] }
  | 'selectionStages' | 'vacancies' | 'dates' | 'sources' | 'links';

/** Fields an UPDATE proposal may change. Deliberately excludes status, postId, organisationId, stateId, slug, isFeatured, robotsIndex. */
export const EDITABLE_FIELDS: Record<string, FieldSpec> = {
  title: 'string', advtNumber: 'string', totalVacancies: 'int', shortSummary: 'text', overviewMarkdown: 'text',
  cycleYear: 'int', payScaleOverride: 'string', salaryDetailsMarkdown: 'text', cadreClassification: 'string',
  minAge: 'int', maxAgeGeneral: 'int', ageCutoffDate: 'date',
  ageRelaxationScSt: 'int', ageRelaxationObc: 'int', ageRelaxationFemale: 'int', ageRelaxationEws: 'int',
  minQualificationLevel: { enum: QUALIFICATIONS },
  qualificationDetailsMarkdown: 'text', relaxationNotesMarkdown: 'text', specialConditionsNotes: 'text',
  experienceMonths: 'int', allowedStreams: 'stringList', additionalSkills: 'stringList',
  requiresMpDomicile: 'bool', domicileStateCode: 'nullableString',
  requiresMpEmploymentReg: 'bool', employmentRegistrationLabel: 'nullableString', requiresCpct: 'bool',
  genderAllowed: { enum: GENDERS },
  minHeightMaleCm: 'nullableNumber', minHeightFemaleCm: 'nullableNumber', minChestMaleCm: 'nullableNumber',
  minPercentageRequired: 'nullableNumber',
  applicationStart: 'date', applicationEnd: 'date', examDate: 'date',
  examStatus: { enum: EXAM_STATUSES }, resultStatus: { enum: RESULT_STATUSES },
  seoTitle: 'string', seoDescription: 'text',
  selectionStages: 'selectionStages', vacanciesBreakdown: 'vacancies', importantDates: 'dates',
  sources: 'sources', officialLinks: 'links',
};

/** A CREATE proposal may additionally name the canonical post and the recruiting organisation (both required). */
export const CREATE_ONLY_FIELDS: Record<string, FieldSpec> = { postId: 'string', organisationId: 'string' };
export const CREATE_REQUIRED = ['title', 'postId', 'organisationId', 'advtNumber', 'totalVacancies'] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function str(v: unknown, field: string, max: number): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new InvalidProposalError(`${field} must be a non-empty string up to ${max} characters.`);
  return v.trim();
}
function int(v: unknown, field: string): number {
  if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 10_000_000) throw new InvalidProposalError(`${field} must be a non-negative integer.`);
  return v as number;
}
function isoDate(v: unknown, field: string): string {
  if (typeof v !== 'string' || !ISO_DATE.test(v) || Number.isNaN(Date.parse(v))) throw new InvalidProposalError(`${field} must be an ISO date (YYYY-MM-DD).`);
  return v;
}
function httpUrl(v: unknown, field: string): string {
  const s = str(v, field, 1000);
  let u: URL;
  try { u = new URL(s); } catch { throw new InvalidProposalError(`${field} must be a valid URL.`); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new InvalidProposalError(`${field} must be an http(s) URL.`);
  return s;
}
function list<T>(v: unknown, field: string, max: number, each: (item: Record<string, unknown>, i: number) => T): T[] {
  if (!Array.isArray(v) || v.length > max) throw new InvalidProposalError(`${field} must be an array of at most ${max} items.`);
  return v.map((item, i) => {
    if (!isObj(item)) throw new InvalidProposalError(`${field}[${i}] must be an object.`);
    return each(item, i);
  });
}

function validateField(field: string, spec: FieldSpec, v: unknown): unknown {
  if (typeof spec === 'object') {
    if (typeof v !== 'string' || !spec.enum.includes(v)) throw new InvalidProposalError(`${field} must be one of: ${spec.enum.join(', ')}.`);
    return v;
  }
  switch (spec) {
    case 'string': return str(v, field, 300);
    case 'text': return str(v, field, 20_000);
    case 'int': return int(v, field);
    case 'bool':
      if (typeof v !== 'boolean') throw new InvalidProposalError(`${field} must be a boolean.`);
      return v;
    case 'date': return isoDate(v, field);
    case 'stringList':
      if (!Array.isArray(v) || v.length > 50) throw new InvalidProposalError(`${field} must be an array of at most 50 strings.`);
      return v.map((s, i) => str(s, `${field}[${i}]`, 100));
    case 'nullableString': return v === null ? null : str(v, field, 100);
    case 'nullableNumber':
      if (v === null) return null;
      if (typeof v !== 'number' || v < 0 || v > 1000) throw new InvalidProposalError(`${field} must be a non-negative number or null.`);
      return v;
    case 'selectionStages':
      return list(v, field, 20, (s, i) => ({
        stage: s.stage === undefined ? i + 1 : int(s.stage, `${field}[${i}].stage`),
        name: str(s.name, `${field}[${i}].name`, 200),
        desc: str(s.desc, `${field}[${i}].desc`, 2000),
        isQualifying: s.isQualifying === undefined ? undefined : s.isQualifying === true,
      }));
    case 'vacancies':
      return list(v, field, 100, (s, i) => ({
        category: str(s.category, `${field}[${i}].category`, 20),
        count: int(s.count, `${field}[${i}].count`),
        gender: s.gender === undefined ? 'ALL' : validateField(`${field}[${i}].gender`, { enum: GENDERS }, s.gender),
        quotaPct: s.quotaPct === undefined ? undefined : str(s.quotaPct, `${field}[${i}].quotaPct`, 20),
        subPostName: s.subPostName === undefined ? undefined : str(s.subPostName, `${field}[${i}].subPostName`, 200),
      }));
    case 'dates':
      return list(v, field, 50, (s, i) => ({
        eventType: str(s.eventType, `${field}[${i}].eventType`, 50),
        eventDate: isoDate(s.eventDate, `${field}[${i}].eventDate`),
        isTentative: s.isTentative === undefined ? 0 : (s.isTentative ? 1 : 0),
        notes: s.notes === undefined ? undefined : str(s.notes, `${field}[${i}].notes`, 500),
      }));
    case 'sources':
      return list(v, field, 20, (s, i) => ({
        sourceType: str(s.sourceType, `${field}[${i}].sourceType`, 50),
        sourceTitle: str(s.sourceTitle, `${field}[${i}].sourceTitle`, 300),
        sourceUrl: httpUrl(s.sourceUrl, `${field}[${i}].sourceUrl`),
        publicationDate: s.publicationDate === undefined ? undefined : isoDate(s.publicationDate, `${field}[${i}].publicationDate`),
      }));
    case 'links':
      return list(v, field, 30, (s, i) => ({
        linkType: str(s.linkType, `${field}[${i}].linkType`, 50),
        title: str(s.title, `${field}[${i}].title`, 200),
        url: httpUrl(s.url, `${field}[${i}].url`),
      }));
  }
}

/** Validate and normalise a proposed change set. Unknown or forbidden fields are rejected, never ignored. */
export function sanitizeChanges(kind: ProposalKind, changes: unknown): Record<string, unknown> {
  if (!isObj(changes) || Object.keys(changes).length === 0) throw new InvalidProposalError('changes must be a non-empty object.');
  const allowed = kind === 'CREATE_RECRUITMENT' ? { ...EDITABLE_FIELDS, ...CREATE_ONLY_FIELDS } : EDITABLE_FIELDS;
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(changes)) {
    const spec = allowed[field];
    if (!spec) throw new InvalidProposalError(`Field "${field}" cannot be proposed.`);
    out[field] = validateField(field, spec, value);
  }
  if (kind === 'CREATE_RECRUITMENT') {
    const missing = CREATE_REQUIRED.filter(f => out[f] === undefined);
    if (missing.length) throw new InvalidProposalError(`A new recruitment requires: ${missing.join(', ')}.`);
  }
  if (new TextEncoder().encode(JSON.stringify(out)).length > MAX_PAYLOAD_BYTES) throw new InvalidProposalError('Proposal is too large.');
  return out;
}

export interface EvidenceItem {
  field: string;
  sourceUrl: string;
  page?: number;
  snippet?: string;
  method: (typeof EVIDENCE_METHODS)[number];
  /** The proposer's own estimate. Advisory only; it is not human verification. */
  confidence?: number;
}

/** Evidence travels beside `changes` (never inside it) and must point at a field that is being changed. */
export function sanitizeEvidence(evidence: unknown, changes: Record<string, unknown>): EvidenceItem[] | undefined {
  if (evidence === undefined) return undefined;
  const items = list(evidence, 'evidence', MAX_EVIDENCE, (e, i): EvidenceItem => {
    const field = str(e.field, `evidence[${i}].field`, 100);
    if (!(field in changes)) throw new InvalidProposalError(`evidence[${i}].field "${field}" is not in changes.`);
    if (!(EVIDENCE_METHODS as readonly unknown[]).includes(e.method)) throw new InvalidProposalError(`evidence[${i}].method must be one of: ${EVIDENCE_METHODS.join(', ')}.`);
    if (e.confidence !== undefined && (typeof e.confidence !== 'number' || e.confidence < 0 || e.confidence > 1)) throw new InvalidProposalError(`evidence[${i}].confidence must be a number from 0 to 1.`);
    return {
      field,
      sourceUrl: httpUrl(e.sourceUrl, `evidence[${i}].sourceUrl`),
      page: e.page === undefined ? undefined : int(e.page, `evidence[${i}].page`),
      snippet: e.snippet === undefined ? undefined : str(e.snippet, `evidence[${i}].snippet`, 500),
      method: e.method as EvidenceItem['method'],
      confidence: e.confidence as number | undefined,
    };
  });
  if (new TextEncoder().encode(JSON.stringify(items)).length > MAX_EVIDENCE_BYTES) throw new InvalidProposalError('Evidence is too large.');
  return items;
}

// ── Reading current values (for the stale guard and the before/after diff) ──────────────────────────

const norm = (v: unknown) => (v === undefined ? null : v);

/** Current value of a proposable field on a loaded recruitment, in the same shape as a proposal value. */
export function currentFieldValue(r: RecruitmentWithDetails, field: string): unknown {
  switch (field) {
    case 'vacanciesBreakdown':
      return (r.vacanciesList ?? []).map(v => ({ category: v.category, count: v.count, gender: v.gender ?? 'ALL', quotaPct: v.quotaPct ?? undefined, subPostName: v.subPostName ?? undefined }));
    case 'importantDates':
      return (r.importantDatesList ?? []).map(d => ({ eventType: d.eventType ?? d.event, eventDate: d.date, isTentative: d.isTentative ? 1 : 0, notes: d.notes ?? undefined }));
    case 'sources':
      return (r.sourcesList ?? []).map(s => ({ sourceType: s.sourceType, sourceTitle: s.sourceTitle, sourceUrl: s.sourceUrl, publicationDate: s.publicationDate ?? undefined }));
    case 'officialLinks':
      return (r.officialLinksList ?? []).filter(l => l.isActive).map(l => ({ linkType: l.linkType, title: l.title, url: l.url }));
    default: {
      const criteria = r.criteria as Record<string, unknown> | undefined;
      if (criteria && field in criteria) return norm(criteria[field]);
      return norm((r as unknown as Record<string, unknown>)[field]);
    }
  }
}

export function snapshotFields(r: RecruitmentWithDetails, fields: string[]): Record<string, unknown> {
  return Object.fromEntries(fields.map(f => [f, norm(currentFieldValue(r, f))]));
}

const same = (a: unknown, b: unknown) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

export interface DiffRow { field: string; before: unknown; after: unknown; changed: boolean }

/** Before/after rows for the admin page. `before` is the live value now, so the reviewer sees what will actually change. */
export function buildDiff(payload: Record<string, unknown>, current: RecruitmentWithDetails | undefined): DiffRow[] {
  return Object.entries(payload).map(([field, after]) => {
    const before = current ? currentFieldValue(current, field) : null;
    return { field, before, after, changed: !same(before, after) };
  });
}

/** Fields whose live value differs from what the proposer saw when proposing (the record moved underneath it). */
export function staleFields(snapshot: Record<string, unknown> | null, current: RecruitmentWithDetails | undefined): string[] {
  if (!snapshot || !current) return [];
  return Object.keys(snapshot).filter(f => !same(snapshot[f], currentFieldValue(current, f)));
}

// ── Persistence ─────────────────────────────────────────────────────────────────────────────────────

export interface ProposalRow {
  id: string;
  kind: ProposalKind;
  recruitmentId: string | null;
  summary: string;
  payload: Record<string, unknown>;
  baseSnapshot: Record<string, unknown> | null;
  status: ProposalStatus;
  supersedesId: string | null;
  /** Reviewer-facing extras: { evidence?: EvidenceItem[]; duplicate?: possible-duplicate warning }. */
  meta: Record<string, unknown> | null;
  proposedBy: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
}

export type NewProposal = Pick<ProposalRow, 'id' | 'kind' | 'recruitmentId' | 'summary' | 'payload' | 'baseSnapshot' | 'meta' | 'supersedesId' | 'proposedBy'>;

export interface ListOptions { status?: ProposalStatus; proposedBy?: string; limit?: number }

export interface ProposalDeps {
  loadRecruitment: (d1: D1Database, id: string) => Promise<RecruitmentWithDetails | undefined>;
  insert: (d1: D1Database, row: NewProposal) => Promise<void>;
  countPending: (d1: D1Database) => Promise<number>;
  list: (d1: D1Database, options: ListOptions) => Promise<ProposalRow[]>;
  get: (d1: D1Database, id: string) => Promise<ProposalRow | undefined>;
  /** PENDING and APPLYING proposals for one recruitment (the pending-conflict check). */
  findOpen: (d1: D1Database, recruitmentId: string) => Promise<ProposalRow[]>;
  /** Guarded PENDING -> WITHDRAWN for the proposer's own row. False when it was no longer PENDING. */
  withdraw: (d1: D1Database, id: string, by: string) => Promise<boolean>;
  /** Atomically withdraw `oldId` and insert the replacement. False when the old row was no longer PENDING. */
  supersede: (d1: D1Database, oldId: string, row: NewProposal) => Promise<boolean>;
  postExists: (d1: D1Database, postId: string) => Promise<boolean>;
  checkDuplicate: (d1: D1Database, candidate: RecruitmentCandidate) => Promise<DuplicateCheckResult>;
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

export function toProposalRow(r: typeof schema.changeProposals.$inferSelect): ProposalRow {
  return {
    id: r.id,
    kind: r.kind as ProposalKind,
    recruitmentId: r.recruitmentId,
    summary: r.summary,
    payload: parseJson<Record<string, unknown>>(r.payload) ?? {},
    baseSnapshot: parseJson<Record<string, unknown>>(r.baseSnapshot),
    status: r.status as ProposalStatus,
    supersedesId: r.supersedesId,
    meta: parseJson<Record<string, unknown>>(r.meta),
    proposedBy: r.proposedBy,
    decidedBy: r.decidedBy,
    decidedAt: r.decidedAt,
    decisionNote: r.decisionNote,
    createdAt: r.createdAt,
  };
}

export async function listProposalRows(d1: D1Database, options: ListOptions): Promise<ProposalRow[]> {
  const db = getDb(d1);
  const t = schema.changeProposals;
  const conditions = [
    options.status ? eq(t.status, options.status) : undefined,
    options.proposedBy ? eq(t.proposedBy, options.proposedBy) : undefined,
  ].filter((c): c is NonNullable<typeof c> => !!c);
  const rows = await db.select().from(t)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(t.createdAt), desc(t.id))
    .limit(options.limit ?? 50);
  return rows.map(toProposalRow);
}

export const defaultProposalDeps: ProposalDeps = {
  loadRecruitment: (d1, id) => getRecruitmentById(id, d1),
  insert: async (d1, row) => {
    await getDb(d1).insert(schema.changeProposals).values({
      id: row.id,
      kind: row.kind,
      recruitmentId: row.recruitmentId,
      summary: row.summary,
      payload: JSON.stringify(row.payload),
      baseSnapshot: row.baseSnapshot ? JSON.stringify(row.baseSnapshot) : null,
      status: 'PENDING',
      supersedesId: row.supersedesId,
      meta: row.meta ? JSON.stringify(row.meta) : null,
      proposedBy: row.proposedBy,
    });
  },
  countPending: async (d1) => {
    const [row] = await getDb(d1).select({ n: sql<number>`count(*)` }).from(schema.changeProposals).where(eq(schema.changeProposals.status, 'PENDING'));
    return Number(row?.n ?? 0);
  },
  list: listProposalRows,
  get: async (d1, id) => {
    const [row] = await getDb(d1).select().from(schema.changeProposals).where(eq(schema.changeProposals.id, id)).limit(1);
    return row ? toProposalRow(row) : undefined;
  },
  findOpen: async (d1, recruitmentId) => {
    const t = schema.changeProposals;
    const rows = await getDb(d1).select().from(t).where(and(eq(t.recruitmentId, recruitmentId), inArray(t.status, ['PENDING', 'APPLYING'])));
    return rows.map(toProposalRow);
  },
  withdraw: async (d1, id, by) => {
    const results = await d1.batch(withdrawStatements(d1, id, by, WITHDRAWN_BY_PROPOSER));
    return (results[0].meta?.changes ?? 0) === 1;
  },
  supersede: async (d1, oldId, row) => {
    const note = `Superseded by ${row.id}`;
    const [withdraw, audit] = withdrawStatements(d1, oldId, row.proposedBy, note);
    const insert = d1.prepare(SUPERSEDE_INSERT_SQL).bind(row.id, row.kind, row.recruitmentId, row.summary, JSON.stringify(row.payload), row.baseSnapshot ? JSON.stringify(row.baseSnapshot) : null, row.supersedesId, row.meta ? JSON.stringify(row.meta) : null, row.proposedBy, oldId, note);
    // One D1 batch is one transaction: the guarded withdraw, the replacement (inserted only if the withdraw landed) and the audit row.
    const results = await d1.batch([withdraw, insert, audit]);
    return (results[0].meta?.changes ?? 0) === 1 && (results[1].meta?.changes ?? 0) === 1;
  },
  postExists: async (d1, postId) => (await getAllCanonicalPosts(d1)).some(p => p.id === postId && p.isActive !== 0),
  checkDuplicate: async (d1, candidate) => {
    const [existing, orgs] = await Promise.all([getAllActiveRecruitments(d1, { includeUnpublished: true, limit: 250 }), getAllOrganisations(d1)]);
    const org = orgs.find(o => o.id === candidate.organisationId);
    return detectDuplicates(
      { ...candidate, organisationShortName: org?.shortName },
      existing.map(r => ({ id: r.id, title: r.title, advtNumber: r.advtNumber, organisationShortName: r.organisationShortName, sourceUrl: r.sourcesList?.[0]?.sourceUrl, postId: r.postId, cycleYear: r.cycleYear })),
    );
  },
};

const WITHDRAWN_BY_PROPOSER = 'Withdrawn by proposer';

// Exported so the D1 integration test runs the exact statements production runs. Params: see withdrawStatements / supersede.
export const WITHDRAW_SQL = "UPDATE change_proposals SET status = 'WITHDRAWN', decided_by = ?, decided_at = unixepoch(), decision_note = ? WHERE id = ? AND status = 'PENDING' AND proposed_by = ?";
export const WITHDRAW_AUDIT_SQL =
  "INSERT INTO audit_logs (id, admin_email, entity, entity_id, action, field, new_value, reason, source) " +
  "SELECT ?, ?, 'PROPOSAL', ?, 'WITHDRAW', 'status', 'WITHDRAWN', ?, 'MCP' WHERE EXISTS (SELECT 1 FROM change_proposals WHERE id = ? AND status = 'WITHDRAWN' AND decision_note = ?)";
export const SUPERSEDE_INSERT_SQL =
  "INSERT INTO change_proposals (id, kind, recruitment_id, summary, payload, base_snapshot, status, supersedes_id, meta, proposed_by) " +
  "SELECT ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ? WHERE EXISTS (SELECT 1 FROM change_proposals WHERE id = ? AND status = 'WITHDRAWN' AND decision_note = ?)";

/** [guarded withdraw, audit row]. The audit row is written only if the withdraw actually landed. */
function withdrawStatements(d1: D1Database, id: string, by: string, note: string) {
  return [
    d1.prepare(WITHDRAW_SQL).bind(by, note, id, by),
    d1.prepare(WITHDRAW_AUDIT_SQL).bind(`audit_${crypto.randomUUID()}`, by, id, note, id, note),
  ];
}

export interface ProposalInput {
  kind: ProposalKind;
  /** Required for UPDATE_RECRUITMENT. */
  recruitmentId?: string;
  summary: string;
  changes: unknown;
  /** Optional field-level provenance; see sanitizeEvidence. */
  evidence?: unknown;
  /** Id of one of the caller's own PENDING proposals that this one replaces (same kind and target). */
  supersedes?: string;
}

function requirePropose(actor: Actor, d1: D1Database | undefined): D1Database {
  if (actor.mode !== 'PROPOSE') throw new Error('Operating mode not permitted for proposals.');
  if (!d1) throw new Error('D1 binding unavailable.');
  return d1;
}

/** Record a PENDING proposal. Nothing live is touched; an admin must approve it. */
export async function createProposal(
  d1: D1Database | undefined,
  actor: Actor,
  input: ProposalInput,
  deps: ProposalDeps = defaultProposalDeps,
): Promise<{ id: string; status: 'PENDING'; kind: ProposalKind; recruitmentId: string | null; supersedes?: string; duplicateWarning?: DuplicateCheckResult }> {
  const db = requirePropose(actor, d1);
  if (!PROPOSAL_KINDS.includes(input.kind)) throw new InvalidProposalError('Unknown proposal kind.');
  const summary = str(input.summary, 'summary', MAX_SUMMARY);
  const payload = sanitizeChanges(input.kind, input.changes);
  const evidence = sanitizeEvidence(input.evidence, payload);
  const meta: Record<string, unknown> = {};
  if (evidence?.length) meta.evidence = evidence;

  let old: ProposalRow | undefined;
  if (input.supersedes) {
    old = await deps.get(db, input.supersedes);
    if (!old || old.proposedBy !== actor.id) throw new InvalidProposalError('Proposal to supersede was not found.');
    if (old.status !== 'PENDING') throw new InvalidProposalError(`Only a PENDING proposal can be superseded (this one is ${old.status}).`);
    if (old.kind !== input.kind) throw new InvalidProposalError('A replacement must have the same kind as the proposal it supersedes.');
  }

  let recruitmentId: string | null = null;
  let baseSnapshot: Record<string, unknown> | null = null;
  let duplicateWarning: DuplicateCheckResult | undefined;
  if (input.kind === 'UPDATE_RECRUITMENT') {
    recruitmentId = str(input.recruitmentId, 'recruitmentId', 100);
    if (old && old.recruitmentId !== recruitmentId) throw new InvalidProposalError('A replacement must target the same recruitment.');
    const current = await deps.loadRecruitment(db, recruitmentId);
    if (!current) throw new InvalidProposalError('Recruitment not found.');
    // Re-snapshot the live record, never reuse the superseded proposal's snapshot.
    baseSnapshot = snapshotFields(current, Object.keys(payload));
    // Best-effort (D1 has no cross-statement transaction); the admin stale-guard remains the backstop.
    const clash = (await deps.findOpen(db, recruitmentId)).filter(p => p.id !== old?.id && Object.keys(p.payload).some(f => f in payload));
    if (clash.length) {
      const fields = [...new Set(clash.flatMap(p => Object.keys(p.payload).filter(f => f in payload)))];
      throw new ProposalBlockedError('PENDING_CHANGE_CONFLICT', `Open proposal(s) already change ${fields.join(', ')} on this recruitment. Withdraw or supersede them first.`, { conflictingIds: clash.map(p => p.id), fields });
    }
  } else {
    if (input.recruitmentId) throw new InvalidProposalError('recruitmentId is only valid for UPDATE_RECRUITMENT.');
    const postId = payload.postId as string;
    if (!(await deps.postExists(db, postId))) {
      throw new ProposalBlockedError('UNKNOWN_POST', `postId "${postId}" is not a canonical post. Use resolve_entity(post); if NOT_FOUND, ask an admin to add the post.`, { postId });
    }
    const sources = payload.sources as Array<{ sourceUrl: string }> | undefined;
    const dup = await deps.checkDuplicate(db, {
      title: payload.title as string,
      advtNumber: payload.advtNumber as string,
      organisationId: payload.organisationId as string,
      postId,
      cycleYear: (payload.cycleYear as number | undefined) ?? new Date().getFullYear(),
      sourceUrl: sources?.[0]?.sourceUrl,
    });
    if (dup.status === 'CONFIRMED_DUPLICATE') throw new ProposalBlockedError('CONFIRMED_DUPLICATE', dup.summary, { matches: dup.matches });
    if (dup.status === 'POSSIBLE_DUPLICATE') {
      duplicateWarning = dup;
      meta.duplicate = dup;
    }
  }

  const id = `prop_${crypto.randomUUID()}`;
  const row: NewProposal = { id, kind: input.kind, recruitmentId, summary, payload, baseSnapshot, meta: Object.keys(meta).length ? meta : null, supersedesId: old?.id ?? null, proposedBy: actor.id };
  if (old) {
    // The withdraw frees the slot the replacement takes, so the pending cap is not re-checked.
    if (!(await deps.supersede(db, old.id, row))) throw new InvalidProposalError('Proposal to supersede is no longer PENDING (an admin may have just decided it).');
  } else {
    if ((await deps.countPending(db)) >= MAX_PENDING_PROPOSALS) {
      throw new InvalidProposalError(`Too many pending proposals (${MAX_PENDING_PROPOSALS}). Ask an admin to review the queue first.`);
    }
    await deps.insert(db, row);
  }
  return { id, status: 'PENDING', kind: input.kind, recruitmentId, ...(old ? { supersedes: old.id } : {}), ...(duplicateWarning ? { duplicateWarning } : {}) };
}

/** One of the caller's own proposals, in full. */
export async function getProposal(d1: D1Database | undefined, actor: Actor, id: string, deps: ProposalDeps = defaultProposalDeps): Promise<ProposalRow> {
  const db = requirePropose(actor, d1);
  const row = await deps.get(db, str(id, 'id', 100));
  if (!row || row.proposedBy !== actor.id) throw new InvalidProposalError('Proposal not found.');
  return row;
}

/** Take back one of the caller's own PENDING proposals. Status transition only; payload and history are never edited. */
export async function withdrawProposal(d1: D1Database | undefined, actor: Actor, id: string, deps: ProposalDeps = defaultProposalDeps): Promise<{ id: string; status: 'WITHDRAWN' }> {
  const row = await getProposal(d1, actor, id, deps);
  if (row.status !== 'PENDING') throw new InvalidProposalError(`Only a PENDING proposal can be withdrawn (this one is ${row.status}).`);
  if (!(await deps.withdraw(d1!, row.id, actor.id))) throw new InvalidProposalError('Proposal is no longer PENDING (an admin may have just decided it).');
  return { id: row.id, status: 'WITHDRAWN' };
}

export async function listProposals(
  d1: D1Database | undefined,
  actor: Actor,
  options: ListOptions = {},
  deps: ProposalDeps = defaultProposalDeps,
): Promise<ProposalRow[]> {
  const db = requirePropose(actor, d1);
  const limit = options.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new InvalidProposalError('limit must be an integer between 1 and 50.');
  // The MCP only ever sees its own proposals.
  return deps.list(db, { status: options.status, limit, proposedBy: actor.id });
}
