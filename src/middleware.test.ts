import {
  isAdminRequestAllowed,
  isAdminTestBypass,
  isSameOrigin,
} from './services/admin-integrity';
import { getHostname } from './lib/hostname';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
  console.log(`✅ ${message}`);
}

const allowedAdmins = ['admin@example.com'];

assert(
  isAdminRequestAllowed('ADMIN@example.com', allowedAdmins),
  'a matching ADMIN_EMAILS identity is allowed',
);
assert(
  !isAdminRequestAllowed('outsider@example.com', allowedAdmins),
  'an identity outside ADMIN_EMAILS is rejected',
);
assert(
  !isAdminRequestAllowed(null, allowedAdmins),
  'a missing identity is rejected',
);
assert(
  isAdminTestBypass('secret', 'secret') && isAdminRequestAllowed('admin@rozgarsetu.in', [], true),
  'the secret-backed test bypass is allowed without a production allowlist',
);
assert(
  !isSameOrigin('https://attacker.example', 'admin.example.com'),
  'a mismatched mutation origin is rejected',
);
assert(
  !isAdminRequestAllowed('admin@example.com', []),
  'a missing ADMIN_EMAILS configuration fails closed',
);
assert(
  getHostname(new Request('https://example.com/admin', {
    headers: { 'x-forwarded-host': 'localhost' },
  })) === 'example.com',
  'caller-controlled forwarded host headers cannot masquerade as localhost',
);

console.log('\n🎉 MIDDLEWARE POLICY TESTS PASSED!');
