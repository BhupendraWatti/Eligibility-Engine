import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { isAdminSubdomain } from './lib/hostname';
import { isAdminTestBypass, isSameOrigin } from './services/admin-integrity';
import { verifyAccessJwt } from './services/cf-access';
import {
  homeValueToSave,
  resolveViewerState,
  VIEWER_STATE_COOKIE,
  VIEWER_STATE_MAX_AGE,
  NATIONAL_VIEW,
  type GeoHint,
} from './services/viewer-state';

export const onRequest = defineMiddleware(async ({ request, url, locals, rewrite, cookies }, next) => {
  const hostname = url.hostname.toLowerCase();

  const isLocal =
    import.meta.env.DEV ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0';

  const isAdminHost = isAdminSubdomain(hostname);
  const isAdminPath = url.pathname === '/admin' || url.pathname.startsWith('/admin/');

  // The admin panel is served only from the admin.* subdomain (behind Cloudflare Access).
  // On every other production host, /admin does not exist, so it is not advertised or probeable.
  if (!isAdminHost && !isLocal && isAdminPath) {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // Authenticate both /admin/* paths and clean URLs served from the admin subdomain.
  if (isAdminPath || isAdminHost) {
    const readEnv = (name: string): string | undefined => {
      let value = (import.meta.env as Record<string, string | undefined>)[name];
      try {
        value ||= (env as unknown as Record<string, string | undefined>)[name];
      } catch {
        // Cloudflare bindings are unavailable outside the worker runtime.
      }
      return value;
    };

    const isTestBypass = isAdminTestBypass(
      readEnv('ADMIN_TEST_BYPASS_TOKEN'),
      request.headers.get('x-admin-bypass'),
    );
    const isTrustedLocal = isTestBypass || isLocal;

    let userEmail: string | null = null;
    if (isTrustedLocal) {
      userEmail = 'local-dev@localhost';
    } else {
      const teamDomain = readEnv('CF_ACCESS_TEAM_DOMAIN');
      const audience = readEnv('CF_ACCESS_AUD');
      if (!teamDomain || !audience) {
        console.error('[Middleware] CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD are not configured; admin is locked.');
        return new Response('Admin authentication is not configured.', { status: 503 });
      }
      // Identity comes only from the signed Access JWT, never from a plain header.
      userEmail = await verifyAccessJwt(request.headers.get('cf-access-jwt-assertion'), teamDomain, audience);
    }

    if (!userEmail) {
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head><title>Access Restricted | GovtRecruitments</title></head>
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

    let db: D1Database | undefined = undefined;
    try {
      db = (env as unknown as { DB?: D1Database })?.DB;
    } catch {
      // not in worker runtime
    }

    if (!isTrustedLocal && !db) {
      return new Response('Admin authorization unavailable.', { status: 503 });
    }

    if (!isTrustedLocal && db) {
      try {
        // Cloudflare Access is the gate: anyone it admits is a member. Roles and revocation live in
        // admin_users; a first-time member is provisioned with the least-privileged role.
        const localPart = userEmail.split('@')[0];
        await db
          .prepare('INSERT OR IGNORE INTO admin_users (id, email, name, role, is_active) VALUES (?, ?, ?, ?, 1)')
          .bind(`admin_${crypto.randomUUID()}`, userEmail, localPart, 'EDITOR')
          .run();
        const admin = await db
          .prepare('SELECT is_active FROM admin_users WHERE lower(email) = lower(?) LIMIT 1')
          .bind(userEmail)
          .first<{ is_active: number }>();
        if (!admin || admin.is_active !== 1) {
          return new Response('Admin account has been revoked.', { status: 403 });
        }
      } catch (error) {
        console.error('[Middleware] Admin authorization lookup failed:', error);
        return new Response('Admin authorization unavailable.', { status: 503 });
      }
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('origin');
      if (origin ? !isSameOrigin(origin, url.host) : !isTrustedLocal) {
        return new Response('Invalid request origin.', { status: 403 });
      }
    }

    // @ts-ignore
    locals.adminEmail = userEmail;

    if (isAdminHost && !isAdminPath) {
      return rewrite(`/admin${url.pathname === '/' ? '' : url.pathname}`);
    }
  } else {
    // Public pages: which state's recruitments to rank first (see src/services/viewer-state.ts).
    const cf = (request as Request & { cf?: GeoHint }).cf;
    const home = url.searchParams.get('home');
    const savedCookie = cookies.get(VIEWER_STATE_COOKIE)?.value;
    const toSave = homeValueToSave(home, url.searchParams.get('remember'));

    if (toSave) {
      const before = resolveViewerState({ cookie: savedCookie, cf });
      cookies.set(VIEWER_STATE_COOKIE, toSave, {
        path: '/',
        maxAge: VIEWER_STATE_MAX_AGE,
        sameSite: 'lax',
        secure: !isLocal,
        httpOnly: false,
      });
      // How often the detected state is overridden, and to what. State codes only, no IP.
      console.log(JSON.stringify({
        event: 'viewer_state_saved',
        fromSource: before.source,
        fromCode: before.code,
        toCode: toSave === NATIONAL_VIEW ? null : toSave,
      }));
    }

    locals.viewerState = resolveViewerState({ home, cookie: savedCookie, cf });
  }

  return next();
});
