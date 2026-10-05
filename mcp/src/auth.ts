/**
 * MCP authentication boundary. The MCP is private: every request needs the MCP_API_TOKEN bearer
 * secret. Fail-closed: if the secret is not configured the endpoint refuses to serve (503).
 * Pure functions (no Astro / cloudflare:workers imports) so they can be tested under tsx.
 */
import type { Actor } from '../../src/services/recruitment-query';

export const MIN_TOKEN_LENGTH = 24;

export type AuthResult = { ok: true; actor: Actor } | { ok: false; status: 401 | 503; message: string };

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

/** Constant-time comparison of two secrets (compares fixed-length digests). */
export async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(provided), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function authenticateMcpRequest(
  request: Request,
  configuredToken: string | undefined,
): Promise<AuthResult> {
  if (!configuredToken || configuredToken.length < MIN_TOKEN_LENGTH) {
    return { ok: false, status: 503, message: 'MCP endpoint is not configured.' };
  }
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match || !(await secretsMatch(match[1], configuredToken))) {
    return { ok: false, status: 401, message: 'Unauthorized.' };
  }
  // Single shared token today; per-client tokens would yield distinct actor ids here.
  // PROPOSE = read + queue change proposals. It can never write live data; an admin approves in /admin.
  return { ok: true, actor: { id: 'mcp-client', mode: 'PROPOSE' } };
}
