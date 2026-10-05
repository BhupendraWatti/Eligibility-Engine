/**
 * Polite, allow-listed fetching: official domains only, robots.txt respected, a clear User-Agent,
 * and a minimum gap between requests to the same domain.
 */
export const USER_AGENT = 'NirnayBot/1.0 (official-notice checker for nirnay; respects robots.txt)';
const ROBOTS_TOKEN = 'nirnaybot';

/** Official Indian government / public-body domains. Anything else is refused, whatever the registry says. */
export const ALLOWED_DOMAINS = ['gov.in', 'nic.in', 'ac.in', 'ibps.in', 'sbi.co.in', 'rbi.org.in', 'bank.in'];

export function isAllowedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  return ALLOWED_DOMAINS.some(d => h === d || h.endsWith(`.${d}`));
}
export function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') && isAllowedHost(u.hostname);
  } catch { return false; }
}

const MIN_GAP_MS = 2000;
const lastHit = new Map<string, number>();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function throttle(host: string): Promise<void> {
  const wait = (lastHit.get(host) ?? 0) + MIN_GAP_MS - Date.now();
  lastHit.set(host, Date.now() + Math.max(0, wait));
  if (wait > 0) await sleep(wait);
}

// ── robots.txt ──────────────────────────────────────────────────────────────────────────────────────────
type Rules = Array<{ allow: boolean; path: string }>;
const robotsCache = new Map<string, { at: number; rules: Rules | 'DISALLOW_ALL' }>();

export function parseRobots(text: string): Rules {
  const groups: Array<{ agents: string[]; rules: Rules }> = [];
  let current: { agents: string[]; rules: Rules } | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && current) {
      lastWasAgent = false;
      if (val) current.rules.push({ allow: key === 'allow', path: val });
    } else lastWasAgent = false;
  }
  const specific = groups.filter(g => g.agents.some(a => a !== '*' && ROBOTS_TOKEN.includes(a)));
  const chosen = specific.length ? specific : groups.filter(g => g.agents.includes('*'));
  return chosen.flatMap(g => g.rules);
}

export function robotsAllows(rules: Rules, path: string): boolean {
  let best: { allow: boolean; len: number } | null = null;
  for (const r of rules) {
    const pattern = r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$');
    if (new RegExp(`^${pattern}`).test(path) && (!best || r.path.length > best.len || (r.path.length === best.len && r.allow))) {
      best = { allow: r.allow, len: r.path.length };
    }
  }
  return best ? best.allow : true;
}

async function allowedByRobots(u: URL, fetcher: typeof fetch): Promise<boolean> {
  const cached = robotsCache.get(u.origin);
  let entry = cached && Date.now() - cached.at < 3_600_000 ? cached : undefined;
  if (!entry) {
    let rules: Rules | 'DISALLOW_ALL' = [];
    try {
      await throttle(u.hostname);
      const res = await fetcher(`${u.origin}/robots.txt`, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(10_000), redirect: 'follow' });
      if (res.status >= 500) rules = 'DISALLOW_ALL'; // server trouble: do not hammer it
      else if (res.ok) rules = parseRobots((await res.text()).slice(0, 200_000));
    } catch { /* unreachable robots.txt: the page fetch will report the real error */ }
    entry = { at: Date.now(), rules };
    robotsCache.set(u.origin, entry);
  }
  return entry.rules === 'DISALLOW_ALL' ? false : robotsAllows(entry.rules, u.pathname + u.search);
}

// ── fetching ───────────────────────────────────────────────────────────────────────────────────────────

export interface Fetched {
  ok: boolean;
  status: number | null;
  url: string;
  contentType: string;
  body: Uint8Array;
  error?: string;
}

const fail = (url: string, error: string, status: number | null = null): Fetched => ({ ok: false, status, url, contentType: '', body: new Uint8Array(), error });

async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  return out;
}

export async function fetchPolite(url: string, opts: { maxBytes?: number; method?: 'GET' | 'HEAD'; statusOnly?: boolean; fetcher?: typeof fetch } = {}): Promise<Fetched> {
  const fetcher = opts.fetcher ?? fetch;
  const maxBytes = opts.maxBytes ?? 3_000_000;
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!isAllowedUrl(current)) return fail(current, 'Domain is not on the official allow-list.');
    const u = new URL(current);
    if (!(await allowedByRobots(u, fetcher))) return fail(current, 'Blocked by robots.txt.');
    await throttle(u.hostname);
    let res: Response;
    try {
      res = await fetcher(current, { method: opts.method ?? 'GET', redirect: 'manual', headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/pdf,application/xml,text/xml,*/*;q=0.5' }, signal: AbortSignal.timeout(25_000) });
    } catch (e) {
      return fail(current, e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : 'Request failed');
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location')!, current).toString();
      continue;
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!res.ok) return { ...fail(current, `HTTP ${res.status}`, res.status), contentType };
    if (opts.method === 'HEAD' || opts.statusOnly) { await res.body?.cancel(); return { ok: true, status: res.status, url: current, contentType, body: new Uint8Array() }; }
    const body = await readCapped(res, maxBytes);
    if (!body) return fail(current, `Document is larger than ${Math.round(maxBytes / 1_000_000)} MB.`, res.status);
    return { ok: true, status: res.status, url: current, contentType, body };
  }
  return fail(current, 'Too many redirects.');
}

export async function sha256(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
