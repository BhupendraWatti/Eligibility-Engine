-- ==============================================================================
-- RozgarSetu MP: Master Seed Data
-- ==============================================================================

-- 1. States
INSERT OR REPLACE INTO states (id, code, name, slug, is_active, created_at) VALUES
('st_mp', 'MP', 'Madhya Pradesh', 'madhya-pradesh', 1, unixepoch());

-- 2. Organisations
INSERT OR REPLACE INTO organisations (id, state_id, name, short_name, slug, website_url, is_active, created_at) VALUES
('org_mpesb', 'st_mp', 'Madhya Pradesh Employees Selection Board', 'MPESB', 'mpesb', 'https://esb.mp.gov.in', 1, unixepoch()),
('org_mppsc', 'st_mp', 'Madhya Pradesh Public Service Commission', 'MPPSC', 'mppsc', 'https://mppsc.mp.gov.in', 1, unixepoch()),
('org_mphc',  'st_mp', 'High Court of Madhya Pradesh', 'MPHC', 'mphc', 'https://mphc.gov.in', 1, unixepoch());

-- 3. Departments
INSERT OR REPLACE INTO departments (id, organisation_id, name, slug, description, is_active, created_at) VALUES
('dept_home',      'org_mpesb', 'Home Department (Police)', 'home-department', 'Police services, law enforcement, and internal security', 1, unixepoch()),
('dept_revenue',   'org_mpesb', 'Revenue Department', 'revenue-department', 'Land records, revenue administration, and Patwari cadrec', 1, unixepoch()),
('dept_forest',    'org_mpesb', 'Forest Department', 'forest-department', 'Wildlife conservation and forest guard cadrec', 1, unixepoch()),
('dept_education', 'org_mpesb', 'School Education Department', 'school-education', 'Primary, secondary, and higher secondary teacher cadrec', 1, unixepoch()),
('dept_gad',       'org_mppsc', 'General Administration Department', 'general-administration', 'State administrative services and clerical cadre', 1, unixepoch());

-- 4. Sectors
INSERT OR REPLACE INTO sectors (id, name, slug, icon, display_order) VALUES
('sec_police',   'Police & Defence', 'police-defence', 'Shield', 1),
('sec_admin',    'Administrative & Clerical', 'administrative-clerical', 'Building2', 2),
('sec_forest',   'Forest & Environment', 'forest-environment', 'Trees', 3),
('sec_teaching', 'Teaching & Education', 'teaching-education', 'GraduationCap', 4);

-- 5. Canonical Posts (Evergreen)
INSERT OR REPLACE INTO posts (id, department_id, sector_id, title, slug, summary, pay_scale, default_min_age, default_max_age, default_qualification, is_active, created_at) VALUES
('post_mp_constable', 'dept_home', 'sec_police', 'Police Constable (General Duty)', 'mp-police-constable', 
 'Police Constable GD in Madhya Pradesh Police is responsible for state law and order, patrolling, and crime prevention. Selection consists of Online Written Test (ESB), Physical Proficiency Test (PPT), and Medical Examination.', 
 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)', 18, 33, '10TH', 1, unixepoch()),

('post_mp_si', 'dept_home', 'sec_police', 'Sub Inspector (Civil Police)', 'mp-police-sub-inspector', 
 'Sub Inspector in MP Police holds station officer responsibilities, investigation of criminal cases, and police station administration. Requires graduation and rigorous physical endurance tests.', 
 'Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)', 21, 33, 'GRADUATION', 1, unixepoch()),

('post_mp_patwari', 'dept_revenue', 'sec_admin', 'Patwari (Land Records Officer)', 'mp-patwari', 
 'Patwari is the primary village revenue officer in MP responsible for agricultural land measurement, crop inspection, land dispute reporting, and government record maintenance. Requires graduation and CPCT scorecard.', 
 'Rs. 25,300 - 80,500/- (Pay Matrix Level 6)', 18, 40, 'GRADUATION', 1, unixepoch()),

