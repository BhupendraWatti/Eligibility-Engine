/**
 * NIRNAY MCP Worker: a private AI control plane. POST /mcp is the MCP endpoint; /authorize is the login page
 * claude.ai connectors open; the OAuth library serves discovery, /register and /token. Everything else is 404.
 * AI client -> this Worker (auth) -> NIRNAY services (../../src/services) -> Drizzle -> D1.
 * This folder only READS the website's code; it never changes it, so the site's deploy is unaffected.
 */
import { OAuthProvider, type OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { isStaticToken, parseUsers, personActor, STATIC_TOKEN_ACTOR } from './auth';
import { handleAuthorize, type McpProps } from './login';
import { createMcpServer } from './server';

interface Env {
  DB?: D1Database;
  /** The owner's static bearer token (Claude Code, Claude Desktop). */
  MCP_API_TOKEN?: string;
  /** {"name":"access code"} for people who sign in through a claude.ai connector. */
  MCP_USERS?: string;
  /** OAuth clients, grants and tokens (hashed). */
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
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

const mcpHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (new URL(request.url).pathname !== '/mcp') return json(404, { error: 'Not found.' });
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' }, { allow: 'POST' });

    // A person removed from MCP_USERS loses access at once, even with a token that has not expired.
    const user = (ctx.props as McpProps).user; // set by the OAuth library from the token
    if (user !== undefined && !parseUsers(env.MCP_USERS).has(user)) {
      await request.arrayBuffer().catch(() => undefined);
      return json(401, { error: 'Access revoked.' }, { 'www-authenticate': 'Bearer error="invalid_token"' });
    }

    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      return json(413, { error: 'Request too large.' });
    }
    const body = await readCapped(request);
    if (!body) return json(413, { error: 'Request too large.' });
    request = new Request(request, { body });

    // Stateless: a fresh server + transport per request, JSON responses (no SSE session state).
    const actor = user === undefined ? STATIC_TOKEN_ACTOR : personActor(user);
    const server = createMcpServer({ d1: env.DB, actor });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      return await transport.handleRequest(request);
    } finally {
      await server.close();
    }
  },
};

const loginHandler = {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    if (new URL(request.url).pathname === '/authorize') return handleAuthorize(request, env);
    return json(404, { error: 'Not found.' });
  },
};

/** The OAuth resource is this Worker's own /mcp URL (workers.dev in production, 127.0.0.1 under wrangler dev). */
const providers = new Map<string, OAuthProvider<Env>>();
function providerFor(origin: string): OAuthProvider<Env> {
  let provider = providers.get(origin);
  if (!provider) {
    const resource = `${origin}/mcp`;
    provider = new OAuthProvider<Env>({
      apiRoute: '/mcp',
      apiHandler: mcpHandler,
      defaultHandler: loginHandler,
      authorizeEndpoint: '/authorize',
      tokenEndpoint: '/token',
      clientRegistrationEndpoint: '/register',
      clientIdMetadataDocumentEnabled: true,
      scopesSupported: ['mcp', 'offline_access'],
      requiredScopes: ['mcp'],
      resourceMetadata: { resource, resource_name: 'NIRNAY MCP' },
      // The owner's existing static token keeps working alongside OAuth.
      resolveExternalToken: async ({ token, env }) =>
        (await isStaticToken(token, env.MCP_API_TOKEN)) ? { props: {} satisfies McpProps, audience: resource } : null,
    });
    providers.set(origin, provider);
  }
  return provider;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return providerFor(new URL(request.url).origin).fetch(request, env, ctx);
  },
};
