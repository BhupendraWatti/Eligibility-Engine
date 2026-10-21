import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  APPLICATION_STATUSES,
  LIFECYCLES,
  InvalidSearchInputError,
  searchRecruitments,
  type Actor,
} from '../../src/services/recruitment-query';
import {
  EDITABLE_FIELDS,
  EVIDENCE_EXEMPT_FIELDS,
  InvalidProposalError,
  MASTER_REF_FIELDS,
  PROPOSAL_STATUSES,
  ProposalBlockedError,
  createProposal,
  getProposal,
  listProposals,
  previewProposal,
  readRecruitmentEligibility,
  withdrawProposal,
  type ProposalInput,
} from '../../src/services/change-proposals';

import {
  MASTER_FACT_FIELDS,
  MASTER_TYPES,
  MASTER_UPDATE_FIELDS,
  UPDATABLE_MASTER_TYPES,
  defaultMasterUpdateDeps,
  proposeMaster,
  proposeMasterUpdate,
} from '../../src/services/master-proposals';
import { SECTOR_ICONS, SECTOR_THEMES } from '../../src/services/sector-theme';
import { checkLink } from './links';
import { TABLE_FORMAT } from '../../src/lib/text-tables';
import { ENTITY_TYPES, SCOPE_RULES, getDomainSchema, listEntities, resolveEntity } from '../../src/services/reference-data';

export interface ServerContext {
  d1: D1Database | undefined;
  actor: Actor;
}

const text = z.string().trim().min(1).max(100);

/** A fixed set of business filters. There is deliberately no free-form query field. */
const searchInput = {
  state: z.string().trim().min(2).max(10).optional().describe("State or UT code, e.g. 'MP', 'MH', 'UP', 'DL' (any Indian state/UT, or 'IN' for central)"),
  organisation: text.optional().describe('Organisation name, short name or slug (substring)'),
  department: text.optional().describe('Department name or slug (substring)'),
  sector: text.optional().describe('Sector name or slug (substring)'),
  post: text.optional().describe('Canonical post title or slug (substring)'),
  title: text.optional().describe('Recruitment title (substring)'),
  cycleYear: z.number().int().optional(),
  advtNumber: text.optional().describe('Advertisement number (substring, ignores spaces and punctuation)'),
  sourceUrl: z.string().trim().min(1).max(1000).optional().describe('An official source or link URL already recorded on the recruitment'),
  includeUnpublished: z.boolean().optional().describe('Also search drafts and pending-verification records (use before creating, to avoid duplicates)'),
  lifecycle: z.enum(LIFECYCLES as [string, ...string[]]).optional().describe('Canonical lifecycle state'),
  applicationStatus: z.enum(APPLICATION_STATUSES).optional(),
  limit: z.number().int().optional().describe('Page size, default 20, max 50'),
  cursor: z.string().max(200).optional().describe('nextCursor from a previous result'),
};

const result = (payload: Record<string, unknown>, isError = false) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  structuredContent: payload,
  isError,
});

