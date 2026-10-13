// Fails the build when a current drive (any important date today or later, in IST) has no official source URL,
// or its newest source was last verified more than MAX_AGE_DAYS ago.
// Usage: node scripts/check-drive-sources.mjs [--local]   (default reads the remote D1 database)
// Re-verify a source in the admin panel to refresh its date. SKIP_SOURCE_CHECK=1 skips the check (offline builds).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAX_AGE_DAYS = 7;
const DATABASE = 'EligibilityEngine-db';

if (process.env.SKIP_SOURCE_CHECK === '1') {
  console.warn('check-drive-sources: skipped (SKIP_SOURCE_CHECK=1)');
  process.exit(0);
}

const now = new Date();
const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const oldest = Math.floor(now.getTime() / 1000) - MAX_AGE_DAYS * 86400;

const sql = `SELECT r.id, r.title, COUNT(s.id) AS sources, MAX(s.last_verified_at) AS verified
FROM recruitments r
LEFT JOIN sources s ON s.recruitment_id = r.id AND trim(s.source_url) <> ''
WHERE r.status = 'PUBLISHED'
  AND EXISTS (SELECT 1 FROM important_dates d WHERE d.recruitment_id = r.id AND d.event_date >= '${todayIST}')
GROUP BY r.id;`;

// Run wrangler's own entry with this Node, so the SQL is passed as one argument with no shell quoting.
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const where = process.argv.includes('--local') ? '--local' : '--remote';
const out = execFileSync(process.execPath, [wrangler, 'd1', 'execute', DATABASE, where, '--json', '--command', sql.replace(/\s+/g, ' ')], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});
const rows = JSON.parse(out)[0].results;

const day = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(t * 1000));
const problems = rows.flatMap((r) => {
  if (!r.sources) return [`${r.title} (${r.id}): no source_url`];
  if (!r.verified || r.verified < oldest) return [`${r.title} (${r.id}): last verified ${r.verified ? day(r.verified) : 'never'}, more than ${MAX_AGE_DAYS} days ago`];
  return [];
});

if (problems.length) {
  console.error(`check-drive-sources: ${problems.length} current drive(s) need their official source re-checked:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`check-drive-sources: ${rows.length} current drive(s) have a source verified within ${MAX_AGE_DAYS} days.`);
