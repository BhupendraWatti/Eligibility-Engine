PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE admin_users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'EDITOR' NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
INSERT INTO "admin_users" ("id","email","name","role","is_active","created_at") VALUES('2d918a3327afdf4a8eba90752307c264','bhupendrawatti24@gmail.com','Bhupendra Watti','SUPER_ADMIN',1,1790761350);
INSERT INTO "admin_users" ("id","email","name","role","is_active","created_at") VALUES('a3a8fcd873e1ecd06bbd34af488b84d9','bhupendra2422006watti@gmail.com','Bhupendra Watti','SUPER_ADMIN',1,1790761614);
INSERT INTO "admin_users" ("id","email","name","role","is_active","created_at") VALUES('adm_himanshu_karveti_2','himanshukarveti2@gmail.com','Himanshu Karveti','SUPER_ADMIN',1,1791098184);
CREATE TABLE states (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_mp','MP','Madhya Pradesh','madhya-pradesh',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_in','IN','Central Government','central-government',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_ap','AP','Andhra Pradesh','andhra-pradesh',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_ar','AR','Arunachal Pradesh','arunachal-pradesh',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_as','AS','Assam','assam',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_br','BR','Bihar','bihar',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_cg','CG','Chhattisgarh','chhattisgarh',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_ga','GA','Goa','goa',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_gj','GJ','Gujarat','gujarat',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_hr','HR','Haryana','haryana',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_hp','HP','Himachal Pradesh','himachal-pradesh',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_jh','JH','Jharkhand','jharkhand',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_ka','KA','Karnataka','karnataka',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_kl','KL','Kerala','kerala',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_mh','MH','Maharashtra','maharashtra',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_mn','MN','Manipur','manipur',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_ml','ML','Meghalaya','meghalaya',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_mz','MZ','Mizoram','mizoram',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_nl','NL','Nagaland','nagaland',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_od','OD','Odisha','odisha',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_pb','PB','Punjab','punjab',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_rj','RJ','Rajasthan','rajasthan',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_sk','SK','Sikkim','sikkim',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_tn','TN','Tamil Nadu','tamil-nadu',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_tg','TG','Telangana','telangana',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_tr','TR','Tripura','tripura',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_up','UP','Uttar Pradesh','uttar-pradesh',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_uk','UK','Uttarakhand','uttarakhand',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_wb','WB','West Bengal','west-bengal',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_an','AN','Andaman and Nicobar Islands','andaman-nicobar-islands',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_ch','CH','Chandigarh','chandigarh',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_dn','DN','Dadra and Nagar Haveli and Daman and Diu','dadra-nagar-haveli-daman-diu',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_dl','DL','Delhi','delhi',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_jk','JK','Jammu and Kashmir','jammu-kashmir',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_la','LA','Ladakh','ladakh',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_ld','LD','Lakshadweep','lakshadweep',1,1791109394);
INSERT INTO "states" ("id","code","name","slug","is_active","created_at") VALUES('st_py','PY','Puducherry','puducherry',1,1791109394);
CREATE TABLE organisations (
    id TEXT PRIMARY KEY NOT NULL,
    state_id TEXT NOT NULL REFERENCES states(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    website_url TEXT NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
INSERT INTO "organisations" ("id","state_id","name","short_name","slug","website_url","is_active","created_at") VALUES('org_mpesb','st_mp','Madhya Pradesh Employees Selection Board','MPESB','mpesb','https://esb.mp.gov.in',1,1791109394);
INSERT INTO "organisations" ("id","state_id","name","short_name","slug","website_url","is_active","created_at") VALUES('org_mppsc','st_mp','Madhya Pradesh Public Service Commission','MPPSC','mppsc','https://mppsc.mp.gov.in',1,1791109394);
INSERT INTO "organisations" ("id","state_id","name","short_name","slug","website_url","is_active","created_at") VALUES('org_mphc','st_mp','High Court of Madhya Pradesh','MPHC','mphc','https://mphc.gov.in',1,1791109394);
INSERT INTO "organisations" ("id","state_id","name","short_name","slug","website_url","is_active","created_at") VALUES('org_mpsedc','st_mp','MP State Electronics Development Corp','MPSEDC','mpsedc','https://mpsedc.mp.gov.in',1,1791109394);
INSERT INTO "organisations" ("id","state_id","name","short_name","slug","website_url","is_active","created_at") VALUES('org_nhm_mp','st_mp','National Health Mission Madhya Pradesh','NHM MP','nhm-mp','https://nhmmp.gov.in',1,1791109394);
CREATE TABLE departments (
    id TEXT PRIMARY KEY NOT NULL,
    organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    UNIQUE(organisation_id, slug)
);
INSERT INTO "departments" ("id","organisation_id","name","slug","description","is_active","created_at") VALUES('dept_gad','org_mppsc','General Administration Department','general-administration','State civil secretariat, personnel management, and executive cadre',1,1791109394);
INSERT INTO "departments" ("id","organisation_id","name","slug","description","is_active","created_at") VALUES('dept_home','org_mpesb','Home Department (Police & Jail)','home-department','State police, internal security, and correctional services',1,1791109394);
INSERT INTO "departments" ("id","organisation_id","name","slug","description","is_active","created_at") VALUES('dept_judiciary','org_mphc','High Court Registry & Subordinate Courts','high-court-judiciary','State judicial administration and court registry',1,1791109394);
INSERT INTO "departments" ("id","organisation_id","name","slug","description","is_active","created_at") VALUES('dept_it','org_mpsedc','Science & Technology (MPSEDC / MAP_IT)','science-technology-it','State e-governance and digital services',1,1791109394);
INSERT INTO "departments" ("id","organisation_id","name","slug","description","is_active","created_at") VALUES('dept_revenue','org_mpesb','Revenue Department','revenue-department','Land records and revenue administration',1,1791109394);
INSERT INTO "departments" ("id","organisation_id","name","slug","description","is_active","created_at") VALUES('dept_forest','org_mpesb','Forest & Wildlife Department','forest-department','Forestry and wildlife protection',1,1791109394);
INSERT INTO "departments" ("id","organisation_id","name","slug","description","is_active","created_at") VALUES('dept_school_edu','org_mpesb','School Education Department','school-education','State school education',1,1791109394);
INSERT INTO "departments" ("id","organisation_id","name","slug","description","is_active","created_at") VALUES('dept_higher_edu','org_mppsc','Higher Education Department','higher-education','Government collegiate education',1,1791109394);
INSERT INTO "departments" ("id","organisation_id","name","slug","description","is_active","created_at") VALUES('dept_pwd','org_mpesb','Public Works Department (PWD / WRD)','public-works-department','State infrastructure works',1,1791109394);
INSERT INTO "departments" ("id","organisation_id","name","slug","description","is_active","created_at") VALUES('dept_health','org_mpesb','Public Health & Family Welfare','public-health-welfare','State public healthcare',1,1791109394);
CREATE TABLE sectors (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    display_order INTEGER DEFAULT 0 NOT NULL
, description TEXT, theme TEXT DEFAULT 'blue' NOT NULL, is_active INTEGER DEFAULT 1 NOT NULL, created_at INTEGER DEFAULT 0 NOT NULL, updated_at INTEGER DEFAULT 0 NOT NULL);
INSERT INTO "sectors" ("id","name","slug","icon","display_order","description","theme","is_active","created_at","updated_at") VALUES('sec_civil_services','Civil & Administrative Services','civil-administrative-services','landmark',1,'State administrative service, executive magistracy, and public governance cadres.','blue',1,1791109452,1791109452);
INSERT INTO "sectors" ("id","name","slug","icon","display_order","description","theme","is_active","created_at","updated_at") VALUES('sec_police','Police, Defence & Prisons','police-defence-prisons','shield',2,'Law enforcement, armed constabulary, state investigation agencies, and prison wardens.','indigo',1,1791109452,1791109452);
INSERT INTO "sectors" ("id","name","slug","icon","display_order","description","theme","is_active","created_at","updated_at") VALUES('sec_judiciary','Judiciary & Legal Services','judiciary-legal-services','scale',3,'Subordinate courts, judicial services, prosecution officers, and legal registry.','slate',1,1791109452,1791109452);
INSERT INTO "sectors" ("id","name","slug","icon","display_order","description","theme","is_active","created_at","updated_at") VALUES('sec_it_egov','Information Technology & e-Governance','it-egovernance','monitor',4,'Digital governance, state IT infrastructure, cybersecurity, and systems engineering.','cyan',1,1791109452,1791109452);
INSERT INTO "sectors" ("id","name","slug","icon","display_order","description","theme","is_active","created_at","updated_at") VALUES('sec_admin','Revenue & Land Administration','revenue-land-administration','building',5,'Land records, survey settlement, revenue collection, and Patwari administration.','amber',1,1791109452,1791109452);
INSERT INTO "sectors" ("id","name","slug","icon","display_order","description","theme","is_active","created_at","updated_at") VALUES('sec_forest','Forest, Wildlife & Environment','forest-environment','trees',6,'Forestry preservation, wildlife sanctuary surveillance, and environmental protection.','green',1,1791109452,1791109452);
INSERT INTO "sectors" ("id","name","slug","icon","display_order","description","theme","is_active","created_at","updated_at") VALUES('sec_teaching','Teaching & Higher Education','teaching-education','graduation-cap',7,'Primary, secondary, collegiate faculty, and university academic administration.','purple',1,1791109452,1791109452);
INSERT INTO "sectors" ("id","name","slug","icon","display_order","description","theme","is_active","created_at","updated_at") VALUES('sec_technical','Engineering & Technical Trades','engineering-technical-trades','wrench',8,'Public works, irrigation engineering, polytechnic cadres, and skilled mechanical trades.','amber',1,1791109452,1791109452);
INSERT INTO "sectors" ("id","name","slug","icon","display_order","description","theme","is_active","created_at","updated_at") VALUES('sec_health','Public Health & Medical Services','public-health-medical','activity',9,'Hospital healthcare, clinical nursing, community medicine, and public health cadres.','red',1,1791109452,1791109452);
INSERT INTO "sectors" ("id","name","slug","icon","display_order","description","theme","is_active","created_at","updated_at") VALUES('sec_support','Support Staff & Allied Services (Class IV)','support-staff-class-iv','briefcase',10,'Ministerial staff, multi-tasking staff, drivers, and institutional support cadres.','slate',1,1791109452,1791109452);
CREATE TABLE posts (
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
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_deputy_collector','dept_gad','sec_civil_services','Deputy Collector (State Civil Service)','mp-deputy-collector','Senior sub-divisional administrative magistrate in MP Civil Services, responsible for executive administration, law & order, and policy implementation.','Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)',21,33,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_dsp','dept_home','sec_police','Deputy Superintendent of Police (DSP)','mp-dsp','Gazetted police executive leadership role commanding sub-divisional police operations, crime control, and law enforcement.','Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)',21,33,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_civil_judge','dept_judiciary','sec_judiciary','Civil Judge (Junior Division / Judicial Magistrate)','mp-civil-judge','Subordinate judicial officer presiding over civil suits and criminal trials across district and tehsil courts of Madhya Pradesh.','Rs. 77,840 - 1,36,520/- (Pay Matrix Level J-1)',21,35,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_acf','dept_forest','sec_forest','Assistant Conservator of Forests (ACF)','mp-acf-forest','Gazetted state forest service officer managing territorial divisions, anti-poaching operations, and sanctuary conservancies.','Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)',21,33,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_assistant_professor','dept_higher_edu','sec_teaching','Assistant Professor (Government Colleges)','mp-assistant-professor','Higher education collegiate faculty instructing undergraduate and postgraduate courses in MP Government Degree Colleges.','Rs. 57,700 - 1,82,400/- (Academic Level 10)',21,40,'POST_GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_medical_officer','dept_health','sec_health','Medical Officer (MBBS)','mp-medical-officer','Registered government physician delivering clinical consultation, trauma emergency care, and public healthcare in district hospitals.','Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)',21,40,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_assistant_engineer','dept_pwd','sec_technical','Assistant Engineer (Civil / Electrical)','mp-assistant-engineer','Gazetted engineer supervising engineering tenders, bridge design, road construction, and state infrastructure works.','Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)',21,33,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_naib_tehsildar','dept_revenue','sec_admin','Naib Tehsildar (Executive Magistrate)','mp-naib-tehsildar','Sub-tehsil executive officer adjudicating land mutations, revenue cases, tenancy matters, and rural dispute resolution.','Rs. 36,200 - 1,14,800/- (Pay Matrix Level 8)',21,33,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_commercial_tax_officer','dept_gad','sec_civil_services','Commercial Tax Officer / GST Officer','mp-commercial-tax-officer','State revenue executive overseeing SGST compliance, commercial tax assessments, and tax intelligence audits.','Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)',21,33,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_forest_range_officer','dept_forest','sec_forest','Forest Range Officer (FRO)','mp-forest-range-officer','Range executive supervising territorial forest beats, wildlife corridors, nurseries, and plantation works.','Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)',21,33,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_school_lecturer','dept_school_edu','sec_teaching','School Lecturer (Uchha Madhyamik Shikshak / Varg-1)','mp-school-lecturer-varg-1','Subject-specialized teacher instructing classes 11 and 12 in state government higher secondary schools.','Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)',21,40,'POST_GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_degm_it','dept_it','sec_it_egov','District e-Governance Manager (DeGM)','mp-degm-it','District IT leader in-charge of state portal delivery, Lok Seva Kendras, Aadhaar services, and technical field operations.','Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)',21,35,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_si','dept_home','sec_police','Sub Inspector (Civil Police)','mp-police-sub-inspector','Police station investigation officer responsible for investigating criminal offences, filing chargesheets, and maintaining order.','Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)',21,33,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_constable','dept_home','sec_police','Police Constable (General Duty)','mp-police-constable','Primary frontline police officer in MP Police responsible for patrolling, beat guarding, escorting, and law enforcement.','Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',18,33,'10TH',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_constable_radio','dept_home','sec_police','Police Constable (Radio / Telecommunication)','mp-police-constable-radio','Technical police operator managing wireless communication networks, VHF repeaters, and dial-112 dispatch systems.','Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',18,33,'12TH',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_jail_prahari','dept_home','sec_police','Jail Prahari (Prison Warder)','mp-jail-prahari','Correctional security officer in MP Jail Department guarding state penitentiaries and maintaining inmate security.','Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',18,33,'10TH',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_patwari','dept_revenue','sec_admin','Patwari (Land Records Officer)','mp-patwari','Primary village revenue and land records officer managing agricultural survey, crop inspection, and mutation records.','Rs. 25,300 - 80,500/- (Pay Matrix Level 6)',18,40,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_revenue_inspector','dept_revenue','sec_admin','Revenue Inspector (RI / Kanoongo)','mp-revenue-inspector','Supervisory revenue officer overseeing multiple Patwari halkas, land demarcation, and government boundary inspections.','Rs. 28,700 - 91,300/- (Pay Matrix Level 7)',18,40,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_forest_guard','dept_forest','sec_forest','Forest Guard (Van Rakshak)','mp-forest-guard','Field forest beat guard protecting national parks and reserved forests against timber logging and poaching.','Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',18,33,'10TH',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_jja_court','dept_judiciary','sec_judiciary','Junior Judicial Assistant (JJA) / Assistant Grade-III (Courts)','mp-jja-court','High Court and District Court ministerial staff handling judicial case files, certified copies, cause lists, and courtroom dockets.','Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',18,35,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_court_stenographer','dept_judiciary','sec_judiciary','Court Stenographer (Grade II & III)','mp-court-stenographer','Verbatim judicial dictation recorder transcribing trial judgments, court orders, and witness depositions.','Rs. 28,700 - 91,300/- (Pay Matrix Level 7)',18,35,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_assistant_programmer','dept_it','sec_it_egov','Assistant Programmer / Systems Analyst (IT)','mp-assistant-programmer','State government software programmer and database specialist developing digital portals and citizen services.','Rs. 32,800 - 1,03,600/- (Pay Matrix Level 8)',21,35,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_data_entry_operator','dept_gad','sec_it_egov','Data Entry Operator (DEO) / Computer Operator','mp-data-entry-operator','Data processing specialist managing state treasury data, civil registrations, and computer records across collectorates.','Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',18,40,'12TH',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_sub_engineer','dept_pwd','sec_technical','Sub-Engineer (Civil / Electrical / Mechanical)','mp-sub-engineer','Technical field engineer supervising public building construction, bridge inspection, and water supply civil works.','Rs. 32,800 - 1,03,600/- (Pay Matrix Level 8)',18,40,'DIPLOMA',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_group4_clerk','dept_gad','sec_admin','Assistant Grade-III / Steno-Typist (State Secretariat)','mp-assistant-grade-3','Clerical ministerial staff in state secretariats and district offices managing administrative files and typing.','Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',18,40,'12TH',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_samvida_varg2','dept_school_edu','sec_teaching','Middle School Teacher (Madhyamik Shikshak / Varg-2)','mp-middle-teacher-varg-2','Subject teacher for classes 6 to 8 in government middle schools covering Science, Math, Social Science, and Languages.','Rs. 25,300 - 80,500/- (Pay Matrix Level 6)',21,40,'GRADUATION',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_samvida_varg3','dept_school_edu','sec_teaching','Primary School Teacher (Prathmik Shikshak / Varg-3)','mp-primary-teacher-varg-3','Foundational elementary teacher instructing classes 1 to 5 in MP State government primary schools.','Rs. 25,300 - 80,500/- (Pay Matrix Level 6)',18,40,'12TH',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_staff_nurse','dept_health','sec_health','Staff Nurse (Nursing Officer)','mp-staff-nurse','Clinical registered nursing officer providing hospital ward healthcare, neonatal care, and surgical assistance.','Rs. 28,700 - 91,300/- (Pay Matrix Level 7)',21,40,'DIPLOMA',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_anm','dept_health','sec_health','ANM (Auxiliary Nurse Midwife)','mp-anm-health','Rural healthcare worker providing child immunization, maternal care, and family planning at village sub-centres.','Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',18,40,'12TH',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_pharmacist','dept_health','sec_health','Pharmacist Grade-II','mp-pharmacist-grade-2','Government hospital pharmacy dispenser managing medication inventory, formulation, and prescription delivery.','Rs. 25,300 - 80,500/- (Pay Matrix Level 6)',18,40,'DIPLOMA',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_peon_bhritya','dept_gad','sec_support','Office Peon / Attendant (Bhritya / Process Server)','mp-peon-bhritya','Support staff maintaining judicial summon deliveries, departmental dak distribution, and office assistance.','Rs. 15,500 - 49,000/- (Pay Matrix Level 1)',18,40,'8TH',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_govt_driver','dept_gad','sec_support','Government Vehicle Driver (Light & Heavy)','mp-govt-driver','Professional driver operating judicial motorcade vehicles, police patrol units, ambulances, and official staff cars.','Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',18,40,'8TH',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_chowkidar','dept_gad','sec_support','Security Chowkidar / Night Watchman','mp-chowkidar','Campus security guard securing government office complexes, district collectorates, and state rest houses.','Rs. 15,500 - 49,000/- (Pay Matrix Level 1)',18,40,'8TH',1,1791109452);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_subedar_steno','dept_home','sec_police','Subedar (Stenographic) - Stenographer','mp-police-subedar-stenographer','Stenographer cadre of MP Police at Subedar rank handling shorthand dictation, typing and confidential correspondence for police offices.','Rs. 36,200 - 1,14,800/-',18,33,'12TH',1,1791232281);
INSERT INTO "posts" ("id","department_id","sector_id","title","slug","summary","pay_scale","default_min_age","default_max_age","default_qualification","is_active","created_at") VALUES('post_mp_asi_steno','dept_home','sec_police','Assistant Sub Inspector (Stenographic)','mp-police-asi-stenographic','Stenographic cadre Assistant Sub Inspector in MP Police handling office records, typing and computer work in police units and branches.','Rs. 19,500 - 62,000/-',18,33,'12TH',1,1791232281);
CREATE TABLE recruitments (
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
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
, validation_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW', validation_errors_json TEXT, overview_markdown TEXT, selection_stages_json TEXT, pay_scale_override TEXT, salary_details_markdown TEXT, cadre_classification TEXT, exam_status TEXT NOT NULL DEFAULT 'NOT_SCHEDULED', result_status TEXT NOT NULL DEFAULT 'NOT_DECLARED', seo_title TEXT, seo_description TEXT, robots_index INTEGER DEFAULT 1 NOT NULL);
INSERT INTO "recruitments" ("id","post_id","organisation_id","state_id","advt_number","title","slug","short_summary","cycle_year","total_vacancies","status","lifecycle_status","is_featured","created_at","updated_at","validation_status","validation_errors_json","overview_markdown","selection_stages_json","pay_scale_override","salary_details_markdown","cadre_classification","exam_status","result_status","seo_title","seo_description","robots_index") VALUES('rec_3b8566d9-026f-4299-98f9-5075f6e5c092','post_mp_subedar_steno','org_mpesb','st_mp','PHQ Letter 40-A/30-07-2026','Police Subedar (Stenographic) - Stenographer Direct Recruitment 2026','police-subedar-stenographic-stenographer-direct-recruitment-2026','Direct recruitment for 135 vacancies of Subedar (Stenographic) - Stenographer.',2026,135,'DRAFT','APPLICATION_CLOSING',0,1791232636,1791232636,'VALID','[]',NULL,NULL,'Rs. 36,200 - 1,14,800',NULL,NULL,'SCHEDULED','NOT_DECLARED',NULL,NULL,1);
INSERT INTO "recruitments" ("id","post_id","organisation_id","state_id","advt_number","title","slug","short_summary","cycle_year","total_vacancies","status","lifecycle_status","is_featured","created_at","updated_at","validation_status","validation_errors_json","overview_markdown","selection_stages_json","pay_scale_override","salary_details_markdown","cadre_classification","exam_status","result_status","seo_title","seo_description","robots_index") VALUES('rec_9a5bba16-cfee-43ac-86a7-e3070ade3453','post_mp_constable','org_mpesb','st_mp','PHQ/2/Chayan/S-3/583/2026','Police Constable (GD) Direct Recruitment Test 2026','police-constable-gd-direct-recruitment-test-2026','Direct recruitment for 7,500 vacancies of Police Constable (General Duty).',2026,7500,'PUBLISHED','APPLICATION_CLOSING',0,1791232666,1791232666,'VALID','[]',NULL,NULL,'Rs. 19,500 - 62,000',NULL,NULL,'SCHEDULED','NOT_DECLARED',NULL,NULL,1);
INSERT INTO "recruitments" ("id","post_id","organisation_id","state_id","advt_number","title","slug","short_summary","cycle_year","total_vacancies","status","lifecycle_status","is_featured","created_at","updated_at","validation_status","validation_errors_json","overview_markdown","selection_stages_json","pay_scale_override","salary_details_markdown","cadre_classification","exam_status","result_status","seo_title","seo_description","robots_index") VALUES('rec_be645587-b1a0-4081-9a14-bf94bf6addc5','post_mp_constable','org_mpesb','st_mp','पुमु/2/चयन/स-3/583/2026 (Police HQ letter dated 30/07/2026)','Police Constable (GD) Direct Recruitment Test 2026','police-constable-gd-direct-recruitment-test-2026-9269','Direct recruitment for 7,500 vacancies of Police Constable (General Duty).',2026,7500,'DRAFT','APPLICATION_CLOSING',0,1791232672,1791232672,'VALID','[]',NULL,'[{"stage":1,"name":"Written Test","desc":"Online MCQ in Hindi, 100 marks, 2 hours: General Knowledge and Reasoning 40, Mental Aptitude 30, Science and Simple Arithmetic 30. No negative marking.","isQualifying":false},{"stage":2,"name":"Physical Efficiency Test and Document Verification","desc":"Candidates up to 7x the advertised vertical posts are called. Minimum 30 of 100 marks in the physical test; marks are added to written test marks for the final merit list. Medical board examination follows.","isQualifying":false}]','Rs. 19,500 - 62,000 (stipend 70%/80%/90% of minimum in years 1-3)',NULL,NULL,'SCHEDULED','NOT_DECLARED',NULL,NULL,1);
CREATE TABLE recruitment_eligibility (
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
, qualification_details_markdown TEXT, relaxation_notes_markdown TEXT, domicile_state_code TEXT, employment_registration_label TEXT);
INSERT INTO "recruitment_eligibility" ("id","recruitment_id","min_age","max_age_general","age_cutoff_date","age_relaxation_sc_st","age_relaxation_obc","age_relaxation_female","age_relaxation_ews","min_qualification_level","allowed_streams_json","requires_mp_domicile","requires_mp_employment_reg","requires_cpct","gender_allowed","min_height_male_cm","min_height_female_cm","min_chest_male_cm","experience_months","min_percentage_required","additional_skills_json","special_conditions_notes","qualification_details_markdown","relaxation_notes_markdown","domicile_state_code","employment_registration_label") VALUES('elig_rec_3b8566d9-026f-4299-98f9-5075f6e5c092','rec_3b8566d9-026f-4299-98f9-5075f6e5c092',18,33,'2026-10-08',5,3,5,0,'12TH',NULL,0,0,0,'ALL',NULL,NULL,NULL,0,NULL,NULL,NULL,'12th pass (Higher Secondary), Hindi shorthand at 100 words per minute from a recognised board/polytechnic/ITI, CPCT certificate with Hindi typing, and a recognised computer diploma/certificate (DOEACC, COPA, modern office management or equivalent).',NULL,NULL,NULL);
INSERT INTO "recruitment_eligibility" ("id","recruitment_id","min_age","max_age_general","age_cutoff_date","age_relaxation_sc_st","age_relaxation_obc","age_relaxation_female","age_relaxation_ews","min_qualification_level","allowed_streams_json","requires_mp_domicile","requires_mp_employment_reg","requires_cpct","gender_allowed","min_height_male_cm","min_height_female_cm","min_chest_male_cm","experience_months","min_percentage_required","additional_skills_json","special_conditions_notes","qualification_details_markdown","relaxation_notes_markdown","domicile_state_code","employment_registration_label") VALUES('elig_rec_9a5bba16-cfee-43ac-86a7-e3070ade3453','rec_9a5bba16-cfee-43ac-86a7-e3070ade3453',18,33,'2026-10-06',5,3,5,0,'10TH',NULL,0,1,0,'ALL',NULL,NULL,NULL,0,NULL,NULL,NULL,'10th class pass (or Higher Secondary / equivalent) for Unreserved, SC and OBC. Class 8 pass or equivalent for ST. Live MP Employment Office registration is mandatory.',NULL,NULL,NULL);
INSERT INTO "recruitment_eligibility" ("id","recruitment_id","min_age","max_age_general","age_cutoff_date","age_relaxation_sc_st","age_relaxation_obc","age_relaxation_female","age_relaxation_ews","min_qualification_level","allowed_streams_json","requires_mp_domicile","requires_mp_employment_reg","requires_cpct","gender_allowed","min_height_male_cm","min_height_female_cm","min_chest_male_cm","experience_months","min_percentage_required","additional_skills_json","special_conditions_notes","qualification_details_markdown","relaxation_notes_markdown","domicile_state_code","employment_registration_label") VALUES('elig_rec_be645587-b1a0-4081-9a14-bf94bf6addc5','rec_be645587-b1a0-4081-9a14-bf94bf6addc5',18,33,'2026-10-06',5,3,5,0,'12TH',NULL,0,1,0,'ALL',NULL,NULL,NULL,0,NULL,NULL,'Non-MP domicile candidates may apply only against Unreserved posts, with no reservation or age relaxation (max age 33). Physical standards: men 168 cm height (SC 165 cm for SAF), chest 81/86 cm; women Unreserved 155 cm, SC 160 cm, OBC 155 cm (ST relaxations apply).','10+2 (Higher Secondary) or equivalent from a recognised board for Unreserved, SC and OBC; Class 8 pass or equivalent for ST. Live registration at the MP Employment Office is mandatory.',NULL,NULL,NULL);
CREATE TABLE important_dates (
    id TEXT PRIMARY KEY NOT NULL,
    recruitment_id TEXT NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_date TEXT NOT NULL,
    is_tentative INTEGER DEFAULT 0 NOT NULL,
    notes TEXT
);
INSERT INTO "important_dates" ("id","recruitment_id","event_type","event_date","is_tentative","notes") VALUES('date_61840096-b30f-41d8-b73c-05ae881cb8b4','rec_3b8566d9-026f-4299-98f9-5075f6e5c092','APPLICATION_START','2026-09-24',0,'Online registration begins');
INSERT INTO "important_dates" ("id","recruitment_id","event_type","event_date","is_tentative","notes") VALUES('date_43e6fe93-8de8-45dc-a84f-65ce15fe6c4c','rec_3b8566d9-026f-4299-98f9-5075f6e5c092','APPLICATION_END','2026-10-08',0,'Application deadline');
INSERT INTO "important_dates" ("id","recruitment_id","event_type","event_date","is_tentative","notes") VALUES('date_13b0ff2e-0766-4fc7-be6d-0c7f3565b4e8','rec_3b8566d9-026f-4299-98f9-5075f6e5c092','EXAM_DATE','2026-11-03',0,'Scheduled examination');
INSERT INTO "important_dates" ("id","recruitment_id","event_type","event_date","is_tentative","notes") VALUES('date_a0974330-0f23-464a-9042-af24b82a7de5','rec_9a5bba16-cfee-43ac-86a7-e3070ade3453','APPLICATION_START','2026-09-22',0,'Online registration begins');
INSERT INTO "important_dates" ("id","recruitment_id","event_type","event_date","is_tentative","notes") VALUES('date_e6b79585-5775-437a-a80e-e73888992fa3','rec_9a5bba16-cfee-43ac-86a7-e3070ade3453','APPLICATION_END','2026-10-06',0,'Application deadline');
INSERT INTO "important_dates" ("id","recruitment_id","event_type","event_date","is_tentative","notes") VALUES('date_ab4ebb58-2d5e-488e-b3aa-807f6f227559','rec_9a5bba16-cfee-43ac-86a7-e3070ade3453','EXAM_DATE','2026-11-19',0,'Scheduled examination');
INSERT INTO "important_dates" ("id","recruitment_id","event_type","event_date","is_tentative","notes") VALUES('date_dd5964fb-e913-40db-bef0-547ba8b097ea','rec_be645587-b1a0-4081-9a14-bf94bf6addc5','CORRECTION_WINDOW_END','2026-10-11',0,'Last date to correct submitted application');
CREATE TABLE official_links (
    id TEXT PRIMARY KEY NOT NULL,
    recruitment_id TEXT NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL
);
INSERT INTO "official_links" ("id","recruitment_id","link_type","title","url","is_active") VALUES('link_0d2d590c-767c-4526-a21f-5d43a116fa6e','rec_3b8566d9-026f-4299-98f9-5075f6e5c092','RULEBOOK','Subedar/ASI (Stenographic) 2026 Rule Book (PDF)','https://esb.mp.gov.in/Rulebooks/RB_2026/Steno_ASI_2026_Rulebook_17092026.pdf',1);
INSERT INTO "official_links" ("id","recruitment_id","link_type","title","url","is_active") VALUES('link_cf7d5ede-c9c5-4e3a-b79f-082fc2f13602','rec_3b8566d9-026f-4299-98f9-5075f6e5c092','OFFICIAL_WEBSITE','MP Employees Selection Board','https://esb.mp.gov.in/e_default.html',1);
INSERT INTO "official_links" ("id","recruitment_id","link_type","title","url","is_active") VALUES('link_1dd6f63e-3643-466a-ba86-fd91ff8774bb','rec_9a5bba16-cfee-43ac-86a7-e3070ade3453','RULEBOOK','Constable (GD) 2026 Rule Book (PDF)','https://esb.mp.gov.in/Rulebooks/RB_2026/PCRT_GD_2026_RuleBook_09092026.pdf',1);
INSERT INTO "official_links" ("id","recruitment_id","link_type","title","url","is_active") VALUES('link_e8e1f719-cb68-4e1d-9bb0-d5e3596c047d','rec_9a5bba16-cfee-43ac-86a7-e3070ade3453','OFFICIAL_WEBSITE','MP Employees Selection Board','https://esb.mp.gov.in/e_default.html',1);
INSERT INTO "official_links" ("id","recruitment_id","link_type","title","url","is_active") VALUES('link_4ef746cd-32e9-48e3-b45e-3df61c04ab33','rec_be645587-b1a0-4081-9a14-bf94bf6addc5','RULEBOOK','Constable (GD) 2026 Rule Book (PDF)','https://esb.mp.gov.in/Rulebooks/RB_2026/PCRT_GD_2026_RuleBook_09092026.pdf',1);
INSERT INTO "official_links" ("id","recruitment_id","link_type","title","url","is_active") VALUES('link_57202362-11a9-41ad-a020-fb32bb40666c','rec_be645587-b1a0-4081-9a14-bf94bf6addc5','OFFICIAL_WEBSITE','MP Employees Selection Board','https://esb.mp.gov.in/e_default.html',1);
CREATE TABLE vacancies (
    id TEXT PRIMARY KEY NOT NULL,
    recruitment_id TEXT NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    gender TEXT DEFAULT 'ALL' NOT NULL,
    count INTEGER NOT NULL
, quota_pct TEXT, sub_post_name TEXT);
INSERT INTO "vacancies" ("id","recruitment_id","category","gender","count","quota_pct","sub_post_name") VALUES('vac_70b3c702-1308-4588-b100-60b46f2f382f','rec_3b8566d9-026f-4299-98f9-5075f6e5c092','ALL','ALL',125,NULL,'Subedar (Stenographic) - General Branch');
INSERT INTO "vacancies" ("id","recruitment_id","category","gender","count","quota_pct","sub_post_name") VALUES('vac_1503205c-f116-41c2-b64c-197bf753dab4','rec_3b8566d9-026f-4299-98f9-5075f6e5c092','ALL','ALL',10,NULL,'Subedar (Stenographic) - Special Branch');
INSERT INTO "vacancies" ("id","recruitment_id","category","gender","count","quota_pct","sub_post_name") VALUES('vac_2c12bb38-9409-47c3-a3a2-f84e96f2d7da','rec_9a5bba16-cfee-43ac-86a7-e3070ade3453','ALL','ALL',700,NULL,'Constable (GD) - Special Armed Force (men only)');
INSERT INTO "vacancies" ("id","recruitment_id","category","gender","count","quota_pct","sub_post_name") VALUES('vac_931a0421-b8bb-4795-8996-17f36796c1b6','rec_9a5bba16-cfee-43ac-86a7-e3070ade3453','ALL','ALL',6800,NULL,'Constable (GD) - excluding Special Armed Force');
INSERT INTO "vacancies" ("id","recruitment_id","category","gender","count","quota_pct","sub_post_name") VALUES('vac_22e80c11-bd3c-45a4-9d7c-e861dcc8091d','rec_be645587-b1a0-4081-9a14-bf94bf6addc5','ALL','ALL',700,NULL,'Constable (GD) - Special Armed Force (men only)');
INSERT INTO "vacancies" ("id","recruitment_id","category","gender","count","quota_pct","sub_post_name") VALUES('vac_1ba390c2-a750-46cc-9576-f1cc1b0bee1c','rec_be645587-b1a0-4081-9a14-bf94bf6addc5','ALL','ALL',6800,NULL,'Constable (GD) - excluding Special Armed Force');
CREATE TABLE sources (
    id TEXT PRIMARY KEY NOT NULL,
    recruitment_id TEXT NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    publication_date TEXT,
    last_verified_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
INSERT INTO "sources" ("id","recruitment_id","source_type","source_url","source_title","publication_date","last_verified_at") VALUES('src_6d24c963-e50f-4fe8-8bef-f6b865456df0','rec_3b8566d9-026f-4299-98f9-5075f6e5c092','OFFICIAL_RULEBOOK','https://esb.mp.gov.in/Rulebooks/RB_2026/Steno_ASI_2026_Rulebook_17092026.pdf','MPESB Subedar (Stenographic) Stenographer and ASI (Stenographic) Selection Test 2026 Rule Book','2026-09-17',1791232636);
INSERT INTO "sources" ("id","recruitment_id","source_type","source_url","source_title","publication_date","last_verified_at") VALUES('src_cf7ab529-3634-4fcd-bebb-9e19f236c7c6','rec_9a5bba16-cfee-43ac-86a7-e3070ade3453','OFFICIAL_RULEBOOK','https://esb.mp.gov.in/Rulebooks/RB_2026/PCRT_GD_2026_RuleBook_09092026.pdf','MPESB Police Constable (GD) Selection Test 2026 Rule Book','2026-09-09',1791232666);
INSERT INTO "sources" ("id","recruitment_id","source_type","source_url","source_title","publication_date","last_verified_at") VALUES('src_d66aa788-8a7b-4f94-b1b4-51fe8825711f','rec_be645587-b1a0-4081-9a14-bf94bf6addc5','OFFICIAL_RULEBOOK','https://esb.mp.gov.in/Rulebooks/RB_2026/PCRT_GD_2026_RuleBook_09092026.pdf','MPESB Police Constable (GD) Selection Test 2026 Rule Book (Hindi, 37 pages)','2026-09-09',1791232672);
CREATE TABLE records (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    data TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_init.sql','2026-09-18 15:55:27');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0002_recruitment_detail_content.sql','2026-09-18 15:55:43');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'0003_recruitment_lifecycle_normalization.sql','2026-09-18 15:55:43');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(4,'0004_integrity_indexes.sql','2026-09-18 15:55:43');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(5,'0005_multistate_eligibility.sql','2026-09-18 15:55:44');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(6,'0006_core_master_seed.sql','2026-10-04 10:23:14');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(7,'0007_nationwide_admin.sql','2026-10-04 10:23:14');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(8,'0008_sectors_enhancement.sql','2026-10-04 10:24:12');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(9,'0009_core_canonical_posts.sql','2026-10-04 10:24:12');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(10,'0010_change_proposals.sql','2026-10-05 10:22:36');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(11,'0011_audit_logs_repair.sql','2026-10-05 10:38:31');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(12,'0012_police_stenographic_posts.sql','2026-10-05 20:31:21');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(13,'0013_proposal_lifecycle.sql','2026-10-05 21:51:35');
CREATE TABLE change_proposals (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,                       
    recruitment_id TEXT,                      
    summary TEXT NOT NULL,
    payload TEXT NOT NULL,                    
    base_snapshot TEXT,                       
    status TEXT NOT NULL DEFAULT 'PENDING',   
    proposed_by TEXT NOT NULL,
    decided_by TEXT,
    decided_at INTEGER,
    decision_note TEXT,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
, supersedes_id TEXT, meta TEXT);
INSERT INTO "change_proposals" ("id","kind","recruitment_id","summary","payload","base_snapshot","status","proposed_by","decided_by","decided_at","decision_note","created_at","supersedes_id","meta") VALUES('prop_cef96aef-9ddf-41a3-8232-3aa5d1ad482c','CREATE_RECRUITMENT',NULL,'E2E TEST - safe to reject (deployment verification)','{"title":"E2E TEST Recruitment 2026","postId":"post_mp_deputy_collector","organisationId":"org_mpesb","advtNumber":"TEST/2026/01","totalVacancies":1,"cycleYear":2026,"sources":[{"sourceType":"NOTIFICATION","sourceTitle":"Test source","sourceUrl":"https://example.com"}]}',NULL,'APPLYING','mcp-client',NULL,NULL,NULL,1791195919,NULL,NULL);
INSERT INTO "change_proposals" ("id","kind","recruitment_id","summary","payload","base_snapshot","status","proposed_by","decided_by","decided_at","decision_note","created_at","supersedes_id","meta") VALUES('prop_ebb3f5cd-262f-47db-bff5-ad6156b9a72e','CREATE_RECRUITMENT',NULL,'New: MP Police Constable (GD) Recruitment Test 2026, 7,500 posts, apply 22-09 to 06-10-2026. Source: official MPESB rule book PDF (PCRT_GD_2026_RuleBook_09092026).','{"title":"Police Constable (GD) Direct Recruitment Test 2026","postId":"post_mp_constable","organisationId":"org_mpesb","advtNumber":"पुमु/2/चयन/स-3/583/2026 (Police HQ letter dated 30/07/2026)","totalVacancies":7500,"cycleYear":2026,"payScaleOverride":"Rs. 19,500 - 62,000 (stipend 70%/80%/90% of minimum in years 1-3)","minAge":18,"maxAgeGeneral":33,"ageCutoffDate":"2026-10-06","minQualificationLevel":"12TH","qualificationDetailsMarkdown":"10+2 (Higher Secondary) or equivalent from a recognised board for Unreserved, SC and OBC; Class 8 pass or equivalent for ST. Live registration at the MP Employment Office is mandatory.","requiresMpEmploymentReg":true,"applicationStart":"2026-09-22","applicationEnd":"2026-10-06","examDate":"2026-11-19","specialConditionsNotes":"Non-MP domicile candidates may apply only against Unreserved posts, with no reservation or age relaxation (max age 33). Physical standards: men 168 cm height (SC 165 cm for SAF), chest 81/86 cm; women Unreserved 155 cm, SC 160 cm, OBC 155 cm (ST relaxations apply).","selectionStages":[{"stage":1,"name":"Written Test","desc":"Online MCQ in Hindi, 100 marks, 2 hours: General Knowledge and Reasoning 40, Mental Aptitude 30, Science and Simple Arithmetic 30. No negative marking.","isQualifying":false},{"stage":2,"name":"Physical Efficiency Test and Document Verification","desc":"Candidates up to 7x the advertised vertical posts are called. Minimum 30 of 100 marks in the physical test; marks are added to written test marks for the final merit list. Medical board examination follows.","isQualifying":false}],"vacanciesBreakdown":[{"category":"ALL","count":700,"gender":"ALL","subPostName":"Constable (GD) - Special Armed Force (men only)"},{"category":"ALL","count":6800,"gender":"ALL","subPostName":"Constable (GD) - excluding Special Armed Force"}],"importantDates":[{"eventType":"CORRECTION_WINDOW_END","eventDate":"2026-10-11","isTentative":0,"notes":"Last date to correct submitted application"}],"sources":[{"sourceType":"OFFICIAL_RULEBOOK","sourceTitle":"MPESB Police Constable (GD) Selection Test 2026 Rule Book (Hindi, 37 pages)","sourceUrl":"https://esb.mp.gov.in/Rulebooks/RB_2026/PCRT_GD_2026_RuleBook_09092026.pdf","publicationDate":"2026-09-09"}],"officialLinks":[{"linkType":"RULEBOOK","title":"Constable (GD) 2026 Rule Book (PDF)","url":"https://esb.mp.gov.in/Rulebooks/RB_2026/PCRT_GD_2026_RuleBook_09092026.pdf"},{"linkType":"OFFICIAL_WEBSITE","title":"MP Employees Selection Board","url":"https://esb.mp.gov.in/e_default.html"}]}',NULL,'APPROVED','mcp-client','bhupendrawatti24@gmail.com',1791232672,'Created rec_be645587-b1a0-4081-9a14-bf94bf6addc5 as DRAFT.',1791231745,NULL,NULL);
INSERT INTO "change_proposals" ("id","kind","recruitment_id","summary","payload","base_snapshot","status","proposed_by","decided_by","decided_at","decision_note","created_at","supersedes_id","meta") VALUES('prop_d4d20fae-677c-484e-beac-4088601d06b8','CREATE_RECRUITMENT',NULL,'CORRECTED version of prop_ebb3f5cd (reject that one): MP Police Constable (GD) 2026, 7,500 posts, 10th pass. Source: official MPESB rule book PDF.','{"title":"Police Constable (GD) Direct Recruitment Test 2026","postId":"post_mp_constable","organisationId":"org_mpesb","advtNumber":"PHQ/2/Chayan/S-3/583/2026","totalVacancies":7500,"cycleYear":2026,"payScaleOverride":"Rs. 19,500 - 62,000","minAge":18,"maxAgeGeneral":33,"ageCutoffDate":"2026-10-06","minQualificationLevel":"10TH","qualificationDetailsMarkdown":"10th class pass (or Higher Secondary / equivalent) for Unreserved, SC and OBC. Class 8 pass or equivalent for ST. Live MP Employment Office registration is mandatory.","requiresMpEmploymentReg":true,"applicationStart":"2026-09-22","applicationEnd":"2026-10-06","examDate":"2026-11-19","vacanciesBreakdown":[{"category":"ALL","count":700,"gender":"ALL","subPostName":"Constable (GD) - Special Armed Force (men only)"},{"category":"ALL","count":6800,"gender":"ALL","subPostName":"Constable (GD) - excluding Special Armed Force"}],"sources":[{"sourceType":"OFFICIAL_RULEBOOK","sourceTitle":"MPESB Police Constable (GD) Selection Test 2026 Rule Book","sourceUrl":"https://esb.mp.gov.in/Rulebooks/RB_2026/PCRT_GD_2026_RuleBook_09092026.pdf","publicationDate":"2026-09-09"}],"officialLinks":[{"linkType":"RULEBOOK","title":"Constable (GD) 2026 Rule Book (PDF)","url":"https://esb.mp.gov.in/Rulebooks/RB_2026/PCRT_GD_2026_RuleBook_09092026.pdf"},{"linkType":"OFFICIAL_WEBSITE","title":"MP Employees Selection Board","url":"https://esb.mp.gov.in/e_default.html"}]}',NULL,'APPROVED','mcp-client','bhupendrawatti24@gmail.com',1791232666,'Created rec_9a5bba16-cfee-43ac-86a7-e3070ade3453 as PUBLISHED.',1791232140,NULL,NULL);
INSERT INTO "change_proposals" ("id","kind","recruitment_id","summary","payload","base_snapshot","status","proposed_by","decided_by","decided_at","decision_note","created_at","supersedes_id","meta") VALUES('prop_9a68c51b-bb52-46e2-a8fd-158d0391b333','CREATE_RECRUITMENT',NULL,'New: MP Police Subedar (Stenographic) - Stenographer 2026, 135 posts, apply 24-09 to 08-10-2026. Source: official MPESB Steno/ASI rule book PDF.','{"title":"Police Subedar (Stenographic) - Stenographer Direct Recruitment 2026","postId":"post_mp_subedar_steno","organisationId":"org_mpesb","advtNumber":"PHQ Letter 40-A/30-07-2026","totalVacancies":135,"cycleYear":2026,"payScaleOverride":"Rs. 36,200 - 1,14,800","maxAgeGeneral":33,"ageCutoffDate":"2026-10-08","minQualificationLevel":"12TH","qualificationDetailsMarkdown":"12th pass (Higher Secondary), Hindi shorthand at 100 words per minute from a recognised board/polytechnic/ITI, CPCT certificate with Hindi typing, and a recognised computer diploma/certificate (DOEACC, COPA, modern office management or equivalent).","applicationStart":"2026-09-24","applicationEnd":"2026-10-08","examDate":"2026-11-03","vacanciesBreakdown":[{"category":"ALL","count":125,"gender":"ALL","subPostName":"Subedar (Stenographic) - General Branch"},{"category":"ALL","count":10,"gender":"ALL","subPostName":"Subedar (Stenographic) - Special Branch"}],"sources":[{"sourceType":"OFFICIAL_RULEBOOK","sourceTitle":"MPESB Subedar (Stenographic) Stenographer and ASI (Stenographic) Selection Test 2026 Rule Book","sourceUrl":"https://esb.mp.gov.in/Rulebooks/RB_2026/Steno_ASI_2026_Rulebook_17092026.pdf","publicationDate":"2026-09-17"}],"officialLinks":[{"linkType":"RULEBOOK","title":"Subedar/ASI (Stenographic) 2026 Rule Book (PDF)","url":"https://esb.mp.gov.in/Rulebooks/RB_2026/Steno_ASI_2026_Rulebook_17092026.pdf"},{"linkType":"OFFICIAL_WEBSITE","title":"MP Employees Selection Board","url":"https://esb.mp.gov.in/e_default.html"}]}',NULL,'APPROVED','mcp-client','bhupendrawatti24@gmail.com',1791232636,'Created rec_3b8566d9-026f-4299-98f9-5075f6e5c092 as DRAFT.',1791232330,NULL,NULL);
INSERT INTO "change_proposals" ("id","kind","recruitment_id","summary","payload","base_snapshot","status","proposed_by","decided_by","decided_at","decision_note","created_at","supersedes_id","meta") VALUES('prop_48fdca4f-b265-4c3e-beae-b7566ab34c06','CREATE_RECRUITMENT',NULL,'New: MP Police Assistant Sub Inspector (Stenographic) 2026, 520 posts, apply 24-09 to 08-10-2026. Source: official MPESB Steno/ASI rule book PDF.','{"title":"Police Assistant Sub Inspector (Stenographic) Direct Recruitment 2026","postId":"post_mp_asi_steno","organisationId":"org_mpesb","advtNumber":"PHQ Letter 40-A/30-07-2026","totalVacancies":520,"cycleYear":2026,"payScaleOverride":"Rs. 19,500 - 62,000","maxAgeGeneral":33,"ageCutoffDate":"2026-10-08","minQualificationLevel":"12TH","qualificationDetailsMarkdown":"12th pass (Higher Secondary) from a recognised board, CPCT certificate with Hindi typing, and a computer qualification (engineering diploma/BCA/MCA, DOEACC, COPA, modern office management or equivalent diploma/certificate).","applicationStart":"2026-09-24","applicationEnd":"2026-10-08","examDate":"2026-11-03","vacanciesBreakdown":[{"category":"ALL","count":100,"gender":"ALL","subPostName":"ASI (Stenographic) - General Branch"},{"category":"ALL","count":370,"gender":"ALL","subPostName":"ASI (Stenographic) - Field Units"},{"category":"ALL","count":25,"gender":"ALL","subPostName":"ASI (Stenographic) - Special Branch"},{"category":"ALL","count":25,"gender":"ALL","subPostName":"ASI (Stenographic) - Crime Investigation Department"}],"sources":[{"sourceType":"OFFICIAL_RULEBOOK","sourceTitle":"MPESB Subedar (Stenographic) Stenographer and ASI (Stenographic) Selection Test 2026 Rule Book","sourceUrl":"https://esb.mp.gov.in/Rulebooks/RB_2026/Steno_ASI_2026_Rulebook_17092026.pdf","publicationDate":"2026-09-17"}],"officialLinks":[{"linkType":"RULEBOOK","title":"Subedar/ASI (Stenographic) 2026 Rule Book (PDF)","url":"https://esb.mp.gov.in/Rulebooks/RB_2026/Steno_ASI_2026_Rulebook_17092026.pdf"},{"linkType":"OFFICIAL_WEBSITE","title":"MP Employees Selection Board","url":"https://esb.mp.gov.in/e_default.html"}]}',NULL,'FAILED','mcp-client','bhupendrawatti24@gmail.com',1791232645,'Found 1 confirmed duplicate notice(s) with identical Advt Number or Source URL.',1791232330,NULL,NULL);
CREATE TABLE audit_logs (
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
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_263a5b8b-7d49-4349-babf-ead5b364a93c','bhupendrawatti24@gmail.com','ADMIN_USER','adm_super','UPDATE',NULL,NULL,'{"isActive":0}','Administrative access revoked',NULL,1791196823);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_1a99ca19-0ed8-4edc-aaa9-e58cbfcb86b7','bhupendrawatti24@gmail.com','ADMIN_USER','adm_aarav','UPDATE',NULL,NULL,'{"isActive":0}','Administrative access revoked',NULL,1791196825);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_0e882c75-f27e-4ef3-a444-03c8293d0f8a','bhupendrawatti24@gmail.com','ADMIN_USER','adm_super','UPDATE',NULL,NULL,'{"role":"SUPER_ADMIN","isActive":1}','Administrative access updated',NULL,1791196834);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_77c64201-39ab-4020-948b-0906ea18c769','bhupendrawatti24@gmail.com','ADMIN_USER','adm_super','UPDATE',NULL,NULL,'{"role":"SUPER_ADMIN","isActive":1}','Administrative access updated',NULL,1791198077);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_7656231e-e160-4df2-92b8-55171708500c','bhupendrawatti24@gmail.com','ADMIN_USER','2d918a3327afdf4a8eba90752307c264','UPDATE',NULL,NULL,'{"role":"SUPER_ADMIN","isActive":1}','Administrative access updated',NULL,1791198086);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_e6cc08d7-f2d7-46b5-b1ea-9fc608755a53','bhupendrawatti24@gmail.com','ADMIN_USER','a3a8fcd873e1ecd06bbd34af488b84d9','UPDATE',NULL,NULL,'{"role":"SUPER_ADMIN","isActive":1}','Administrative access updated',NULL,1791198089);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_4936adde-eeb2-41f8-b2e4-b9a45340e071','bhupendrawatti24@gmail.com','ADMIN_USER','adm_himanshu_karveti_2','UPDATE',NULL,NULL,'{"role":"SUPER_ADMIN","isActive":1}','Administrative access updated',NULL,1791198092);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_28570154-8a81-4af5-bea6-46cd0546c078','bhupendrawatti24@gmail.com','ADMIN_USER','adm_super','UPDATE',NULL,NULL,'{"isActive":0}','Administrative access revoked',NULL,1791198096);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_cb6be437-283a-4f41-bafe-d973e8489fd3','bhupendrawatti24@gmail.com','ADMIN_USER','adm_super','UPDATE',NULL,NULL,'{"role":"SUPER_ADMIN","isActive":1}','Administrative access updated',NULL,1791198099);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_76a4b5b6-aae7-45fd-92c5-3517c24c6e9a','bhupendrawatti24@gmail.com','ADMIN_USER','adm_super','UPDATE',NULL,NULL,'{"isActive":0}','Administrative access revoked',NULL,1791198101);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_2da23970-075c-4bb8-8598-dcd30419d288','bhupendrawatti24@gmail.com','ADMIN_USER','adm_super','UPDATE',NULL,NULL,'{"isActive":0}','Administrative access revoked',NULL,1791198108);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_b07870d7-33ee-4eef-9238-cf3d8eec3c01','bhupendrawatti24@gmail.com','RECRUITMENT','rec_3b8566d9-026f-4299-98f9-5075f6e5c092','CREATE','status',NULL,'DRAFT','Recruitment created via Admin Ingest with validation status: VALID','https://esb.mp.gov.in',1791232636);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_31ed4807-7883-4399-96fb-8ce25d922481','bhupendrawatti24@gmail.com','PROPOSAL','prop_9a68c51b-bb52-46e2-a8fd-158d0391b333','APPROVE','CREATE_RECRUITMENT',NULL,'rec_3b8566d9-026f-4299-98f9-5075f6e5c092','New: MP Police Subedar (Stenographic) - Stenographer 2026, 135 posts, apply 24-09 to 08-10-2026. Source: official MPESB Steno/ASI rule book PDF.','mcp:mcp-client',1791232636);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_81d5b5f0-87e7-40c5-9093-87582b2f3d85','bhupendrawatti24@gmail.com','PROPOSAL','prop_48fdca4f-b265-4c3e-beae-b7566ab34c06','APPLY_FAILED','CREATE_RECRUITMENT',NULL,NULL,'Found 1 confirmed duplicate notice(s) with identical Advt Number or Source URL.','mcp:mcp-client',1791232645);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_3e4b3ce5-33ce-4bc9-95d7-7b6927eee815','bhupendrawatti24@gmail.com','RECRUITMENT','rec_9a5bba16-cfee-43ac-86a7-e3070ade3453','PUBLISH','status',NULL,'PUBLISHED','Recruitment created via Admin Ingest with validation status: VALID','https://esb.mp.gov.in',1791232666);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_6d9ae3e9-5055-4224-a4ef-421395699ecb','bhupendrawatti24@gmail.com','PROPOSAL','prop_d4d20fae-677c-484e-beac-4088601d06b8','APPROVE','CREATE_RECRUITMENT',NULL,'rec_9a5bba16-cfee-43ac-86a7-e3070ade3453','CORRECTED version of prop_ebb3f5cd (reject that one): MP Police Constable (GD) 2026, 7,500 posts, 10th pass. Source: official MPESB rule book PDF.','mcp:mcp-client',1791232666);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_eadfbf97-d04e-4299-9cc5-59e5c144a97a','bhupendrawatti24@gmail.com','RECRUITMENT','rec_be645587-b1a0-4081-9a14-bf94bf6addc5','CREATE','status',NULL,'DRAFT','Recruitment created via Admin Ingest with validation status: VALID','https://esb.mp.gov.in',1791232672);
INSERT INTO "audit_logs" ("id","admin_email","entity","entity_id","action","field","old_value","new_value","reason","source","created_at") VALUES('audit_51451dc1-d667-4e43-a3dd-8227f3d6c670','bhupendrawatti24@gmail.com','PROPOSAL','prop_ebb3f5cd-262f-47db-bff5-ad6156b9a72e','APPROVE','CREATE_RECRUITMENT',NULL,'rec_be645587-b1a0-4081-9a14-bf94bf6addc5','New: MP Police Constable (GD) Recruitment Test 2026, 7,500 posts, apply 22-09 to 06-10-2026. Source: official MPESB rule book PDF (PCRT_GD_2026_RuleBook_09092026).','mcp:mcp-client',1791232672);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',13);
CREATE INDEX idx_org_state ON organisations(state_id);
CREATE INDEX idx_posts_sector ON posts(sector_id);
CREATE INDEX idx_posts_dept ON posts(department_id);
CREATE INDEX idx_rec_status_lifecycle ON recruitments(status, lifecycle_status);
CREATE INDEX idx_rec_post ON recruitments(post_id);
CREATE INDEX idx_rec_state ON recruitments(state_id);
CREATE INDEX idx_dates_rec ON important_dates(recruitment_id);
CREATE INDEX idx_vacancies_rec ON vacancies(recruitment_id);
CREATE INDEX idx_records_type ON records(type);
CREATE INDEX idx_rec_exam_result ON recruitments (exam_status, result_status);
CREATE UNIQUE INDEX unq_rec_org_advt_cycle
  ON recruitments (organisation_id, advt_number, cycle_year);
CREATE INDEX idx_sources_rec ON sources (recruitment_id);
CREATE INDEX idx_links_rec ON official_links (recruitment_id);
CREATE INDEX idx_proposals_status ON change_proposals(status, created_at);
CREATE INDEX idx_proposals_recruitment ON change_proposals(recruitment_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_admin ON audit_logs(admin_email);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_proposals_supersedes ON change_proposals(supersedes_id);
