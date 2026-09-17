-- Migration: 0002_recruitment_detail_content.sql
-- Add dynamic content fields for Overview, Selection Process, Salary/Cadre, and Quota breakdowns

ALTER TABLE recruitments ADD COLUMN overview_markdown TEXT;
ALTER TABLE recruitments ADD COLUMN selection_stages_json TEXT;
ALTER TABLE recruitments ADD COLUMN pay_scale_override TEXT;
ALTER TABLE recruitments ADD COLUMN salary_details_markdown TEXT;
ALTER TABLE recruitments ADD COLUMN cadre_classification TEXT;

ALTER TABLE recruitment_eligibility ADD COLUMN qualification_details_markdown TEXT;
ALTER TABLE recruitment_eligibility ADD COLUMN relaxation_notes_markdown TEXT;

ALTER TABLE vacancies ADD COLUMN quota_pct TEXT;
ALTER TABLE vacancies ADD COLUMN sub_post_name TEXT;
