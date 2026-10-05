-- 0014: advt_number becomes nullable. NULL means "the official notice states no advertisement number".
-- SQLite cannot drop NOT NULL in place, so recruitments is rebuilt. Five child tables reference it with
-- ON DELETE CASCADE, so dropping it would delete their rows: they are copied aside first and restored after.
-- Each _mig0014_guard insert aborts the whole migration (CHECK failure) if a copy does not match.
-- Nothing is dropped until every guard before it has passed.

CREATE TABLE _mig0014_guard (label TEXT NOT NULL, ok INTEGER NOT NULL CHECK (ok = 1));

-- 1. Copy children aside (SELECT * keeps whatever columns exist) and verify.
CREATE TABLE _mig0014_eligibility AS SELECT * FROM recruitment_eligibility;
CREATE TABLE _mig0014_dates AS SELECT * FROM important_dates;
CREATE TABLE _mig0014_vacancies AS SELECT * FROM vacancies;
CREATE TABLE _mig0014_sources AS SELECT * FROM sources;
CREATE TABLE _mig0014_links AS SELECT * FROM official_links;

-- 2. Build the replacement table and copy every recruitment row.
CREATE TABLE recruitments_new (
    id TEXT PRIMARY KEY NOT NULL,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE RESTRICT,
    organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
    state_id TEXT NOT NULL REFERENCES states(id) ON DELETE RESTRICT,
    advt_number TEXT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    short_summary TEXT NOT NULL,
    cycle_year INTEGER NOT NULL,
    total_vacancies INTEGER DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'DRAFT' NOT NULL,
    lifecycle_status TEXT DEFAULT 'NOT_STARTED' NOT NULL,
    is_featured INTEGER DEFAULT 0 NOT NULL,
    validation_status TEXT DEFAULT 'NEEDS_REVIEW' NOT NULL,
    validation_errors_json TEXT,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    overview_markdown TEXT,
    selection_stages_json TEXT,
    pay_scale_override TEXT,
    salary_details_markdown TEXT,
    cadre_classification TEXT,
    exam_status TEXT NOT NULL DEFAULT 'NOT_SCHEDULED',
    result_status TEXT NOT NULL DEFAULT 'NOT_DECLARED',
    seo_title TEXT,
    seo_description TEXT,
    robots_index INTEGER DEFAULT 1 NOT NULL
);
INSERT INTO recruitments_new (
    id, post_id, organisation_id, state_id, advt_number, title, slug, short_summary, cycle_year, total_vacancies,
    status, lifecycle_status, is_featured, validation_status, validation_errors_json, created_at, updated_at,
    overview_markdown, selection_stages_json, pay_scale_override, salary_details_markdown, cadre_classification,
    exam_status, result_status, seo_title, seo_description, robots_index
) SELECT
    id, post_id, organisation_id, state_id, advt_number, title, slug, short_summary, cycle_year, total_vacancies,
    status, lifecycle_status, is_featured, validation_status, validation_errors_json, created_at, updated_at,
    overview_markdown, selection_stages_json, pay_scale_override, salary_details_markdown, cadre_classification,
    exam_status, result_status, seo_title, seo_description, robots_index
FROM recruitments;

-- 3. Guards: every row and every child copy must match before the original is touched.
INSERT INTO _mig0014_guard SELECT 'recruitments row count', (SELECT COUNT(*) FROM recruitments) = (SELECT COUNT(*) FROM recruitments_new);
INSERT INTO _mig0014_guard SELECT 'recruitments ids', NOT EXISTS (SELECT id FROM recruitments EXCEPT SELECT id FROM recruitments_new);
INSERT INTO _mig0014_guard SELECT 'recruitments advt_number unchanged', NOT EXISTS (SELECT 1 FROM recruitments o JOIN recruitments_new n ON n.id = o.id WHERE n.advt_number IS NOT o.advt_number OR n.title IS NOT o.title OR n.slug IS NOT o.slug);
INSERT INTO _mig0014_guard SELECT 'eligibility copy', (SELECT COUNT(*) FROM recruitment_eligibility) = (SELECT COUNT(*) FROM _mig0014_eligibility);
INSERT INTO _mig0014_guard SELECT 'dates copy', (SELECT COUNT(*) FROM important_dates) = (SELECT COUNT(*) FROM _mig0014_dates);
INSERT INTO _mig0014_guard SELECT 'vacancies copy', (SELECT COUNT(*) FROM vacancies) = (SELECT COUNT(*) FROM _mig0014_vacancies);
INSERT INTO _mig0014_guard SELECT 'sources copy', (SELECT COUNT(*) FROM sources) = (SELECT COUNT(*) FROM _mig0014_sources);
INSERT INTO _mig0014_guard SELECT 'links copy', (SELECT COUNT(*) FROM official_links) = (SELECT COUNT(*) FROM _mig0014_links);

-- 4. Swap. Dropping recruitments cascades into the child tables; they are restored from the copies below.
DROP TABLE recruitments;
ALTER TABLE recruitments_new RENAME TO recruitments;

CREATE INDEX idx_rec_status_lifecycle ON recruitments(status, lifecycle_status);
CREATE INDEX idx_rec_exam_result ON recruitments (exam_status, result_status);
CREATE INDEX idx_rec_post ON recruitments(post_id);
CREATE INDEX idx_rec_state ON recruitments(state_id);
CREATE INDEX idx_rec_validation ON recruitments(validation_status);
-- Same identity rule as before for notices that have an advertisement number (NULLs never collide in a unique index).
CREATE UNIQUE INDEX unq_rec_org_advt_cycle ON recruitments (organisation_id, advt_number, cycle_year);
-- Notices without one: same organisation + title + cycle year is the same recruitment (case-insensitive).
CREATE UNIQUE INDEX unq_rec_org_title_cycle_no_advt ON recruitments (organisation_id, title COLLATE NOCASE, cycle_year) WHERE advt_number IS NULL;

-- 5. Restore the children and verify they all came back.
INSERT INTO recruitment_eligibility SELECT * FROM _mig0014_eligibility;
INSERT INTO important_dates SELECT * FROM _mig0014_dates;
INSERT INTO vacancies SELECT * FROM _mig0014_vacancies;
INSERT INTO sources SELECT * FROM _mig0014_sources;
INSERT INTO official_links SELECT * FROM _mig0014_links;

INSERT INTO _mig0014_guard SELECT 'eligibility restored', (SELECT COUNT(*) FROM recruitment_eligibility) = (SELECT COUNT(*) FROM _mig0014_eligibility);
INSERT INTO _mig0014_guard SELECT 'dates restored', (SELECT COUNT(*) FROM important_dates) = (SELECT COUNT(*) FROM _mig0014_dates);
INSERT INTO _mig0014_guard SELECT 'vacancies restored', (SELECT COUNT(*) FROM vacancies) = (SELECT COUNT(*) FROM _mig0014_vacancies);
INSERT INTO _mig0014_guard SELECT 'sources restored', (SELECT COUNT(*) FROM sources) = (SELECT COUNT(*) FROM _mig0014_sources);
INSERT INTO _mig0014_guard SELECT 'links restored', (SELECT COUNT(*) FROM official_links) = (SELECT COUNT(*) FROM _mig0014_links);

-- 6. Clean up.
DROP TABLE _mig0014_eligibility;
DROP TABLE _mig0014_dates;
DROP TABLE _mig0014_vacancies;
DROP TABLE _mig0014_sources;
DROP TABLE _mig0014_links;
DROP TABLE _mig0014_guard;
