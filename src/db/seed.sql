PRAGMA foreign_keys = OFF;

-- ==============================================================================
-- NIRNAY: Initial MP reference dataset; nationwide jurisdictions are added by migration 0007.
-- ==============================================================================

-- 1. States
INSERT OR IGNORE INTO states (id, code, name, slug, is_active, created_at) VALUES
('st_mp', 'MP', 'Madhya Pradesh', 'madhya-pradesh', 1, unixepoch());

-- 2. Master Organisations / Recruiting Authorities
INSERT OR IGNORE INTO organisations (id, state_id, name, short_name, slug, website_url, is_active, created_at) VALUES
('org_mpesb',   'st_mp', 'Madhya Pradesh Employees Selection Board', 'MPESB',   'mpesb',   'https://esb.mp.gov.in', 1, unixepoch()),
('org_mppsc',   'st_mp', 'Madhya Pradesh Public Service Commission', 'MPPSC',   'mppsc',   'https://mppsc.mp.gov.in', 1, unixepoch()),
('org_mphc',    'st_mp', 'High Court of Madhya Pradesh',             'MPHC',    'mphc',    'https://mphc.gov.in', 1, unixepoch()),
('org_mpsedc',  'st_mp', 'MP State Electronics Development Corp',    'MPSEDC',  'mpsedc',  'https://mpsedc.mp.gov.in', 1, unixepoch()),
('org_nhm_mp',  'st_mp', 'National Health Mission Madhya Pradesh',   'NHM MP',  'nhm-mp',  'https://nhmmp.gov.in', 1, unixepoch());

-- 3. Master Sectors
INSERT OR IGNORE INTO sectors (id, name, slug, icon, display_order) VALUES
('sec_civil_services', 'Civil & Administrative Services',              'civil-administrative-services', 'Landmark',      1),
('sec_police',         'Police, Defence & Prisons',                    'police-defence-prisons',        'Shield',        2),
('sec_judiciary',      'Judiciary & Legal Services',                   'judiciary-legal-services',      'Scale',         3),
('sec_it_egov',        'Information Technology & e-Governance',        'it-egovernance',                'Cpu',           4),
('sec_admin',          'Revenue & Land Administration',                'revenue-land-administration',   'Building2',     5),
('sec_forest',         'Forest, Wildlife & Environment',               'forest-environment',            'Trees',         6),
('sec_teaching',       'Teaching & Higher Education',                  'teaching-education',            'GraduationCap', 7),
('sec_technical',      'Engineering & Technical Trades',               'engineering-technical-trades',  'Wrench',        8),
('sec_health',         'Public Health & Medical Services',             'public-health-medical',         'Activity',      9),
('sec_support',        'Support Staff & Allied Services (Class IV)',   'support-staff-class-iv',        'Users',         10);

-- 4. Master Departments
INSERT OR IGNORE INTO departments (id, organisation_id, name, slug, description, is_active, created_at) VALUES
('dept_gad',         'org_mppsc',  'General Administration Department',        'general-administration',    'State civil secretariat, personnel management, and executive cadre', 1, unixepoch()),
('dept_home',        'org_mpesb',  'Home Department (Police & Jail)',          'home-department',           'State police forces, internal security, criminal investigations, and correctional services', 1, unixepoch()),
('dept_judiciary',   'org_mphc',   'High Court Registry & Subordinate Courts', 'high-court-judiciary',      'State judicial administration, district sessions courts, and registry', 1, unixepoch()),
('dept_it',          'org_mpsedc', 'Science & Technology (MPSEDC / MAP_IT)',   'science-technology-it',     'State e-governance infrastructure, IT systems, and digital citizen services', 1, unixepoch()),
('dept_revenue',     'org_mpesb',  'Revenue Department',                       'revenue-department',        'Land records, revenue administration, settlement, and Patwari cadre', 1, unixepoch()),
('dept_forest',      'org_mpesb',  'Forest & Wildlife Department',             'forest-department',         'Forestry preservation, sanctuary surveillance, and wildlife conservation', 1, unixepoch()),
('dept_school_edu',  'org_mpesb',  'School Education Department',              'school-education',          'State primary, middle, and higher secondary school education', 1, unixepoch()),
('dept_higher_edu',  'org_mppsc',  'Higher Education Department',              'higher-education',          'Government degree colleges, collegiate faculty, and university administration', 1, unixepoch()),
('dept_pwd',         'org_mpesb',  'Public Works Department (PWD / WRD)',      'public-works-department',   'State highway engineering, government building construction, and water resources', 1, unixepoch()),
('dept_health',      'org_mpesb',  'Public Health & Family Welfare',           'public-health-welfare',     'State hospital management, clinical care, nursing, and preventive medicine', 1, unixepoch()),
('dept_education',   'org_mpesb',  'School Education Department (Legacy)',     'school-education-legacy',   'Legacy department reference for backwards compatibility', 1, unixepoch());

