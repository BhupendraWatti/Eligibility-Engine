-- 0015: automated data pipeline (source registry, run log, settings, LLM usage, record version history).
-- The pipeline only ever PROPOSES (change_proposals); nothing here makes a record public by itself.

CREATE TABLE IF NOT EXISTS source_registry (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    source_type TEXT NOT NULL DEFAULT 'NOTICE_PAGE',      -- NOTICE_PAGE | RSS | PDF_LIST
    category TEXT NOT NULL,                               -- JOBS | ADMIT_CARDS | RESULTS | ANSWER_KEYS | ADMISSIONS | SCHOLARSHIPS | SYLLABUS | BOOKS | KNOWLEDGE
    organisation_id TEXT REFERENCES organisations(id) ON DELETE SET NULL,
    state_code TEXT,
    department TEXT,
    frequency_hours INTEGER NOT NULL DEFAULT 3,
    last_checked_at INTEGER,
    last_content_hash TEXT,
    last_error TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'NEEDS_VERIFICATION',    -- NEEDS_VERIFICATION | ACTIVE | PAUSED | FAILING
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_registry_due ON source_registry(status, category, last_checked_at);

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,                                   -- NOTICES | DAILY | LINKS
    trigger_by TEXT NOT NULL,                             -- cron | manual
    dry_run INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'RUNNING',               -- RUNNING | OK | PARTIAL | FAILED | CAP_REACHED | PAUSED
    started_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    finished_at INTEGER,
    sources_checked INTEGER NOT NULL DEFAULT 0,
    sources_changed INTEGER NOT NULL DEFAULT 0,
    items_found INTEGER NOT NULL DEFAULT 0,
    proposals_created INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    llm_cost_usd REAL NOT NULL DEFAULT 0,
    detail TEXT                                           -- JSON: per-source outcomes and error messages
);
CREATE INDEX IF NOT EXISTS idx_runs_started ON pipeline_runs(started_at);