export function createMcpServer(ctx: ServerContext): McpServer {
  const server = new McpServer({ name: 'nirnay-mcp', version: '0.1.0' }, { instructions: SCOPE_RULES.join('\n') });

  server.registerTool(
    'search_recruitments',
    {
      title: 'Search recruitments',
      description:
        'Search NIRNAY government recruitments (hiring cycles, not evergreen posts). READ-only. Drafts and pending-verification records are included by default for this authenticated MCP (pass includeUnpublished=false for published only); the public website never sees them. ' +
        'Returns structured recruitment summaries with dates, vacancies, official links and a source summary.',
      inputSchema: searchInput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      // Minimal audit boundary: who called what, with which filter keys (never values or secrets).
      console.info(JSON.stringify({ evt: 'mcp.tool', tool: 'search_recruitments', actor: ctx.actor.id, mode: ctx.actor.mode, filters: Object.keys(args) }));
      try {
        return result(await searchRecruitments(ctx.d1, args as never) as unknown as Record<string, unknown>);
      } catch (error) {
        if (error instanceof InvalidSearchInputError) return result({ error: { code: 'INVALID_INPUT', message: error.message } }, true);
        // Never leak internals (SQL, bindings, stack) to the model.
        console.error('[mcp] search_recruitments failed:', error);
        return result({ error: { code: 'INTERNAL_ERROR', message: 'Recruitment search failed.' } }, true);
      }
    },
  );

  server.registerTool(
    'get_recruitment_eligibility',
    {
      title: 'Read the eligibility rules of a recruitment',
      description:
        'READ-only. Every eligibility field the engine uses for one recruitment (age, relaxations, qualification, streams, certificates, who may apply, physical standards, post-wise rules), ' +
        'plus "unchecked": fields still empty or unverified. An empty requirement is not checked at all, so a candidate passes it. ' +
        'Read this before proposing an eligibility update, and compare every field with the official notice.',
      inputSchema: { recruitmentId: z.string().trim().min(1).max(100).describe('id from search_recruitments') },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      console.info(JSON.stringify({ evt: 'mcp.tool', tool: 'get_recruitment_eligibility', actor: ctx.actor.id, mode: ctx.actor.mode }));
      try {
        return result(await readRecruitmentEligibility(ctx.d1, args.recruitmentId) as unknown as Record<string, unknown>);
      } catch (error) {
        if (error instanceof InvalidProposalError) return result({ error: { code: 'NOT_FOUND', message: error.message } }, true);
        console.error('[mcp] get_recruitment_eligibility failed:', error);
        return result({ error: { code: 'INTERNAL_ERROR', message: 'Could not read the eligibility rules.' } }, true);
      }
    },
  );

  // ── Proposals: the MCP may only queue a change. An admin approves it in /admin/pending-changes. ──────────
  const editable = Object.keys(EDITABLE_FIELDS).join(', ');
  const proposeAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
  const summaryField = z.string().trim().min(1).max(300).describe('One line for the reviewer: what changes and why, ideally citing the official source.');

  const evidenceField = z.array(z.record(z.string(), z.unknown())).optional().describe(
    `REQUIRED for every changed field except ${EVIDENCE_EXEMPT_FIELDS.join(', ')} (otherwise refused as EVIDENCE_REQUIRED): one item per field {field, sourceUrl, page, section, snippet, method: NATIVE|OCR|VISION, handwritten?}. ` +
    'snippet is the exact wording copied from the official notice, corrigendum or portal (<=500 chars), not a paraphrase. method: NATIVE = copied from a text layer, VISION/OCR = read from a scanned image. ' +
    'Set handwritten: true when the value is handwritten on the notice. Do not send a confidence score: the reviewer sees mechanical checks instead. ' +
    'Numbers, dates and the advertisement number must appear in their snippet, or the proposal is refused as VALUE_NOT_IN_QUOTE (a total may instead equal the sum of vacanciesBreakdown rows). ' +
    'Never invent or estimate values: leave a field out if the official source does not state it.',
  );

  /** Run a proposal-service call and map its errors to stable codes. Internals are never leaked. */
  const guarded = async (tool: string, run: () => Promise<Record<string, unknown>>, failure: string) => {
    try {
      return result(await run());
    } catch (error) {
      if (error instanceof ProposalBlockedError) return result({ error: { code: error.code, message: error.message, ...error.details } }, true);
      if (error instanceof InvalidProposalError) return result({ error: { code: 'INVALID_INPUT', message: error.message } }, true);
      console.error(`[mcp] ${tool} failed:`, error);
      return result({ error: { code: 'INTERNAL_ERROR', message: failure } }, true);
    }
  };

  const propose = async (tool: string, input: ProposalInput) => {
    console.info(JSON.stringify({ evt: 'mcp.tool', tool, actor: ctx.actor.id, mode: ctx.actor.mode, kind: input.kind, fields: input.changes && typeof input.changes === 'object' ? Object.keys(input.changes) : [] }));
    return guarded(tool, async () => ({
      ...(await createProposal(ctx.d1, ctx.actor, input)),
      message: 'Proposal queued. Nothing is live until the owner approves it in /admin/pending-changes.',
    }), 'Could not queue the proposal.');
  };

  server.registerTool(
    'propose_recruitment_update',
    {
      title: 'Propose an update to a recruitment',
      description:
        'Queue a field-level change to an EXISTING recruitment for owner approval. Does NOT change the live site. ' +
        'Covers every tab of the admin editor: Basic (title, advtNumber, cycleYear, totalVacancies, shortSummary, overviewMarkdown, examStatus, resultStatus), Vacancy (vacanciesBreakdown, payScaleOverride, salaryDetailsMarkdown, cadreClassification), ' +
        'Eligibility (age, relaxations, qualification, domicileScope = who may apply: STATE_ONLY / OPEN / OPEN_STATE_QUOTA, see get_domain_schema eligibilityNotes; physical standards), Dates (applicationStart/End, examDate, importantDates for notification, correction window, admit card, result), Sources (sources, officialLinks) and SEO (seoTitle, seoDescription). ' +
        'SEO is filled automatically from the facts while it is empty or still the generated text (a state job targets "{State} govt jobs" / "{State} govt job vacancy" first, a central one "central government jobs", both then "government jobs {year}"); send seoTitle/seoDescription only to override with your own plain-English text. ' +
        `Allowed fields in "changes": ${editable}. ` +
        'Use only official sources (the recruiting body notice, corrigendum, gazette or portal), never news or coaching sites. Write every text field in plain, simple English, translating notices in Hindi, Gujarati or any other language (text in another script is refused; evidence snippets and advtNumber stay as printed): plain factual statements taken from the notice, no promotional tone, no guesses. ' +
        `${TABLE_FORMAT} A broken table is refused. ` +
        'Dates are ISO YYYY-MM-DD. To move headline dates use applicationStart / applicationEnd / examDate. ' +
        'Array fields (vacanciesBreakdown, importantDates, sources, officialLinks, selectionStages) REPLACE the whole list, so send the full list. ' +
        'To move the recruitment to another canonical post or recruiting organisation, send postId / organisationId (an existing id from resolve_entity, or a pending propose_master id); its state follows the organisation. ' +
        'Publication status, featured, search indexing and slug stay admin-only. Find the recruitmentId with search_recruitments first. ' +
        'Returns PENDING_CHANGE_CONFLICT if an open proposal already changes the same fields (withdraw it first). Call get_domain_schema for exact formats.',
      inputSchema: {
        recruitmentId: z.string().trim().min(1).max(100).describe('id from search_recruitments'),
        summary: summaryField,
        changes: z.record(z.string(), z.unknown()).describe('Object of field -> new value'),
        evidence: evidenceField,
      },
      annotations: proposeAnnotations,
    },
    async (args) => propose('propose_recruitment_update', { kind: 'UPDATE_RECRUITMENT', recruitmentId: args.recruitmentId, summary: args.summary, changes: args.changes, evidence: args.evidence }),
  );

  server.registerTool(
    'propose_new_recruitment',
    {
      title: 'Propose a new recruitment',
      description:
        'Queue a NEW recruitment for owner approval. Does NOT create anything live; the owner decides in /admin whether to save it as a draft or publish it. ' +
        `Required in "changes": title, postId (canonical post id), organisationId, totalVacancies. advtNumber is optional. Optional: ${editable}. ` +
        `Also accepts: ${Object.keys(MASTER_REF_FIELDS).join(', ')}. Include official sources and links so the reviewer can verify. ` +
        `${TABLE_FORMAT} A broken table is refused. ` +
        'Leave out seoTitle and seoDescription: they are written for you from the title, state, vacancies, qualification and last date, so a state job reaches people searching for jobs in that state and also shows for all-India "government jobs {year}" searches. ' +
        'postId and organisationId must come from resolve_entity (never guess; an unknown post is refused as UNKNOWN_POST). ' +
        'If the post or organisation is missing, queue it with propose_master in the same run and pass the returned proposal id (prop_...) instead: the owner approves the masters first, then this recruitment. ' +
        'If the official notice states no advertisement number, omit advtNumber (or send null): it is stored as NULL and shown as "Not stated". Never put a letter, memo or reference number in its place. ' +
        'Only recruitments selected by a written or computer-based exam (selectionStages must be given, else SELECTION_STAGES_REQUIRED, and must show the exam, else NO_EXAM_STAGE); honorary, volunteer, walk-in, interview-only and merit-only posts are out of scope. ' +
        'officialLinks must include an APPLY_ONLINE link to the page where candidates fill the form, not a PDF (else APPLY_LINK_REQUIRED / INVALID_LINK). ' +
        'Every source and evidence sourceUrl must be on a government domain (.gov.in, .nic.in, .ac.in ...) or the organisation\'s own website, else UNOFFICIAL_SOURCE. ' +
        'A CONFIRMED_DUPLICATE is refused (same advt number, source URL, or same organisation with a near-identical name in an overlapping apply window or the same vacancies and last date); to add its new source, propose_recruitment_update on the matched record. A possible duplicate is queued with a warning for the reviewer.',
      inputSchema: {
        summary: summaryField,
        changes: z.record(z.string(), z.unknown()).describe('Object of field -> value'),
        evidence: evidenceField,
      },
      annotations: proposeAnnotations,
    },
    async (args) => propose('propose_new_recruitment', { kind: 'CREATE_RECRUITMENT', summary: args.summary, changes: args.changes, evidence: args.evidence }),
  );

  server.registerTool(
    'propose_master',
    {
      title: 'Propose a missing master (sector, organisation, department or post)',
      description:
        'Resolve first, then queue a request to add a missing canonical master for owner approval. Returns MATCH (reuse entity.id), POSSIBLE_MATCH (a human decides) or NOT_FOUND. ' +
        'Only NOT_FOUND queues a proposal; nothing is created until an admin approves it in /admin/pending-changes, after which resolve_entity finds it. ' +
        'An organisation needs an existing stateId (use resolve_entity). The organisationId of a department, and the departmentId and sectorId of a post, may be an existing id OR the proposal id (prop_...) this tool returned for a parent queued in the same run, ' +
        'so sector -> organisation -> department -> post -> propose_new_recruitment can all be queued at once; the owner approves them parent first. ' +
        'A sector is a national job family shown as a homepage card (e.g. "Police, Defence & Prisons", "Teaching & Education"). Propose one only after list_entities(sector) shows that no existing sector fits the job; a sector sharing half its words with an existing one is POSSIBLE_MATCH and is never queued: reuse that sector. ' +
        `fields: sector {name, description (max 300 chars), icon (${Object.keys(SECTOR_ICONS).join('|')}), theme (${Object.keys(SECTOR_THEMES).join('|')})}; organisation {stateId, name, shortName, websiteUrl}; department {organisationId, name, description?}; post {departmentId, sectorId, title, summary?, payScale?, defaultMinAge?, defaultMaxAge?, defaultQualification?}. ` +
        'Names, descriptions and the summary must be in English (use the body\'s English name, or translate it). Masters belong to one state: the same post name in another state is not a duplicate, so queue the new state\'s own chain. ' +
        'Set dryRun=true to resolve without queuing. Include evidence (sourceUrl of the official site) for name and websiteUrl.',
      inputSchema: {
        type: z.enum(MASTER_TYPES),
        summary: summaryField,
        fields: z.record(z.string(), z.unknown()).describe('Master fields (see description)'),
        evidence: evidenceField,
        dryRun: z.boolean().optional().describe('Only resolve; never queue'),
      },
      annotations: proposeAnnotations,
    },
    async (args) => {
      console.info(JSON.stringify({ evt: 'mcp.tool', tool: 'propose_master', actor: ctx.actor.id, mode: ctx.actor.mode, type: args.type, dryRun: args.dryRun === true }));
      return guarded('propose_master', async () => {
        const out = await proposeMaster(ctx.d1, ctx.actor, args);
        return { ...out, ...(out.status === 'NOT_FOUND' && out.queued ? { message: 'Master proposal queued. Nothing is live until the owner approves it in /admin/pending-changes.' } : {}) } as Record<string, unknown>;
      }, 'Could not process the master proposal.');
    },
  );

  const fieldList = UPDATABLE_MASTER_TYPES.map(t => `${t} {${MASTER_UPDATE_FIELDS[t].join(', ')}}`).join('; ');
  const factList = UPDATABLE_MASTER_TYPES.filter(t => MASTER_FACT_FIELDS[t].length).map(t => `${t}: ${MASTER_FACT_FIELDS[t].join(', ')}`).join('; ');

  server.registerTool(
    'get_master',
    {
      title: 'Read one master record',
      description: 'READ-only. The live, editable values of one existing state, sector, organisation, department or post (inactive ones included). Read it before propose_master_update.',
      inputSchema: { type: z.enum(UPDATABLE_MASTER_TYPES), id: z.string().trim().min(1).max(100).describe('id from resolve_entity or list_entities') },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      console.info(JSON.stringify({ evt: 'mcp.tool', tool: 'get_master', actor: ctx.actor.id, mode: ctx.actor.mode, type: args.type }));
      if (!ctx.d1) return result({ error: { code: 'INTERNAL_ERROR', message: 'Database unavailable.' } }, true);
      try {
        const record = await defaultMasterUpdateDeps.load(ctx.d1, args.type, args.id);
        if (!record) return result({ error: { code: 'NOT_FOUND', message: `There is no ${args.type} with id "${args.id}". Use resolve_entity or list_entities.` } }, true);
        return result({ type: args.type, id: args.id, ...record, editableFields: MASTER_UPDATE_FIELDS[args.type] });
      } catch (error) {
        console.error('[mcp] get_master failed:', error);
        return result({ error: { code: 'INTERNAL_ERROR', message: 'Could not read the master.' } }, true);
      }
    },
  );

  server.registerTool(
    'propose_master_update',
    {
      title: 'Propose an edit to an existing master (state, sector, organisation, department or post)',
      description:
        'Queue a correction to an EXISTING master for owner approval, the same edits an admin makes by hand in Master Records. Does NOT change the live site. ' +
        'Read the live values with get_master first and send only the fields that change (unchanged values are dropped; nothing left is refused as NO_CHANGE). ' +
        `Editable fields: ${fieldList}. isActive is true/false (false hides the master). Slugs, state codes and an organisation's state stay admin-only. ` +
        `Evidence with a snippet quoted from the official website or notice is REQUIRED for ${factList} (else EVIDENCE_REQUIRED). ` +
        'A new organisationId / departmentId / sectorId must be an existing master (resolve_entity). A rename onto another master under the same parent, or a sector onto one covering the same work, is refused as DUPLICATE_MASTER; ' +
        'an open edit of the same fields is PENDING_CHANGE_CONFLICT (withdraw it first). Names in plain English. Set dryRun=true to see the before/after rows without queuing. ' +
        'To fix a recruitment itself use propose_recruitment_update; to add a missing master use propose_master.',
      inputSchema: {
        type: z.enum(UPDATABLE_MASTER_TYPES),
        id: z.string().trim().min(1).max(100).describe('id of the master to edit (resolve_entity / list_entities)'),
        summary: summaryField,
        changes: z.record(z.string(), z.unknown()).describe('Object of field -> new value (only the fields that change)'),
        evidence: evidenceField,
        dryRun: z.boolean().optional().describe('Run every check and return the before/after rows; never queue'),
      },
      annotations: proposeAnnotations,
    },
    async (args) => {
      console.info(JSON.stringify({ evt: 'mcp.tool', tool: 'propose_master_update', actor: ctx.actor.id, mode: ctx.actor.mode, type: args.type, fields: Object.keys(args.changes ?? {}), dryRun: args.dryRun === true }));
      return guarded('propose_master_update', async () => {
        const out = await proposeMasterUpdate(ctx.d1, ctx.actor, args);
        return { ...out, ...(out.queued ? { message: 'Edit queued. Nothing is live until the owner approves it in /admin/pending-changes.' } : {}) } as Record<string, unknown>;
      }, 'Could not process the master edit.');
    },
  );

  server.registerTool(
    'preview_proposal',
    {
      title: 'Preview a proposal (dry run)',
      description:
        'Run every proposal check WITHOUT queuing anything or using a pending slot. Same input as the propose tools plus kind. ' +
        'Returns action (NEW, NEW_POSSIBLE_DUPLICATE, UPDATE, or the blocking code CONFIRMED_DUPLICATE / PENDING_CHANGE_CONFLICT / UNKNOWN_POST / UNKNOWN_ORGANISATION / UNOFFICIAL_SOURCE / EVIDENCE_REQUIRED / VALUE_NOT_IN_QUOTE / SELECTION_STAGES_REQUIRED / NO_EXAM_STAGE / APPLY_LINK_REQUIRED / INVALID_LINK / FIELD_RETIRED / DOMICILE_SCOPE_INVALID / DOMICILE_CLAUSE_MISMATCH) and checks (fields to re-read: needsReading, fromImage, handwritten; domicileFlag when the domicile clause was accepted but needs the admin to read it), ' +
        'a before/after row per field and approval. Always preview before proposing.',
      inputSchema: {
        kind: z.enum(['CREATE_RECRUITMENT', 'UPDATE_RECRUITMENT']),
        recruitmentId: z.string().trim().min(1).max(100).optional().describe('Required for UPDATE_RECRUITMENT'),
        summary: summaryField,
        changes: z.record(z.string(), z.unknown()),
        evidence: evidenceField,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      console.info(JSON.stringify({ evt: 'mcp.tool', tool: 'preview_proposal', actor: ctx.actor.id, mode: ctx.actor.mode, kind: args.kind }));
      try {
        return result({ ...(await previewProposal(ctx.d1, ctx.actor, args as ProposalInput)) });
      } catch (error) {
        if (error instanceof ProposalBlockedError) return result({ action: error.code, message: error.message, ...error.details });
        if (error instanceof InvalidProposalError) return result({ error: { code: 'INVALID_INPUT', message: error.message } }, true);
        console.error('[mcp] preview_proposal failed:', error);
        return result({ error: { code: 'INTERNAL_ERROR', message: 'Could not preview the proposal.' } }, true);
      }
    },
  );

  server.registerTool(
    'check_links',
    {
      title: 'Check official links',
      description: 'Check up to 6 URLs are reachable (HTTP status and content type). READ-only. Run before citing a source; a dead link (ok=false) must not be proposed. ok=null means the checker could not reach the site (many gov.in sites block it): open the link yourself and cite it only if it opens.',
      // Workers open at most 6 connections at once; more would queue while their timeout runs and fail as false timeouts.
      inputSchema: { urls: z.array(z.string().max(1000)).min(1).max(6) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args) => {
      console.info(JSON.stringify({ evt: 'mcp.tool', tool: 'check_links', actor: ctx.actor.id, mode: ctx.actor.mode, count: args.urls.length }));
      return result({ items: await Promise.all(args.urls.map(u => checkLink(u))) });
    },
  );

  server.registerTool(
    'list_my_proposals',
    {
      title: 'List my proposals',
      description: 'List proposals this MCP queued and their status (PENDING until the owner decides; WITHDRAWN if you took it back). Filter status=PENDING for the open queue. READ-only.',
      inputSchema: {
        status: z.enum(PROPOSAL_STATUSES).optional(),
        limit: z.number().int().optional().describe('Default 20, max 50'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      console.info(JSON.stringify({ evt: 'mcp.tool', tool: 'list_my_proposals', actor: ctx.actor.id, mode: ctx.actor.mode, filters: Object.keys(args) }));
      try {
        const rows = await listProposals(ctx.d1, ctx.actor, args);
        return result({
          items: rows.map(r => ({
            id: r.id, kind: r.kind, recruitmentId: r.recruitmentId, summary: r.summary, status: r.status, supersedesId: r.supersedesId,
            createdAt: r.createdAt.toISOString(), decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null, decisionNote: r.decisionNote,
          })),
        });
      } catch (error) {
        if (error instanceof InvalidProposalError) return result({ error: { code: 'INVALID_INPUT', message: error.message } }, true);
        console.error('[mcp] list_my_proposals failed:', error);
        return result({ error: { code: 'INTERNAL_ERROR', message: 'Could not list proposals.' } }, true);
      }
    },
  );

  const read = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const entityType = z.enum(ENTITY_TYPES);
  const audit = (tool: string, args: object) => console.info(JSON.stringify({ evt: 'mcp.tool', tool, actor: ctx.actor.id, mode: ctx.actor.mode, filters: Object.keys(args) }));

  server.registerTool(
    'resolve_entity',
    {
      title: 'Resolve a master entity',
      description:
        'Look up a state, organisation, department, sector or canonical post by exact name, slug, short name or code. READ-only. ' +
        'Returns status MATCH (use entity.id), AMBIGUOUS (several exact matches: stop and report, never pick) or NOT_FOUND (never invent an id: queue the missing master with propose_master and use the returned proposal id; suggestions are only hints).',
      inputSchema: { type: entityType, query: text },
      annotations: read,
    },
    async (args) => {
      audit('resolve_entity', args);
      try {
        return result(await resolveEntity(ctx.d1, args.type, args.query) as unknown as Record<string, unknown>);
      } catch (error) {
        console.error('[mcp] resolve_entity failed:', error);
        return result({ error: { code: 'INTERNAL_ERROR', message: 'Could not resolve the entity.' } }, true);
      }
    },
  );

  server.registerTool(
    'list_entities',
    {
      title: 'List master entities',
      description: 'List active states, organisations, departments, sectors or canonical posts, optionally filtered by a substring. READ-only. Max 100 items; narrow with q.',
      inputSchema: { type: entityType, q: text.optional().describe('Substring of name, slug, short name or code') },
      annotations: read,
    },
    async (args) => {
      audit('list_entities', args);
      try {
        return result(await listEntities(ctx.d1, args.type, args.q) as unknown as Record<string, unknown>);
      } catch (error) {
        console.error('[mcp] list_entities failed:', error);
        return result({ error: { code: 'INTERNAL_ERROR', message: 'Could not list entities.' } }, true);
      }
    },
  );

  server.registerTool(
    'get_domain_schema',
    {
      title: 'Get proposal schema and allowed values',
      description: 'Allowed fields, formats, enums, lifecycle values and evidence format for proposals. READ-only. Call once before proposing instead of reading source code.',
      inputSchema: {},
      annotations: read,
    },
    async () => {
      audit('get_domain_schema', {});
      return result(getDomainSchema() as unknown as Record<string, unknown>);
    },
  );

  server.registerTool(
    'get_proposal',
    {
      title: 'Get one of my proposals',
      description: 'Full detail of a proposal this MCP queued: payload, evidence, duplicate warning, status and decision. READ-only.',
      inputSchema: { id: z.string().trim().min(1).max(100) },
      annotations: read,
    },
    async (args) => {
      audit('get_proposal', args);
      return guarded('get_proposal', async () => {
        const r = await getProposal(ctx.d1, ctx.actor, args.id);
        return { ...r, createdAt: r.createdAt.toISOString(), decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null };
      }, 'Could not load the proposal.');
    },
  );

  server.registerTool(
    'withdraw_proposal',
    {
      title: 'Withdraw a proposal',
      description:
        'Take back one of your own PENDING proposals (for example it was wrong). Status becomes WITHDRAWN; the record stays and is never edited. ' +
        'To correct a proposal, withdraw it, then propose the corrected version.',
      inputSchema: { id: z.string().trim().min(1).max(100) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      audit('withdraw_proposal', args);
      return guarded('withdraw_proposal', async () => ({ ...(await withdrawProposal(ctx.d1, ctx.actor, args.id)), message: 'Proposal withdrawn.' }), 'Could not withdraw the proposal.');
    },
  );

  return server;
}
