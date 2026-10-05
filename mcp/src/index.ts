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

// Above the 40KB proposal payload cap so a full proposal plus evidence fits. Enforced on the bytes actually read.
const MAX_BODY_BYTES = 64 * 1024;

/** Read the body but give up past the cap, whatever Content-Length claims (it can be absent or wrong). */
async function readCapped(request: Request): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  return out;
}

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

    const body = await readCapped(request);
    if (!body) return json(413, { error: 'Request too large.' });
    request = new Request(request, { body });

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
