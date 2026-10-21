/**
 * MasterProposalService (PROPOSE). The private MCP may ask for a missing canonical master (sector, organisation, department, post);
 * it never creates one.
 *
 *   MCP tool -> proposeMaster() -> resolve against existing masters -> change_proposals (PENDING, only when NOT_FOUND)
 *   Admin    -> approveProposal() -> createSector / createOrganisation / createDepartment / createCanonicalPost
 *
 * It may also ask to EDIT an existing master (state, sector, organisation, department, post), the same fields an admin edits by hand:
 *
 *   MCP tool -> proposeMasterUpdate() -> change_proposals (PENDING, UPDATE_<TYPE>, meta.targetId)
 *   Admin    -> approveProposal() -> updateState / updateSector / updateOrganisation / updateDepartment / updateCanonicalPost
 *
 * Like change-proposals.ts this module must NOT import the master writers (the MCP bundles it).
 */
import { getAllCanonicalPosts, getAllDepartments, getAllOrganisations, getAllSectors, getAllStates } from '../db/queries';
import {
  InvalidProposalError,
  MASTER_PROPOSAL_KINDS,
  MASTER_UPDATE_KINDS,
  MAX_PENDING_PROPOSALS,
  ProposalBlockedError,
  QUALIFICATIONS,
  checkParentRef,
  defaultProposalDeps,
  isProposalRef,
  sanitizeEvidence,
  assertEnglish,
  type MasterProposalKind,
  type MasterUpdateKind,
  type ProposalDeps,
} from './change-proposals';
import type { Actor } from './recruitment-query';
import { SECTOR_ICONS, SECTOR_THEMES } from './sector-theme';

export const MASTER_TYPES = ['sector', 'organisation', 'department', 'post'] as const;
export type MasterType = (typeof MASTER_TYPES)[number];

export const MASTER_KIND: Record<MasterType, MasterProposalKind> = {
  sector: 'CREATE_SECTOR',
  organisation: 'CREATE_ORGANISATION',
  department: 'CREATE_DEPARTMENT',
  post: 'CREATE_POST',
};
export const MASTER_TYPE_OF_KIND: Record<MasterProposalKind, MasterType> = {
  CREATE_SECTOR: 'sector',
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
  /** Every sector, hidden ones included: a hidden sector must be reactivated, not created again. */
  sectors: (d1: D1Database) => Promise<MasterRecord[]>;
  organisations: (d1: D1Database) => Promise<MasterRecord[]>;
  departments: (d1: D1Database) => Promise<MasterRecord[]>;
  posts: (d1: D1Database) => Promise<MasterRecord[]>;
  stateIds: (d1: D1Database) => Promise<string[]>;
  sectorIds: (d1: D1Database) => Promise<string[]>;
}

export const defaultMasterDeps: MasterDeps = {
  sectors: async d1 => (await getAllSectors(d1, { includeInactive: true })).map(s => ({ id: s.id, name: s.name, slug: s.slug })),
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

/** Words that say nothing about which field of work a sector is. */
const SECTOR_FILLER = new Set(['and', 'of', 'the', 'for', 'in', 'services', 'service', 'sector', 'sectors', 'jobs', 'job', 'government', 'govt', 'public', 'department', 'departments', 'other', 'general', 'related', 'allied']);
/** Significant words, cut to a 5-letter stem so "Finance" and "Financial", "Teacher" and "Teaching" meet. */
const sectorWords = (v: string) => new Set(v.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1 && !SECTOR_FILLER.has(w)).map(w => w.slice(0, 5)));

