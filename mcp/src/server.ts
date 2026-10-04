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

export interface ServerContext {
  d1: D1Database | undefined;
  actor: Actor;
  deps?: RecruitmentQueryDeps;
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

  return server;
}
