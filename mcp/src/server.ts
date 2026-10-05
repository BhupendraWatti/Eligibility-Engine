import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  APPLICATION_STATUSES,
  LIFECYCLES,
  InvalidSearchInputError,
  searchRecruitments,
  type Actor,
  type RecruitmentQueryDeps,
} from '../../src/services/recruitment-query';
import {
  CREATE_ONLY_FIELDS,
  EDITABLE_FIELDS,
  InvalidProposalError,
  PROPOSAL_STATUSES,
  createProposal,
  listProposals,
  type ProposalDeps,
  type ProposalInput,
} from '../../src/services/change-proposals';

export interface ServerContext {
  d1: D1Database | undefined;
  actor: Actor;
  deps?: RecruitmentQueryDeps;
  proposalDeps?: ProposalDeps;
}

const text = z.string().trim().min(1).max(100);

/** A fixed set of business filters. There is deliberately no free-form query field. */
const searchInput = {
  state: z.string().trim().min(2).max(10).optional().describe("State code, e.g. 'MP'"),
  organisation: text.optional().describe('Organisation name, short name or slug (substring)'),
  department: text.optional().describe('Department name or slug (substring)'),
  sector: text.optional().describe('Sector name or slug (substring)'),
  post: text.optional().describe('Canonical post title or slug (substring)'),
  title: text.optional().describe('Recruitment title (substring)'),
  cycleYear: z.number().int().optional(),
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
  const server = new McpServer({ name: 'nirnay-mcp', version: '0.1.0' });

  server.registerTool(
    'search_recruitments',
    {
      title: 'Search recruitments',
      description:
        'Search published NIRNAY government recruitments (hiring cycles, not evergreen posts). READ-only. ' +
        'Returns structured recruitment summaries with dates, vacancies, official links and a source summary.',
      inputSchema: searchInput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      // Minimal audit boundary: who called what, with which filter keys (never values or secrets).
      console.info(JSON.stringify({ evt: 'mcp.tool', tool: 'search_recruitments', actor: ctx.actor.id, mode: ctx.actor.mode, filters: Object.keys(args) }));
      try {
        return result(await searchRecruitments(ctx.d1, ctx.actor, args as never, ctx.deps) as unknown as Record<string, unknown>);
      } catch (error) {
        if (error instanceof InvalidSearchInputError) return result({ error: { code: 'INVALID_INPUT', message: error.message } }, true);
        // Never leak internals (SQL, bindings, stack) to the model.
        console.error('[mcp] search_recruitments failed:', error);
        return result({ error: { code: 'INTERNAL_ERROR', message: 'Recruitment search failed.' } }, true);
      }
    },
  );

  // ── Proposals: the MCP may only queue a change. An admin approves it in /admin/pending-changes. ──────────
  const editable = Object.keys(EDITABLE_FIELDS).join(', ');
  const proposeAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
  const summaryField = z.string().trim().min(1).max(300).describe('One line for the reviewer: what changes and why, ideally citing the official source.');

  const propose = async (tool: string, input: ProposalInput) => {
    console.info(JSON.stringify({ evt: 'mcp.tool', tool, actor: ctx.actor.id, mode: ctx.actor.mode, kind: input.kind, fields: input.changes && typeof input.changes === 'object' ? Object.keys(input.changes) : [] }));
    try {
      const created = await createProposal(ctx.d1, ctx.actor, input, ctx.proposalDeps);
      return result({
        ...created,
        message: 'Proposal queued. Nothing is live until the owner approves it in /admin/pending-changes.',
      });
    } catch (error) {
      if (error instanceof InvalidProposalError) return result({ error: { code: 'INVALID_INPUT', message: error.message } }, true);
      console.error(`[mcp] ${tool} failed:`, error);
      return result({ error: { code: 'INTERNAL_ERROR', message: 'Could not queue the proposal.' } }, true);
    }
  };

  server.registerTool(
    'propose_recruitment_update',
    {
      title: 'Propose an update to a recruitment',
      description:
        'Queue a field-level change to an EXISTING recruitment for owner approval. Does NOT change the live site. ' +
        `Allowed fields in "changes": ${editable}. ` +
        'Dates are ISO YYYY-MM-DD. To move headline dates use applicationStart / applicationEnd / examDate. ' +
        'Array fields (vacanciesBreakdown, importantDates, sources, officialLinks, selectionStages) REPLACE the whole list, so send the full list. ' +
        'Publication status, slug and ids cannot be proposed. Find the recruitmentId with search_recruitments first.',
      inputSchema: {
        recruitmentId: z.string().trim().min(1).max(100).describe('id from search_recruitments'),
        summary: summaryField,
        changes: z.record(z.string(), z.unknown()).describe('Object of field -> new value'),
      },
      annotations: proposeAnnotations,
    },
    async (args) => propose('propose_recruitment_update', { kind: 'UPDATE_RECRUITMENT', recruitmentId: args.recruitmentId, summary: args.summary, changes: args.changes }),
  );

  server.registerTool(
    'propose_new_recruitment',
    {
      title: 'Propose a new recruitment',
      description:
        'Queue a NEW recruitment for owner approval. Does NOT create anything live; the owner decides in /admin whether to save it as a draft or publish it. ' +
        `Required in "changes": title, postId (canonical post id), organisationId, advtNumber, totalVacancies. Optional: ${editable}. ` +
        `Also accepts: ${Object.keys(CREATE_ONLY_FIELDS).join(', ')}. Include official sources and links so the reviewer can verify.`,
      inputSchema: {
        summary: summaryField,
        changes: z.record(z.string(), z.unknown()).describe('Object of field -> value'),
      },
      annotations: proposeAnnotations,
    },
    async (args) => propose('propose_new_recruitment', { kind: 'CREATE_RECRUITMENT', summary: args.summary, changes: args.changes }),
  );

  server.registerTool(
    'list_my_proposals',
    {
      title: 'List my proposals',
      description: 'List proposals this MCP queued and their status (PENDING until the owner decides). READ-only.',
      inputSchema: {
        status: z.enum(PROPOSAL_STATUSES).optional(),
        limit: z.number().int().optional().describe('Default 20, max 50'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      console.info(JSON.stringify({ evt: 'mcp.tool', tool: 'list_my_proposals', actor: ctx.actor.id, mode: ctx.actor.mode, filters: Object.keys(args) }));
      try {
        const rows = await listProposals(ctx.d1, ctx.actor, args, ctx.proposalDeps);
        return result({
          items: rows.map(r => ({
            id: r.id, kind: r.kind, recruitmentId: r.recruitmentId, summary: r.summary, status: r.status,
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

  return server;
}
