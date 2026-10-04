import {
  createAdminUser,
  createCanonicalPost,
  createDepartment,
  createOrganisation,
  FALLBACK_RECRUITMENTS,
  getAdminUsers,
  updateAdminUser,
  updateCanonicalPost,
  updateDepartment,
  updateOrganisation,
  updateRecruitmentEligibility,
  updateRecruitmentSeo,
  updateRecruitmentStatus,
} from './queries';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const assertEqual = (actual: unknown, expected: unknown, message: string) => {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
};

const adminEmail = 'crud-test@localhost';

const organisationId = await createOrganisation({ stateId: 'st_mp', name: 'CRUD Test Commission', shortName: 'CTC', slug: 'crud-test-commission', websiteUrl: 'https://example.gov.in', isActive: 1, adminEmail });
assert(await updateOrganisation({ id: organisationId, name: 'CRUD Test Commission Updated', isActive: 0, adminEmail }), 'Organisation update failed');

const departmentId = await createDepartment({ organisationId, name: 'CRUD Test Department', slug: 'crud-test-department', isActive: 1, adminEmail });
assert(await updateDepartment({ id: departmentId, description: 'Updated safely', isActive: 0, adminEmail }), 'Department update failed');

const postId = await createCanonicalPost({ departmentId, sectorId: 'sec_admin', title: 'CRUD Test Post', slug: 'crud-test-post', summary: 'Test-only canonical record', payScale: null, defaultMinAge: 18, defaultMaxAge: 30, defaultQualification: '10TH', isActive: 1 });
assert(await updateCanonicalPost({ id: postId, defaultMaxAge: 32, isActive: 0 }), 'Canonical post update failed');

const userId = await createAdminUser({ name: 'CRUD Test User', email: 'crud-user@example.in', role: 'REVIEWER', adminEmail });
assert(await updateAdminUser({ id: userId, role: 'EDITOR', isActive: 0, adminEmail }), 'Admin user update failed');
assertEqual((await getAdminUsers()).find(user => user.id === userId)?.isActive, 0, 'Admin user should be revoked');

const recruitment = FALLBACK_RECRUITMENTS[0];
assert(await updateRecruitmentSeo({ id: recruitment.id, seoTitle: 'Test SEO', seoDescription: 'Test description', robotsIndex: 0, adminEmail }), 'SEO update failed');
assertEqual(recruitment.seoTitle, 'Test SEO', 'SEO title should be persisted');
assert(await updateRecruitmentEligibility(recruitment.id, { minAge: 19, maxAgeGeneral: 34, ageCutoffDate: '2026-01-01', minQualificationLevel: '12TH', requiresMpDomicile: true, domicileStateCode: 'RJ', requiresMpEmploymentReg: true, employmentRegistrationLabel: 'RJ_EMPLOYMENT', adminEmail }), 'Eligibility update failed');
assertEqual(recruitment.criteria.domicileStateCode, 'RJ', 'Domicile state should be persisted');
assert(await updateRecruitmentStatus(recruitment.id, 'DRAFT', adminEmail), 'Recruitment status update failed');
assertEqual(recruitment.status, 'DRAFT', 'Recruitment status should be persisted');

console.log('Admin master, access, SEO, eligibility, and status CRUD checks passed.');
