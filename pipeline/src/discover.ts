/** Find candidate notice links on an official page / RSS feed, and turn an HTML page into plain text. */
import { isAllowedUrl, sha256 } from './http';

export interface Candidate { url: string; text: string }

const KEYWORDS = /recruit|notif|advert|vacanc|result|admit|answer|key|syllabus|scholar|admission|corrigendum|exam|notice|bharti|appointment|merit|cutoff|schedule|calendar|विज्ञापन|भर्ती|परिणाम|प्रवेश/i;
const NOISE = /\b(rti|faq|citizens?[- ]charter|tenders?|annual[- ]report|privacy|terms|sitemap|contact|feedback|disclaimer|hyperlinking|accessibility|screen[- ]reader|login|sign[- ]?in|archives?)\b|rti\.pdf|faq\.pdf/i;
const STRONG = /advert|notif|recruit|vacanc|result|admit|answer|syllabus|scholar|admission|corrigendum|merit|cutoff|schedule|विज्ञापन|भर्ती|परिणाम/i;
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const clean = (s: string) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

export function extractLinks(body: string, baseUrl: string, kind: 'RSS' | 'HTML'): Candidate[] {
  const found: Candidate[] = [];
  if (kind === 'RSS') {
    for (const m of body.matchAll(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi)) {
      const block = m[0];
      const title = clean((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(block)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, ''));
      const link = (/<link[^>]*>([\s\S]*?)<\/link>/i.exec(block)?.[1] ?? /<link[^>]*href="([^"]+)"/i.exec(block)?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      if (link) found.push({ url: link, text: title });
    }
  } else {
    for (const m of body.matchAll(/<a\s[^>]*?href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      found.push({ url: decode(m[1].trim()), text: clean(m[2]) });
    }
  }
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of found) {
    let abs: string;
    try { const u = new URL(c.url, baseUrl); u.hash = ''; abs = u.toString(); } catch { continue; }
    if (!isAllowedUrl(abs) || seen.has(abs)) continue;
    const isPdf = /\.pdf(\?|$)/i.test(abs);
    if (NOISE.test(`${c.text} ${abs}`)) continue;
    if (!isPdf && !KEYWORDS.test(`${c.text} ${abs}`)) continue;
    if (abs === baseUrl || abs === baseUrl.replace(/\/$/, '')) continue;
    seen.add(abs);
    out.push({ url: abs, text: c.text.slice(0, 200) });
  }
  // Notice PDFs with a telling name first; plain pages last. Stable, so page order (newest first) is kept within a tier.
  const score = (c: Candidate) => (/\.pdf(\?|$)/i.test(c.url) ? 2 : 0) + (STRONG.test(`${c.text} ${c.url}`) ? 1 : 0);
  return out.map((c, i) => ({ c, i })).sort((a, b) => score(b.c) - score(a.c) || a.i - b.i).slice(0, 80).map(x => x.c);
}

/** Stable hash of what a source offers (not of its page chrome, which changes on every load). */
export async function candidatesHash(c: Candidate[]): Promise<string> {
  return sha256(c.map(x => `${x.url}|${x.text}`).sort().join('\n'));
}

export function htmlToText(html: string, max = 60_000): string {
  return decode(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<\/(p|div|tr|li|h\d|br)>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\f\v]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, max);
}

export function looksLikePdf(contentType: string, bytes: Uint8Array, url: string): boolean {
  return /pdf/i.test(contentType) || (bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) || /\.pdf(\?|$)/i.test(url);
}