('post_mp_forest_guard', 'dept_forest', 'sec_forest', 'Forest Guard (Van Rakshak)', 'mp-forest-guard', 
 'Forest Guard in MP Forest Department performs beat surveillance, prevents timber smuggling, and protects wildlife across national parks and sanctuaries. Requires 10th pass and walking physical test.', 
 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)', 18, 33, '10TH', 1, unixepoch()),

('post_mp_group4_clerk', 'dept_gad', 'sec_admin', 'Assistant Grade-III / Steno-Typist', 'mp-assistant-grade-3', 
 'Clerical and secretarial posts across Madhya Pradesh government secretariats and district collectorates. Requires 12th pass, Computer Diploma (DCA/PGDCA), and valid CPCT score card.', 
 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)', 18, 40, '12TH', 1, unixepoch()),

('post_mp_samvida_varg3', 'dept_education', 'sec_teaching', 'Primary School Teacher (Varg 3)', 'mp-primary-teacher-varg-3', 
 'Teaching classes 1 to 5 in MP state government schools. Governed by MP Primary School Teacher Eligibility Test (MP TET) standards.', 
 'Rs. 25,300 - 80,500/- (Pay Matrix Level 6)', 21, 40, '12TH', 1, unixepoch());

-- 6. Recruitments (Active & Planned Drives)
INSERT OR REPLACE INTO recruitments (id, post_id, organisation_id, state_id, advt_number, title, slug, short_summary, cycle_year, total_vacancies, status, lifecycle_status, is_featured, created_at, updated_at) VALUES
('rec_mp_constable_2026', 'post_mp_constable', 'org_mpesb', 'st_mp', 'Advt No. 04/2026', 
 'MP Police Constable Recruitment 2026 (7,500 Vacancies)', 'mp-police-constable-recruitment-2026',
 'Official recruitment by MPESB for 7,500 posts of Police Constable (General Duty & Radio) in Madhya Pradesh Police Department. 10th pass candidates eligible.',
 2026, 7500, 'PUBLISHED', 'OPEN', 1, unixepoch(), unixepoch()),

('rec_mp_patwari_2026', 'post_mp_patwari', 'org_mpesb', 'st_mp', 'Advt No. 06/2026', 
 'MP ESB Patwari & Combined Group-2 Sub-Group-4 Recruitment 2026', 'mp-patwari-recruitment-2026',
 'Recruitment for 3,550 vacancies of Patwari and Revenue Inspectors across all 55 districts of Madhya Pradesh. Graduate with CPCT required.',
 2026, 3550, 'PUBLISHED', 'UPCOMING', 1, unixepoch(), unixepoch()),

('rec_mp_forest_guard_2026', 'post_mp_forest_guard', 'org_mpesb', 'st_mp', 'Advt No. 07/2026', 
 'MP Forest Guard & Jail Prahari Combined Recruitment 2026', 'mp-forest-guard-recruitment-2026',
 'Direct recruitment for 2,112 posts of Van Rakshak (Forest Guard) and Kshetra Rakshak in MP Forest Department. 10th pass candidates eligible with physical standards.',
 2026, 2112, 'PUBLISHED', 'OPEN', 0, unixepoch(), unixepoch());

-- 7. Recruitment Eligibility (Simplified Typed Model)
INSERT OR REPLACE INTO recruitment_eligibility (
  id, recruitment_id, min_age, max_age_general, age_cutoff_date, 
  age_relaxation_sc_st, age_relaxation_obc, age_relaxation_female, 
  min_qualification_level, allowed_streams_json, requires_mp_domicile, 
  requires_mp_employment_reg, requires_cpct, gender_allowed, 
  min_height_male_cm, min_height_female_cm, min_chest_male_cm, 
  age_relaxation_ews, min_percentage_required, additional_skills_json,
  experience_months, special_conditions_notes
) VALUES
('el_constable_2026', 'rec_mp_constable_2026', 
 18, 33, '2026-01-01', 5, 3, 5, 
 '10TH', '["ANY"]', 1, 1, 0, 'ALL', 
 168.0, 158.0, 81.0, 0, NULL, NULL,
 0, 
 'ST candidates have height relaxation up to 160 cm. Physical proficiency test is qualifying and carries scoring marks.'),