-- 5. Master Canonical Posts (Full Spectrum from Class 1 / Group A to Class 4 / Group D)

-- === GROUP A / CLASS 1 (Senior Gazetted Officers) ===
INSERT OR IGNORE INTO posts (id, department_id, sector_id, title, slug, summary, pay_scale, default_min_age, default_max_age, default_qualification, is_active, created_at) VALUES
('post_mp_deputy_collector', 'dept_gad', 'sec_civil_services', 'Deputy Collector (State Civil Service)', 'mp-deputy-collector',
 'Senior sub-divisional administrative magistrate in MP Civil Services, responsible for executive administration, law & order, and policy implementation.',
 'Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)', 21, 33, 'GRADUATION', 1, unixepoch()),

('post_mp_dsp', 'dept_home', 'sec_police', 'Deputy Superintendent of Police (DSP)', 'mp-dsp',
 'Gazetted police executive leadership role commanding sub-divisional police operations, crime control, and law enforcement.',
 'Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)', 21, 33, 'GRADUATION', 1, unixepoch()),

('post_mp_civil_judge', 'dept_judiciary', 'sec_judiciary', 'Civil Judge (Junior Division / Judicial Magistrate)', 'mp-civil-judge',
 'Subordinate judicial officer presiding over civil suits and criminal trials across district and tehsil courts of Madhya Pradesh.',
 'Rs. 77,840 - 1,36,520/- (Pay Matrix Level J-1)', 21, 35, 'GRADUATION', 1, unixepoch()),

('post_mp_acf', 'dept_forest', 'sec_forest', 'Assistant Conservator of Forests (ACF)', 'mp-acf-forest',
 'Gazetted state forest service officer managing territorial divisions, anti-poaching operations, and sanctuary conservancies.',
 'Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)', 21, 33, 'GRADUATION', 1, unixepoch()),

('post_mp_assistant_professor', 'dept_higher_edu', 'sec_teaching', 'Assistant Professor (Government Colleges)', 'mp-assistant-professor',
 'Higher education collegiate faculty instructing undergraduate and postgraduate courses in MP Government Degree Colleges.',
 'Rs. 57,700 - 1,82,400/- (Academic Level 10)', 21, 40, 'POST_GRADUATION', 1, unixepoch()),

('post_mp_medical_officer', 'dept_health', 'sec_health', 'Medical Officer (MBBS)', 'mp-medical-officer',
 'Registered government physician delivering clinical consultation, trauma emergency care, and public healthcare in district hospitals.',
 'Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)', 21, 40, 'GRADUATION', 1, unixepoch()),

('post_mp_assistant_engineer', 'dept_pwd', 'sec_technical', 'Assistant Engineer (Civil / Electrical)', 'mp-assistant-engineer',
 'Gazetted engineer supervising engineering tenders, bridge design, road construction, and state infrastructure works.',
 'Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)', 21, 33, 'GRADUATION', 1, unixepoch()),

-- === GROUP B / CLASS 2 (Gazetted & Senior Executives) ===
('post_mp_naib_tehsildar', 'dept_revenue', 'sec_admin', 'Naib Tehsildar (Executive Magistrate)', 'mp-naib-tehsildar',
 'Sub-tehsil executive officer adjudicating land mutations, revenue cases, tenancy matters, and rural dispute resolution.',
 'Rs. 36,200 - 1,14,800/- (Pay Matrix Level 8)', 21, 33, 'GRADUATION', 1, unixepoch()),

('post_mp_commercial_tax_officer', 'dept_gad', 'sec_civil_services', 'Commercial Tax Officer / GST Officer', 'mp-commercial-tax-officer',
 'State revenue executive overseeing SGST compliance, commercial tax assessments, and tax intelligence audits.',
 'Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)', 21, 33, 'GRADUATION', 1, unixepoch()),

