// src/pages/robots.txt.ts: served at /robots.txt. Built per request so the Sitemap line uses
// whatever domain the site is reached on (workers.dev now, a custom domain later).
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ url }) => {
  const body = [
    'User-agent: *',
    'Allow: /',
    // Admin panel and per-visitor eligibility reports are not public content.
    'Disallow: /admin',
    'Disallow: /eligibility/report',
    'Disallow: /search',
    '',
    `Sitemap: ${new URL('/sitemap-index.xml', url.origin).href}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