('el_patwari_2026', 'rec_mp_patwari_2026', 
 18, 40, '2026-01-01', 5, 5, 5, 
 'GRADUATION', '["ANY"]', 1, 1, 1, 'ALL', 
 NULL, NULL, NULL, 0, NULL, '["Hindi Typing"]',
 0, 
 'Valid CPCT scorecard with Hindi typing certification is mandatory. 3-year probation period.'),

('el_forest_2026', 'rec_mp_forest_guard_2026', 
 18, 33, '2026-01-01', 5, 3, 5, 
 '10TH', '["ANY"]', 1, 1, 0, 'ALL', 
 163.0, 150.0, 79.0, 0, NULL, NULL,
 0, 
 'Walking test: 25 km in 4 hours for male candidates, 14 km in 4 hours for female candidates.');

-- 8. Vacancies by Category
INSERT OR REPLACE INTO vacancies (id, recruitment_id, category, gender, count) VALUES
('vac_c_ur',    'rec_mp_constable_2026', 'UR', 'ALL', 2025),
('vac_c_sc',    'rec_mp_constable_2026', 'SC', 'ALL', 1200),
('vac_c_st',    'rec_mp_constable_2026', 'ST', 'ALL', 1500),
('vac_c_obc',   'rec_mp_constable_2026', 'OBC', 'ALL', 2025),
('vac_c_ews',   'rec_mp_constable_2026', 'EWS', 'ALL', 750),

('vac_p_ur',    'rec_mp_patwari_2026', 'UR', 'ALL', 960),
('vac_p_sc',    'rec_mp_patwari_2026', 'SC', 'ALL', 568),
('vac_p_st',    'rec_mp_patwari_2026', 'ST', 'ALL', 710),
('vac_p_obc',   'rec_mp_patwari_2026', 'OBC', 'ALL', 957),
('vac_p_ews',   'rec_mp_patwari_2026', 'EWS', 'ALL', 355),

('vac_f_ur',    'rec_mp_forest_guard_2026', 'UR', 'ALL', 570),
('vac_f_sc',    'rec_mp_forest_guard_2026', 'SC', 'ALL', 338),
('vac_f_st',    'rec_mp_forest_guard_2026', 'ST', 'ALL', 422),
('vac_f_obc',   'rec_mp_forest_guard_2026', 'OBC', 'ALL', 570),
('vac_f_ews',   'rec_mp_forest_guard_2026', 'EWS', 'ALL', 212);

-- 9. Important Dates
INSERT OR REPLACE INTO important_dates (id, recruitment_id, event_type, event_date, is_tentative, notes) VALUES
('dt_c_notif', 'rec_mp_constable_2026', 'NOTIFICATION', '2026-02-15', 0, 'Official notification released on ESB portal'),
('dt_c_start', 'rec_mp_constable_2026', 'APPLICATION_START', '2026-03-01', 0, 'Online form submission starts via MPOnline portal'),
('dt_c_end',   'rec_mp_constable_2026', 'APPLICATION_END', '2026-03-31', 0, 'Last date to submit application form and pay fees'),
('dt_c_corr',  'rec_mp_constable_2026', 'CORRECTION_END', '2026-04-05', 0, 'Correction window closes'),
('dt_c_exam',  'rec_mp_constable_2026', 'EXAM_DATE', '2026-05-15', 0, 'Online CBT examination across state centres'),

('dt_p_notif', 'rec_mp_patwari_2026', 'NOTIFICATION', '2026-03-10', 0, 'Rulebook published on MPESB official website'),
('dt_p_start', 'rec_mp_patwari_2026', 'APPLICATION_START', '2026-04-01', 0, 'Online application start date'),
('dt_p_end',   'rec_mp_patwari_2026', 'APPLICATION_END', '2026-04-25', 0, 'Online application closing date'),
('dt_p_exam',  'rec_mp_patwari_2026', 'EXAM_DATE', '2026-06-20', 1, 'Tentative exam commencement date'),

