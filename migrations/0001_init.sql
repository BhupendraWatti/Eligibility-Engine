-- Migration: 0001_init.sql
-- Core schema for Eligibility Engine (NIRNAY OPS) and Admin Management

-- 1. Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'EDITOR' NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- 2. States / Regions
CREATE TABLE IF NOT EXISTS states (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- 3. Recruitment Organisations
CREATE TABLE IF NOT EXISTS organisations (
    id TEXT PRIMARY KEY NOT NULL,
    state_id TEXT NOT NULL REFERENCES states(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    website_url TEXT NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_org_state ON organisations(state_id);

-- 4. Departments
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY NOT NULL,
    organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    UNIQUE(organisation_id, slug)
);

-- 5. Sectors
CREATE TABLE IF NOT EXISTS sectors (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    display_order INTEGER DEFAULT 0 NOT NULL
);

-- 6. Canonical Posts
CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY NOT NULL,
    department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    sector_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    summary TEXT NOT NULL,
    pay_scale TEXT,
    default_min_age INTEGER DEFAULT 18 NOT NULL,
    default_max_age INTEGER DEFAULT 33 NOT NULL,
    default_qualification TEXT DEFAULT '10TH' NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_sector ON posts(sector_id);
CREATE INDEX IF NOT EXISTS idx_posts_dept ON posts(department_id);

-- 7. Recruitments (Live Drives)
CREATE TABLE IF NOT EXISTS recruitments (
    id TEXT PRIMARY KEY NOT NULL,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE RESTRICT,
    organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
    state_id TEXT NOT NULL REFERENCES states(id) ON DELETE RESTRICT,
    advt_number TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    short_summary TEXT NOT NULL,
    cycle_year INTEGER NOT NULL,
    total_vacancies INTEGER DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'DRAFT' NOT NULL,
    lifecycle_status TEXT DEFAULT 'UPCOMING' NOT NULL,
    is_featured INTEGER DEFAULT 0 NOT NULL,
    validation_status TEXT DEFAULT 'NEEDS_REVIEW' NOT NULL,
    validation_errors_json TEXT,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rec_status_lifecycle ON recruitments(status, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_rec_post ON recruitments(post_id);
CREATE INDEX IF NOT EXISTS idx_rec_state ON recruitments(state_id);
CREATE INDEX IF NOT EXISTS idx_rec_validation ON recruitments(validation_status);

-- 8. Recruitment Eligibility Criteria
CREATE TABLE IF NOT EXISTS recruitment_eligibility (
    id TEXT PRIMARY KEY NOT NULL,
    recruitment_id TEXT NOT NULL UNIQUE REFERENCES recruitments(id) ON DELETE CASCADE,
    min_age INTEGER DEFAULT 18 NOT NULL,
    max_age_general INTEGER DEFAULT 33 NOT NULL,
    age_cutoff_date TEXT NOT NULL,
    age_relaxation_sc_st INTEGER DEFAULT 5 NOT NULL,
    age_relaxation_obc INTEGER DEFAULT 3 NOT NULL,
    age_relaxation_female INTEGER DEFAULT 5 NOT NULL,
    age_relaxation_ews INTEGER DEFAULT 0 NOT NULL,
    min_qualification_level TEXT NOT NULL,
    allowed_streams_json TEXT,
    requires_mp_domicile INTEGER DEFAULT 0 NOT NULL,
    requires_mp_employment_reg INTEGER DEFAULT 1 NOT NULL,
    requires_cpct INTEGER DEFAULT 0 NOT NULL,
    gender_allowed TEXT DEFAULT 'ALL' NOT NULL,
    min_height_male_cm REAL,
    min_height_female_cm REAL,
    min_chest_male_cm REAL,
    experience_months INTEGER DEFAULT 0 NOT NULL,
    min_percentage_required INTEGER,
    additional_skills_json TEXT,
    special_conditions_notes TEXT
);

-- 9. Important Dates
CREATE TABLE IF NOT EXISTS important_dates (
    id TEXT PRIMARY KEY NOT NULL,
    recruitment_id TEXT NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_date TEXT NOT NULL,
    is_tentative INTEGER DEFAULT 0 NOT NULL,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_dates_rec ON important_dates(recruitment_id);

-- 10. Official Links
CREATE TABLE IF NOT EXISTS official_links (
    id TEXT PRIMARY KEY NOT NULL,
    recruitment_id TEXT NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL
);

-- 11. Vacancies Breakdown
CREATE TABLE IF NOT EXISTS vacancies (
    id TEXT PRIMARY KEY NOT NULL,
    recruitment_id TEXT NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    gender TEXT DEFAULT 'ALL' NOT NULL,
    count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vacancies_rec ON vacancies(recruitment_id);

-- 12. Sources
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY NOT NULL,
    recruitment_id TEXT NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    publication_date TEXT,
    last_verified_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- 13. Generic Admin Records & Key-Value Document Store
CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    data TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_records_type ON records(type);

-- 14. Audit Logs (Operational Traceability & Integrity Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY NOT NULL,
    admin_email TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    field TEXT,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    source TEXT,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs(admin_email);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
