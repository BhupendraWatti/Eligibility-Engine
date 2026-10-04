// @ts-expect-error Node built-ins are available to the tsx test runner, not the Worker bundle.
import { execFileSync } from 'node:child_process';
// @ts-expect-error Node built-ins are available to the tsx test runner, not the Worker bundle.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// @ts-expect-error Node built-ins are available to the tsx test runner, not the Worker bundle.
import { tmpdir } from 'node:os';
// @ts-expect-error Node built-ins are available to the tsx test runner, not the Worker bundle.
import { join } from 'node:path';

const persistenceDirectory = mkdtempSync(join(tmpdir(), 'nirnay-d1-'));
const wranglerCli = join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const wranglerLogDirectory = join(persistenceDirectory, 'logs');
mkdirSync(wranglerLogDirectory);

function wrangler(...args: string[]): string {
  return execFileSync(process.execPath, [wranglerCli, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, WRANGLER_LOG_PATH: wranglerLogDirectory },
    maxBuffer: 10 * 1024 * 1024,
  });
}

function query(sql: string): Array<Record<string, unknown>> {
  const output = wrangler('d1', 'execute', 'EligibilityEngine-db', '--local', '--persist-to', persistenceDirectory, '--command', sql, '--json');
  return JSON.parse(output)[0]?.results ?? [];
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

try {
  wrangler('d1', 'migrations', 'apply', 'EligibilityEngine-db', '--local', '--persist-to', persistenceDirectory);

  assert(query("SELECT id FROM posts WHERE id = 'post_mp_constable'")[0]?.id === 'post_mp_constable', 'Canonical constable post must exist after a clean migration replay');

  query(`
    PRAGMA foreign_keys = ON;
    INSERT INTO states (id, code, name, slug) VALUES ('st_qa', 'QA', 'QA State', 'qa-state');
    INSERT INTO organisations (id, state_id, name, short_name, slug, website_url) VALUES ('org_qa', 'st_qa', 'QA Commission', 'QAC', 'qa-commission', 'https://example.gov.in');
    INSERT INTO departments (id, organisation_id, name, slug) VALUES ('dept_qa', 'org_qa', 'QA Department', 'qa-department');
    INSERT INTO sectors (id, name, slug, icon, display_order) VALUES ('sec_qa', 'QA Sector', 'qa-sector', 'briefcase', 999);
    INSERT INTO posts (id, department_id, sector_id, title, slug, summary) VALUES ('post_qa', 'dept_qa', 'sec_qa', 'QA Post', 'qa-post', 'Disposable integration record');
    INSERT INTO recruitments (id, post_id, organisation_id, state_id, advt_number, title, slug, short_summary, cycle_year) VALUES ('rec_qa', 'post_qa', 'org_qa', 'st_qa', 'QA/2026', 'QA Recruitment', 'qa-recruitment', 'Disposable integration record', 2026);
    UPDATE states SET is_active = 0 WHERE id = 'st_qa';
  `);

  assert(query("SELECT COUNT(*) AS count FROM recruitments WHERE id = 'rec_qa'")[0]?.count === 1, 'A recruitment can be created against freshly migrated master data');
  assert(query('PRAGMA foreign_key_check').length === 0, 'Fresh migrations and representative CRUD preserve foreign keys');

  query(`
    DELETE FROM recruitments WHERE id = 'rec_qa';
    DELETE FROM posts WHERE id = 'post_qa';
    DELETE FROM departments WHERE id = 'dept_qa';
    DELETE FROM organisations WHERE id = 'org_qa';
    DELETE FROM sectors WHERE id = 'sec_qa';
    DELETE FROM states WHERE id = 'st_qa';
  `);

  console.log('Clean D1 migration replay and representative master/recruitment CRUD passed.');
} finally {
  rmSync(persistenceDirectory, { recursive: true, force: true });
}