/**
 * MATCH when a name, short name or slug is identical after normalisation within the same parent (state for an organisation,
 * organisation for a department, department for a post; a sector has none). A sector sharing half its significant words with an
 * existing one is a POSSIBLE_MATCH, so near-duplicates like "Police & Defence" / "Defence and Police Services" are never queued. POSSIBLE_MATCH when an organisation has the same name in another state,
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
    else if (type === 'sector') {
      // Sectors are few and national: sharing half the significant words means the same field of work.
      const mine = sectorWords(candidate.name), theirs = sectorWords(e.name);
      const shared = [...mine].filter(w => theirs.has(w));
      if (shared.length && shared.length / Math.min(mine.size, theirs.size) >= 0.5) possible.set(e.id, { rec: e, reason: `"${e.name}" covers the same field of work. Reuse it unless the job clearly belongs elsewhere.` });
    }
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
  /** sector: name, description, icon, theme. organisation: stateId, name, shortName, websiteUrl. department: organisationId, name, description?. post: departmentId, sectorId, title, summary?, payScale?, defaultMinAge?, defaultMaxAge?, defaultQualification?. */
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
    sector: ['name', 'description', 'icon', 'theme'],
    organisation: ['stateId', 'name', 'shortName', 'websiteUrl'],
    department: ['organisationId', 'name', 'description'],
    post: ['departmentId', 'sectorId', 'title', 'summary', 'payScale', 'defaultMinAge', 'defaultMaxAge', 'defaultQualification'],
  };
  const unknown = Object.keys(raw).filter(k => !allowed[type].includes(k));
  if (unknown.length) throw new InvalidProposalError(`Field(s) cannot be proposed for a ${type}: ${unknown.join(', ')}. Allowed: ${allowed[type].join(', ')}.`);
  if (type === 'sector') {
    const name = text(raw.name, 'name', 80)!;
    const icon = String(raw.icon ?? '');
    const theme = String(raw.theme ?? '');
    if (!(icon in SECTOR_ICONS)) throw new InvalidProposalError(`icon must be one of: ${Object.keys(SECTOR_ICONS).join(', ')}.`);
    if (!(theme in SECTOR_THEMES)) throw new InvalidProposalError(`theme must be one of: ${Object.keys(SECTOR_THEMES).join(', ')}.`);
    return { name, slug: slugify(name), description: text(raw.description, 'description', 300)!, icon, theme };
  }
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
  if (input.type === 'sector') {
    parentId = '';
    existing = await masters.sectors(d1);
  } else if (input.type === 'organisation') {
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
    if (isProposalRef(payload.sectorId)) payload.sectorId = await checkParentRef(d1, deps, 'sectorId', payload.sectorId);
    else if (!(await masters.sectorIds(d1)).includes(payload.sectorId as string)) throw new InvalidProposalError(`sectorId "${payload.sectorId}" is not a sector. Use resolve_entity(sector); if NOT_FOUND, queue it with propose_master(sector) and pass the returned proposal id.`);
  }
  // Nothing can exist yet under a parent that is still waiting for approval, so only the queue is checked for it.
  if (isProposalRef(parentId)) existing = [];

  const resolution = resolveMaster(input.type, { name: (payload.name ?? payload.title) as string, shortName: payload.shortName as string | undefined, slug: payload.slug as string, websiteUrl: payload.websiteUrl as string | undefined, parentId: parentId || undefined }, existing);
  if (resolution.status !== 'NOT_FOUND') return { ...resolution, status: resolution.status, queued: false };

  // The same master may already be waiting in the queue (under the same parent).
  const kind = MASTER_KIND[input.type];
  const queued = (await deps.list(d1, { status: 'PENDING', limit: 250 })).filter(p => p.kind === kind && p.payload);
  // A sector has no parent to tell two apart, so a similar queued sector is a clash too.
  const clash = queued.find(p => {
    const status = resolveMaster(input.type, { name: (payload.name ?? payload.title) as string, shortName: payload.shortName as string | undefined, slug: payload.slug as string, parentId: parentId || undefined }, [{ id: p.id, name: String(p.payload.name ?? p.payload.title ?? ''), slug: String(p.payload.slug ?? ''), shortName: p.payload.shortName as string | undefined, stateId: p.payload.stateId as string | undefined, organisationId: p.payload.organisationId as string | undefined, departmentId: p.payload.departmentId as string | undefined }]).status;
    return input.type === 'sector' ? status !== 'NOT_FOUND' : status === 'MATCH';
  });
  if (clash) return { status: 'POSSIBLE_MATCH', queued: false, matches: [{ id: clash.id, name: String(clash.payload.name ?? clash.payload.title), slug: String(clash.payload.slug) }], reasons: [`Already waiting as PENDING proposal ${clash.id}.`] };

  if (input.dryRun) return { status: 'NOT_FOUND', queued: false, dryRun: true, payload };
  if ((await deps.countPending(d1, actor.id)) >= MAX_PENDING_PROPOSALS) throw new InvalidProposalError(`Too many pending proposals (${MAX_PENDING_PROPOSALS}). Ask an admin to review the queue first.`);
  const id = `prop_${crypto.randomUUID()}`;
  await deps.insert(d1, { id, kind, recruitmentId: null, summary, payload, baseSnapshot: null, meta: evidence?.length ? { evidence } : null, supersedesId: null, proposedBy: actor.id });
  return { status: 'NOT_FOUND', queued: true, id, kind, payload };
}

