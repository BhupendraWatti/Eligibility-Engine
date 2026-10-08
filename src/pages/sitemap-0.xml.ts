// src/pages/sitemap-0.xml.ts: served at /sitemap-0.xml. Lists the fixed public pages plus every
// public recruitment, organisation, post and sector page read live from D1.
import type { APIRoute } from 'astro';
import { getSitemapEntries, type SitemapEntry } from '../db/queries';

// Public pages that are not database-driven. /search and /eligibility/report are left out (see robots.txt).
const STATIC_PATHS = [
  '/',
  '/jobs',
  '/admit-cards',
  '/answer-keys',
  '/results',
  '/calendar',
  '/organisations',
  '/eligibility-checker',
  '/about',
  '/contact',
  '/source-policy',
  '/disclaimer',
  '/privacy',
  '/terms',
];

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export const GET: APIRoute = async ({ url }) => {
  const entries: SitemapEntry[] = [...STATIC_PATHS.map(path => ({ path })), ...(await getSitemapEntries())];

  const urls = entries
    .map(({ path, lastmod }) => {
      const loc = escapeXml(new URL(path, url.origin).href);
      return lastmod
        ? `  <url><loc>${loc}</loc><lastmod>${lastmod.toISOString()}</lastmod></url>`
        : `  <url><loc>${loc}</loc></url>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
