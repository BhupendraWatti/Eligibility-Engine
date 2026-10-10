/**
 * MasterProposalService (PROPOSE). The private MCP may ask for a missing canonical master (organisation, department, post);
 * it never creates one.
 *
 *   MCP tool -> proposeMaster() -> resolve against existing masters -> change_proposals (PENDING, only when NOT_FOUND)
 *   Admin    -> approveProposal() -> createOrganisation / createDepartment / createCanonicalPost
 *
 * Like change-proposals.ts this module must NOT import the master writers (the MCP bundles it).
 */
import { getAllCanonicalPosts, getAllDepartments, getAllOrganisations, getAllSectors, getAllStates } from '../db/queries';
import {
  InvalidProposalError,
  MASTER_PROPOSAL_KINDS,
  MAX_PENDING_PROPOSALS,
  QUALIFICATIONS,
  checkParentRef,
  defaultProposalDeps,
  isProposalRef,
  sanitizeEvidence,
  assertEnglish,
  type MasterProposalKind,
  type ProposalDeps,
} from './change-proposals';
import type { Actor } from './recruitment-query';

export const MASTER_TYPES = ['organisation', 'department', 'post'] as const;
export type MasterType = (typeof MASTER_TYPES)[number];

export const MASTER_KIND: Record<MasterType, MasterProposalKind> = {
  organisation: 'CREATE_ORGANISATION',
  department: 'CREATE_DEPARTMENT',
  post: 'CREATE_POST',
};
export const MASTER_TYPE_OF_KIND: Record<MasterProposalKind, MasterType> = {
  CREATE_ORGANISATION: 'organisation',
  CREATE_DEPARTMENT: 'department',
  CREATE_POST: 'post',
};
export const isMasterKind = (kind: string): kind is MasterProposalKind => (MASTER_PROPOSAL_KINDS as readonly string[]).includes(kind);

export interface MasterRecord {
  id: string;
  name: string;
  slug: string;
  shortName?: string;
  stateId?: string;
  organisationId?: string;
  departmentId?: string;
  websiteUrl?: string;
}

/** Everything the matcher needs to see, loaded once. Replaceable in tests. */
export interface MasterDeps {
  organisations: (d1: D1Database) => Promise<MasterRecord[]>;
  departments: (d1: D1Database) => Promise<MasterRecord[]>;
  posts: (d1: D1Database) => Promise<MasterRecord[]>;
  stateIds: (d1: D1Database) => Promise<string[]>;
  sectorIds: (d1: D1Database) => Promise<string[]>;
}

export const defaultMasterDeps: MasterDeps = {
  organisations: async d1 => (await getAllOrganisations(d1)).map(o => ({ id: o.id, name: o.name, slug: o.slug, shortName: o.shortName, stateId: o.stateId, websiteUrl: o.websiteUrl })),
  departments: async d1 => (await getAllDepartments(d1)).map(d => ({ id: d.id, name: d.name, slug: d.slug, organisationId: d.organisationId })),
  posts: async d1 => (await getAllCanonicalPosts(d1)).filter(p => p.isActive !== 0).map(p => ({ id: p.id, name: p.title, slug: p.slug, departmentId: p.departmentId })),
  stateIds: async d1 => (await getAllStates(d1)).map(s => s.id),
  sectorIds: async d1 => (await getAllSectors(d1)).map(s => s.id),
};

export type MasterStatus = 'MATCH' | 'POSSIBLE_MATCH' | 'NOT_FOUND';
export interface MasterResolution {
  status: MasterStatus;
  /** MATCH: the one master to reuse. POSSIBLE_MATCH: candidates for a human; never auto-picked. */
  matches: MasterRecord[];
  reasons: string[];
}

