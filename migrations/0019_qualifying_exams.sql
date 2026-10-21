-- 0019: eligibility tests (UGC NET, CSIR NET, CTET, state TET/SET) and entrance exams (JEE Main, NEET UG, CUET)
-- next to job recruitments. They have no vacancies: everyone who meets the conditions may sit, and passing
-- (qualifying marks, percentile or All India Rank) is what counts. See docs/designs/qualifying-exams.md.
ALTER TABLE recruitments ADD COLUMN exam_kind TEXT NOT NULL DEFAULT 'RECRUITMENT'; -- 'RECRUITMENT' | 'ELIGIBILITY_TEST' | 'ENTRANCE_EXAM'
-- Many of these exams state "no upper age limit"; max_age_general is then not checked by the engine.
ALTER TABLE recruitment_eligibility ADD COLUMN no_upper_age_limit INTEGER NOT NULL DEFAULT 0;

-- One national home for tests open to candidates from every state.
INSERT OR IGNORE INTO sectors (id, name, slug, description, icon, theme, display_order, is_active, created_at, updated_at) VALUES
('sec_national_tests', 'National Eligibility & Entrance Tests', 'national-eligibility-entrance-tests',
 'Qualifying and entrance exams such as UGC NET, CSIR NET, CTET, JEE Main, NEET UG and CUET. No vacancies: candidates who clear the cutoff qualify.',
 'landmark', 'purple', (SELECT COALESCE(MAX(display_order), 0) + 1 FROM sectors), 1, unixepoch(), unixepoch());

-- National Testing Agency (Ministry of Education): conducts UGC NET for UGC, CSIR NET for CSIR, JEE Main, NEET UG and CUET.
INSERT OR IGNORE INTO organisations (id, state_id, name, short_name, slug, website_url, is_active) VALUES
('org_nta', 'st_in', 'National Testing Agency', 'NTA', 'nta', 'https://nta.ac.in', 1);