('post_mp_forest_range_officer', 'dept_forest', 'sec_forest', 'Forest Range Officer (FRO)', 'mp-forest-range-officer',
 'Range executive supervising territorial forest beats, wildlife corridors, nurseries, and plantation works.',
 'Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)', 21, 33, 'GRADUATION', 1, unixepoch()),

('post_mp_school_lecturer', 'dept_school_edu', 'sec_teaching', 'School Lecturer (Uchha Madhyamik Shikshak / Varg-1)', 'mp-school-lecturer-varg-1',
 'Subject-specialized teacher instructing classes 11 and 12 in state government higher secondary schools.',
 'Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)', 21, 40, 'POST_GRADUATION', 1, unixepoch()),

('post_mp_degm_it', 'dept_it', 'sec_it_egov', 'District e-Governance Manager (DeGM)', 'mp-degm-it',
 'District IT leader in-charge of state portal delivery, Lok Seva Kendras, Aadhaar services, and technical field operations.',
 'Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)', 21, 35, 'GRADUATION', 1, unixepoch()),

-- === GROUP C / CLASS 3 (Frontline Police, Clerical, Technical & Skilled Execution) ===
('post_mp_si', 'dept_home', 'sec_police', 'Sub Inspector (Civil Police)', 'mp-police-sub-inspector',
 'Police station investigation officer responsible for investigating criminal offences, filing chargesheets, and maintaining order.',
 'Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)', 21, 33, 'GRADUATION', 1, unixepoch()),

('post_mp_constable', 'dept_home', 'sec_police', 'Police Constable (General Duty)', 'mp-police-constable',
 'Primary frontline police officer in MP Police responsible for patrolling, beat guarding, escorting, and law enforcement.',
 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)', 18, 33, '10TH', 1, unixepoch()),

('post_mp_constable_radio', 'dept_home', 'sec_police', 'Police Constable (Radio / Telecommunication)', 'mp-police-constable-radio',
 'Technical police operator managing wireless communication networks, VHF repeaters, and dial-112 dispatch systems.',
 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)', 18, 33, '12TH', 1, unixepoch()),

('post_mp_jail_prahari', 'dept_home', 'sec_police', 'Jail Prahari (Prison Warder)', 'mp-jail-prahari',
 'Correctional security officer in MP Jail Department guarding state penitentiaries and maintaining inmate security.',
 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)', 18, 33, '10TH', 1, unixepoch()),

('post_mp_patwari', 'dept_revenue', 'sec_admin', 'Patwari (Land Records Officer)', 'mp-patwari',
 'Primary village revenue and land records officer managing agricultural survey, crop inspection, and mutation records.',
 'Rs. 25,300 - 80,500/- (Pay Matrix Level 6)', 18, 40, 'GRADUATION', 1, unixepoch()),

('post_mp_revenue_inspector', 'dept_revenue', 'sec_admin', 'Revenue Inspector (RI / Kanoongo)', 'mp-revenue-inspector',
 'Supervisory revenue officer overseeing multiple Patwari halkas, land demarcation, and government boundary inspections.',
 'Rs. 28,700 - 91,300/- (Pay Matrix Level 7)', 18, 40, 'GRADUATION', 1, unixepoch()),

('post_mp_forest_guard', 'dept_forest', 'sec_forest', 'Forest Guard (Van Rakshak)', 'mp-forest-guard',
 'Field forest beat guard protecting national parks and reserved forests against timber logging and poaching.',
 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)', 18, 33, '10TH', 1, unixepoch()),

('post_mp_jja_court', 'dept_judiciary', 'sec_judiciary', 'Junior Judicial Assistant (JJA) / Assistant Grade-III (Courts)', 'mp-jja-court',
 'High Court and District Court ministerial staff handling judicial case files, certified copies, cause lists, and courtroom dockets.',
 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)', 18, 35, 'GRADUATION', 1, unixepoch()),

('post_mp_court_stenographer', 'dept_judiciary', 'sec_judiciary', 'Court Stenographer (Grade II & III)', 'mp-court-stenographer',
 'Verbatim judicial dictation recorder transcribing trial judgments, court orders, and witness depositions.',
 'Rs. 28,700 - 91,300/- (Pay Matrix Level 7)', 18, 35, 'GRADUATION', 1, unixepoch()),