// ── Editing an existing master ──────────────────────────────────────────────────────────────────────

export const UPDATABLE_MASTER_TYPES = ['state', 'sector', 'organisation', 'department', 'post'] as const;
export type UpdatableMasterType = (typeof UPDATABLE_MASTER_TYPES)[number];

export const MASTER_UPDATE_KIND: Record<UpdatableMasterType, MasterUpdateKind> = {
  state: 'UPDATE_STATE',
  sector: 'UPDATE_SECTOR',
  organisation: 'UPDATE_ORGANISATION',
  department: 'UPDATE_DEPARTMENT',
  post: 'UPDATE_POST',
};
export const MASTER_TYPE_OF_UPDATE_KIND = Object.fromEntries(Object.entries(MASTER_UPDATE_KIND).map(([t, k]) => [k, t])) as Record<MasterUpdateKind, UpdatableMasterType>;
export const isMasterUpdateKind = (kind: string): kind is MasterUpdateKind => (MASTER_UPDATE_KINDS as readonly string[]).includes(kind);

/**
 * What an update may change: the admin form's fields, except slugs, state codes and an organisation's state.
 * Public URLs, the domicile rules and every recruitment of a body hang on those, so they stay admin-only.
 */
export const MASTER_UPDATE_FIELDS: Record<UpdatableMasterType, readonly string[]> = {
  state: ['name', 'isActive'],
  sector: ['name', 'description', 'icon', 'theme', 'displayOrder', 'isActive'],
  organisation: ['name', 'shortName', 'websiteUrl', 'isActive'],
  department: ['name', 'description', 'organisationId', 'isActive'],
  post: ['title', 'summary', 'payScale', 'defaultMinAge', 'defaultMaxAge', 'defaultQualification', 'sectorId', 'departmentId', 'isActive'],
};

/** Facts read from an official source: each needs an evidence item with a quote. Sectors are NIRNAY's own job families, so none of theirs are. */
export const MASTER_FACT_FIELDS: Record<UpdatableMasterType, readonly string[]> = {
  state: ['name'],
  sector: [],
  organisation: ['name', 'shortName', 'websiteUrl'],
  department: ['name'],
  post: ['title', 'payScale', 'defaultMinAge', 'defaultMaxAge', 'defaultQualification'],
};

export interface MasterUpdateDeps {
  /** The live master's editable fields (inactive ones included), or undefined when there is none. */
  load: (d1: D1Database, type: UpdatableMasterType, id: string) => Promise<Record<string, unknown> | undefined>;
  /** Siblings a rename or a move is matched against. */
  masters: MasterDeps;
  states: (d1: D1Database) => Promise<Array<{ id: string; name: string; code: string; slug: string }>>;
}

