// @ts-expect-error Node built-ins are available to the tsx test runner, not the Worker bundle.
import { execFileSync } from 'node:child_process';
// @ts-expect-error Node built-ins are available to the tsx test runner, not the Worker bundle.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// @ts-expect-error Node built-ins are available to the tsx test runner, not the Worker bundle.
import { tmpdir } from 'node:os';
// @ts-expect-error Node built-ins are available to the tsx test runner, not the Worker bundle.
import { join } from 'node:path';

import { SUPERSEDE_INSERT_SQL, WITHDRAW_AUDIT_SQL, WITHDRAW_SQL } from '../services/change-proposals';

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

  query("INSERT INTO change_proposals (id, kind, summary, payload, proposed_by) VALUES ('prop_qa', 'UPDATE_RECRUITMENT', 'QA proposal', '{}', 'mcp-client')");
  const proposal = query("SELECT status, decided_by FROM change_proposals WHERE id = 'prop_qa'")[0];
  assert(proposal?.status === 'PENDING' && proposal?.decided_by === null, 'A new change proposal defaults to PENDING and undecided');
  query("DELETE FROM change_proposals WHERE id = 'prop_qa'");

  // MCP withdraw / supersede: run the real statements. Each `?` is replaced in order by a quoted literal.
  const bind = (sql: string, ...params: Array<string | null>) => {
    let i = 0;
    return sql.replace(/\?/g, () => {
      const value = params[i++];
      return value === null ? 'NULL' : `'${value.replace(/'/g, "''")}'`;
    });
  };
  const changes = (sql: string) => {
    const out = JSON.parse(wrangler('d1', 'execute', 'EligibilityEngine-db', '--local', '--persist-to', persistenceDirectory, '--command', `${sql}; SELECT changes() AS n`, '--json'));
    return out[out.length - 1]?.results?.[0]?.n;
  };
  query("INSERT INTO change_proposals (id, kind, recruitment_id, summary, payload, proposed_by) VALUES ('prop_a', 'UPDATE_RECRUITMENT', 'rec_qa', 'a', '{}', 'mcp-client'), ('prop_b', 'UPDATE_RECRUITMENT', 'rec_qa', 'b', '{}', 'mcp-client'), ('prop_c', 'UPDATE_RECRUITMENT', 'rec_qa', 'c', '{}', 'other')");
  const note = 'Superseded by prop_new';
  assert(changes(bind(WITHDRAW_SQL, 'mcp-client', 'x', 'prop_c', 'mcp-client')) === 0, 'Withdraw is refused for another actor proposal');
  assert(changes(bind(WITHDRAW_SQL, 'mcp-client', note, 'prop_a', 'mcp-client')) === 1, 'Withdraw flips an own PENDING proposal to WITHDRAWN');
  assert(changes(bind(WITHDRAW_SQL, 'mcp-client', note, 'prop_a', 'mcp-client')) === 0, 'A second withdraw changes nothing (guarded on PENDING)');
  query(bind(SUPERSEDE_INSERT_SQL, 'prop_new', 'UPDATE_RECRUITMENT', 'rec_qa', 's', '{}', null, 'prop_a', null, 'mcp-client', 'prop_a', note));
  assert(query("SELECT supersedes_id, status FROM change_proposals WHERE id = 'prop_new'")[0]?.supersedes_id === 'prop_a', 'Replacement is inserted and linked once the old row is WITHDRAWN');
  query(bind(SUPERSEDE_INSERT_SQL, 'prop_bad', 'UPDATE_RECRUITMENT', 'rec_qa', 's', '{}', null, 'prop_b', null, 'mcp-client', 'prop_b', note));
  assert(query("SELECT id FROM change_proposals WHERE id = 'prop_bad'").length === 0, 'No replacement is inserted when the old proposal was not withdrawn');
  query(bind(WITHDRAW_AUDIT_SQL, 'audit_qa', 'mcp-client', 'prop_a', note, 'prop_a', note));
  query(bind(WITHDRAW_AUDIT_SQL, 'audit_qb', 'mcp-client', 'prop_b', note, 'prop_b', note));
  assert(query("SELECT id FROM audit_logs WHERE id IN ('audit_qa','audit_qb')").map(r => r.id).join() === 'audit_qa', 'Audit row is written only for a withdraw that landed');
  query("DELETE FROM change_proposals WHERE id LIKE 'prop_%'; DELETE FROM audit_logs WHERE id LIKE 'audit_q%'");

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