('post_mp_assistant_programmer', 'dept_it', 'sec_it_egov', 'Assistant Programmer / Systems Analyst (IT)', 'mp-assistant-programmer',
 'State government software programmer and database specialist developing digital portals and citizen services.',
 'Rs. 32,800 - 1,03,600/- (Pay Matrix Level 8)', 21, 35, 'GRADUATION', 1, unixepoch()),

('post_mp_data_entry_operator', 'dept_gad', 'sec_it_egov', 'Data Entry Operator (DEO) / Computer Operator', 'mp-data-entry-operator',
 'Data processing specialist managing state treasury data, civil registrations, and computer records across collectorates.',
 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)', 18, 40, '12TH', 1, unixepoch()),

('post_mp_sub_engineer', 'dept_pwd', 'sec_technical', 'Sub-Engineer (Civil / Electrical / Mechanical)', 'mp-sub-engineer',
 'Technical field engineer supervising public building construction, bridge inspection, and water supply civil works.',
 'Rs. 32,800 - 1,03,600/- (Pay Matrix Level 8)', 18, 40, 'DIPLOMA', 1, unixepoch()),

('post_mp_group4_clerk', 'dept_gad', 'sec_admin', 'Assistant Grade-III / Steno-Typist (State Secretariat)', 'mp-assistant-grade-3',
 'Clerical ministerial staff in state secretariats and district offices managing administrative files and typing.',
 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)', 18, 40, '12TH', 1, unixepoch()),

('post_mp_samvida_varg2', 'dept_school_edu', 'sec_teaching', 'Middle School Teacher (Madhyamik Shikshak / Varg-2)', 'mp-middle-teacher-varg-2',
 'Subject teacher for classes 6 to 8 in government middle schools covering Science, Math, Social Science, and Languages.',
 'Rs. 25,300 - 80,500/- (Pay Matrix Level 6)', 21, 40, 'GRADUATION', 1, unixepoch()),

('post_mp_samvida_varg3', 'dept_school_edu', 'sec_teaching', 'Primary School Teacher (Prathmik Shikshak / Varg-3)', 'mp-primary-teacher-varg-3',
 'Foundational elementary teacher instructing classes 1 to 5 in MP State government primary schools.',
 'Rs. 25,300 - 80,500/- (Pay Matrix Level 6)', 18, 40, '12TH', 1, unixepoch()),

('post_mp_staff_nurse', 'dept_health', 'sec_health', 'Staff Nurse (Nursing Officer)', 'mp-staff-nurse',
 'Clinical registered nursing officer providing hospital ward healthcare, neonatal care, and surgical assistance.',
 'Rs. 28,700 - 91,300/- (Pay Matrix Level 7)', 21, 40, 'DIPLOMA', 1, unixepoch()),

('post_mp_anm', 'dept_health', 'sec_health', 'ANM (Auxiliary Nurse Midwife)', 'mp-anm-health',
 'Rural healthcare worker providing child immunization, maternal care, and family planning at village sub-centres.',
 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)', 18, 40, '12TH', 1, unixepoch()),

('post_mp_pharmacist', 'dept_health', 'sec_health', 'Pharmacist Grade-II', 'mp-pharmacist-grade-2',
 'Government hospital pharmacy dispenser managing medication inventory, formulation, and prescription delivery.',
 'Rs. 25,300 - 80,500/- (Pay Matrix Level 6)', 18, 40, 'DIPLOMA', 1, unixepoch()),

-- === GROUP D / CLASS 4 (Support Services & Field Staff) ===
('post_mp_peon_bhritya', 'dept_gad', 'sec_support', 'Office Peon / Attendant (Bhritya / Process Server)', 'mp-peon-bhritya',
 'Support staff maintaining judicial summon deliveries, departmental dak distribution, and office assistance.',
 'Rs. 15,500 - 49,000/- (Pay Matrix Level 1)', 18, 40, '8TH', 1, unixepoch()),

('post_mp_govt_driver', 'dept_gad', 'sec_support', 'Government Vehicle Driver (Light & Heavy)', 'mp-govt-driver',
 'Professional driver operating judicial motorcade vehicles, police patrol units, ambulances, and official staff cars.',
 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)', 18, 40, '8TH', 1, unixepoch()),

