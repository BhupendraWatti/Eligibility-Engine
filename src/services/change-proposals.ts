/**
 * ChangeProposalService (PROPOSE). The private MCP may only describe a change; it never applies one.
 *
 *   MCP tool -> createProposal() -> change_proposals (PENDING)
 *   Admin    -> the admin-only decision module -> the existing atomic recruitment writers
 *
 * This module must NOT import or call those writers (the MCP bundles it). A test enforces that.
 * Field allowlists keep publication status, ids, slugs and audit data out of anything the MCP can propose.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { getRecruitmentById, type RecruitmentWithDetails } from '../db/queries';
import type { Actor } from './recruitment-query';

export const PROPOSAL_KINDS = ['CREATE_RECRUITMENT', 'UPDATE_RECRUITMENT'] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];
/** APPLYING is a short-lived claim held while an admin approval is being written (stops double-approve). */
export const PROPOSAL_STATUSES = ['PENDING', 'APPLYING', 'APPROVED', 'REJECTED', 'FAILED'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export class InvalidProposalError extends Error {}

export const MAX_PENDING_PROPOSALS = 50;
export const MAX_PAYLOAD_BYTES = 40_000;
export const MAX_SUMMARY = 300;

const QUALIFICATIONS = ['8TH', '10TH', '12TH', 'ITI', 'DIPLOMA', 'GRADUATION', 'POST_GRADUATION'];
const EXAM_STATUSES = ['NOT_SCHEDULED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'POSTPONED'];
const RESULT_STATUSES = ['NOT_DECLARED', 'DECLARED'];
const GENDERS = ['ALL', 'MALE', 'FEMALE'];

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
  proposedBy: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
}

export type NewProposal = Pick<ProposalRow, 'id' | 'kind' | 'recruitmentId' | 'summary' | 'payload' | 'baseSnapshot' | 'proposedBy'>;

export interface ListOptions { status?: ProposalStatus; proposedBy?: string; limit?: number }

export interface ProposalDeps {
  loadRecruitment: (d1: D1Database, id: string) => Promise<RecruitmentWithDetails | undefined>;
  insert: (d1: D1Database, row: NewProposal) => Promise<void>;
  countPending: (d1: D1Database) => Promise<number>;
  list: (d1: D1Database, options: ListOptions) => Promise<ProposalRow[]>;
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
      proposedBy: row.proposedBy,
    });
  },
  countPending: async (d1) => {
    const [row] = await getDb(d1).select({ n: sql<number>`count(*)` }).from(schema.changeProposals).where(eq(schema.changeProposals.status, 'PENDING'));
    return Number(row?.n ?? 0);
  },
  list: listProposalRows,
};

export interface ProposalInput {
  kind: ProposalKind;
  /** Required for UPDATE_RECRUITMENT. */
  recruitmentId?: string;
  summary: string;
  changes: unknown;
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
): Promise<{ id: string; status: 'PENDING'; kind: ProposalKind; recruitmentId: string | null }> {
  const db = requirePropose(actor, d1);
  if (!PROPOSAL_KINDS.includes(input.kind)) throw new InvalidProposalError('Unknown proposal kind.');
  const summary = str(input.summary, 'summary', MAX_SUMMARY);
  const payload = sanitizeChanges(input.kind, input.changes);

  let recruitmentId: string | null = null;
  let baseSnapshot: Record<string, unknown> | null = null;
  if (input.kind === 'UPDATE_RECRUITMENT') {
    recruitmentId = str(input.recruitmentId, 'recruitmentId', 100);
    const current = await deps.loadRecruitment(db, recruitmentId);
    if (!current) throw new InvalidProposalError('Recruitment not found.');
    baseSnapshot = snapshotFields(current, Object.keys(payload));
  } else if (input.recruitmentId) {
    throw new InvalidProposalError('recruitmentId is only valid for UPDATE_RECRUITMENT.');
  }

  if ((await deps.countPending(db)) >= MAX_PENDING_PROPOSALS) {
    throw new InvalidProposalError(`Too many pending proposals (${MAX_PENDING_PROPOSALS}). Ask an admin to review the queue first.`);
  }

  const id = `prop_${crypto.randomUUID()}`;
  await deps.insert(db, { id, kind: input.kind, recruitmentId, summary, payload, baseSnapshot, proposedBy: actor.id });
  return { id, status: 'PENDING', kind: input.kind, recruitmentId };
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
