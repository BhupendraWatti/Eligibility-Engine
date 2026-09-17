import { defineMiddleware } from 'astro:middleware';
import { getHostname, isAdminSubdomain, isWorkersDev } from './lib/hostname';

export const onRequest = defineMiddleware(async ({ request, url, locals, rewrite }, next) => {
  const hostname = getHostname(request) || url.hostname;

  // Step 4: Temporary diagnostic logging for path & hostname
  console.log(`[Middleware] Path: ${url.pathname}, Hostname: ${hostname}`);

  const isLocal =
    import.meta.env.DEV ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    url.port === '4321' ||
    url.port === '3000';

  const isWorkers = isWorkersDev(hostname);
  const isAdminHost = isAdminSubdomain(hostname);

  // Step 5: Subdomain Routing
  // Case A: If hostname starts with "admin." → serve admin pages
  if (isAdminHost) {
    if (!url.pathname.startsWith('/admin')) {
      return rewrite(`/admin${url.pathname === '/' ? '' : url.pathname}`);
    }
  } else if (!isLocal && !isWorkers && url.pathname.startsWith('/admin')) {
    // Case B: On a custom domain in production, redirect /admin on the main domain to the admin subdomain
    const baseDomain = hostname.replace(/^www\./, '');
    const redirectUrl = new URL(url.toString());
    redirectUrl.hostname = `admin.${baseDomain}`;
    return Response.redirect(redirectUrl.toString(), 302);
  }

  // Case C: Accessing /admin route directly
  if (url.pathname.startsWith('/admin')) {
    // On localhost and on *.workers.dev, ALLOW /admin path access as a fallback for testing
    if (isLocal || isWorkers) {
      // @ts-ignore
      locals.adminEmail = 'admin@rozgarsetu.in';
      return next();
    }

    // --- REPORTED 403 SOURCE (Lines below kept intact as requested in Step 2) ---
    // In Production on custom domain, verify Cloudflare Zero Trust Access identity header
    const userEmail = request.headers.get('cf-access-authenticated-user-email');
    const allowedAdmins = (import.meta.env.ADMIN_EMAILS || '').split(',').map((e: string) => e.trim());

    if (!userEmail || (allowedAdmins.length > 0 && !allowedAdmins.includes(userEmail))) {
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

    // @ts-ignore
    locals.adminEmail = userEmail;
  }

  return next();
});