export const defaultMasterUpdateDeps: MasterUpdateDeps = {
  load: async (d1, type, id) => {
    if (type === 'state') {
      const s = (await getAllStates(d1, { includeInactive: true })).find(x => x.id === id);
      return s && { name: s.name, code: s.code, slug: s.slug, isActive: s.isActive ?? 1 };
    }
    if (type === 'sector') {
      const s = (await getAllSectors(d1, { includeInactive: true })).find(x => x.id === id);
      return s && { name: s.name, slug: s.slug, description: s.description ?? null, icon: s.icon, theme: s.theme ?? null, displayOrder: s.displayOrder, isActive: s.isActive ?? 1 };
    }
    if (type === 'organisation') {
      const o = (await getAllOrganisations(d1, { includeInactive: true })).find(x => x.id === id);
      return o && { name: o.name, shortName: o.shortName, slug: o.slug, stateId: o.stateId, websiteUrl: o.websiteUrl, isActive: o.isActive };
    }
    if (type === 'department') {
      const d = (await getAllDepartments(d1, { includeInactive: true })).find(x => x.id === id);
      return d && { name: d.name, slug: d.slug, organisationId: d.organisationId, description: d.description, isActive: d.isActive };
    }
    const p = (await getAllCanonicalPosts(d1)).find(x => x.id === id);
    return p && { title: p.title, slug: p.slug, summary: p.summary, payScale: p.payScale, defaultMinAge: p.defaultMinAge, defaultMaxAge: p.defaultMaxAge, defaultQualification: p.defaultQualification, sectorId: p.sectorId, departmentId: p.departmentId, isActive: p.isActive };
  },
  masters: defaultMasterDeps,
  states: async d1 => getAllStates(d1, { includeInactive: true }),
};

export interface MasterUpdateInput {
  type: UpdatableMasterType;
  /** The master's id (resolve_entity / list_entities / get_master). */
  id: string;
  summary: string;
  /** Only the fields that change. */
  changes: unknown;
  evidence?: unknown;
  /** Run every check and return the before/after rows; never queue. */
  dryRun?: boolean;
}

const flag = (v: unknown, field: string) => {
  if (typeof v !== 'boolean') throw new InvalidProposalError(`${field} must be true or false.`);
  return v ? 1 : 0;
};

/** Validate an edit. Unknown or admin-only fields are refused, never ignored. */
export function sanitizeMasterUpdate(type: UpdatableMasterType, raw: unknown): Record<string, unknown> {
  if (!isObj(raw) || Object.keys(raw).length === 0) throw new InvalidProposalError('changes must be a non-empty object.');
  const allowed = MASTER_UPDATE_FIELDS[type];
  const refused = Object.keys(raw).filter(k => !allowed.includes(k));
  if (refused.length) throw new InvalidProposalError(`Field(s) cannot be proposed for a ${type}: ${refused.join(', ')}. Allowed: ${allowed.join(', ')}. Slugs, state codes and an organisation's state stay admin-only.`);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    switch (k) {
      case 'name': out.name = text(v, 'name', type === 'sector' ? 80 : 200); break;
      case 'title': out.title = text(v, 'title', 200); break;
      case 'shortName': out.shortName = text(v, 'shortName', 40); break;
      case 'description': out.description = text(v, 'description', type === 'sector' ? 300 : 1000); break;
      case 'summary': out.summary = text(v, 'summary', 2000); break;
      case 'payScale': out.payScale = v === null ? null : text(v, 'payScale', 200); break;
      case 'websiteUrl': {
        const url = text(v, 'websiteUrl', 500)!;
        let u: URL;
        try { u = new URL(url); } catch { throw new InvalidProposalError('websiteUrl must be a valid URL.'); }
        if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new InvalidProposalError('websiteUrl must be an http(s) URL.');
        out.websiteUrl = url;
        break;
      }
      case 'icon': if (!(String(v) in SECTOR_ICONS)) throw new InvalidProposalError(`icon must be one of: ${Object.keys(SECTOR_ICONS).join(', ')}.`); out.icon = v; break;
      case 'theme': if (!(String(v) in SECTOR_THEMES)) throw new InvalidProposalError(`theme must be one of: ${Object.keys(SECTOR_THEMES).join(', ')}.`); out.theme = v; break;
      case 'displayOrder': if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 999) throw new InvalidProposalError('displayOrder must be an integer from 0 to 999.'); out.displayOrder = v; break;
      case 'isActive': out.isActive = flag(v, 'isActive'); break;
      case 'defaultMinAge': case 'defaultMaxAge': out[k] = age(v, k); break;
      case 'defaultQualification': if (!QUALIFICATIONS.includes(String(v))) throw new InvalidProposalError(`defaultQualification must be one of: ${QUALIFICATIONS.join(', ')}.`); out.defaultQualification = v; break;
      default: out[k] = text(v, k, 100); // organisationId, departmentId, sectorId
    }
  }
  return assertEnglish(out, 'changes');
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Before/after rows for a master edit, against the live record. */
export function masterUpdateDiff(payload: Record<string, unknown>, current: Record<string, unknown> | undefined) {
  return Object.entries(payload).map(([field, after]) => {
    const before = current ? current[field] ?? null : null;
    return { field, before, after, changed: !sameValue(before, after) };
  });
}

