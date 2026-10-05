/** Reachability check for official links. Read-only: HEAD, then GET if the server rejects HEAD. */
export interface LinkCheck { url: string; ok: boolean; status: number | null; contentType: string | null; error?: string }

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|\[.*\]|\d{1,3}(\.\d{1,3}){3})$/i;

export async function checkLink(url: string, fetcher: typeof fetch = fetch): Promise<LinkCheck> {
  let u: URL;
  try { u = new URL(url); } catch { return { url, ok: false, status: null, contentType: null, error: 'Invalid URL' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { url, ok: false, status: null, contentType: null, error: 'Only http(s) is checked' };
  if (PRIVATE_HOST.test(u.hostname)) return { url, ok: false, status: null, contentType: null, error: 'Host not allowed' };
  try {
    let res = await fetcher(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) });
    if (res.status === 405 || res.status === 403 || res.status === 501) res = await fetcher(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000) });
    return { url, ok: res.status >= 200 && res.status < 400, status: res.status, contentType: res.headers.get('content-type') };
  } catch (e) {
    return { url, ok: false, status: null, contentType: null, error: e instanceof Error ? e.name : 'Request failed' };
  }
}
