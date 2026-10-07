import { sqliteTable, text, integer, real, index, unique } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';

// 1. States Table
export const states = sqliteTable('states', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(), // 'MP', 'RJ', 'IN'
  name: text('name').notNull(), // 'Madhya Pradesh'
  slug: text('slug').notNull().unique(), // 'madhya-pradesh'
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// 2. Recruitment Organisations
export const organisations = sqliteTable('organisations', {
  id: text('id').primaryKey(),
  stateId: text('state_id').notNull().references(() => states.id, { onDelete: 'restrict' }),
  name: text('name').notNull(), // 'Madhya Pradesh Employees Selection Board'
  shortName: text('short_name').notNull(), // 'MPESB'
  slug: text('slug').notNull().unique(), // 'mpesb'
  websiteUrl: text('website_url').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_org_state').on(table.stateId),
]);

// 3. Departments
export const departments = sqliteTable('departments', {
  id: text('id').primaryKey(),
  organisationId: text('organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(), // 'Home Department', 'Revenue Department'
  slug: text('slug').notNull(),
  description: text('description'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  unique('unq_org_dept_slug').on(table.organisationId, table.slug),
]);

// 4. Sectors (High-level category)
export const sectors = sqliteTable('sectors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // 'Police & Defence', 'Teaching & Education'
  slug: text('slug').notNull().unique(),
  description: text('description'),
  icon: text('icon'),
  theme: text('theme').notNull().default('blue'),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// 5. Canonical Posts (Evergreen Entity)
export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  departmentId: text('department_id').notNull().references(() => departments.id, { onDelete: 'restrict' }),
  sectorId: text('sector_id').notNull().references(() => sectors.id, { onDelete: 'restrict' }),
  title: text('title').notNull(), // 'Police Constable (General Duty)'
  slug: text('slug').notNull().unique(), // 'mp-police-constable'
  summary: text('summary').notNull(),
  payScale: text('pay_scale'),
  defaultMinAge: integer('default_min_age').notNull().default(18),
  defaultMaxAge: integer('default_max_age').notNull().default(33),
  defaultQualification: text('default_qualification').notNull().default('10TH'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_posts_sector').on(table.sectorId),
  index('idx_posts_dept').on(table.departmentId),
]);

// 6. Recruitments (Time-Bound Recruitment Drive)
export const recruitments = sqliteTable('recruitments', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => posts.id, { onDelete: 'restrict' }),
  organisationId: text('organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  stateId: text('state_id').notNull().references(() => states.id, { onDelete: 'restrict' }),
  advtNumber: text('advt_number'), // '05/2026'; NULL when the official notice states none
  title: text('title').notNull(), // 'MP Police Constable Recruitment 2026'
  slug: text('slug').notNull().unique(),
  shortSummary: text('short_summary').notNull(),
  cycleYear: integer('cycle_year').notNull(),
  totalVacancies: integer('total_vacancies').notNull().default(0),
  status: text('status').notNull().default('DRAFT'), // 'DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'PUBLISHED', 'UPDATE_REQUIRED', 'ARCHIVED'
  lifecycleStatus: text('lifecycle_status').notNull().default('NOT_STARTED'), // Canonical derived lifecycle state: 'NOT_STARTED', 'APPLICATION_OPEN', 'APPLICATION_CLOSING', 'APPLICATION_CLOSED', 'EXAM_SCHEDULED', 'EXAM_COMPLETED', 'RESULT_DECLARED'
  examStatus: text('exam_status').notNull().default('NOT_SCHEDULED'), // 'NOT_SCHEDULED', 'SCHEDULED', 'POSTPONED', 'CANCELLED', 'COMPLETED'
  resultStatus: text('result_status').notNull().default('NOT_DECLARED'), // 'NOT_DECLARED', 'DECLARED'
  isFeatured: integer('is_featured').notNull().default(0),
  validationStatus: text('validation_status').notNull().default('NEEDS_REVIEW'), // 'VALID', 'WARNING', 'INVALID', 'NEEDS_REVIEW'
  validationErrorsJson: text('validation_errors_json'),
  overviewMarkdown: text('overview_markdown'),
  selectionStagesJson: text('selection_stages_json'),
  payScaleOverride: text('pay_scale_override'),
  salaryDetailsMarkdown: text('salary_details_markdown'),
  cadreClassification: text('cadre_classification'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  robotsIndex: integer('robots_index').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_rec_status_lifecycle').on(table.status, table.lifecycleStatus),
  index('idx_rec_exam_result').on(table.examStatus, table.resultStatus),
  index('idx_rec_post').on(table.postId),
  index('idx_rec_state').on(table.stateId),
  index('idx_rec_validation').on(table.validationStatus),
  unique('unq_rec_org_advt_cycle').on(table.organisationId, table.advtNumber, table.cycleYear),
]);

// 7. Typed Recruitment Eligibility (The Simplified Model)
export const recruitmentEligibility = sqliteTable('recruitment_eligibility', {
  id: text('id').primaryKey(),
  recruitmentId: text('recruitment_id').notNull().unique().references(() => recruitments.id, { onDelete: 'cascade' }),
  minAge: integer('min_age').notNull().default(18),
  maxAgeGeneral: integer('max_age_general').notNull().default(33),
  ageCutoffDate: text('age_cutoff_date').notNull(), // 'YYYY-MM-DD'
  ageRelaxationScSt: integer('age_relaxation_sc_st').notNull().default(5),
  ageRelaxationObc: integer('age_relaxation_obc').notNull().default(3),
  ageRelaxationFemale: integer('age_relaxation_female').notNull().default(5),
  minQualificationLevel: text('min_qualification_level').notNull(), // '7TH', '8TH', '10TH', '12TH', 'ITI', 'DIPLOMA', 'GRADUATION', 'POST_GRADUATION'
  allowedStreamsJson: text('allowed_streams_json'), // JSON array e.g. ["ANY"] or ["SCIENCE"]
  requiresMpDomicile: integer('requires_mp_domicile').notNull().default(0),
  domicileStateCode: text('domicile_state_code'),
  reservationStateCode: text('reservation_state_code'), // category/women relaxations only for this state's domiciles
  qualificationByCategoryJson: text('qualification_by_category_json'), // e.g. {"ST":"8TH"}
  requiresMpEmploymentReg: integer('requires_mp_employment_reg').notNull().default(0),
  employmentRegistrationLabel: text('employment_registration_label'),
  requiresCpct: integer('requires_cpct').notNull().default(0),
  genderAllowed: text('gender_allowed').notNull().default('ALL'), // 'ALL', 'MALE', 'FEMALE'
  minHeightMaleCm: real('min_height_male_cm'),
  minHeightFemaleCm: real('min_height_female_cm'),
  minChestMaleCm: real('min_chest_male_cm'),
  ageRelaxationEws: integer('age_relaxation_ews').notNull().default(0),
  minPercentageRequired: integer('min_percentage_required'),
  additionalSkillsJson: text('additional_skills_json'),
  experienceMonths: integer('experience_months').notNull().default(0),
  specialConditionsNotes: text('special_conditions_notes'),
  qualificationDetailsMarkdown: text('qualification_details_markdown'),
  relaxationNotesMarkdown: text('relaxation_notes_markdown'),
});

// 8. Vacancies (Category-Wise Breakdown)
export const vacancies = sqliteTable('vacancies', {
  id: text('id').primaryKey(),
  recruitmentId: text('recruitment_id').notNull().references(() => recruitments.id, { onDelete: 'cascade' }),
  category: text('category').notNull(), // 'UR', 'SC', 'ST', 'OBC', 'EWS', 'TOTAL'
  gender: text('gender').notNull().default('ALL'), // 'ALL', 'MALE', 'FEMALE'
  count: integer('count').notNull(),
  quotaPct: text('quota_pct'),
  subPostName: text('sub_post_name'),
}, (table) => [
  index('idx_vacancies_rec').on(table.recruitmentId),
]);

// 9. Important Dates
export const importantDates = sqliteTable('important_dates', {
  id: text('id').primaryKey(),
  recruitmentId: text('recruitment_id').notNull().references(() => recruitments.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(), // 'NOTIFICATION', 'APPLICATION_START', 'APPLICATION_END', 'CORRECTION_END', 'EXAM_DATE', 'ADMIT_CARD', 'RESULT'
  eventDate: text('event_date').notNull(), // 'YYYY-MM-DD'
  isTentative: integer('is_tentative').notNull().default(0),
  notes: text('notes'),
}, (table) => [
  index('idx_dates_rec').on(table.recruitmentId),
]);

// 10. Sources (Provenance & Trust)
export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  recruitmentId: text('recruitment_id').notNull().references(() => recruitments.id, { onDelete: 'cascade' }),
  sourceType: text('source_type').notNull(), // 'OFFICIAL_NOTIFICATION_PDF', 'GOVT_GAZETTE', 'OFFICIAL_PORTAL'
  sourceUrl: text('source_url').notNull(),
  sourceTitle: text('source_title').notNull(),
  publicationDate: text('publication_date'),
  lastVerifiedAt: integer('last_verified_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_sources_rec').on(table.recruitmentId),
]);

// 11. Official Links
export const officialLinks = sqliteTable('official_links', {
  id: text('id').primaryKey(),
  recruitmentId: text('recruitment_id').notNull().references(() => recruitments.id, { onDelete: 'cascade' }),
  linkType: text('link_type').notNull(), // 'APPLY_ONLINE', 'NOTIFICATION_PDF', 'SYLLABUS_PDF', 'ADMIT_CARD', 'RESULT'
  title: text('title').notNull(),
  url: text('url').notNull(),
  isActive: integer('is_active').notNull().default(1),
}, (table) => [
  index('idx_links_rec').on(table.recruitmentId),
]);

// 12. Admin Users
export const adminUsers = sqliteTable('admin_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull().default('EDITOR'), // 'SUPER_ADMIN', 'EDITOR'
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// 13. Audit Logs (Operational Traceability & Integrity Trail)
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  adminEmail: text('admin_email').notNull(),
  entity: text('entity').notNull(), // 'RECRUITMENT', 'ELIGIBILITY', 'SOURCE', 'POST', 'VACANCY'
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(), // 'CREATE', 'UPDATE', 'VERIFY', 'PUBLISH', 'UNPUBLISH', 'ARCHIVE'
  field: text('field'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  reason: text('reason'),
  source: text('source'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_audit_entity').on(table.entity, table.entityId),
  index('idx_audit_admin').on(table.adminEmail),
  index('idx_audit_created').on(table.createdAt),
]);

// 14. Generic Records & Key-Value Document Store
export const records = sqliteTable('records', {
  id: text('id').primaryKey(),
  type: text('type').notNull().default('general'),
  data: text('data').notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_records_type').on(table.type),
]);

// 15. Change Proposals (MCP proposes, a human admin approves; see src/services/change-proposals.ts)
export const changeProposals = sqliteTable('change_proposals', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(), // 'CREATE_RECRUITMENT' | 'UPDATE_RECRUITMENT'
  recruitmentId: text('recruitment_id'),
  summary: text('summary').notNull(),
  payload: text('payload').notNull(),
  baseSnapshot: text('base_snapshot'),
  status: text('status').notNull().default('PENDING'), // 'PENDING' | 'APPLYING' | 'APPROVED' | 'REJECTED' | 'FAILED' | 'WITHDRAWN'
  supersedesId: text('supersedes_id'),
  meta: text('meta'), // JSON: { evidence?, duplicate? } beside the allowlisted payload
  proposedBy: text('proposed_by').notNull(),
  decidedBy: text('decided_by'),
  decidedAt: integer('decided_at', { mode: 'timestamp' }),
  decisionNote: text('decision_note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  index('idx_proposals_status').on(table.status, table.createdAt),
  index('idx_proposals_recruitment').on(table.recruitmentId),
]);

// Relationships
export const statesRelations = relations(states, ({ many }) => ({
  organisations: many(organisations),
  recruitments: many(recruitments),
}));

export const organisationsRelations = relations(organisations, ({ one, many }) => ({
  state: one(states, { fields: [organisations.stateId], references: [states.id] }),
  departments: many(departments),
  recruitments: many(recruitments),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  organisation: one(organisations, { fields: [departments.organisationId], references: [organisations.id] }),
  posts: many(posts),
}));

export const sectorsRelations = relations(sectors, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  department: one(departments, { fields: [posts.departmentId], references: [departments.id] }),
  sector: one(sectors, { fields: [posts.sectorId], references: [sectors.id] }),
  recruitments: many(recruitments),
}));

export const recruitmentsRelations = relations(recruitments, ({ one, many }) => ({
  post: one(posts, { fields: [recruitments.postId], references: [posts.id] }),
  organisation: one(organisations, { fields: [recruitments.organisationId], references: [organisations.id] }),
  state: one(states, { fields: [recruitments.stateId], references: [states.id] }),
  eligibility: one(recruitmentEligibility, { fields: [recruitments.id], references: [recruitmentEligibility.recruitmentId] }),
  vacancies: many(vacancies),
  importantDates: many(importantDates),
  sources: many(sources),
  officialLinks: many(officialLinks),
}));

// Inverse relations for child tables (required by Drizzle for relational queries)
export const recruitmentEligibilityRelations = relations(recruitmentEligibility, ({ one }) => ({
  recruitment: one(recruitments, { fields: [recruitmentEligibility.recruitmentId], references: [recruitments.id] }),
}));

export const vacanciesRelations = relations(vacancies, ({ one }) => ({
  recruitment: one(recruitments, { fields: [vacancies.recruitmentId], references: [recruitments.id] }),
}));

export const importantDatesRelations = relations(importantDates, ({ one }) => ({
  recruitment: one(recruitments, { fields: [importantDates.recruitmentId], references: [recruitments.id] }),
}));

export const sourcesRelations = relations(sources, ({ one }) => ({
  recruitment: one(recruitments, { fields: [sources.recruitmentId], references: [recruitments.id] }),
}));

export const officialLinksRelations = relations(officialLinks, ({ one }) => ({
  recruitment: one(recruitments, { fields: [officialLinks.recruitmentId], references: [recruitments.id] }),
}));

/** Snapshot of a recruitment BEFORE each change (migration 0015), so any change can be undone from /admin. */
export const recordVersions = sqliteTable('record_versions', {
  id: text('id').primaryKey(),
  recruitmentId: text('recruitment_id').notNull(),
  version: integer('version').notNull(),
  snapshot: text('snapshot').notNull(),
  changedBy: text('changed_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