/** Fields whose live value moved since the edit was proposed. */
export function masterStaleFields(snapshot: Record<string, unknown> | null, current: Record<string, unknown> | undefined): string[] {
  if (!snapshot || !current) return [];
  return Object.keys(snapshot).filter(f => !sameValue(snapshot[f], current[f]));
}

/**
 * Would the edited master collide with another one? A rename onto an existing name under the same parent (or, for a sector,
 * onto one covering the same field of work) is blocking; any other similarity is a warning for the reviewer.
 * Also checks that a new parent exists.
 */
export async function checkMasterUpdate(
  d1: D1Database,
  type: UpdatableMasterType,
  id: string,
  next: Record<string, unknown>,
  changed: string[],
  deps: MasterUpdateDeps,
): Promise<{ blocking?: string; similar?: MasterResolution }> {
  const m = deps.masters;
  if (changed.includes('organisationId') && !(await m.organisations(d1)).some(o => o.id === next.organisationId)) return { blocking: `organisationId "${next.organisationId}" is not an organisation. Use resolve_entity(organisation).` };
  if (changed.includes('departmentId') && !(await m.departments(d1)).some(x => x.id === next.departmentId)) return { blocking: `departmentId "${next.departmentId}" is not a department. Use resolve_entity(department).` };
  if (changed.includes('sectorId') && !(await m.sectorIds(d1)).includes(next.sectorId as string)) return { blocking: `sectorId "${next.sectorId}" is not an active sector. Use resolve_entity(sector).` };

  if (!['name', 'shortName', 'title', 'websiteUrl', 'organisationId', 'departmentId'].some(f => changed.includes(f))) return {};
  if (type === 'state') {
    const clash = (await deps.states(d1)).find(s => s.id !== id && [s.name, s.code, s.slug].map(norm).includes(norm(next.name)));
    return clash ? { blocking: `Another state or UT is already called "${clash.name}" (${clash.id}).` } : {};
  }
  const existing = (await (type === 'sector' ? m.sectors(d1) : type === 'organisation' ? m.organisations(d1) : type === 'department' ? m.departments(d1) : m.posts(d1))).filter(e => e.id !== id);
  const parentId = (type === 'organisation' ? next.stateId : type === 'department' ? next.organisationId : type === 'post' ? next.departmentId : undefined) as string | undefined;
  // The slug never changes on an edit, so only the names are matched.
  const found = resolveMaster(type, { name: (next.name ?? next.title) as string, shortName: next.shortName as string | undefined, websiteUrl: changed.includes('websiteUrl') ? next.websiteUrl as string : undefined, parentId }, existing);
  if (found.status === 'MATCH') return { blocking: `This would duplicate ${type} "${found.matches[0].name}" (${found.matches[0].id}). Keep one: report it to the admin instead.` };
  if (found.status === 'POSSIBLE_MATCH' && type === 'sector') return { blocking: `A similar sector already exists (${found.matches.map(x => x.name).join(', ')}).` };
  return found.status === 'POSSIBLE_MATCH' ? { similar: found } : {};
}

export type MasterUpdateOutcome = {
  kind: MasterUpdateKind;
  targetId: string;
  changes: ReturnType<typeof masterUpdateDiff>;
  similar?: MasterResolution;
} & ({ queued: false; dryRun: true } | { queued: true; id: string; status: 'PENDING' });

/**
 * Queue an edit of an existing master for admin approval. Only fields that really change are kept; every fact needs a quote.
 * Refused: unknown master, nothing to change, a parent that does not exist, a rename onto another master, an open edit of the same fields.
 */
