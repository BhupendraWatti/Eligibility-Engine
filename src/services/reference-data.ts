/**
 * Read-only reference data for the MCP: list and resolve masters, and describe what a proposal may contain.
 * Resolution is exact-match only (name, slug, short name or code). It never guesses a canonical master.
 */
import { getAllCanonicalPosts, getAllDepartments, getAllOrganisations, getAllSectors, getAllStates } from '../db/queries';
import { MASTER_REF_FIELDS, MASTER_UPDATE_KINDS, CREATE_REQUIRED, JOB_CREATE_REQUIRED, EDITABLE_FIELDS, EVIDENCE_EXEMPT_FIELDS, EVIDENCE_METHODS, MASTER_PROPOSAL_KINDS, PROPOSAL_KINDS, PROPOSAL_STATUSES, QUALIFICATIONS, EXAM_STATUSES, RESULT_STATUSES, GENDERS, RESERVATION_CATEGORIES, LINK_TYPES, DATE_TYPES } from './change-proposals';
import { APPLICATION_STATUSES, LIFECYCLES } from './recruitment-query';
import { MASTER_FACT_FIELDS, MASTER_UPDATE_FIELDS } from './master-proposals';
import { CERTIFICATES, STREAM_ALIASES } from '../data/credentials';
import { TABLE_FORMAT } from '../lib/text-tables';
import { EXAM_KINDS, NATIONAL_TESTS_SECTOR_ID } from './exam-kind';

/** What the MCP may add, for every state and central body. Shown in get_domain_schema and the MCP server instructions. */
export const SCOPE_RULES = [
  'Add only government recruitments that select by a written or computer-based exam. Skip honorary, volunteer, walk-in, interview-only, merit-only and "fill the form and we will call you" posts in every state (refused as NO_EXAM_STAGE). A new recruitment must list its selectionStages (missing: SELECTION_STAGES_REQUIRED).',
  'Eligibility tests and entrance exams are in scope too, as examKind ELIGIBILITY_TEST (UGC NET, CSIR NET, CTET, a state TET or SET) or ENTRANCE_EXAM (JEE Main, NEET UG, CUET). They have NO vacancies: everyone who meets the conditions may sit, and everyone who clears the cutoff (qualifying marks, percentile or All India Rank) qualifies. So send examKind with a quote and leave totalVacancies and vacanciesBreakdown out (a vacancy count on one is refused as VACANCIES_NOT_APPLICABLE; a job without totalVacancies is VACANCIES_REQUIRED). ' +
    `Masters for them: the organisation is the conducting body (the National Testing Agency is organisation org_nta under Central Government; CBSE conducts CTET; a state board or university conducts a state TET or SET), the department is the body the test is held for as the notice names it (e.g. University Grants Commission for UGC NET), the post is the test itself (e.g. "UGC NET"), and the sector is ${NATIONAL_TESTS_SECTOR_ID} (National Eligibility & Entrance Tests). A central test is open to candidates from every state: leave domicileScope out. ` +
    'Selection stages are the exam stages (e.g. "Computer Based Test"); the apply link, dates, admit card, answer key and result links work as for a job. When the notice states no upper age limit send noUpperAgeLimit true and leave maxAgeGeneral out; when it states no minimum age, leave minAge out (none is then checked for a test or entrance exam).',
  'officialLinks must include an APPLY_ONLINE link: the official page where candidates start filling the form. A notice or rulebook PDF is NOTIFICATION_PDF or RULEBOOK, never APPLY_ONLINE. officialLinks replaces the whole list, so an update must keep an existing apply link.',
  'Masters belong to one state: organisation -> department -> post. A post or department with the same name in another state is not a duplicate; queue the new state\'s own chain instead of reusing another state\'s post. Sectors are national and shared by every state: reuse an existing sector whenever the job fits it, and propose a new one only when none does.',
  'Nobody re-checks your work before it goes live: the admin only approves. So verify every proposal yourself, in this order, and stop rather than guess. ' +
    '(1) Find the notice on the recruiting body\'s own official website or a government domain (.gov.in, .nic.in). A job portal, coaching site, news article or social post is only a lead, never a source, and is refused as UNOFFICIAL_SOURCE. ' +
    '(2) Confirm it is genuine and current: the body really exists, the advertisement number, year and dates are on the official page, the notice is not fake, expired, cancelled or superseded, and every link opens (check_links ok=true, or, when it says ok=null, you opened the link yourself). ' +
    '(3) search_recruitments (includeUnpublished) by organisation, post, advertisement number and source URL. If the recruitment already exists, use propose_recruitment_update instead. ' +
    '(4) resolve_entity / list_entities for the sector, organisation, department and post. Reuse every MATCH. On AMBIGUOUS, stop and report: never pick one. On NOT_FOUND, queue the master with propose_master; if propose_master answers POSSIBLE_MATCH (never queued), reuse that master when it is the same body, otherwise stop and report. A master that exists but is wrong (misspelt name, old website, wrong pay scale) is corrected with propose_master_update, never re-created. ' +
    '(5) Read every value from the official notice and quote it as evidence. Leave out any field the notice does not state or you are not sure of. ' +
    '(6) preview_proposal, fix every flag (re-read needsReading / fromImage / handwritten fields), then propose.',
  'Write everything in plain English, for every state: names, summary and every text field. Translate a notice in Hindi, Gujarati or any other language; use the body\'s own English name where it has one. Text in another script is refused (evidence snippets and the advertisement number stay as printed).',
];

