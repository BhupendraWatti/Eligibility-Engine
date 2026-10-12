// Source registry lifecycle: nothing becomes ACTIVE without the robot's check AND an admin approval.
// Runs the real SQL from pipeline-store.ts against Node's built-in SQLite through a minimal D1 shim.
import { approveSource, dueSources, isAllowedUrl, markSourceChecked, saveSource, setSourceStatus, validateSourceInput } from './pipeline-store';

// Node built-ins loaded by name: the site's tsconfig has Workers types only, no @types/node.
const node = (m: string) => import(m);
const { default: assert } = await node('node:assert/strict');
const { readFileSync } = await node('node:fs');
const { DatabaseSync } = await node('node:sqlite');

const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE organisations (id TEXT PRIMARY KEY);');
const sql = readFileSync(new URL('../../migrations/0015_data_pipeline.sql', import.meta.url), 'utf8');
db.exec(sql.slice(0, sql.indexOf('CREATE TABLE IF NOT EXISTS pipeline_runs')));

const d1 = {
  prepare(q: string) {
    let args: unknown[] = [];
    const stmt = {
      bind: (...a: unknown[]) => { args = a; return stmt; },
      run: async () => ({ meta: { changes: Number(db.prepare(q).run(...(args as never[])).changes) } }),
      first: async () => db.prepare(q).get(...(args as never[])) ?? null,
      all: async () => ({ results: db.prepare(q).all(...(args as never[])) }),
    };
    return stmt;
  },
} as unknown as D1Database;

const status = (id: string) => (db.prepare('SELECT status FROM source_registry WHERE id = ?').get(id) as { status: string }).status;
const base = { name: 'Board notices', sourceType: 'NOTICE_PAGE', category: 'JOBS', frequencyHours: 3 };

// Only official domains can be registered.
assert.equal(isAllowedUrl('https://psc.up.gov.in/notices'), true);
assert.match(validateSourceInput({ ...base, url: 'https://sarkariresult.com/jobs' }) ?? '', /official domains/);
assert.match(validateSourceInput({ ...base, url: 'https://gov.in.evil.com/' }) ?? '', /official domains/);
assert.equal(validateSourceInput({ ...base, url: 'https://ssc.nic.in/' }), null);
await assert.rejects(saveSource(d1, { ...base, url: 'https://example.com/' }), /official domains/);

const id = await saveSource(d1, { ...base, url: 'https://ssc.nic.in/notices' });
assert.equal(status(id), 'NEEDS_VERIFICATION');
await assert.rejects(approveSource(d1, id), /verified/); // cannot approve before the robot checks it

await markSourceChecked(d1, id, {});
assert.equal(status(id), 'VERIFIED'); // a successful check never activates
assert.equal((await dueSources(d1, ['JOBS'], 10)).length, 0); // waiting for approval: not crawled

await approveSource(d1, id);
assert.equal(status(id), 'ACTIVE');

// Outage: 3 failures -> FAILING; recovery needs approval again.
for (let i = 0; i < 3; i++) await markSourceChecked(d1, id, { error: 'HTTP 503' });
assert.equal(status(id), 'FAILING');
await markSourceChecked(d1, id, {});
assert.equal(status(id), 'VERIFIED');
await approveSource(d1, id);

// Editing without changing the URL keeps it ACTIVE; a new URL goes back through check + approval.
await saveSource(d1, { ...base, name: 'Renamed', url: 'https://ssc.nic.in/notices' }, id);
assert.equal(status(id), 'ACTIVE');
await saveSource(d1, { ...base, url: 'https://ssc.gov.in/notices' }, id);
assert.equal(status(id), 'NEEDS_VERIFICATION');

// Resume from pause re-verifies.
await setSourceStatus(d1, id, 'PAUSED');
await saveSource(d1, { ...base, url: 'https://ssc.nic.in/other' }, id);
assert.equal(status(id), 'PAUSED'); // URL edit does not unpause
await setSourceStatus(d1, id, 'NEEDS_VERIFICATION');
assert.equal(status(id), 'NEEDS_VERIFICATION');

console.log('source-registry.test.ts: all checks passed');