('dt_f_notif', 'rec_mp_forest_guard_2026', 'NOTIFICATION', '2026-02-20', 0, 'Official advertisement published'),
('dt_f_start', 'rec_mp_forest_guard_2026', 'APPLICATION_START', '2026-03-05', 0, 'Application start date'),
('dt_f_end',   'rec_mp_forest_guard_2026', 'APPLICATION_END', '2026-03-28', 0, 'Application closing date'),
('dt_f_exam',  'rec_mp_forest_guard_2026', 'EXAM_DATE', '2026-05-28', 0, 'CBT examination date');

-- 10. Sources (Provenance)
INSERT OR REPLACE INTO sources (id, recruitment_id, source_type, source_url, source_title, publication_date, last_verified_at) VALUES
('src_c_pdf', 'rec_mp_constable_2026', 'OFFICIAL_NOTIFICATION_PDF', 
 'https://esb.mp.gov.in/Rulebooks/RB_2026/Police_Constable_2026_RuleBook.pdf', 
 'MP Police Constable Recruitment Test 2026 Detailed Rulebook', '2026-02-15', unixepoch()),

('src_p_pdf', 'rec_mp_patwari_2026', 'OFFICIAL_NOTIFICATION_PDF', 
 'https://esb.mp.gov.in/Rulebooks/RB_2026/Patwari_Group2_2026_RuleBook.pdf', 
 'MP ESB Combined Group-2 Sub-Group-4 & Patwari Examination 2026 Rulebook', '2026-03-10', unixepoch()),

('src_f_pdf', 'rec_mp_forest_guard_2026', 'OFFICIAL_NOTIFICATION_PDF', 
 'https://esb.mp.gov.in/Rulebooks/RB_2026/Van_Rakshak_2026_RuleBook.pdf', 
 'MP Forest Guard and Jail Prahari Combined Recruitment Test 2026 Rulebook', '2026-02-20', unixepoch());

-- 11. Official Links (Direct Outbound Actions)
INSERT OR REPLACE INTO official_links (id, recruitment_id, link_type, title, url, is_active) VALUES
('lnk_c_apply', 'rec_mp_constable_2026', 'APPLY_ONLINE', 'Apply Online (MPOnline Portal)', 'https://esb.mponline.gov.in', 1),
('lnk_c_pdf',   'rec_mp_constable_2026', 'NOTIFICATION_PDF', 'Download Official Notification PDF', 'https://esb.mp.gov.in/Rulebooks/RB_2026/Police_Constable_2026_RuleBook.pdf', 1),
('lnk_c_portal','rec_mp_constable_2026', 'RESULT', 'MPESB Official Examination Portal', 'https://esb.mp.gov.in', 1),

('lnk_p_apply', 'rec_mp_patwari_2026', 'APPLY_ONLINE', 'Apply Online via MPOnline Portal', 'https://esb.mponline.gov.in', 1),
('lnk_p_pdf',   'rec_mp_patwari_2026', 'NOTIFICATION_PDF', 'Download Official Patwari Rulebook PDF', 'https://esb.mp.gov.in/Rulebooks/RB_2026/Patwari_Group2_2026_RuleBook.pdf', 1),

('lnk_f_apply', 'rec_mp_forest_guard_2026', 'APPLY_ONLINE', 'Apply Online (MPOnline Portal)', 'https://esb.mponline.gov.in', 1),
('lnk_f_pdf',   'rec_mp_forest_guard_2026', 'NOTIFICATION_PDF', 'Download Official Forest Guard Rulebook PDF', 'https://esb.mp.gov.in/Rulebooks/RB_2026/Van_Rakshak_2026_RuleBook.pdf', 1);

-- 12. Admin Users
INSERT OR REPLACE INTO admin_users (id, email, name, role, is_active, created_at) VALUES
('adm_super', 'admin@rozgarsetu.in', 'Lead Administrator', 'SUPER_ADMIN', 1, unixepoch());
