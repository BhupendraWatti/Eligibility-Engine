// src/pages/sitemap-index.xml.ts: served at /sitemap-index.xml, the file robots.txt points to.
// @astrojs/sitemap cannot list on-demand (database) pages, so the sitemap is built here instead,
// using the same file names that integration would produce.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ url }) => {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${new URL('/sitemap-0.xml', url.origin).href}</loc></sitemap>
</sitemapindex>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
