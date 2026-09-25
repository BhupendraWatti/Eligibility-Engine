import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { getHostname, isAdminSubdomain } from './lib/hostname';

export const onRequest = defineMiddleware(async ({ request, url, locals, rewrite }, next) => {
  const hostname = getHostname(request) || url.hostname;

  const isLocal =
    import.meta.env.DEV ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    url.port === '4321' ||
    url.port === '3000';

  const isAdminHost = isAdminSubdomain(hostname);
  const isAdminPath = url.pathname === '/admin' || url.pathname.startsWith('/admin/');

  // Step 5: Subdomain Routing
  // workers.dev only issues TLS for one level of subdomain (*.bhupendrawatti24.workers.dev).
  // Second-level subdomains like admin.eligibility-engine.*.workers.dev have no cert → ERR_SSL.
  // On workers.dev we skip the subdomain redirect and serve /admin directly on the main domain.
  // On a real custom domain the redirect to admin.* still applies.
  const isWorkersDev = hostname.endsWith('.workers.dev');

  // On a custom-domain public host, send admin paths to the protected admin host.
  if (!isAdminHost && !isLocal && !isWorkersDev && isAdminPath) {
    // Case B: On a custom domain in production, redirect /admin on the main domain to the admin subdomain
    const baseDomain = hostname.replace(/^www\./, '');
    const redirectUrl = new URL(url.toString());
    redirectUrl.hostname = `admin.${baseDomain}`;
    return Response.redirect(redirectUrl.toString(), 302);
  }

  // Authenticate both /admin/* paths and clean URLs served from the admin subdomain.
  if (isAdminPath || isAdminHost) {
    // Cloudflare Access must protect every admin surface, including workers.dev and local test hosts.
    const userEmail = request.headers.get('cf-access-authenticated-user-email');
    const allowedAdmins = (import.meta.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e: string) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!userEmail || allowedAdmins.length === 0 || !allowedAdmins.includes(userEmail.toLowerCase())) {
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head><title>Access Restricted | RozgarSetu MP</title></head>
          <body style="font-family: sans-serif; display: grid; place-content: center; height: 100vh; text-align: center; background: #0f172a; color: #f8fafc;">
            <h1>403 — Unauthorized</h1>
            <p>Admin portal access is restricted to verified administrators via Cloudflare Zero Trust.</p>
          </body>
        </html>`,
        {
          status: 403,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    const db = (env as unknown as { DB?: D1Database }).DB;
    if (!db) return new Response('Admin database unavailable.', { status: 503 });

    try {
      const admin = await db
        .prepare('SELECT is_active FROM admin_users WHERE lower(email) = lower(?) LIMIT 1')
        .bind(userEmail)
        .first<{ is_active: number }>();
      if (!admin || admin.is_active !== 1) return new Response('Admin account is inactive or not provisioned.', { status: 403 });
    } catch (error) {
      console.error('[Middleware] Admin authorization lookup failed:', error);
      return new Response('Admin authorization unavailable.', { status: 503 });
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('origin');
      try {
        if (!origin || new URL(origin).host !== url.host) throw new Error('Invalid origin');
      } catch {
        return new Response('Invalid request origin.', { status: 403 });
      }
    }

    // @ts-ignore
    locals.adminEmail = userEmail;

    if (isAdminHost && !isAdminPath) {
      return rewrite(`/admin${url.pathname === '/' ? '' : url.pathname}`);
    }
  }

  return next();
});
