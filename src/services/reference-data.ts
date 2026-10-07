/**
 * Read-only reference data for the MCP: list and resolve masters, and describe what a proposal may contain.
 * Resolution is exact-match only (name, slug, short name or code). It never guesses a canonical master.
 */
import { getAllCanonicalPosts, getAllDepartments, getAllOrganisations, getAllSectors, getAllStates } from '../db/queries';
import { CREATE_ONLY_FIELDS, CREATE_REQUIRED, EDITABLE_FIELDS, EVIDENCE_EXEMPT_FIELDS, EVIDENCE_METHODS, MASTER_PROPOSAL_KINDS, PROPOSAL_KINDS, PROPOSAL_STATUSES, QUALIFICATIONS, EXAM_STATUSES, RESULT_STATUSES, GENDERS, RESERVATION_CATEGORIES } from './change-proposals';
import { APPLICATION_STATUSES, LIFECYCLES } from './recruitment-query';

export const ENTITY_TYPES = ['state', 'organisation', 'department', 'sector', 'post'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export type Entity = { id: string; name: string; slug: string } & Record<string, unknown>;
export type ResolveResult =
  | { status: 'MATCH'; entity: Entity }
  | { status: 'AMBIGUOUS'; matches: Entity[] }
  | { status: 'NOT_FOUND'; suggestions: Entity[]; next: string };

export type EntityLoader = (d1: D1Database) => Promise<Entity[]>;

export const entityLoaders: Record<EntityType, EntityLoader> = {
  state: async d1 => (await getAllStates(d1)).map(s => ({ id: s.id, name: s.name, slug: s.slug, code: s.code })),
  organisation: async d1 => (await getAllOrganisations(d1)).map(o => ({ id: o.id, name: o.name, slug: o.slug, shortName: o.shortName, stateId: o.stateId })),
  department: async d1 => (await getAllDepartments(d1)).map(d => ({ id: d.id, name: d.name, slug: d.slug, organisationId: d.organisationId })),
  sector: async d1 => (await getAllSectors(d1)).map(s => ({ id: s.id, name: s.name, slug: s.slug })),
  post: async d1 => (await getAllCanonicalPosts(d1)).filter(p => p.isActive !== 0).map(p => ({ id: p.id, name: p.title, slug: p.slug, departmentId: p.departmentId, sectorId: p.sectorId })),
};

const norm = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = (e: Entity) => [e.name, e.slug, e.shortName, e.code].map(norm).filter(Boolean);

export const NOT_FOUND_NEXT =
  'Not in the master data. Do not invent an id. Use propose_master to queue it for admin approval, then retry once approved; propose_new_recruitment refuses unknown posts and organisations.';

/** Exact normalised match: 1 = MATCH, >1 = AMBIGUOUS, 0 = NOT_FOUND (with substring suggestions for a human, never auto-picked). */
export function resolveFrom(entities: Entity[], query: string): ResolveResult {
  const q = norm(query);
  if (!q) throw new Error('query must not be empty.');
  const exact = entities.filter(e => aliases(e).includes(q));
  if (exact.length === 1) return { status: 'MATCH', entity: exact[0] };
  if (exact.length > 1) return { status: 'AMBIGUOUS', matches: exact.slice(0, 10) };
  const suggestions = entities.filter(e => aliases(e).some(a => a.includes(q) || q.includes(a))).slice(0, 5);
  return { status: 'NOT_FOUND', suggestions, next: NOT_FOUND_NEXT };
}

export async function resolveEntity(d1: D1Database | undefined, type: EntityType, query: string, load: EntityLoader = entityLoaders[type]): Promise<ResolveResult> {
  if (!d1) throw new Error('D1 binding unavailable.');
  return resolveFrom(await load(d1), query);
}

const LIST_LIMIT = 100;

export async function listEntities(d1: D1Database | undefined, type: EntityType, q?: string, load: EntityLoader = entityLoaders[type]) {
  if (!d1) throw new Error('D1 binding unavailable.');
  const needle = q ? norm(q) : '';
  const all = (await load(d1)).filter(e => !needle || aliases(e).some(a => a.includes(needle)));
  return { items: all.slice(0, LIST_LIMIT), total: all.length, truncated: all.length > LIST_LIMIT };
}

/** Allowed values and shapes, generated from the same constants the validators use, so it cannot drift. */
export function getDomainSchema() {
  const spec = (s: unknown) => (typeof s === 'object' && s ? `enum: ${(s as { enum: string[] }).enum.join(' | ')}` : String(s));
  const describe = (fields: Record<string, unknown>) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, spec(v)]));
  return {
    proposalKinds: [...PROPOSAL_KINDS, ...MASTER_PROPOSAL_KINDS],
    proposalStatuses: PROPOSAL_STATUSES,
    updateFields: describe(EDITABLE_FIELDS),
    createOnlyFields: describe(CREATE_ONLY_FIELDS),
    createRequired: CREATE_REQUIRED,
    enums: { minQualificationLevel: QUALIFICATIONS, examStatus: EXAM_STATUSES, resultStatus: RESULT_STATUSES, genderAllowed: GENDERS, qualificationByCategoryKeys: RESERVATION_CATEGORIES },
    eligibilityNotes: {
      reservationStateCode: 'Set to the recruiting state code when the notice says reservation / age relaxation is only for that state\'s domiciles (outsiders compete as Unreserved). Leave null for central recruitments or when the notice gives relaxation to all.',
      qualificationByCategory: 'Only when the notice prescribes a different minimum for a category, e.g. {"ST":"8TH"}. minQualificationLevel stays the general minimum.',
      domicileStateCode: 'Set ONLY when domicile is mandatory to apply at all. Not the same as reservationStateCode.',
    },
    lifecycles: LIFECYCLES,
    applicationStatuses: APPLICATION_STATUSES,
    evidence: {
      methods: EVIDENCE_METHODS,
      fields: 'field (a key in changes), sourceUrl (http/https), page, section, snippet (<=500 chars, quoted from the source), method (NATIVE text layer, VISION/OCR scanned image), handwritten (true when handwritten on the notice). No confidence score.',
      checks: 'Numbers, dates and the advertisement number must appear in their snippet (else VALUE_NOT_IN_QUOTE). Summaries, enums and yes/no values are flagged for the reviewer to read.',
      required: `MCP proposals need one item with a snippet for every changed field except ${EVIDENCE_EXEMPT_FIELDS.join(', ')} (else EVIDENCE_REQUIRED).`,
    },
    // Free text in the validators (max 50 chars); these are the values the site uses today.
    linkTypeExamples: ['APPLY_ONLINE', 'NOTIFICATION_PDF', 'SYLLABUS_PDF', 'ADMIT_CARD', 'RESULT'],
    sourceTypeExamples: ['OFFICIAL_NOTIFICATION_PDF', 'GOVT_GAZETTE', 'OFFICIAL_PORTAL'],
    dateFormat: 'ISO YYYY-MM-DD',
    approvalRequired: true,
    note: 'The MCP can only search and propose. An admin approves in /admin/pending-changes.',
  };
}
