/**
 * Weekly dead-link check. Fully automatic, writes only link health and "last verified" on sources. It never changes a URL.
 * A link is flagged BROKEN after two consecutive failed weekly checks. "Last verified" on a source moves only when its URL was really re-fetched.
 * A PDF-type link that loads but is not a PDF (an HTML listing or viewer page) is flagged NOT_PDF at once: that is not a flake.
 * A link outside the official allow-list is not fetched; it is flagged UNVERIFIED_DOMAIN for an admin to confirm, not counted as dead.
 */
import { listLinkGaps, PDF_LINK_TYPES } from '../../src/services/pipeline-store';
import { fetchPolite, isAllowedUrl } from './http';

const MAX_LINKS_PER_RUN = 150;
const MAX_PDF_SNIFF_BYTES = 8_000_000;

export interface LinkCheckSummary { checked: number; ok: number; failing: number; newlyBroken: string[]; notPdf: string[]; unverifiedDomain: string[]; sourcesVerified: number; gaps: number }

export async function runLinkCheck(d1: D1Database): Promise<LinkCheckSummary> {
  const { results: links } = await d1.prepare('SELECT id, url, link_type AS linkType, link_failures AS failures, link_status AS status FROM official_links WHERE is_active = 1 ORDER BY COALESCE(link_checked_at, 0) LIMIT ?').bind(MAX_LINKS_PER_RUN).all<{ id: string; url: string; linkType: string; failures: number; status: string | null }>();
  const summary: LinkCheckSummary = { checked: 0, ok: 0, failing: 0, newlyBroken: [], notPdf: [], unverifiedDomain: [], sourcesVerified: 0, gaps: 0 };
  const mark = (id: string, status: string, failures: number) => d1.prepare('UPDATE official_links SET link_status = ?, link_failures = ?, link_checked_at = unixepoch() WHERE id = ?').bind(status, failures, id).run();

  // One chain per domain (polite pacing inside fetchPolite), all domains in parallel.
  const byHost = new Map<string, typeof links>();
  for (const l of links ?? []) {
    let host = 'invalid';
    try { host = new URL(l.url).hostname; } catch { /* checked below */ }
    byHost.set(host, [...(byHost.get(host) ?? []), l]);
  }
  await Promise.all([...byHost.values()].map(async group => {
    for (const l of group) {
      summary.checked++;
      if (!isAllowedUrl(l.url)) {
        if (l.status !== 'UNVERIFIED_DOMAIN') summary.unverifiedDomain.push(l.url);
        await mark(l.id, 'UNVERIFIED_DOMAIN', l.failures ?? 0);
        continue;
      }
      let res = await fetchPolite(l.url, { method: 'HEAD' });
      // Some servers reject HEAD; ask for the headers with GET instead (body is never read).
      if (!res.ok && (res.status === 403 || res.status === 405 || res.status === 501)) res = await fetchPolite(l.url, { statusOnly: true });
      if (res.ok && PDF_LINK_TYPES.includes(l.linkType) && !(await isPdf(res.url, res.contentType))) {
        summary.failing++;
        if (l.status !== 'NOT_PDF') summary.notPdf.push(l.url);
        await mark(l.id, 'NOT_PDF', 0);
        continue;
      }
      if (res.ok) {
        summary.ok++;
        await mark(l.id, 'OK', 0);
        // The same URL recorded as a document source was just re-fetched successfully: that is a real re-check.
        const upd = await d1.prepare('UPDATE sources SET last_verified_at = unixepoch() WHERE source_url = ?').bind(l.url).run();
        summary.sourcesVerified += upd.meta?.changes ?? 0;
      } else {
        summary.failing++;
        const failures = (l.failures ?? 0) + 1;
        const broken = failures >= 2;
        if (broken && l.status !== 'BROKEN') summary.newlyBroken.push(l.url);
        await mark(l.id, broken ? 'BROKEN' : 'FAILING', failures);
      }
    }
  }));
  summary.gaps = (await listLinkGaps(d1, 500)).length;
  return summary;
}

/** application/pdf in the headers, or a body that starts with %PDF. HTML is never a PDF. A file too large to sniff is given the benefit of the doubt. */
async function isPdf(url: string, contentType: string): Promise<boolean> {
  if (/pdf/i.test(contentType)) return true;
  if (/html/i.test(contentType)) return false;
  const doc = await fetchPolite(url, { maxBytes: MAX_PDF_SNIFF_BYTES });
  if (!doc.ok) return /larger than/.test(doc.error ?? '');
  const b = doc.body;
  return b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
}
