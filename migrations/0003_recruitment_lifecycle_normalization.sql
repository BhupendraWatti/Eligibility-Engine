-- Migration 0003: Normalize Recruitment Lifecycle, Exam & Result Status
ALTER TABLE recruitments ADD COLUMN exam_status TEXT NOT NULL DEFAULT 'NOT_SCHEDULED';
ALTER TABLE recruitments ADD COLUMN result_status TEXT NOT NULL DEFAULT 'NOT_DECLARED';
CREATE INDEX IF NOT EXISTS idx_rec_exam_result ON recruitments (exam_status, result_status);