export const ENTITY_TYPES = ['state', 'organisation', 'department', 'sector', 'post'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export type Entity = { id: string; name: string; slug: string } & Record<string, unknown>;
export type ResolveResult =
  | { status: 'MATCH'; entity: Entity }
  | { status: 'AMBIGUOUS'; matches: Entity[] }
  | { status: 'NOT_FOUND'; suggestions: Entity[]; next: string };

const entityLoaders: Record<EntityType, (d1: D1Database) => Promise<Entity[]>> = {
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

export async function resolveEntity(d1: D1Database | undefined, type: EntityType, query: string): Promise<ResolveResult> {
  if (!d1) throw new Error('D1 binding unavailable.');
  return resolveFrom(await entityLoaders[type](d1), query);
}

const LIST_LIMIT = 100;

export async function listEntities(d1: D1Database | undefined, type: EntityType, q?: string) {
  if (!d1) throw new Error('D1 binding unavailable.');
  const needle = q ? norm(q) : '';
  const all = (await entityLoaders[type](d1)).filter(e => !needle || aliases(e).some(a => a.includes(needle)));
  return { items: all.slice(0, LIST_LIMIT), total: all.length, truncated: all.length > LIST_LIMIT };
}

/** Allowed values and shapes, generated from the same constants the validators use, so it cannot drift. */
export function getDomainSchema() {
  const spec = (s: unknown) => (typeof s === 'object' && s ? `enum: ${(s as { enum: string[] }).enum.join(' | ')}` : String(s));
  const describe = (fields: Record<string, unknown>) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, spec(v)]));
  return {
    proposalKinds: [...PROPOSAL_KINDS, ...MASTER_PROPOSAL_KINDS, ...MASTER_UPDATE_KINDS],
    proposalStatuses: PROPOSAL_STATUSES,
    updateFields: describe(EDITABLE_FIELDS),
    masterRefFields: describe(MASTER_REF_FIELDS),
    masterRefNote: 'postId and organisationId are required on a new recruitment; an update may move a recruitment to another existing post or organisation (its state follows the organisation).',
    masterUpdateFields: MASTER_UPDATE_FIELDS,
    masterUpdateEvidence: MASTER_FACT_FIELDS,
    masterUpdateNote: 'propose_master_update edits an existing state, sector, organisation, department or post (get_master shows its live values). Send only the fields that change. masterUpdateEvidence lists, per type, the fields that need a quoted official source. Slugs, state codes and an organisation\'s state stay admin-only.',
    createRequired: CREATE_REQUIRED,
    createRequiredForJobs: JOB_CREATE_REQUIRED,
    createRequiredNote: 'totalVacancies is required for a job (examKind RECRUITMENT, the default) and must be left out for an ELIGIBILITY_TEST or ENTRANCE_EXAM.',
    enums: { examKind: EXAM_KINDS, minQualificationLevel: QUALIFICATIONS, examStatus: EXAM_STATUSES, resultStatus: RESULT_STATUSES, genderAllowed: GENDERS, qualificationByCategoryKeys: RESERVATION_CATEGORIES, importantDatesEventType: DATE_TYPES },
    eligibilityNotes: {
      domicileScope: 'Who may apply, always about the recruitment\'s own state. STATE_ONLY: only its domiciles may apply ("Only bona fide residents of the State are eligible to apply."). OPEN_STATE_QUOTA: anyone may apply, but reservation and relaxations are only for its domiciles ("Candidates of other states may apply but will not get the benefit of reservation."). OPEN: candidates from any state may apply ("Candidates from other states may also apply."). Quote that eligibility sentence as evidence; it is classified and a mismatch or unclear quote is refused (DOMICILE_CLAUSE_MISMATCH). A domicile certificate line or the "citizen of India" line is not enough. Leave domicileScope out when the notice does not say: the recruitment then shows "not checked yet". Never send it for a Central recruitment, or for one where an admin set another domicile state (both DOMICILE_SCOPE_INVALID); only an admin can limit a recruitment to a state other than its own. requiresMpDomicile, domicileStateCode and reservationStateCode are retired (FIELD_RETIRED).',
      examKind: 'RECRUITMENT (default): a job with vacancies. ELIGIBILITY_TEST: a test that certifies candidates as eligible, e.g. UGC NET for Assistant Professor/JRF, CSIR NET, CTET, a state TET or SET. ENTRANCE_EXAM: admission by rank or percentile, e.g. JEE Main, NEET UG, CUET. Quote the line that names the test (e.g. "National Eligibility Test for Assistant Professor"). Neither kind has vacancies: leave totalVacancies and vacanciesBreakdown out.',
      noUpperAgeLimit: 'true only when the notice says there is no upper age limit ("There is no upper age limit"). Then leave maxAgeGeneral out; only minAge is checked. If the limit differs by post or paper (UGC NET: JRF up to 30 years, Assistant Professor no limit), send noUpperAgeLimit true and describe the difference in postSpecificRules.',
      qualificationByCategory: 'Only when the notice prescribes a different minimum for a category, e.g. {"ST":"8TH"}. minQualificationLevel stays the general minimum.',
      ageLimits: 'minAge/maxAgeGeneral are COMPLETED years on ageCutoffDate. "Must not have completed 40 years" (40 वर्ष की आयु पूर्ण न की हो) means maxAgeGeneral 39; "not more than 40 years" means 40. Relaxations are years added to maxAgeGeneral: "SC/ST 38 years" against a general 33 is 5 (send maxAgeGeneral in the same proposal). Female relaxation does not stack with category; the engine uses the larger. Leave a relaxation out when the notice does not state it. Leave minAge out when the notice states no minimum age: a job then falls back to 18, an ELIGIBILITY_TEST or ENTRANCE_EXAM checks no minimum (JEE Main has none).',
      additionalSkills: 'Certificates every eligible candidate must hold, as certificate codes (list below). Each entry is one requirement; join alternatives with "|" ("DELED|BELED" = D.El.Ed or B.El.Ed). A degree subject goes in allowedStreams, experience in experienceMonths, CPCT in requiresCpct. A certificate not in the list cannot be proposed: describe it in specialConditionsNotes and report it.',
      allowedStreams: 'Degree subjects in plain English ("Law", "Mathematics"). Known spellings are matched by meaning, e.g. LLB = Law.',
      postSpecificRules: 'Only when one recruitment covers posts with different rules. Store the LEAST strict rule any post accepts in the other fields (lowest qualification, widest age range, lowest height, only certificates every post needs), and write here, in plain English, how each post differs. A candidate who passes is then shown "check the post-wise rules" instead of "eligible".',
      experienceMonths: 'Months of required experience: "two years as an advocate" is 24.',
    },
    textFields: TABLE_FORMAT,
    lifecycles: LIFECYCLES,
    applicationStatuses: APPLICATION_STATUSES,
    evidence: {
      methods: EVIDENCE_METHODS,
      fields: 'field (a key in changes), sourceUrl (http/https), page, section, snippet (<=500 chars, quoted from the source), method (NATIVE text layer, VISION/OCR scanned image), handwritten (true when handwritten on the notice). No confidence score.',
      checks: 'Numbers, dates and the advertisement number must appear in their snippet (else VALUE_NOT_IN_QUOTE). Summaries, enums and yes/no values are flagged for the reviewer to read.',
      required: `MCP proposals need one item with a snippet for every changed field except ${EVIDENCE_EXEMPT_FIELDS.join(', ')} (else EVIDENCE_REQUIRED).`,
    },
    linkTypes: LINK_TYPES,
    certificateCodes: CERTIFICATES.map(c => ({ code: c.code, label: c.label, alsoKnownAs: c.aliases })),
    streamSubjects: STREAM_ALIASES,
    scope: SCOPE_RULES,
    sourceTypeExamples: ['OFFICIAL_NOTIFICATION_PDF', 'GOVT_GAZETTE', 'OFFICIAL_PORTAL'],
    dateFormat: 'ISO YYYY-MM-DD',
    approvalRequired: true,
    note: 'The MCP can only search and propose. An admin approves in /admin/pending-changes.',
  };
}
