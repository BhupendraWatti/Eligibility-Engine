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
import { checkFacts, type FactCheckSummary } from './fact-checks';
import { isPdfUrl } from './cadre-guide';
import type { Actor } from './recruitment-query';

export const PROPOSAL_KINDS = ['CREATE_RECRUITMENT', 'UPDATE_RECRUITMENT'] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];
/** Proposals to add a missing canonical master (see master-proposals.ts). Stored in the same table; applied only by an admin. */
export const MASTER_PROPOSAL_KINDS = ['CREATE_ORGANISATION', 'CREATE_DEPARTMENT', 'CREATE_POST'] as const;
export type MasterProposalKind = (typeof MASTER_PROPOSAL_KINDS)[number];
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
    readonly code: 'PENDING_CHANGE_CONFLICT' | 'CONFIRMED_DUPLICATE' | 'UNKNOWN_POST' | 'UNKNOWN_ORGANISATION' | 'EVIDENCE_REQUIRED' | 'VALUE_NOT_IN_QUOTE'
      | 'NO_EXAM_STAGE' | 'APPLY_LINK_REQUIRED' | 'INVALID_LINK',
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

export const QUALIFICATIONS = ['7TH', '8TH', '10TH', '12TH', 'ITI', 'DIPLOMA', 'GRADUATION', 'POST_GRADUATION'];
export const EXAM_STATUSES = ['NOT_SCHEDULED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'POSTPONED'];
export const RESULT_STATUSES = ['NOT_DECLARED', 'DECLARED'];
export const GENDERS = ['ALL', 'MALE', 'FEMALE'];
export const RESERVATION_CATEGORIES = ['UR', 'SC', 'ST', 'OBC', 'EWS'];
/** officialLinks types an MCP proposal may use. APPLY_ONLINE is the page where candidates start filling the form. */
export const LINK_TYPES = [
  'APPLY_ONLINE', 'NOTIFICATION_PDF', 'RULEBOOK', 'SYLLABUS_PDF', 'ADMIT_CARD', 'ANSWER_KEY', 'PROVISIONAL_ANSWER_KEY',
  'FINAL_ANSWER_KEY', 'RESULT', 'SCORECARD', 'MERIT_LIST', 'CORRIGENDUM', 'EXAM_CITY_SLIP', 'OFFICIAL_WEBSITE', 'PORTAL',
];

type FieldSpec =
  | 'string' | 'text' | 'int' | 'bool' | 'date' | 'stringList'
  | 'nullableString' | 'nullableNumber' | 'nullableStateCode' | 'categoryQualifications'
  | { enum: string[] }
  | 'selectionStages' | 'vacancies' | 'dates' | 'sources' | 'links';

/** Fields an UPDATE proposal may change. Deliberately excludes status, postId, organisationId, stateId, slug, isFeatured, robotsIndex. */
export const EDITABLE_FIELDS: Record<string, FieldSpec> = {
  title: 'string', advtNumber: 'nullableString', totalVacancies: 'int', shortSummary: 'text', overviewMarkdown: 'text',
  cycleYear: 'int', payScaleOverride: 'string', salaryDetailsMarkdown: 'text', cadreClassification: 'string',
  minAge: 'int', maxAgeGeneral: 'int', ageCutoffDate: 'date',
  ageRelaxationScSt: 'int', ageRelaxationObc: 'int', ageRelaxationFemale: 'int', ageRelaxationEws: 'int',
  minQualificationLevel: { enum: QUALIFICATIONS },
  qualificationDetailsMarkdown: 'text', relaxationNotesMarkdown: 'text', specialConditionsNotes: 'text',
  experienceMonths: 'int', allowedStreams: 'stringList', additionalSkills: 'stringList',
  requiresMpDomicile: 'bool', domicileStateCode: 'nullableString',
  reservationStateCode: 'nullableStateCode', qualificationByCategory: 'categoryQualifications',
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
/** advtNumber is optional: omit or send null when the official notice states none. */
export const CREATE_REQUIRED = ['title', 'postId', 'organisationId', 'totalVacancies'] as const;

/**
 * A master that is itself still waiting for approval can be named by its proposal id (prop_…) wherever its id is expected,
 * so one MCP run can queue an organisation, its department, its post and the recruitment together. Approval swaps the
 * reference for the id the approved master was given (see change-proposal-decision.ts).
 */
export const PARENT_REF_KIND = { organisationId: 'CREATE_ORGANISATION', departmentId: 'CREATE_DEPARTMENT', postId: 'CREATE_POST' } as const;
type ParentRefField = keyof typeof PARENT_REF_KIND;
const PROPOSAL_ID = /^prop_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isProposalRef = (v: unknown): v is string => typeof v === 'string' && PROPOSAL_ID.test(v);

/** Parent fields of a payload that name a pending master proposal instead of a master. */
export function parentRefs(payload: Record<string, unknown>): Array<{ field: ParentRefField; id: string }> {
  return (Object.keys(PARENT_REF_KIND) as ParentRefField[]).flatMap(field => (isProposalRef(payload[field]) ? [{ field, id: payload[field] as string }] : []));
}

/** The master an approved master proposal created (recorded on approval). */
export const createdMasterId = (p: Pick<ProposalRow, 'meta'>): string | undefined => (typeof p.meta?.createdId === 'string' ? p.meta.createdId : undefined);

/**
 * Check a parent named by proposal id: it must be a master proposal of the matching kind that is PENDING or APPROVED.
 * Returns the real master id once that proposal is approved, otherwise the reference unchanged.
 */
export async function checkParentRef(db: D1Database, deps: Pick<ProposalDeps, 'get'>, field: ParentRefField, ref: string): Promise<string> {
  const parent = await deps.get(db, ref);
  const kind = PARENT_REF_KIND[field];
  if (!parent || parent.kind !== kind) throw new InvalidProposalError(`${field} "${ref}" is not a ${kind} proposal.`);
  if (parent.status === 'APPROVED') {
    const created = createdMasterId(parent);
    if (!created) throw new InvalidProposalError(`${ref} is already approved; use resolve_entity to get the real ${field}.`);
    return created;
  }
  if (parent.status !== 'PENDING' && parent.status !== 'APPLYING') throw new InvalidProposalError(`${field} "${ref}" is ${parent.status}, so nothing can be built on it.`);
  return ref;
}

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

/**
 * Everything a proposal puts on the site is written in English so every reader, in any state, can read and search it.
 * Letters from another script (Hindi, Gujarati, Tamil...) are refused; symbols like ₹ are fine. Evidence snippets stay verbatim.
 */
export function assertEnglish<T>(v: T, field: string): T {
  if (typeof v === 'string') {
    if (/[^\P{L}\p{Script=Latin}]/u.test(v)) throw new InvalidProposalError(`${field} must be written in plain English. Translate text from the notice; do not copy words in another script.`);
  } else if (Array.isArray(v)) {
    v.forEach((item, i) => assertEnglish(item, `${field}[${i}]`));
  } else if (isObj(v)) {
    for (const [k, item] of Object.entries(v)) assertEnglish(item, `${field}.${k}`);
  }
  return v;
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
    case 'nullableStateCode':
      if (v === null) return null;
      if (typeof v !== 'string' || !/^[A-Za-z]{2,3}$/.test(v.trim())) throw new InvalidProposalError(`${field} must be a 2-3 letter state code (e.g. MP, RJ) or null.`);
      return v.trim().toUpperCase();
    case 'categoryQualifications': {
      if (v === null) return null;
      if (!isObj(v)) throw new InvalidProposalError(`${field} must be an object like {"ST":"8TH"} or null.`);
      const out: Record<string, string> = {};
      for (const [category, level] of Object.entries(v)) {
        if (!RESERVATION_CATEGORIES.includes(category)) throw new InvalidProposalError(`${field} keys must be one of: ${RESERVATION_CATEGORIES.join(', ')}.`);
        out[category] = validateField(`${field}.${category}`, { enum: QUALIFICATIONS }, level) as string;
      }
      return Object.keys(out).length ? out : null;
    }
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
        category: str(s.category, `${field}[${i}].category`, 60),
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
    const valid = validateField(field, spec, value);
    // The advertisement number is an identifier, kept exactly as printed so it can match its quote.
    out[field] = field === 'advtNumber' ? valid : assertEnglish(valid, field);
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
  /** Heading or clause in the document, e.g. "Para 5 Age limit". */
  section?: string;
  snippet?: string;
  method: (typeof EVIDENCE_METHODS)[number];
  /** The value is handwritten on the notice (filled-in dates, corrections): flagged for the reviewer. */
  handwritten?: boolean;
}

/** Evidence travels beside `changes` (never inside it) and must point at a field that is being changed. */
export function sanitizeEvidence(evidence: unknown, changes: Record<string, unknown>): EvidenceItem[] | undefined {
  if (evidence === undefined) return undefined;
  const items = list(evidence, 'evidence', MAX_EVIDENCE, (e, i): EvidenceItem => {
    const field = str(e.field, `evidence[${i}].field`, 100);
    if (!(field in changes)) throw new InvalidProposalError(`evidence[${i}].field "${field}" is not in changes.`);
    if (!(EVIDENCE_METHODS as readonly unknown[]).includes(e.method)) throw new InvalidProposalError(`evidence[${i}].method must be one of: ${EVIDENCE_METHODS.join(', ')}.`);
    if (e.handwritten !== undefined && typeof e.handwritten !== 'boolean') throw new InvalidProposalError(`evidence[${i}].handwritten must be a boolean.`);
    // A self-rated "confidence" is no longer accepted or stored: the reviewer sees mechanical checks instead (fact-checks.ts).
    return {
      field,
      sourceUrl: httpUrl(e.sourceUrl, `evidence[${i}].sourceUrl`),
      page: e.page === undefined ? undefined : int(e.page, `evidence[${i}].page`),
      section: e.section === undefined ? undefined : str(e.section, `evidence[${i}].section`, 200),
      snippet: e.snippet === undefined ? undefined : str(e.snippet, `evidence[${i}].snippet`, 500),
      method: e.method as EvidenceItem['method'],
      ...(e.handwritten === true ? { handwritten: true } : {}),
    };
  });
  if (new TextEncoder().encode(JSON.stringify(items)).length > MAX_EVIDENCE_BYTES) throw new InvalidProposalError('Evidence is too large.');
  return items;
}

/** Not facts from the notice: editorial SEO copy and master ids (those come from resolve_entity). */
export const EVIDENCE_EXEMPT_FIELDS = ['seoTitle', 'seoDescription', 'postId', 'organisationId'];

/** Every changed fact needs an evidence item that quotes the official source (a snippet). */
export function unsupportedFields(payload: Record<string, unknown>, evidence: EvidenceItem[] | undefined): string[] {
  const quoted = new Set((evidence ?? []).filter(e => e.snippet).map(e => e.field));
  return Object.keys(payload).filter(f => !EVIDENCE_EXEMPT_FIELDS.includes(f) && !quoted.has(f));
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
  kind: ProposalKind | MasterProposalKind;
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
  countPending: (d1: D1Database, proposedBy: string) => Promise<number>;
  list: (d1: D1Database, options: ListOptions) => Promise<ProposalRow[]>;
  get: (d1: D1Database, id: string) => Promise<ProposalRow | undefined>;
  /** PENDING and APPLYING proposals for one recruitment (the pending-conflict check). */
  findOpen: (d1: D1Database, recruitmentId: string) => Promise<ProposalRow[]>;
  /** Guarded PENDING -> WITHDRAWN for the proposer's own row. False when it was no longer PENDING. */
  withdraw: (d1: D1Database, id: string, by: string) => Promise<boolean>;
  postExists: (d1: D1Database, postId: string) => Promise<boolean>;
  orgExists: (d1: D1Database, organisationId: string) => Promise<boolean>;
  checkDuplicate: (d1: D1Database, candidate: RecruitmentCandidate) => Promise<DuplicateCheckResult>;
  /** One audit_logs row (skipped notices). */
  audit: (d1: D1Database, entry: { by: string; entity: string; entityId: string; action: string; field: string | null; newValue: string | null; reason: string }) => Promise<void>;
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

export function toProposalRow(r: typeof schema.changeProposals.$inferSelect): ProposalRow {
  return {
    id: r.id,
    kind: r.kind as ProposalRow['kind'],
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
  countPending: async (d1, proposedBy) => {
    const [row] = await getDb(d1).select({ n: sql<number>`count(*)` }).from(schema.changeProposals).where(and(eq(schema.changeProposals.status, 'PENDING'), eq(schema.changeProposals.proposedBy, proposedBy)));
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
  postExists: async (d1, postId) => (await getAllCanonicalPosts(d1)).some(p => p.id === postId && p.isActive !== 0),
  orgExists: async (d1, organisationId) => (await getAllOrganisations(d1)).some(o => o.id === organisationId),
  checkDuplicate: async (d1, candidate) => {
    const [existing, orgs] = await Promise.all([getAllActiveRecruitments(d1, { includeUnpublished: true, limit: 250 }), getAllOrganisations(d1)]);
    const org = orgs.find(o => o.id === candidate.organisationId);
    return detectDuplicates(
      { ...candidate, organisationShortName: org?.shortName },
      existing.map(r => ({ id: r.id, title: r.title, advtNumber: r.advtNumber, organisationShortName: r.organisationShortName, organisationId: r.organisationId, sourceUrls: (r.sourcesList ?? []).map(src => src.sourceUrl), postId: r.postId, cycleYear: r.cycleYear, totalVacancies: r.totalVacancies, applicationStart: r.applicationStart, applicationEnd: r.applicationEnd })),
    );
  },
  audit: async (d1, e) => {
    await d1.prepare("INSERT INTO audit_logs (id, admin_email, entity, entity_id, action, field, new_value, reason, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MCP')")
      .bind(`audit_${crypto.randomUUID()}`, e.by, e.entity, e.entityId.slice(0, 300), e.action, e.field?.slice(0, 500) ?? null, e.newValue?.slice(0, 1000) ?? null, e.reason.slice(0, 500)).run();
  },
};

const WITHDRAWN_BY_PROPOSER = 'Withdrawn by proposer';

const WITHDRAW_SQL = "UPDATE change_proposals SET status = 'WITHDRAWN', decided_by = ?, decided_at = unixepoch(), decision_note = ? WHERE id = ? AND status = 'PENDING' AND proposed_by = ?";
const WITHDRAW_AUDIT_SQL =
  "INSERT INTO audit_logs (id, admin_email, entity, entity_id, action, field, new_value, reason, source) " +
  "SELECT ?, ?, 'PROPOSAL', ?, 'WITHDRAW', 'status', 'WITHDRAWN', ?, 'MCP' WHERE EXISTS (SELECT 1 FROM change_proposals WHERE id = ? AND status = 'WITHDRAWN' AND decision_note = ?)";

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
  /** Field-level provenance; see sanitizeEvidence. Every changed fact needs a quote. */
  evidence?: unknown;
}

// Stage names are English (assertEnglish), so only English wording is matched.
const EXAM_STAGE = /\b(written|exam(ination)?s?|tests?|cbt|computer[- ]based|objective|mcq|omr|paper[- ]?(i{1,3}|[1-3])|prelim(inary|s)?|mains|tier[- ]?(i{1,3}|[1-3]))\b/i;
// Not a selection exam: medical and physical checks, interviews, the school/degree exam a merit list is drawn from, and fee wording.
const NOT_AN_EXAM = /\b(medical|physical(\s+(efficiency|endurance|standards?|measurement))?|health|fitness|endurance|personality|psychological|qualifying|board|school|matric(ulation)?|(higher\s+)?secondary|graduation|degree|diploma|class\s*\d+|\d+(st|nd|rd|th))\s+(exam(ination)?s?|tests?)\b|\bexam(ination)?\s+fees?\b/gi;
const NO_EXAM = /\b(no|without)\s+(written\s+)?(exam(ination)?|test)\b/i;
const isExamStage = (s: { name: string; desc: string }) => {
  const text = `${s.name} ${s.desc}`.replace(NOT_AN_EXAM, ' ');
  return EXAM_STAGE.test(text) && !NO_EXAM.test(text);
};

/**
 * MCP scope rules: known link types, an apply link that is not a PDF,
 * and, on a new recruitment or whenever stages or links are sent, a written/computer exam and the page where candidates fill the form.
 * Honorary, volunteer, walk-in, interview-only and merit-only selections are out of scope in every state.
 */
export function checkMcpScope(kind: ProposalKind, payload: Record<string, unknown>, existingLinkTypes: string[] = []): void {
  const links = (payload.officialLinks as Array<{ linkType: string; url: string }> | undefined) ?? [];
  for (const [i, l] of links.entries()) {
    // officialLinks replaces the whole list, so a type already on the live record may be sent back unchanged.
    if (!LINK_TYPES.includes(l.linkType) && !existingLinkTypes.includes(l.linkType)) {
      throw new ProposalBlockedError('INVALID_LINK', `officialLinks[${i}].linkType "${l.linkType}" is not allowed. Use one of: ${LINK_TYPES.join(', ')}.`, { index: i });
    }
    if (l.linkType === 'APPLY_ONLINE' && isPdfUrl(l.url)) {
      throw new ProposalBlockedError('INVALID_LINK', `officialLinks[${i}] is APPLY_ONLINE but points at a PDF. Give the page where candidates start filling the form; list the PDF as NOTIFICATION_PDF or RULEBOOK.`, { index: i });
    }
  }
  const create = kind === 'CREATE_RECRUITMENT';
  const stages = payload.selectionStages as Array<{ name: string; desc: string }> | undefined;
  if ((create || stages) && !(stages ?? []).some(isExamStage)) {
    throw new ProposalBlockedError('NO_EXAM_STAGE', 'selectionStages must include a written or computer-based exam. Only government recruitments selected by such an exam are added; honorary, volunteer, walk-in, interview-only and merit-only posts are out of scope in every state. Do not propose this one.');
  }
  if (create && !links.some(l => l.linkType === 'APPLY_ONLINE')) {
    throw new ProposalBlockedError('APPLY_LINK_REQUIRED', 'officialLinks must include an APPLY_ONLINE link: the official page where candidates start filling the application form (not the notice PDF).');
  }
}

function requireD1(d1: D1Database | undefined): D1Database {
  if (!d1) throw new Error('D1 binding unavailable.');
  return d1;
}

/** Every check createProposal runs, with no write. Throws the same errors; returns what would be queued. */
async function checkProposal(db: D1Database, actor: Actor, input: ProposalInput, deps: ProposalDeps) {
  if (!PROPOSAL_KINDS.includes(input.kind)) throw new InvalidProposalError('Unknown proposal kind.');
  const summary = assertEnglish(str(input.summary, 'summary', MAX_SUMMARY), 'summary');
  const payload = sanitizeChanges(input.kind, input.changes);
  const evidence = sanitizeEvidence(input.evidence, payload);
  const unsupported = unsupportedFields(payload, evidence);
  if (unsupported.length) {
    throw new ProposalBlockedError('EVIDENCE_REQUIRED', `Every changed field needs evidence quoting the official source (sourceUrl + snippet). Missing for: ${unsupported.join(', ')}. Leave out any value the source does not state.`, { fields: unsupported });
  }
  const meta: Record<string, unknown> = {};
  if (evidence?.length) meta.evidence = evidence;
  const checks = checkFacts(payload, evidence);
  const wrong = checks.fields.filter(c => c.status === 'NOT_IN_QUOTE');
  if (wrong.length) {
    throw new ProposalBlockedError('VALUE_NOT_IN_QUOTE', `These values do not appear in their quoted text: ${wrong.map(c => `${c.field} (${c.detail})`).join(' ')} Re-read the source: fix the value or the quote, or leave the field out.`, { fields: wrong.map(c => c.field) });
  }
  // An update is checked once the live record is loaded (below), so its existing link types can be kept.
  if (input.kind === 'CREATE_RECRUITMENT') checkMcpScope(input.kind, payload);

  let recruitmentId: string | null = null;
  let baseSnapshot: Record<string, unknown> | null = null;
  let duplicateWarning: DuplicateCheckResult | undefined;
  let diff: DiffRow[] | undefined;
  if (input.kind === 'UPDATE_RECRUITMENT') {
    recruitmentId = str(input.recruitmentId, 'recruitmentId', 100);
    const current = await deps.loadRecruitment(db, recruitmentId);
    if (!current) throw new InvalidProposalError('Recruitment not found.');
    checkMcpScope(input.kind, payload, (current.officialLinksList ?? []).map(l => l.linkType));
    // officialLinks replaces the whole list: an MCP update must not drop the apply link the record already has.
    const hadApply = (current.officialLinksList ?? []).some(l => l.isActive !== 0 && l.linkType === 'APPLY_ONLINE');
    const links = payload.officialLinks as Array<{ linkType: string }> | undefined;
    if (links && hadApply && !links.some(l => l.linkType === 'APPLY_ONLINE')) {
      throw new ProposalBlockedError('APPLY_LINK_REQUIRED', 'officialLinks replaces the whole list: include the existing APPLY_ONLINE link again.');
    }
    baseSnapshot = snapshotFields(current, Object.keys(payload));
    diff = buildDiff(payload, current);
    // Best-effort (D1 has no cross-statement transaction); the admin stale-guard remains the backstop.
    const clash = (await deps.findOpen(db, recruitmentId)).filter(p => Object.keys(p.payload).some(f => f in payload));
    if (clash.length) {
      const fields = [...new Set(clash.flatMap(p => Object.keys(p.payload).filter(f => f in payload)))];
      throw new ProposalBlockedError('PENDING_CHANGE_CONFLICT', `Open proposal(s) already change ${fields.join(', ')} on this recruitment. Withdraw them first.`, { conflictingIds: clash.map(p => p.id), fields });
    }
  } else {
    if (input.recruitmentId) throw new InvalidProposalError('recruitmentId is only valid for UPDATE_RECRUITMENT.');
    // Either an existing master, or a master proposal queued in the same run (prop_…).
    const postId = isProposalRef(payload.postId) ? await checkParentRef(db, deps, 'postId', payload.postId) : payload.postId as string;
    if (!isProposalRef(postId) && !(await deps.postExists(db, postId))) {
      throw new ProposalBlockedError('UNKNOWN_POST', `postId "${postId}" is not a canonical post. Use resolve_entity(post); if NOT_FOUND, queue it with propose_master and pass the returned proposal id as postId.`, { postId });
    }
    const organisationId = isProposalRef(payload.organisationId) ? await checkParentRef(db, deps, 'organisationId', payload.organisationId) : payload.organisationId as string;
    if (!isProposalRef(organisationId) && !(await deps.orgExists(db, organisationId))) {
      throw new ProposalBlockedError('UNKNOWN_ORGANISATION', `organisationId "${organisationId}" is not an organisation. Use resolve_entity(organisation); if NOT_FOUND, queue it with propose_master and pass the returned proposal id as organisationId.`, { organisationId });
    }
    payload.postId = postId;
    payload.organisationId = organisationId;
    const sources = payload.sources as Array<{ sourceUrl: string }> | undefined;
    const window = { totalVacancies: payload.totalVacancies as number, applicationStart: payload.applicationStart as string | undefined, applicationEnd: payload.applicationEnd as string | undefined };
    const dup = await deps.checkDuplicate(db, {
      title: payload.title as string,
      advtNumber: (payload.advtNumber as string | null | undefined) ?? null,
      organisationId: payload.organisationId as string,
      postId,
      cycleYear: (payload.cycleYear as number | undefined) ?? new Date().getFullYear(),
      sourceUrls: (sources ?? []).map(s => s.sourceUrl),
      ...window,
    });
    if (dup.status === 'CONFIRMED_DUPLICATE') throw new ProposalBlockedError('CONFIRMED_DUPLICATE', dup.summary, { matches: dup.matches });
    if (dup.status === 'POSSIBLE_DUPLICATE') {
      duplicateWarning = dup;
      meta.duplicate = dup;
    }
    // The same notice may already be waiting in the queue as another PENDING create: that is a duplicate too.
    const queued = (await deps.list(db, { status: 'PENDING', limit: 250 }))
      .filter(p => p.kind === 'CREATE_RECRUITMENT' && p.payload && typeof p.payload.title === 'string');
    const pendingDup = detectDuplicates(
      { title: payload.title as string, advtNumber: (payload.advtNumber as string | null | undefined) ?? null, organisationId, postId, cycleYear: (payload.cycleYear as number | undefined) ?? new Date().getFullYear(), sourceUrls: (sources ?? []).map(s => s.sourceUrl), ...window },
      queued.map(p => ({ id: p.id, title: p.payload.title as string, advtNumber: (p.payload.advtNumber as string | null | undefined) ?? null, organisationId: p.payload.organisationId as string, postId: p.payload.postId as string, cycleYear: (p.payload.cycleYear as number | undefined) ?? new Date(p.createdAt).getFullYear(), sourceUrls: ((p.payload.sources as Array<{ sourceUrl: string }> | undefined) ?? []).map(s => s.sourceUrl), totalVacancies: p.payload.totalVacancies as number | undefined, applicationStart: p.payload.applicationStart as string | undefined, applicationEnd: p.payload.applicationEnd as string | undefined })),
    );
    if (pendingDup.status === 'CONFIRMED_DUPLICATE') {
      throw new ProposalBlockedError('CONFIRMED_DUPLICATE', 'The same recruitment is already waiting as a PENDING proposal. Withdraw it first.', { pendingProposalIds: pendingDup.matches.map(m => m.matchedRecruitmentId), matches: pendingDup.matches });
    }
  }

  const id = `prop_${crypto.randomUUID()}`;
  const row: NewProposal = { id, kind: input.kind, recruitmentId, summary, payload, baseSnapshot, meta: Object.keys(meta).length ? meta : null, supersedesId: null, proposedBy: actor.id };
  return { row, duplicateWarning, diff, checks };
}

/** What the reviewer will be asked to look at hardest, returned to the proposer so it can re-read those fields first. */
const reviewerFlags = (c: FactCheckSummary) => ({
  machineChecked: `${c.matched} of ${c.total} fields matched their quote`,
  needsReading: c.needsReading, fromImage: c.fromImage, handwritten: c.handwritten,
});

/** Dry run: what createProposal would do, without queuing anything or using a pending slot. Blocked outcomes are thrown as ProposalBlockedError. */
export async function previewProposal(d1: D1Database | undefined, actor: Actor, input: ProposalInput, deps: ProposalDeps = defaultProposalDeps) {
  const db = requireD1(d1);
  let checked: Awaited<ReturnType<typeof checkProposal>>;
  try {
    checked = await checkProposal(db, actor, input, deps);
  } catch (e) {
    // A no-exam notice refused at preview still belongs on the Skipped list (the MCP stops there).
    if (e instanceof ProposalBlockedError) await recordBlocked(db, actor, input, e, deps);
    throw e;
  }
  const { row, duplicateWarning, diff, checks } = checked;
  return {
    action: row.kind === 'CREATE_RECRUITMENT' ? (duplicateWarning ? 'NEW_POSSIBLE_DUPLICATE' : 'NEW') : 'UPDATE',
    kind: row.kind, recruitmentId: row.recruitmentId,
    changes: diff ?? Object.entries(row.payload).map(([field, after]) => ({ field, before: null, after, changed: true })),
    ...(duplicateWarning ? { duplicateWarning } : {}),
    checks: reviewerFlags(checks),
    approval: 'REQUIRED',
  };
}

/** Record a PENDING proposal. Nothing live is touched; an admin must approve it. */
export async function createProposal(
  d1: D1Database | undefined,
  actor: Actor,
  input: ProposalInput,
  deps: ProposalDeps = defaultProposalDeps,
): Promise<{ id: string; status: 'PENDING'; kind: ProposalKind; recruitmentId: string | null; duplicateWarning?: DuplicateCheckResult; checks: ReturnType<typeof reviewerFlags> }> {
  const db = requireD1(d1);
  let checked: Awaited<ReturnType<typeof checkProposal>>;
  try {
    checked = await checkProposal(db, actor, input, deps);
  } catch (e) {
    if (e instanceof ProposalBlockedError) await recordBlocked(db, actor, input, e, deps);
    throw e;
  }
  const { row, duplicateWarning, checks } = checked;
  const { id, recruitmentId } = row;
  if ((await deps.countPending(db, actor.id)) >= MAX_PENDING_PROPOSALS) {
    throw new InvalidProposalError(`Too many pending proposals (${MAX_PENDING_PROPOSALS}). Ask an admin to review the queue first.`);
  }
  await deps.insert(db, row);
  return { id, status: 'PENDING', kind: row.kind as ProposalKind, recruitmentId, checks: reviewerFlags(checks), ...(duplicateWarning ? { duplicateWarning } : {}) };
}

/** A no-exam notice refused on create goes on the Skipped list (audit action SKIPPED). Never throws: the original refusal is what the caller sees. */
async function recordBlocked(db: D1Database, actor: Actor, input: ProposalInput, e: ProposalBlockedError, deps: ProposalDeps): Promise<void> {
  if (input.kind !== 'CREATE_RECRUITMENT' || e.code !== 'NO_EXAM_STAGE') return;
  try {
    const changes = isObj(input.changes) ? input.changes : {};
    const title = typeof changes.title === 'string' ? changes.title : String(input.summary ?? 'Untitled notice');
    const sources = (Array.isArray(changes.sources) ? changes.sources : []) as Array<{ sourceUrl: string }>;
    const stages = Array.isArray(changes.selectionStages) ? (changes.selectionStages as Array<{ name?: string }>).map(s => s?.name).filter(Boolean).join(', ') : '';
    await deps.audit(db, { by: actor.id, entity: 'PROPOSAL', entityId: title, action: 'SKIPPED', field: sources[0]?.sourceUrl ?? null, newValue: stages || null, reason: `NO_EXAM: ${stages ? `selection is ${stages}` : 'no selection stages given'}` });
  } catch (err) {
    console.error('[proposals] could not record blocked proposal', err);
  }
}

/** One of the caller's own proposals, in full. */
export async function getProposal(d1: D1Database | undefined, actor: Actor, id: string, deps: ProposalDeps = defaultProposalDeps): Promise<ProposalRow> {
  const db = requireD1(d1);
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
  const db = requireD1(d1);
  const limit = options.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new InvalidProposalError('limit must be an integer between 1 and 50.');
  // The MCP only ever sees its own proposals.
  return deps.list(db, { status: options.status, limit, proposedBy: actor.id });
}
