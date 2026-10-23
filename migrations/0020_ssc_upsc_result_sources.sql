-- 0020: official SSC and UPSC result listings for the data pipeline.
-- Rows start as NEEDS_VERIFICATION: the pipeline only checks the page loads until an admin approves each source
-- in the source registry. The pipeline only PROPOSES changes; nothing here publishes anything.
-- Note: ssc.gov.in renders its result list with JavaScript, so a plain fetch of the home page lists no documents.
-- Result PDFs live under https://ssc.gov.in/api/attachment/uploads/masterData/Results/ and NoticeBoards/.
INSERT OR IGNORE INTO source_registry (id, name, url, source_type, category, organisation_id, state_code, department, frequency_hours) VALUES
 ('src_upsc_written_result', 'UPSC - Written results', 'https://www.upsc.gov.in/exams-related-info/written-result', 'NOTICE_PAGE', 'RESULTS', 'org_783f46cf-d2dc-4692-8c6e-225f8c389008', 'IN', NULL, 3),
 ('src_upsc_final_result', 'UPSC - Final results', 'https://www.upsc.gov.in/exams-related-info/final-result', 'NOTICE_PAGE', 'RESULTS', 'org_783f46cf-d2dc-4692-8c6e-225f8c389008', 'IN', NULL, 3),
 ('src_upsc_final_result_archive', 'UPSC - Final results archive', 'https://www.upsc.gov.in/exams-related-info/final-result/archives', 'NOTICE_PAGE', 'RESULTS', 'org_783f46cf-d2dc-4692-8c6e-225f8c389008', 'IN', NULL, 24);
