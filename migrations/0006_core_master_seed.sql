-- Required parents for admin fixture creation. Keep FK order explicit.
INSERT OR IGNORE INTO admin_users (id, email, name, role, is_active) VALUES
('adm_super', 'admin@rozgarsetu.in', 'Lead Administrator', 'SUPER_ADMIN', 1),
('adm_aarav', 'aarav@nirnay.in', 'Aarav Sharma', 'SUPER_ADMIN', 1);

INSERT OR IGNORE INTO states (id, code, name, slug, is_active) VALUES
('st_mp', 'MP', 'Madhya Pradesh', 'madhya-pradesh', 1);

INSERT OR IGNORE INTO organisations (id, state_id, name, short_name, slug, website_url, is_active) VALUES
('org_mpesb', 'st_mp', 'Madhya Pradesh Employees Selection Board', 'MPESB', 'mpesb', 'https://esb.mp.gov.in', 1),
('org_mppsc', 'st_mp', 'Madhya Pradesh Public Service Commission', 'MPPSC', 'mppsc', 'https://mppsc.mp.gov.in', 1),
('org_mphc', 'st_mp', 'High Court of Madhya Pradesh', 'MPHC', 'mphc', 'https://mphc.gov.in', 1),
('org_mpsedc', 'st_mp', 'MP State Electronics Development Corp', 'MPSEDC', 'mpsedc', 'https://mpsedc.mp.gov.in', 1),
('org_nhm_mp', 'st_mp', 'National Health Mission Madhya Pradesh', 'NHM MP', 'nhm-mp', 'https://nhmmp.gov.in', 1);

INSERT OR IGNORE INTO sectors (id, name, slug, icon, display_order) VALUES
('sec_civil_services', 'Civil & Administrative Services', 'civil-administrative-services', 'Landmark', 1),
('sec_police', 'Police, Defence & Prisons', 'police-defence-prisons', 'Shield', 2),
('sec_judiciary', 'Judiciary & Legal Services', 'judiciary-legal-services', 'Scale', 3),
('sec_it_egov', 'Information Technology & e-Governance', 'it-egovernance', 'Cpu', 4),
('sec_admin', 'Revenue & Land Administration', 'revenue-land-administration', 'Building2', 5),
('sec_forest', 'Forest, Wildlife & Environment', 'forest-environment', 'Trees', 6),
('sec_teaching', 'Teaching & Higher Education', 'teaching-education', 'GraduationCap', 7),
('sec_technical', 'Engineering & Technical Trades', 'engineering-technical-trades', 'Wrench', 8),
('sec_health', 'Public Health & Medical Services', 'public-health-medical', 'Activity', 9),
('sec_support', 'Support Staff & Allied Services (Class IV)', 'support-staff-class-iv', 'Users', 10);

INSERT OR IGNORE INTO departments (id, organisation_id, name, slug, description, is_active) VALUES
('dept_gad', 'org_mppsc', 'General Administration Department', 'general-administration', 'State civil secretariat, personnel management, and executive cadre', 1),
('dept_home', 'org_mpesb', 'Home Department (Police & Jail)', 'home-department', 'State police, internal security, and correctional services', 1),
('dept_judiciary', 'org_mphc', 'High Court Registry & Subordinate Courts', 'high-court-judiciary', 'State judicial administration and court registry', 1),
('dept_it', 'org_mpsedc', 'Science & Technology (MPSEDC / MAP_IT)', 'science-technology-it', 'State e-governance and digital services', 1),
('dept_revenue', 'org_mpesb', 'Revenue Department', 'revenue-department', 'Land records and revenue administration', 1),
('dept_forest', 'org_mpesb', 'Forest & Wildlife Department', 'forest-department', 'Forestry and wildlife protection', 1),
('dept_school_edu', 'org_mpesb', 'School Education Department', 'school-education', 'State school education', 1),
('dept_higher_edu', 'org_mppsc', 'Higher Education Department', 'higher-education', 'Government collegiate education', 1),
('dept_pwd', 'org_mpesb', 'Public Works Department (PWD / WRD)', 'public-works-department', 'State infrastructure works', 1),
('dept_health', 'org_mpesb', 'Public Health & Family Welfare', 'public-health-welfare', 'State public healthcare', 1);
