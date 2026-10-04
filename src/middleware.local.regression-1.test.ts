// Regression: ISSUE-001 — trusted local admin requests were assigned an empty identity and rejected.
// Found by /qa on 2026-10-04.
// Report: .gstack/qa-reports/qa-report-localhost-2026-10-04.md
// @ts-expect-error Node built-ins are available to the tsx test runner, not the Worker bundle.
import { readFileSync } from 'node:fs';
import { isAdminRequestAllowed } from './services/admin-integrity';

const middleware = readFileSync('src/middleware.ts', 'utf8');
const localAdmin = middleware.match(/userEmail\s*=\s*'([^']+)'/)?.[1] || '';

if (localAdmin !== 'admin@rozgarsetu.in') {
  throw new Error(`Expected the seeded local admin identity, received "${localAdmin}".`);
}

if (!isAdminRequestAllowed(localAdmin, [], true)) {
  throw new Error('Trusted local requests must pass authorization with the seeded identity.');
}

console.log('Local admin middleware regression check passed.');
