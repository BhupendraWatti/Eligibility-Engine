/**
 * Weekly dead-link check. Fully automatic, writes only link health and "last verified" on sources.
 * A link is flagged BROKEN after two consecutive failed weekly checks. "Last verified" on a source moves only when its URL was really re-fetched.
 */
import { fetchPolite } from './http';

const MAX_LINKS_PER_RUN = 150;

export interface LinkCheckSummary { checked: number; ok: number; failing: number; newlyBroken: string[]; sourcesVerified: number }

export async function runLinkCheck(d1: D1Database): Promise<LinkCheckSummary> {
  const { results: links } = await d1.prepare('SELECT id, url, link_failures AS failures, link_status AS status FROM official_links WHERE is_active = 1 ORDER BY COALESCE(link_checked_at, 0) LIMIT ?').bind(MAX_LINKS_PER_RUN).all<{ id: string; url: string; failures: number; status: string | null }>();
  const summary: LinkCheckSummary = { checked: 0, ok: 0, failing: 0, newlyBroken: [], sourcesVerified: 0 };

  // One chain per domain (polite pacing inside fetchPolite), all domains in parallel.
  const byHost = new Map<string, typeof links>();
  for (const l of links ?? []) {
    let host = 'invalid';
    try { host = new URL(l.url).hostname; } catch { /* checked below */ }
    byHost.set(host, [...(byHost.get(host) ?? []), l]);
  }
  await Promise.all([...byHost.values()].map(async group => {
    for (const l of group) {
      let res = await fetchPolite(l.url, { method: 'HEAD' });
      // Some servers reject HEAD; ask for the headers with GET instead (body is never read).
      if (!res.ok && (res.status === 403 || res.status === 405 || res.status === 501)) res = await fetchPolite(l.url, { statusOnly: true });
      summary.checked++;
      if (res.ok) {
        summary.ok++;
        await d1.prepare("UPDATE official_links SET link_status = 'OK', link_failures = 0, link_checked_at = unixepoch() WHERE id = ?").bind(l.id).run();
        // The same URL recorded as a document source was just re-fetched successfully: that is a real re-check.
        const upd = await d1.prepare('UPDATE sources SET last_verified_at = unixepoch() WHERE source_url = ?').bind(l.url).run();
        summary.sourcesVerified += upd.meta?.changes ?? 0;
      } else {
        summary.failing++;
        const failures = (l.failures ?? 0) + 1;
        const broken = failures >= 2;
        if (broken && l.status !== 'BROKEN') summary.newlyBroken.push(l.url);
        await d1.prepare('UPDATE official_links SET link_status = ?, link_failures = ?, link_checked_at = unixepoch() WHERE id = ?').bind(broken ? 'BROKEN' : 'FAILING', failures, l.id).run();
      }
    }
  }));
  return summary;
}
