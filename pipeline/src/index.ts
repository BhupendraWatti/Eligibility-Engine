/**
 * NIRNAY data pipeline Worker. Cron: every 3 hours (notices), daily (syllabus/books/knowledge), weekly (dead links).
 * Manual: POST /run with the bearer token. It proposes changes only; an admin approves in /admin/pending-changes.
 */
import { runPipeline, type Env, type RunOptions } from './run';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function tokenOk(request: Request, token: string | undefined): Promise<boolean> {
  if (!token || token.length < 24) return false;
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(given)), crypto.subtle.digest('SHA-256', enc.encode(token))]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const KIND_BY_CRON: Record<string, RunOptions['kind']> = { '0 */3 * * *': 'NOTICES', '30 2 * * *': 'DAILY', '30 3 * * 1': 'LINKS' };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json(200, { ok: true });
    if (url.pathname !== '/run') return json(404, { error: 'Not found.' });
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
    if (!(await tokenOk(request, env.PIPELINE_TOKEN))) return json(401, { error: 'Unauthorized.' });

    const body = (await request.json().catch(() => ({}))) as Partial<RunOptions>;
    const kind = (['NOTICES', 'DAILY', 'LINKS'] as const).includes(body.kind as never) ? body.kind! : 'NOTICES';
    // Manual runs are dry runs unless dryRun:false is sent explicitly.
    try {
      return json(200, await runPipeline(env, { kind, trigger: 'manual', dryRun: body.dryRun !== false, sourceIds: Array.isArray(body.sourceIds) ? body.sourceIds.slice(0, 20).map(String) : undefined, noLlm: !!body.noLlm, maxDocs: typeof body.maxDocs === 'number' ? Math.min(30, body.maxDocs) : undefined }));
    } catch (e) {
      console.error('[pipeline] manual run failed', e);
      return json(500, { error: 'Run failed.', detail: e instanceof Error ? e.message : String(e) });
    }
  },

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const kind = KIND_BY_CRON[event.cron] ?? 'NOTICES';
    ctx.waitUntil(runPipeline(env, { kind, trigger: 'cron' }).then(r => console.info(JSON.stringify({ evt: 'pipeline.run', kind, status: r.status, sources: r.sourcesChecked, items: r.itemsFound, proposals: r.proposalsCreated, errors: r.errors }))));
  },
};
