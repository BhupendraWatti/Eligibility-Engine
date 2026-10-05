// Verifies the Cloudflare Access JWT (Cf-Access-Jwt-Assertion). The plain
// cf-access-authenticated-user-email header is forgeable if a request reaches the
// Worker without passing through Access, so identity comes only from a signed token.

type Jwk = JsonWebKey & { kid?: string };
type Claims = { aud?: string | string[]; iss?: string; exp?: number; nbf?: number; email?: string };

const KEY_TTL_MS = 10 * 60 * 1000;
let keyCache: { team: string; keys: Jwk[]; fetchedAt: number } | null = null;

function b64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function decodeJson<T>(part: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part))) as T;
}

export function normaliseTeamDomain(raw: string): string {
  return raw.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
}

async function loadKeys(teamDomain: string, forceRefresh: boolean): Promise<Jwk[]> {
  if (!forceRefresh && keyCache && keyCache.team === teamDomain && Date.now() - keyCache.fetchedAt < KEY_TTL_MS) {
    return keyCache.keys;
  }
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access certs request failed: ${response.status}`);
  const { keys } = (await response.json()) as { keys: Jwk[] };
  keyCache = { team: teamDomain, keys, fetchedAt: Date.now() };
  return keys;
}

/** Returns the verified, lower-cased email, or null when the token is missing/invalid. */
export async function verifyAccessJwt(
  token: string | null,
  teamDomainRaw: string,
  audience: string,
): Promise<string | null> {
  if (!token || !teamDomainRaw || !audience) return null;
  const teamDomain = normaliseTeamDomain(teamDomainRaw);
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = decodeJson<{ alg?: string; kid?: string }>(parts[0]);
    if (header.alg !== 'RS256' || !header.kid) return null;

    let jwk = (await loadKeys(teamDomain, false)).find(key => key.kid === header.kid);
    if (!jwk) jwk = (await loadKeys(teamDomain, true)).find(key => key.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) return null;

    const claims = decodeJson<Claims>(parts[1]);
    const now = Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(audience)) return null;
    if (claims.iss !== `https://${teamDomain}`) return null;
    if (!claims.exp || claims.exp <= now) return null;
    if (claims.nbf && claims.nbf > now + 60) return null;
    return claims.email ? claims.email.toLowerCase() : null;
  } catch {
    return null;
  }
}