('post_mp_chowkidar', 'dept_gad', 'sec_support', 'Security Chowkidar / Night Watchman', 'mp-chowkidar',
 'Campus security guard securing government office complexes, district collectorates, and state rest houses.',
 'Rs. 15,500 - 49,000/- (Pay Matrix Level 1)', 18, 40, '8TH', 1, unixepoch());

-- 6. Recruitments (Active & Planned Drives)
INSERT OR IGNORE INTO recruitments (id, post_id, organisation_id, state_id, advt_number, title, slug, short_summary, cycle_year, total_vacancies, status, lifecycle_status, exam_status, result_status, is_featured, validation_status, created_at, updated_at) VALUES
('rec_mp_constable_2026', 'post_mp_constable', 'org_mpesb', 'st_mp', 'Advt No. 04/2026', 
 'MP Police Constable Recruitment 2026 (7,500 Vacancies)', 'mp-police-constable-recruitment-2026',
 'Official recruitment by MPESB for 7,500 posts of Police Constable (General Duty & Radio) in Madhya Pradesh Police Department. 10th pass candidates eligible.',
 2026, 7500, 'PUBLISHED', 'NOT_STARTED', 'SCHEDULED', 'NOT_DECLARED', 1, 'VALID', unixepoch(), unixepoch()),

('rec_mp_patwari_2026', 'post_mp_patwari', 'org_mpesb', 'st_mp', 'Advt No. 06/2026', 
 'MP ESB Patwari & Combined Group-2 Sub-Group-4 Recruitment 2026', 'mp-patwari-recruitment-2026',
 'Recruitment for 3,550 vacancies of Patwari and Revenue Inspectors across all 55 districts of Madhya Pradesh. Graduate with CPCT required.',
 2026, 3550, 'PUBLISHED', 'EXAM_SCHEDULED', 'SCHEDULED', 'NOT_DECLARED', 1, 'VALID', unixepoch(), unixepoch()),

('rec_mp_forest_guard_2026', 'post_mp_forest_guard', 'org_mpesb', 'st_mp', 'Advt No. 07/2026', 
 'MP Forest Guard & Jail Prahari Combined Recruitment 2026', 'mp-forest-guard-recruitment-2026',
 'Direct recruitment for 2,112 posts of Van Rakshak (Forest Guard) and Kshetra Rakshak in MP Forest Department. 10th pass candidates eligible with physical standards.',
 2026, 2112, 'PUBLISHED', 'RESULT_DECLARED', 'COMPLETED', 'DECLARED', 0, 'VALID', unixepoch(), unixepoch()),

('rec_mp_mppsc_sse_2026', 'post_mp_deputy_collector', 'org_mppsc', 'st_mp', 'Advt No. 01/Exam/2026',
 'MPPSC State Services Examination (SSE) 2026', 'mppsc-state-service-2026',
 'Premier state administrative examination conducted by MPPSC for 356 gazetted executive Class II posts including Deputy Collector, DSP, and Commercial Tax Officer.',
 2026, 356, 'PENDING_VERIFICATION', 'APPLICATION_CLOSED', 'NOT_SCHEDULED', 'NOT_DECLARED', 1, 'VALID', unixepoch(), unixepoch()),

('rec_mp_jja_court_2026', 'post_mp_jja_court', 'org_mphc', 'st_mp', 'Advt No. HC/JJA/2026',
 'Junior Judicial Assistant (JJA) & Court AG-III Examination 2026', 'mp-jja-court-recruitment-2026',
 'Direct judicial ministerial recruitment for 980 vacancies in the High Court Registry of Madhya Pradesh and Subordinate District Courts.',
 2026, 980, 'PENDING_VERIFICATION', 'NOT_STARTED', 'NOT_SCHEDULED', 'NOT_DECLARED', 0, 'VALID', unixepoch(), unixepoch());

-- 7. Recruitment Eligibility (Simplified Typed Model)
INSERT OR IGNORE INTO recruitment_eligibility (
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
 'Walking test: 25 km in 4 hours for male candidates, 14 km in 4 hours for female candidates.'),

('el_mppsc_sse_2026', 'rec_mp_mppsc_sse_2026',
 21, 40, '2026-01-01', 5, 5, 5,
 'GRADUATION', '["ANY"]', 0, 1, 0, 'ALL',
 NULL, NULL, NULL, 0, NULL, NULL,
 0,
 'Final year degree students may appear in Preliminary exam. Uniformed posts (DSP) have separate physical criteria (Height 168 cm male, 155 cm female).'),

