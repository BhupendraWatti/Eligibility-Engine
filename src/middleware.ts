import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async ({ request, url, locals }, next) => {
  if (url.pathname.startsWith('/admin')) {
    // 1. In Local Development / Localhost / Dev Port, allow admin access with default email
    const isLocal = 
      import.meta.env.DEV || 
      url.hostname === 'localhost' || 
      url.hostname === '127.0.0.1' || 
      url.hostname === '0.0.0.0' ||
      url.port === '4321';

    if (isLocal) {
      // @ts-ignore
      locals.adminEmail = 'admin@rozgarsetu.in';
      return next();
    }

    // 2. In Production, verify Cloudflare Zero Trust Access identity header
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
