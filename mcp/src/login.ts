/**
 * The OAuth login page (/authorize) that claude.ai connectors open. The person types the access code the
 * owner gave them (MCP_USERS); the library then issues an OAuth token tied to that person.
 * Signing in only grants what the static token grants: read and PROPOSE. Nothing goes live until an admin approves.
 */
import { AuthorizationError, CimdFetchError, type ConsentDescription, type OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import { isAllowedRedirect, userForCode } from './auth';

export interface LoginEnv {
  MCP_USERS?: string;
  OAUTH_PROVIDER: OAuthHelpers;
}

/** What the OAuth token carries into the MCP handler (ctx.props). */
export interface McpProps {
  /** Name from MCP_USERS; absent for the owner's static token. */
  user?: string;
}

const escape = (value: string) => value.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

function page(status: number, body: string, headers = new Headers()): Response {
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https: http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'");
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>NIRNAY MCP sign-in</title>
<style>
  body { margin: 0; background: #f8fafc; color: #090d16; font: 16px/1.5 system-ui, sans-serif; }
  main { max-width: 420px; margin: 48px auto; padding: 24px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  label { display: block; font-weight: 600; margin: 16px 0 6px; }
  input { box-sizing: border-box; width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; font: inherit; }
  input:focus { outline: 2px solid #1e40af; outline-offset: 1px; }
  .row { display: flex; gap: 8px; margin-top: 20px; }
  button { padding: 10px 16px; border-radius: 6px; font: inherit; cursor: pointer; border: 1px solid #e2e8f0; background: #fff; }
  button.primary { background: #1e40af; border-color: #1e40af; color: #fff; }
  .warn { color: #d97706; background: #fffbeb; border: 1px solid #fde68a; padding: 8px 10px; border-radius: 6px; }
  .error { color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; padding: 8px 10px; border-radius: 6px; }
  .muted { color: #475569; font-size: 14px; }
</style></head><body><main>${body}</main></body></html>`, { status, headers });
}

function consentPage(details: ConsentDescription, handle: string): string {
  return `<h1>Connect ${escape(details.clientName)} to NIRNAY</h1>
<p class="muted">Access will be sent to <strong>${escape(details.redirectHost)}</strong>.
It can search recruitments and propose changes; an admin approves every change before it goes live.</p>
${details.redirectIsLoopback ? '<p class="warn">This sends access to an app on your computer. Continue only if you just started connecting from it.</p>' : ''}
<form method="post">
  <input type="hidden" name="handle" value="${escape(handle)}">
  <label for="code">Access code</label>
  <input id="code" name="code" type="password" autocomplete="off" required autofocus>
  <div class="row">
    <button class="primary" name="decision" value="approve">Connect</button>
    <button name="decision" value="deny" formnovalidate>Cancel</button>
  </div>
</form>`;
}

const refused = () => page(400, '<h1>Not allowed</h1><p>Only claude.ai and Claude apps on your own computer can connect to NIRNAY.</p>');

export async function handleAuthorize(request: Request, env: LoginEnv): Promise<Response> {
  const oauth = env.OAUTH_PROVIDER;
  try {
    if (request.method === 'GET') {
      const authRequest = await oauth.parseAuthRequest(request);
      if (!isAllowedRedirect(authRequest.redirectUri)) return refused();
      const details = await oauth.describeConsent(authRequest);
      const consent = await oauth.beginConsent(authRequest);
      return page(200, consentPage(details, consent.handle), consent.headers);
    }
    if (request.method !== 'POST') return page(405, '<h1>Method not allowed</h1>');

    const form = await request.formData();
    const handle = String(form.get('handle') ?? '');
    if (form.get('decision') !== 'approve') {
      const denied = await oauth.denyConsent(request, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }
    // Checked before approveConsent, which uses up the handle: a wrong code can go Back and try again.
    const user = await userForCode(env.MCP_USERS, String(form.get('code') ?? ''));
    if (!user) {
      console.warn(JSON.stringify({ evt: 'mcp.login', ok: false }));
      return page(401, '<h1>Wrong access code</h1><p>Go back and try again. Ask the NIRNAY owner if you do not have a code.</p>');
    }
    const approved = await oauth.approveConsent(request, handle);
    if (!isAllowedRedirect(approved.request.redirectUri)) return refused();
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request,
      userId: user,
      metadata: { user },
      scope: approved.request.scope,
      props: { user } satisfies McpProps,
    });
    console.info(JSON.stringify({ evt: 'mcp.login', ok: true, user }));
    approved.headers.set('location', redirectTo);
    return new Response(null, { status: 302, headers: approved.headers });
  } catch (error) {
    if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
    if (error instanceof AuthorizationError || error instanceof CimdFetchError) {
      const message = error instanceof AuthorizationError ? error.description : 'This app could not be verified.';
      return page(400, `<h1>Could not connect</h1><p>${escape(message)}</p><p class="muted">Go back to Claude and click Connect again.</p>`);
    }
    throw error;
  }
}