('el_jja_court_2026', 'rec_mp_jja_court_2026',
 18, 35, '2026-01-01', 5, 3, 5,
 'GRADUATION', '["ANY"]', 0, 1, 1, 'ALL',
 NULL, NULL, NULL, 0, 50, '["English & Hindi Typing"]',
 0,
 'Bachelor degree in any discipline with minimum 50% marks and valid CPCT scorecard required.');

-- 8. Vacancies by Category
INSERT OR IGNORE INTO vacancies (id, recruitment_id, category, gender, count) VALUES
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
('vac_f_ews',   'rec_mp_forest_guard_2026', 'EWS', 'ALL', 212),

('vac_m_ur',    'rec_mp_mppsc_sse_2026', 'UR', 'ALL', 96),
('vac_m_sc',    'rec_mp_mppsc_sse_2026', 'SC', 'ALL', 57),
('vac_m_st',    'rec_mp_mppsc_sse_2026', 'ST', 'ALL', 71),
('vac_m_obc',   'rec_mp_mppsc_sse_2026', 'OBC', 'ALL', 96),
('vac_m_ews',   'rec_mp_mppsc_sse_2026', 'EWS', 'ALL', 36),

('vac_j_ur',    'rec_mp_jja_court_2026', 'UR', 'ALL', 490),
('vac_j_sc',    'rec_mp_jja_court_2026', 'SC', 'ALL', 157),
('vac_j_st',    'rec_mp_jja_court_2026', 'ST', 'ALL', 196),
('vac_j_obc',   'rec_mp_jja_court_2026', 'OBC', 'ALL', 137);

-- 9. Important Dates
INSERT OR IGNORE INTO important_dates (id, recruitment_id, event_type, event_date, is_tentative, notes) VALUES
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
('dt_f_exam',  'rec_mp_forest_guard_2026', 'EXAM_DATE', '2026-05-28', 0, 'CBT examination date'),

('dt_m_notif', 'rec_mp_mppsc_sse_2026', 'NOTIFICATION', '2026-01-10', 0, 'MPPSC State Services 2026 Official Gazette Notification'),
('dt_m_start', 'rec_mp_mppsc_sse_2026', 'APPLICATION_START', '2026-01-19', 0, 'Online application submission opens on MPOnline'),
('dt_m_end',   'rec_mp_mppsc_sse_2026', 'APPLICATION_END', '2026-02-18', 0, 'Online application window closing date'),
('dt_m_corr',  'rec_mp_mppsc_sse_2026', 'CORRECTION_END', '2026-02-20', 0, 'Application error correction deadline'),
('dt_m_exam',  'rec_mp_mppsc_sse_2026', 'EXAM_DATE', '2026-04-28', 0, 'State Services Preliminary Examination (OMR based)'),

('dt_j_notif', 'rec_mp_jja_court_2026', 'NOTIFICATION', '2026-02-01', 0, 'High Court of MP JJA Official Advertisement'),
('dt_j_start', 'rec_mp_jja_court_2026', 'APPLICATION_START', '2026-02-15', 0, 'Online application registration start'),
('dt_j_end',   'rec_mp_jja_court_2026', 'APPLICATION_END', '2026-03-15', 0, 'Application form submission deadline'),
('dt_j_exam',  'rec_mp_jja_court_2026', 'EXAM_DATE', '2026-05-10', 0, 'Online Preliminary Screening Examination');

-- 10. Sources (Provenance)
INSERT OR IGNORE INTO sources (id, recruitment_id, source_type, source_url, source_title, publication_date, last_verified_at) VALUES
('src_c_pdf', 'rec_mp_constable_2026', 'OFFICIAL_NOTIFICATION_PDF', 
 'https://esb.mp.gov.in/Rulebooks/RB_2026/Police_Constable_2026_RuleBook.pdf', 
 'MP Police Constable Recruitment Test 2026 Detailed Rulebook', '2026-02-15', unixepoch()),

('src_p_pdf', 'rec_mp_patwari_2026', 'OFFICIAL_NOTIFICATION_PDF', 
 'https://esb.mp.gov.in/Rulebooks/RB_2026/Patwari_Group2_2026_RuleBook.pdf', 
 'MP ESB Combined Group-2 Sub-Group-4 & Patwari Examination 2026 Rulebook', '2026-03-10', unixepoch()),