export async function proposeMasterUpdate(
  d1: D1Database | undefined,
  actor: Actor,
  input: MasterUpdateInput,
  deps: ProposalDeps = defaultProposalDeps,
  mdeps: MasterUpdateDeps = defaultMasterUpdateDeps,
): Promise<MasterUpdateOutcome> {
  if (!d1) throw new Error('D1 binding unavailable.');
  if (!(UPDATABLE_MASTER_TYPES as readonly string[]).includes(input.type)) throw new InvalidProposalError(`type must be one of: ${UPDATABLE_MASTER_TYPES.join(', ')}.`);
  const summary = assertEnglish(text(input.summary, 'summary', 300)!, 'summary');
  const id = text(input.id, 'id', 100)!;
  const current = await mdeps.load(d1, input.type, id);
  if (!current) throw new InvalidProposalError(`There is no ${input.type} with id "${id}". Use resolve_entity or list_entities for its id.`);

  const proposed = sanitizeMasterUpdate(input.type, input.changes);
  const payload = Object.fromEntries(Object.entries(proposed).filter(([f, v]) => !sameValue(current[f], v)));
  const changed = Object.keys(payload);
  if (!changed.length) throw new ProposalBlockedError('NO_CHANGE', `Every proposed value already matches the live ${input.type}. Nothing to change.`);
  const next = { ...current, ...payload };
  if (input.type === 'post' && Number(next.defaultMinAge) > Number(next.defaultMaxAge)) throw new InvalidProposalError('defaultMinAge cannot be above defaultMaxAge.');

  const evidence = sanitizeEvidence(input.evidence, payload);
  const quoted = new Set((evidence ?? []).filter(e => e.snippet).map(e => e.field));
  const unquoted = changed.filter(f => MASTER_FACT_FIELDS[input.type].includes(f) && !quoted.has(f));
  if (unquoted.length) throw new ProposalBlockedError('EVIDENCE_REQUIRED', `Quote the official source (sourceUrl + snippet) for: ${unquoted.join(', ')}.`, { fields: unquoted });

  const check = await checkMasterUpdate(d1, input.type, id, next, changed, mdeps);
  if (check.blocking) throw new ProposalBlockedError('DUPLICATE_MASTER', check.blocking);

  const kind = MASTER_UPDATE_KIND[input.type];
  const open = (await deps.list(d1, { status: 'PENDING', limit: 250 })).filter(p => p.kind === kind && p.meta?.targetId === id);
  const clash = open.filter(p => Object.keys(p.payload).some(f => f in payload));
  if (clash.length) {
    const fields = [...new Set(clash.flatMap(p => Object.keys(p.payload).filter(f => f in payload)))];
    throw new ProposalBlockedError('PENDING_CHANGE_CONFLICT', `Open proposal(s) already change ${fields.join(', ')} on this ${input.type}. Withdraw them first.`, { conflictingIds: clash.map(p => p.id), fields });
  }

  const changes = masterUpdateDiff(payload, current);
  const common = { kind, targetId: id, changes, ...(check.similar ? { similar: check.similar } : {}) };
  if (input.dryRun) return { ...common, queued: false, dryRun: true };
  if ((await deps.countPending(d1, actor.id)) >= MAX_PENDING_PROPOSALS) throw new InvalidProposalError(`Too many pending proposals (${MAX_PENDING_PROPOSALS}). Ask an admin to review the queue first.`);
  const proposalId = `prop_${crypto.randomUUID()}`;
  const meta: Record<string, unknown> = { targetId: id, targetName: current.name ?? current.title };
  if (evidence?.length) meta.evidence = evidence;
  if (check.similar) meta.similar = check.similar;
  await deps.insert(d1, {
    id: proposalId, kind, recruitmentId: null, summary, payload,
    baseSnapshot: Object.fromEntries(changed.map(f => [f, current[f] ?? null])),
    meta, supersedesId: null, proposedBy: actor.id,
  });
  return { ...common, queued: true, id: proposalId, status: 'PENDING' };
}