export const norm = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const host = (u?: string) => { try { return new URL(u ?? '').hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const names = (e: MasterRecord) => [e.name, e.shortName, e.slug].map(norm).filter(Boolean);

/**
 * MATCH when a name, short name or slug is identical after normalisation within the same parent (state for an organisation,
 * organisation for a department, department for a post). POSSIBLE_MATCH when an organisation has the same name in another state,
 * or one name contains the other under the same parent, or an organisation shares the official website host. Anything else is NOT_FOUND:
 * a department or post with the same name under another parent belongs to another body or state and is not a duplicate.
 */
export function resolveMaster(type: MasterType, candidate: { name: string; shortName?: string; slug?: string; websiteUrl?: string; parentId?: string }, existing: MasterRecord[]): MasterResolution {
  const wanted = [candidate.name, candidate.shortName, candidate.slug].map(norm).filter(Boolean);
  const parentOf = (e: MasterRecord) => (type === 'organisation' ? e.stateId : type === 'department' ? e.organisationId : e.departmentId);
  const exactSame: MasterRecord[] = [];
  const possible = new Map<string, { rec: MasterRecord; reason: string }>();
  for (const e of existing) {
    const theirs = names(e);
    const identical = wanted.some(w => theirs.includes(w));
    const contained = wanted.some(w => w.length >= 4 && theirs.some(t => t.length >= 4 && (t.includes(w) || w.includes(t))));
    const sameParent = !candidate.parentId || !parentOf(e) || parentOf(e) === candidate.parentId;
    if (identical && sameParent) exactSame.push(e);
    else if (identical && type === 'organisation') possible.set(e.id, { rec: e, reason: `"${e.name}" has the same name under a different parent (${parentOf(e)}).` });
    else if (contained && sameParent) possible.set(e.id, { rec: e, reason: `"${e.name}" has a similar name.` });
    else if (type === 'organisation' && candidate.websiteUrl && host(candidate.websiteUrl) && host(candidate.websiteUrl) === host(e.websiteUrl)) {
      possible.set(e.id, { rec: e, reason: `"${e.name}" uses the same official website (${host(e.websiteUrl)}).` });
    }
  }
  if (exactSame.length === 1) return { status: 'MATCH', matches: exactSame, reasons: [`Exact normalised name/short name/slug match: ${exactSame[0].id}.`] };
  if (exactSame.length > 1) return { status: 'POSSIBLE_MATCH', matches: exactSame.slice(0, 10), reasons: ['Several masters match exactly: a human must pick one.'] };
  if (possible.size) return { status: 'POSSIBLE_MATCH', matches: [...possible.values()].map(p => p.rec).slice(0, 10), reasons: [...possible.values()].map(p => p.reason).slice(0, 10) };
  return { status: 'NOT_FOUND', matches: [], reasons: [] };
}

export interface MasterInput {
  type: MasterType;
  summary: string;
  /** organisation: stateId, name, shortName, websiteUrl. department: organisationId, name, description?. post: departmentId, sectorId, title, summary?, payScale?, defaultMinAge?, defaultMaxAge?, defaultQualification?. */
  fields: unknown;
  evidence?: unknown;
  /** Resolve only; never queue. */
  dryRun?: boolean;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function text(v: unknown, field: string, max: number, optional = false): string | undefined {
  if (v === undefined && optional) return undefined;
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new InvalidProposalError(`${field} must be a non-empty string up to ${max} characters.`);
  return v.trim();
}
function age(v: unknown, field: string): number | undefined {
  if (v === undefined) return undefined;
  if (!Number.isInteger(v) || (v as number) < 14 || (v as number) > 70) throw new InvalidProposalError(`${field} must be an integer from 14 to 70.`);
  return v as number;
}

/** Validate the master fields and return the payload an admin approval will pass to the existing master writers. Masters are shown, sorted and matched in English. */
export function sanitizeMasterFields(type: MasterType, raw: unknown): Record<string, unknown> {
  return assertEnglish(sanitizeMasterFieldsRaw(type, raw), 'fields');
}

function sanitizeMasterFieldsRaw(type: MasterType, raw: unknown): Record<string, unknown> {
  if (!isObj(raw)) throw new InvalidProposalError('fields must be an object.');
  const allowed: Record<MasterType, string[]> = {
    organisation: ['stateId', 'name', 'shortName', 'websiteUrl'],
    department: ['organisationId', 'name', 'description'],
    post: ['departmentId', 'sectorId', 'title', 'summary', 'payScale', 'defaultMinAge', 'defaultMaxAge', 'defaultQualification'],
  };
  const unknown = Object.keys(raw).filter(k => !allowed[type].includes(k));
  if (unknown.length) throw new InvalidProposalError(`Field(s) cannot be proposed for a ${type}: ${unknown.join(', ')}. Allowed: ${allowed[type].join(', ')}.`);
  if (type === 'organisation') {
    const websiteUrl = text(raw.websiteUrl, 'websiteUrl', 500)!;
    let u: URL;
    try { u = new URL(websiteUrl); } catch { throw new InvalidProposalError('websiteUrl must be a valid URL.'); }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new InvalidProposalError('websiteUrl must be an http(s) URL.');
    const name = text(raw.name, 'name', 200)!;
    const shortName = text(raw.shortName, 'shortName', 40)!;
    return { stateId: text(raw.stateId, 'stateId', 100)!, name, shortName, slug: slugify(shortName), websiteUrl };
  }
  if (type === 'department') {
    const name = text(raw.name, 'name', 200)!;
    return { organisationId: text(raw.organisationId, 'organisationId', 100)!, name, slug: slugify(name), description: text(raw.description, 'description', 1000, true) };
  }
  const title = text(raw.title, 'title', 200)!;
  const qual = raw.defaultQualification === undefined ? undefined : String(raw.defaultQualification);
  if (qual !== undefined && !QUALIFICATIONS.includes(qual)) throw new InvalidProposalError(`defaultQualification must be one of: ${QUALIFICATIONS.join(', ')}.`);
  return {
    departmentId: text(raw.departmentId, 'departmentId', 100)!, sectorId: text(raw.sectorId, 'sectorId', 100)!, title, slug: slugify(title),
    summary: text(raw.summary, 'summary', 2000, true) ?? '', payScale: text(raw.payScale, 'payScale', 200, true),
    defaultMinAge: age(raw.defaultMinAge, 'defaultMinAge'), defaultMaxAge: age(raw.defaultMaxAge, 'defaultMaxAge'), defaultQualification: qual,
  };
}

export type MasterOutcome =
  | { status: 'MATCH' | 'POSSIBLE_MATCH'; matches: MasterRecord[]; reasons: string[]; queued: false }
  | { status: 'NOT_FOUND'; queued: false; dryRun: true; payload: Record<string, unknown> }
  | { status: 'NOT_FOUND'; queued: true; id: string; kind: MasterProposalKind; payload: Record<string, unknown> };

/**
 * Resolve first, queue only on NOT_FOUND. A parent master must exist, or be named by the id of its own pending proposal
 * (organisation -> department -> post can be queued in one run; the admin approves them parent first).
 */
export async function proposeMaster(
  d1: D1Database | undefined,
  actor: Actor,
  input: MasterInput,
  deps: ProposalDeps = defaultProposalDeps,
  masters: MasterDeps = defaultMasterDeps,
): Promise<MasterOutcome> {
  if (!d1) throw new Error('D1 binding unavailable.');
  if (!(MASTER_TYPES as readonly string[]).includes(input.type)) throw new InvalidProposalError(`type must be one of: ${MASTER_TYPES.join(', ')}.`);
  const summary = assertEnglish(text(input.summary, 'summary', 300)!, 'summary');
  const payload = sanitizeMasterFields(input.type, input.fields);
  const evidence = sanitizeEvidence(input.evidence, payload);

  // Parent / jurisdiction must exist, or (department, post) be a master proposal queued in the same run.
  let parentId: string;
  let existing: MasterRecord[];
  if (input.type === 'organisation') {
    parentId = payload.stateId as string;
    if (!(await masters.stateIds(d1)).includes(parentId)) throw new InvalidProposalError(`stateId "${parentId}" is not a state. Use resolve_entity(state).`);
    existing = await masters.organisations(d1);
  } else if (input.type === 'department') {
    parentId = payload.organisationId = isProposalRef(payload.organisationId) ? await checkParentRef(d1, deps, 'organisationId', payload.organisationId) : payload.organisationId as string;
    existing = await masters.departments(d1);
    if (!isProposalRef(parentId) && !(await masters.organisations(d1)).some(o => o.id === parentId)) throw new InvalidProposalError(`organisationId "${parentId}" is not an organisation. Queue it with propose_master and pass the returned proposal id.`);
  } else {
    parentId = payload.departmentId = isProposalRef(payload.departmentId) ? await checkParentRef(d1, deps, 'departmentId', payload.departmentId) : payload.departmentId as string;
    existing = await masters.posts(d1);
    if (!isProposalRef(parentId) && !(await masters.departments(d1)).some(x => x.id === parentId)) throw new InvalidProposalError(`departmentId "${parentId}" is not a department. Queue it with propose_master and pass the returned proposal id.`);
    if (!(await masters.sectorIds(d1)).includes(payload.sectorId as string)) throw new InvalidProposalError(`sectorId "${payload.sectorId}" is not a sector. Use resolve_entity(sector).`);
  }
  // Nothing can exist yet under a parent that is still waiting for approval, so only the queue is checked for it.
  if (isProposalRef(parentId)) existing = [];

  const resolution = resolveMaster(input.type, { name: (payload.name ?? payload.title) as string, shortName: payload.shortName as string | undefined, slug: payload.slug as string, websiteUrl: payload.websiteUrl as string | undefined, parentId }, existing);
  if (resolution.status !== 'NOT_FOUND') return { ...resolution, status: resolution.status, queued: false };

  // The same master may already be waiting in the queue (under the same parent).
  const kind = MASTER_KIND[input.type];
  const queued = (await deps.list(d1, { status: 'PENDING', limit: 250 })).filter(p => p.kind === kind && p.payload);
  const clash = queued.find(p => resolveMaster(input.type, { name: (payload.name ?? payload.title) as string, shortName: payload.shortName as string | undefined, slug: payload.slug as string, parentId }, [{ id: p.id, name: String(p.payload.name ?? p.payload.title ?? ''), slug: String(p.payload.slug ?? ''), shortName: p.payload.shortName as string | undefined, stateId: p.payload.stateId as string | undefined, organisationId: p.payload.organisationId as string | undefined, departmentId: p.payload.departmentId as string | undefined }]).status === 'MATCH');
  if (clash) return { status: 'POSSIBLE_MATCH', queued: false, matches: [{ id: clash.id, name: String(clash.payload.name ?? clash.payload.title), slug: String(clash.payload.slug) }], reasons: [`Already waiting as PENDING proposal ${clash.id}.`] };

  if (input.dryRun) return { status: 'NOT_FOUND', queued: false, dryRun: true, payload };
  if ((await deps.countPending(d1, actor.id)) >= MAX_PENDING_PROPOSALS) throw new InvalidProposalError(`Too many pending proposals (${MAX_PENDING_PROPOSALS}). Ask an admin to review the queue first.`);
  const id = `prop_${crypto.randomUUID()}`;
  await deps.insert(d1, { id, kind, recruitmentId: null, summary, payload, baseSnapshot: null, meta: evidence?.length ? { evidence } : null, supersedesId: null, proposedBy: actor.id });
  return { status: 'NOT_FOUND', queued: true, id, kind, payload };
}