('src_f_pdf', 'rec_mp_forest_guard_2026', 'OFFICIAL_NOTIFICATION_PDF', 
 'https://esb.mp.gov.in/Rulebooks/RB_2026/Van_Rakshak_2026_RuleBook.pdf', 
 'MP Forest Guard and Jail Prahari Combined Recruitment Test 2026 Rulebook', '2026-02-20', unixepoch()),

('src_m_pdf', 'rec_mp_mppsc_sse_2026', 'OFFICIAL_NOTIFICATION_PDF',
 'https://mppsc.mp.gov.in/Uploads/Advertisements/SSE_2026_Notification.pdf',
 'MPPSC State Services Examination 2026 Detailed Gazette Advertisement', '2026-01-10', unixepoch()),

('src_j_pdf', 'rec_mp_jja_court_2026', 'OFFICIAL_NOTIFICATION_PDF',
 'https://mphc.gov.in/PDF/web_pdf/RE/JJA_2026_Notification.pdf',
 'High Court of Madhya Pradesh Junior Judicial Assistant Examination 2026 Notice', '2026-02-01', unixepoch());

-- 11. Official Links (Direct Outbound Actions)
INSERT OR IGNORE INTO official_links (id, recruitment_id, link_type, title, url, is_active) VALUES
('lnk_c_apply', 'rec_mp_constable_2026', 'APPLY_ONLINE', 'Apply Online (MPOnline Portal)', 'https://esb.mponline.gov.in', 1),
('lnk_c_pdf',   'rec_mp_constable_2026', 'NOTIFICATION_PDF', 'Download Official Notification PDF', 'https://esb.mp.gov.in/Rulebooks/RB_2026/Police_Constable_2026_RuleBook.pdf', 1),
('lnk_c_portal','rec_mp_constable_2026', 'RESULT', 'MPESB Official Examination Portal', 'https://esb.mp.gov.in', 1),

('lnk_p_apply', 'rec_mp_patwari_2026', 'APPLY_ONLINE', 'Apply Online via MPOnline Portal', 'https://esb.mponline.gov.in', 1),
('lnk_p_pdf',   'rec_mp_patwari_2026', 'NOTIFICATION_PDF', 'Download Official Patwari Rulebook PDF', 'https://esb.mp.gov.in/Rulebooks/RB_2026/Patwari_Group2_2026_RuleBook.pdf', 1),

('lnk_f_apply', 'rec_mp_forest_guard_2026', 'APPLY_ONLINE', 'Apply Online (MPOnline Portal)', 'https://esb.mponline.gov.in', 1),
('lnk_f_pdf',   'rec_mp_forest_guard_2026', 'NOTIFICATION_PDF', 'Download Official Forest Guard Rulebook PDF', 'https://esb.mp.gov.in/Rulebooks/RB_2026/Van_Rakshak_2026_RuleBook.pdf', 1),

('lnk_m_apply', 'rec_mp_mppsc_sse_2026', 'APPLY_ONLINE', 'Apply Online (MPOnline MPPSC Portal)', 'https://mponline.gov.in/portal/services/mppsc/', 1),
('lnk_m_pdf',   'rec_mp_mppsc_sse_2026', 'NOTIFICATION_PDF', 'Download MPPSC SSE 2026 Gazette Rulebook', 'https://mppsc.mp.gov.in/Uploads/Advertisements/SSE_2026_Notification.pdf', 1),
('lnk_m_portal','rec_mp_mppsc_sse_2026', 'RESULT', 'MPPSC Official Website', 'https://mppsc.mp.gov.in', 1),

('lnk_j_apply', 'rec_mp_jja_court_2026', 'APPLY_ONLINE', 'Apply Online (High Court of MP Portal)', 'https://mphc.gov.in', 1),
('lnk_j_pdf',   'rec_mp_jja_court_2026', 'NOTIFICATION_PDF', 'Download MPHC JJA Notification PDF', 'https://mphc.gov.in/PDF/web_pdf/RE/JJA_2026_Notification.pdf', 1);

-- 12. Admin Users: intentionally not seeded. Members are authorised by Cloudflare Access
-- and provisioned in admin_users on first verified sign-in.
