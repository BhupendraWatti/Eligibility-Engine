/**
 * MCP authentication boundary. The MCP is private: every request needs either the owner's MCP_API_TOKEN
 * bearer secret or an OAuth token from the login page (/authorize), which asks for a per-person access
 * code from MCP_USERS. Fail-closed: if no secret is configured nothing gets in.
 * Pure functions (no Astro / cloudflare:workers imports) so they can be tested under tsx.
 */
import type { Actor } from '../../src/services/recruitment-query';

export const MIN_TOKEN_LENGTH = 24;

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

/** True when the bearer token is the owner's static MCP_API_TOKEN (never true while that secret is unset or too short). */
export async function isStaticToken(token: string, configuredToken: string | undefined): Promise<boolean> {
  return !!configuredToken && configuredToken.length >= MIN_TOKEN_LENGTH && (await secretsMatch(token, configuredToken));
}

/**
 * The owner's static MCP_API_TOKEN (Claude Code, Claude Desktop via mcp-remote).
 * PROPOSE = read + queue change proposals. It can never write live data; an admin approves in /admin.
 */
export const STATIC_TOKEN_ACTOR: Actor = { id: 'mcp-client', mode: 'PROPOSE' };

/** A person signed in through the claude.ai connector login page. Shown as "proposed by" in /admin/pending-changes. */
export const personActor = (name: string): Actor => ({ id: `mcp-${name}`, mode: 'PROPOSE' });

const USER_NAME = /^[a-z0-9-]{2,32}$/;

/**
 * MCP_USERS secret: one access code per person, e.g. {"himanshu":"<long random code>"}.
 * Entries with a bad name or a code shorter than MIN_TOKEN_LENGTH are ignored (fail closed).
 * Removing a person from the secret revokes them: every MCP request re-checks the list.
 */
export function parseUsers(raw: string | undefined): Map<string, string> {
  const users = new Map<string, string>();
  let parsed: unknown;
  try { parsed = JSON.parse(raw ?? '{}'); } catch { return users; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return users;
  for (const [name, code] of Object.entries(parsed)) {
    if (USER_NAME.test(name) && typeof code === 'string' && code.length >= MIN_TOKEN_LENGTH) users.set(name, code);
  }
  return users;
}

/** The person whose access code this is, or null. Compares against every entry so timing does not reveal which matched. */
export async function userForCode(raw: string | undefined, code: string): Promise<string | null> {
  let found: string | null = null;
  for (const [name, expected] of parseUsers(raw)) {
    if ((await secretsMatch(code, expected)) && !found) found = name;
  }
  return found;
}

/**
 * Where a login may send its tokens: claude.ai / claude.com connectors, or an app on this computer
 * (Claude Code, Claude Desktop). Any other app that registers itself is refused before the code is asked for.
 */
export function isAllowedRedirect(redirectUri: string): boolean {
  let url: URL;
  try { url = new URL(redirectUri); } catch { return false; }
  const host = url.hostname.toLowerCase();
  if (url.protocol === 'http:') return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  return url.protocol === 'https:' && ['claude.ai', 'claude.com'].some(d => host === d || host.endsWith(`.${d}`));
}