-- One row per discovered document. (doc_url, doc_hash) of a LIVE run is never processed twice.
CREATE TABLE IF NOT EXISTS pipeline_items (
    id TEXT PRIMARY KEY NOT NULL,
    run_id TEXT NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES source_registry(id) ON DELETE CASCADE,
    doc_url TEXT NOT NULL,
    doc_hash TEXT,
    dry_run INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,                                 -- PROPOSED | AUTO_CREATED | UNCHANGED | INVALID | INCOMPLETE | AMBIGUOUS | UNMATCHED | UNSUPPORTED | DEFERRED | DRY_RUN | ERROR
    doc_type TEXT,
    title TEXT,
    confidence REAL,
    reason TEXT,
    extracted_json TEXT,                                  -- exactly what the model returned, incl. quoted evidence
    validation_json TEXT,
    proposal_id TEXT,
    dismissed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_seen ON pipeline_items(doc_url, doc_hash, dry_run);
CREATE INDEX IF NOT EXISTS idx_items_run ON pipeline_items(run_id);

CREATE TABLE IF NOT EXISTS pipeline_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_by TEXT,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
INSERT OR IGNORE INTO pipeline_settings (key, value) VALUES
    ('automation_paused', '0'),               -- global kill switch
    ('auto_publish_high_confidence', '0'),    -- OFF by default
    ('auto_publish_threshold', '0.95'),
    ('daily_llm_cap_usd', '2'),
    ('daily_new_draft_cap', '20'),
    ('extraction_model', 'claude-haiku-4-5'),
    ('alert_email', '');

CREATE TABLE IF NOT EXISTS llm_usage (
    id TEXT PRIMARY KEY NOT NULL,
    run_id TEXT,
    source_id TEXT,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_created ON llm_usage(created_at);

-- Snapshot of a recruitment BEFORE each change, so any change can be undone from /admin.
CREATE TABLE IF NOT EXISTS record_versions (
    id TEXT PRIMARY KEY NOT NULL,
    recruitment_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    snapshot TEXT NOT NULL,
    changed_by TEXT,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    UNIQUE (recruitment_id, version)
);

-- Weekly dead-link check results on official links.
ALTER TABLE official_links ADD COLUMN link_status TEXT;
ALTER TABLE official_links ADD COLUMN link_checked_at INTEGER;
ALTER TABLE official_links ADD COLUMN link_failures INTEGER NOT NULL DEFAULT 0;

-- Official sources only. Every row starts as NEEDS_VERIFICATION and becomes ACTIVE only after the pipeline
-- fetches it successfully from an allow-listed domain (robots.txt permitting). Aggregator sites are never listed.
INSERT OR IGNORE INTO source_registry (id, name, url, source_type, category, state_code, department, frequency_hours) VALUES
 ('src_ssc',        'SSC - Notice board',                 'https://ssc.gov.in/',                                   'NOTICE_PAGE', 'JOBS',        NULL, 'Staff Selection Commission', 3),
 ('src_upsc',       'UPSC - What''s new',                 'https://upsc.gov.in/whats-new',                         'NOTICE_PAGE', 'JOBS',        NULL, 'Union Public Service Commission', 3),
 ('src_ibps',       'IBPS - Home',                        'https://www.ibps.in/',                                  'NOTICE_PAGE', 'JOBS',        NULL, 'Institute of Banking Personnel Selection', 3),
 ('src_rbi_jobs',   'RBI - Vacancies',                    'https://opportunities.rbi.org.in/Scripts/Vacancies.aspx','NOTICE_PAGE', 'JOBS',        NULL, 'Reserve Bank of India', 3),
 ('src_sbi_jobs',   'SBI - Current openings',             'https://sbi.co.in/web/careers/current-openings',        'NOTICE_PAGE', 'JOBS',        NULL, 'State Bank of India', 3),
 ('src_railways',   'Indian Railways - Home',             'https://indianrailways.gov.in/',                        'NOTICE_PAGE', 'JOBS',        NULL, 'Indian Railways', 3),
 ('src_rrb_chd',    'RRB Chandigarh',                     'https://www.rrbcdg.gov.in/',                            'NOTICE_PAGE', 'JOBS',        NULL, 'Railway Recruitment Board', 3),
 ('src_rrb_bpl',    'RRB Bhopal',                         'https://www.rrbbpl.nic.in/',                            'NOTICE_PAGE', 'JOBS',        'MP', 'Railway Recruitment Board', 3),
 ('src_nta',        'NTA - Home',                         'https://nta.ac.in/',                                    'NOTICE_PAGE', 'ADMISSIONS',  NULL, 'National Testing Agency', 3),
 ('src_mppsc',      'MPPSC - Home',                       'https://mppsc.mp.gov.in/',                              'NOTICE_PAGE', 'JOBS',        'MP', 'Madhya Pradesh Public Service Commission', 3),
 ('src_mpesb',      'MPESB - Home',                       'https://esb.mp.gov.in/',                                'NOTICE_PAGE', 'JOBS',        'MP', 'MP Employees Selection Board', 3),
 ('src_uppsc',      'UPPSC - Home',                       'https://uppsc.up.nic.in/',                              'NOTICE_PAGE', 'JOBS',        'UP', 'Uttar Pradesh Public Service Commission', 3),
 ('src_bpsc',       'BPSC - Home',                        'https://www.bpsc.bih.nic.in/',                          'NOTICE_PAGE', 'JOBS',        'BR', 'Bihar Public Service Commission', 3),
 ('src_rpsc',       'RPSC - Home',                        'https://rpsc.rajasthan.gov.in/',                        'NOTICE_PAGE', 'JOBS',        'RJ', 'Rajasthan Public Service Commission', 3),
 ('src_hpsc',       'HPSC - Home',                        'https://hpsc.gov.in/',                                  'NOTICE_PAGE', 'JOBS',        'HR', 'Haryana Public Service Commission', 3),
 ('src_pib_rss',    'PIB - Press releases (RSS)',         'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3','RSS',         'KNOWLEDGE',   NULL, 'Press Information Bureau', 24),
 ('src_ncert_books','NCERT - Textbooks',                  'https://ncert.nic.in/textbook.php',                     'NOTICE_PAGE', 'BOOKS',       NULL, 'NCERT', 24),
 ('src_upsc_syll',  'UPSC - Examination syllabus',        'https://upsc.gov.in/examinations/syllabus',             'NOTICE_PAGE', 'SYLLABUS',    NULL, 'Union Public Service Commission', 24);

-- Link registry rows to existing organisation masters (only the MP bodies exist as masters today).
UPDATE source_registry SET organisation_id = 'org_mpesb' WHERE id = 'src_mpesb' AND EXISTS (SELECT 1 FROM organisations WHERE id = 'org_mpesb');
UPDATE source_registry SET organisation_id = 'org_mppsc' WHERE id = 'src_mppsc' AND EXISTS (SELECT 1 FROM organisations WHERE id = 'org_mppsc');
