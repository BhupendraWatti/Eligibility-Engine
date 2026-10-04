/**
 * NIRNAY MCP Worker: a private AI control plane. Only POST /mcp; everything else is 404/405.
 * AI client -> this Worker (auth) -> NIRNAY services (../../src/services) -> Drizzle -> D1.
 * This folder only READS the website's code; it never changes it, so the site's deploy is unaffected.
 */
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authenticateMcpRequest } from './auth';
import { createMcpServer } from './server';

interface Env {
  DB?: D1Database;
  MCP_API_TOKEN?: string;
}

const MAX_BODY_BYTES = 16 * 1024;

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== '/mcp') return json(404, { error: 'Not found.' });
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' }, { allow: 'POST' });

    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      return json(413, { error: 'Request too large.' });
    }

    const auth = await authenticateMcpRequest(request, env.MCP_API_TOKEN);
    if (!auth.ok) {
      // Drain the (size-capped) body so the connection stays reusable; unread bodies break keep-alive in workerd.
      await request.arrayBuffer().catch(() => undefined);
      return json(auth.status, { error: auth.message }, auth.status === 401 ? { 'www-authenticate': 'Bearer' } : {});
    }

    // Stateless: a fresh server + transport per request, JSON responses (no SSE session state).
    const server = createMcpServer({ d1: env.DB, actor: auth.actor });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request);
    } finally {
      await server.close();
    }
  },
};
