import { getDb, schema } from './client';
import { eq, desc, asc } from 'drizzle-orm';

let cfEnv: any = undefined;
try {
  // @ts-ignore
  const cf = await import('cloudflare:workers');
  cfEnv = cf.env;
} catch {
  // Fallback for environments outside Cloudflare Workers runtime
}

export interface MasterSector {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  displayOrder: number;
}

export interface MasterDepartment {
  id: string;
  organisationId: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: number;
}

export interface CanonicalPostWithDetails {
  id: string;
  departmentId: string;
  sectorId: string;
  title: string;
  slug: string;
  summary: string;
  payScale: string | null;
  defaultMinAge: number;
  defaultMaxAge: number;
  defaultQualification: string;
  isActive: number;
  departmentName?: string;
  sectorName?: string;
  organisationName?: string;
}

export interface RecruitmentWithDetails {
  id: string;
  postId?: string;
  advtNumber: string;
  title: string;
  slug: string;
  shortSummary: string;
  cycleYear: number;
  totalVacancies: number;
  status: string;
  lifecycleStatus: string;
  isFeatured: number;
  postTitle: string;
  postSlug: string;
  organisationName: string;
  organisationShortName: string;
  organisationUrl: string;
  criteria: {
    minAge: number;
    maxAgeGeneral: number;
    ageCutoffDate: string;
    ageRelaxationScSt: number;
    ageRelaxationObc: number;
    ageRelaxationFemale: number;
    ageRelaxationEws: number;
    minQualificationLevel: string;
    requiresMpDomicile: boolean;
    requiresMpEmploymentReg: boolean;
    requiresCpct: boolean;
    genderAllowed: 'ALL' | 'MALE' | 'FEMALE';
    minHeightMaleCm?: number | null;
    minHeightFemaleCm?: number | null;
    minChestMaleCm?: number | null;
    minPercentageRequired?: number | null;
    additionalSkills?: string[] | null;
  };
}

export const FALLBACK_SECTORS: MasterSector[] = [
  { id: 'sec_civil_services', name: 'Civil & Administrative Services', slug: 'civil-administrative-services', icon: 'Landmark', displayOrder: 1 },
  { id: 'sec_police', name: 'Police, Defence & Prisons', slug: 'police-defence-prisons', icon: 'Shield', displayOrder: 2 },
  { id: 'sec_judiciary', name: 'Judiciary & Legal Services', slug: 'judiciary-legal-services', icon: 'Scale', displayOrder: 3 },
  { id: 'sec_it_egov', name: 'Information Technology & e-Governance', slug: 'it-egovernance', icon: 'Cpu', displayOrder: 4 },
  { id: 'sec_admin', name: 'Revenue & Land Administration', slug: 'revenue-land-administration', icon: 'Building2', displayOrder: 5 },
  { id: 'sec_forest', name: 'Forest, Wildlife & Environment', slug: 'forest-environment', icon: 'Trees', displayOrder: 6 },
  { id: 'sec_teaching', name: 'Teaching & Higher Education', slug: 'teaching-education', icon: 'GraduationCap', displayOrder: 7 },
  { id: 'sec_technical', name: 'Engineering & Technical Trades', slug: 'engineering-technical-trades', icon: 'Wrench', displayOrder: 8 },
  { id: 'sec_health', name: 'Public Health & Medical Services', slug: 'public-health-medical', icon: 'Activity', displayOrder: 9 },
  { id: 'sec_support', name: 'Support Staff & Allied Services (Class IV)', slug: 'support-staff-class-iv', icon: 'Users', displayOrder: 10 },
];

export const FALLBACK_DEPARTMENTS: MasterDepartment[] = [
  { id: 'dept_gad', organisationId: 'org_mppsc', name: 'General Administration Department', slug: 'general-administration', description: 'State civil secretariat, personnel management, and executive cadre', isActive: 1 },
  { id: 'dept_home', organisationId: 'org_mpesb', name: 'Home Department (Police & Jail)', slug: 'home-department', description: 'State police forces, internal security, and prison warden cadre', isActive: 1 },
  { id: 'dept_judiciary', organisationId: 'org_mphc', name: 'High Court Registry & Subordinate Courts', slug: 'high-court-judiciary', description: 'State judicial administration, district sessions courts, and registry', isActive: 1 },
  { id: 'dept_it', organisationId: 'org_mpsedc', name: 'Science & Technology (MPSEDC / MAP_IT)', slug: 'science-technology-it', description: 'State e-governance infrastructure, IT systems, and digital citizen services', isActive: 1 },
  { id: 'dept_revenue', organisationId: 'org_mpesb', name: 'Revenue Department', slug: 'revenue-department', description: 'Land records, revenue administration, settlement, and Patwari cadre', isActive: 1 },
  { id: 'dept_forest', organisationId: 'org_mpesb', name: 'Forest & Wildlife Department', slug: 'forest-department', description: 'Forestry preservation, sanctuary surveillance, and wildlife conservation', isActive: 1 },
  { id: 'dept_school_edu', organisationId: 'org_mpesb', name: 'School Education Department', slug: 'school-education', description: 'State primary, middle, and higher secondary school education', isActive: 1 },
  { id: 'dept_higher_edu', organisationId: 'org_mppsc', name: 'Higher Education Department', slug: 'higher-education', description: 'Government degree colleges, collegiate faculty, and university administration', isActive: 1 },
  { id: 'dept_pwd', organisationId: 'org_mpesb', name: 'Public Works Department (PWD / WRD)', slug: 'public-works-department', description: 'State highway engineering, government building construction, and water resources', isActive: 1 },
  { id: 'dept_health', organisationId: 'org_mpesb', name: 'Public Health & Family Welfare', slug: 'public-health-welfare', description: 'State hospital management, clinical care, nursing, and preventive medicine', isActive: 1 },
];

export let FALLBACK_POSTS: CanonicalPostWithDetails[] = [
  // === GROUP A / CLASS 1 (Senior Gazetted Officers) ===
  {
    id: 'post_mp_deputy_collector',
    departmentId: 'dept_gad',
    sectorId: 'sec_civil_services',
    title: 'Deputy Collector (State Civil Service)',
    slug: 'mp-deputy-collector',
    summary: 'Senior sub-divisional administrative magistrate in MP Civil Services, responsible for executive administration, law & order, and policy implementation.',
    payScale: 'Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)',
    defaultMinAge: 21,
    defaultMaxAge: 33,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'General Administration Department',
    sectorName: 'Civil & Administrative Services',
    organisationName: 'MPPSC',
  },
  {
    id: 'post_mp_dsp',
    departmentId: 'dept_home',
    sectorId: 'sec_police',
    title: 'Deputy Superintendent of Police (DSP)',
    slug: 'mp-dsp',
    summary: 'Gazetted police executive leadership role commanding sub-divisional police operations, crime control, and law enforcement.',
    payScale: 'Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)',
    defaultMinAge: 21,
    defaultMaxAge: 33,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'Home Department (Police & Jail)',
    sectorName: 'Police, Defence & Prisons',
    organisationName: 'MPPSC',
  },
  {
    id: 'post_mp_civil_judge',
    departmentId: 'dept_judiciary',
    sectorId: 'sec_judiciary',
    title: 'Civil Judge (Junior Division / Judicial Magistrate)',
    slug: 'mp-civil-judge',
    summary: 'Subordinate judicial officer presiding over civil suits and criminal trials across district and tehsil courts of Madhya Pradesh.',
    payScale: 'Rs. 77,840 - 1,36,520/- (Pay Matrix Level J-1)',
    defaultMinAge: 21,
    defaultMaxAge: 35,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'High Court Registry & Subordinate Courts',
    sectorName: 'Judiciary & Legal Services',
    organisationName: 'MPHC',
  },
  {
    id: 'post_mp_acf',
    departmentId: 'dept_forest',
    sectorId: 'sec_forest',
    title: 'Assistant Conservator of Forests (ACF)',
    slug: 'mp-acf-forest',
    summary: 'Gazetted state forest service officer managing territorial divisions, anti-poaching operations, and sanctuary conservancies.',
    payScale: 'Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)',
    defaultMinAge: 21,
    defaultMaxAge: 33,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'Forest & Wildlife Department',
    sectorName: 'Forest, Wildlife & Environment',
    organisationName: 'MPPSC',
  },
  {
    id: 'post_mp_assistant_professor',
    departmentId: 'dept_higher_edu',
    sectorId: 'sec_teaching',
    title: 'Assistant Professor (Government Colleges)',
    slug: 'mp-assistant-professor',
    summary: 'Higher education collegiate faculty instructing undergraduate and postgraduate courses in MP Government Degree Colleges.',
    payScale: 'Rs. 57,700 - 1,82,400/- (Academic Level 10)',
    defaultMinAge: 21,
    defaultMaxAge: 40,
    defaultQualification: 'POST_GRADUATION',
    isActive: 1,
    departmentName: 'Higher Education Department',
    sectorName: 'Teaching & Higher Education',
    organisationName: 'MPPSC',
  },
  {
    id: 'post_mp_medical_officer',
    departmentId: 'dept_health',
    sectorId: 'sec_health',
    title: 'Medical Officer (MBBS)',
    slug: 'mp-medical-officer',
    summary: 'Registered government physician delivering clinical consultation, trauma emergency care, and public healthcare in district hospitals.',
    payScale: 'Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)',
    defaultMinAge: 21,
    defaultMaxAge: 40,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'Public Health & Family Welfare',
    sectorName: 'Public Health & Medical Services',
    organisationName: 'MPPSC',
  },
  {
    id: 'post_mp_assistant_engineer',
    departmentId: 'dept_pwd',
    sectorId: 'sec_technical',
    title: 'Assistant Engineer (Civil / Electrical)',
    slug: 'mp-assistant-engineer',
    summary: 'Gazetted engineer supervising engineering tenders, bridge design, road construction, and state infrastructure works.',
    payScale: 'Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)',
    defaultMinAge: 21,
    defaultMaxAge: 33,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'Public Works Department (PWD / WRD)',
    sectorName: 'Engineering & Technical Trades',
    organisationName: 'MPPSC',
  },

  // === GROUP B / CLASS 2 (Senior Executives & Field Officers) ===
  {
    id: 'post_mp_naib_tehsildar',
    departmentId: 'dept_revenue',
    sectorId: 'sec_admin',
    title: 'Naib Tehsildar (Executive Magistrate)',
    slug: 'mp-naib-tehsildar',
    summary: 'Sub-tehsil executive officer adjudicating land mutations, revenue cases, tenancy matters, and rural dispute resolution.',
    payScale: 'Rs. 36,200 - 1,14,800/- (Pay Matrix Level 8)',
    defaultMinAge: 21,
    defaultMaxAge: 33,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'Revenue Department',
    sectorName: 'Revenue & Land Administration',
    organisationName: 'MPPSC',
  },
  {
    id: 'post_mp_commercial_tax_officer',
    departmentId: 'dept_gad',
    sectorId: 'sec_civil_services',
    title: 'Commercial Tax Officer / GST Officer',
    slug: 'mp-commercial-tax-officer',
    summary: 'State revenue executive overseeing SGST compliance, commercial tax assessments, and tax intelligence audits.',
    payScale: 'Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)',
    defaultMinAge: 21,
    defaultMaxAge: 33,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'General Administration Department',
    sectorName: 'Civil & Administrative Services',
    organisationName: 'MPPSC',
  },
  {
    id: 'post_mp_forest_range_officer',
    departmentId: 'dept_forest',
    sectorId: 'sec_forest',
    title: 'Forest Range Officer (FRO)',
    slug: 'mp-forest-range-officer',
    summary: 'Range executive supervising territorial forest beats, wildlife corridors, nurseries, and plantation works.',
    payScale: 'Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)',
    defaultMinAge: 21,
    defaultMaxAge: 33,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'Forest & Wildlife Department',
    sectorName: 'Forest, Wildlife & Environment',
    organisationName: 'MPPSC',
  },
  {
    id: 'post_mp_school_lecturer',
    departmentId: 'dept_school_edu',
    sectorId: 'sec_teaching',
    title: 'School Lecturer (Uchha Madhyamik Shikshak / Varg-1)',
    slug: 'mp-school-lecturer-varg-1',
    summary: 'Subject-specialized teacher instructing classes 11 and 12 in state government higher secondary schools.',
    payScale: 'Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)',
    defaultMinAge: 21,
    defaultMaxAge: 40,
    defaultQualification: 'POST_GRADUATION',
    isActive: 1,
    departmentName: 'School Education Department',
    sectorName: 'Teaching & Higher Education',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_degm_it',
    departmentId: 'dept_it',
    sectorId: 'sec_it_egov',
    title: 'District e-Governance Manager (DeGM)',
    slug: 'mp-degm-it',
    summary: 'District IT leader in-charge of state portal delivery, Lok Seva Kendras, Aadhaar services, and technical field operations.',
    payScale: 'Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)',
    defaultMinAge: 21,
    defaultMaxAge: 35,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'Science & Technology (MPSEDC / MAP_IT)',
    sectorName: 'Information Technology & e-Governance',
    organisationName: 'MPSEDC',
  },

  // === GROUP C / CLASS 3 (Frontline Police, Clerical, Technical & Skilled Execution) ===
  {
    id: 'post_mp_si',
    departmentId: 'dept_home',
    sectorId: 'sec_police',
    title: 'Sub Inspector (Civil Police)',
    slug: 'mp-police-sub-inspector',
    summary: 'Police station investigation officer responsible for investigating criminal offences, filing chargesheets, and maintaining order.',
    payScale: 'Rs. 36,200 - 1,14,800/- (Pay Matrix Level 9)',
    defaultMinAge: 21,
    defaultMaxAge: 33,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'Home Department (Police & Jail)',
    sectorName: 'Police, Defence & Prisons',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_constable',
    departmentId: 'dept_home',
    sectorId: 'sec_police',
    title: 'Police Constable (General Duty)',
    slug: 'mp-police-constable',
    summary: 'Primary frontline police officer in MP Police responsible for patrolling, beat guarding, escorting, and law enforcement.',
    payScale: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    defaultMinAge: 18,
    defaultMaxAge: 33,
    defaultQualification: '10TH',
    isActive: 1,
    departmentName: 'Home Department (Police & Jail)',
    sectorName: 'Police, Defence & Prisons',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_constable_radio',
    departmentId: 'dept_home',
    sectorId: 'sec_police',
    title: 'Police Constable (Radio / Telecommunication)',
    slug: 'mp-police-constable-radio',
    summary: 'Technical police operator managing wireless communication networks, VHF repeaters, and dial-112 dispatch systems.',
    payScale: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    defaultMinAge: 18,
    defaultMaxAge: 33,
    defaultQualification: '12TH',
    isActive: 1,
    departmentName: 'Home Department (Police & Jail)',
    sectorName: 'Police, Defence & Prisons',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_jail_prahari',
    departmentId: 'dept_home',
    sectorId: 'sec_police',
    title: 'Jail Prahari (Prison Warder)',
    slug: 'mp-jail-prahari',
    summary: 'Correctional security officer in MP Jail Department guarding state penitentiaries and maintaining inmate security.',
    payScale: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    defaultMinAge: 18,
    defaultMaxAge: 33,
    defaultQualification: '10TH',
    isActive: 1,
    departmentName: 'Home Department (Police & Jail)',
    sectorName: 'Police, Defence & Prisons',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_patwari',
    departmentId: 'dept_revenue',
    sectorId: 'sec_admin',
    title: 'Patwari (Land Records Officer)',
    slug: 'mp-patwari',
    summary: 'Primary village revenue and land records officer managing agricultural survey, crop inspection, and mutation records.',
    payScale: 'Rs. 25,300 - 80,500/- (Pay Matrix Level 6)',
    defaultMinAge: 18,
    defaultMaxAge: 40,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'Revenue Department',
    sectorName: 'Revenue & Land Administration',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_revenue_inspector',
    departmentId: 'dept_revenue',
    sectorId: 'sec_admin',
    title: 'Revenue Inspector (RI / Kanoongo)',
    slug: 'mp-revenue-inspector',
    summary: 'Supervisory revenue officer overseeing multiple Patwari halkas, land demarcation, and government boundary inspections.',
    payScale: 'Rs. 28,700 - 91,300/- (Pay Matrix Level 7)',
    defaultMinAge: 18,
    defaultMaxAge: 40,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'Revenue Department',
    sectorName: 'Revenue & Land Administration',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_forest_guard',
    departmentId: 'dept_forest',
    sectorId: 'sec_forest',
    title: 'Forest Guard (Van Rakshak)',
    slug: 'mp-forest-guard',
    summary: 'Field forest beat guard protecting national parks and reserved forests against timber logging and poaching.',
    payScale: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    defaultMinAge: 18,
    defaultMaxAge: 33,
    defaultQualification: '10TH',
    isActive: 1,
    departmentName: 'Forest & Wildlife Department',
    sectorName: 'Forest, Wildlife & Environment',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_jja_court',
    departmentId: 'dept_judiciary',
    sectorId: 'sec_judiciary',
    title: 'Junior Judicial Assistant (JJA) / Assistant Grade-III (Courts)',
    slug: 'mp-jja-court',
    summary: 'High Court and District Court ministerial staff handling judicial case files, certified copies, cause lists, and courtroom dockets.',
    payScale: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    defaultMinAge: 18,
    defaultMaxAge: 35,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'High Court Registry & Subordinate Courts',
    sectorName: 'Judiciary & Legal Services',
    organisationName: 'MPHC',
  },
  {
    id: 'post_mp_court_stenographer',
    departmentId: 'dept_judiciary',
    sectorId: 'sec_judiciary',
    title: 'Court Stenographer (Grade II & III)',
    slug: 'mp-court-stenographer',
    summary: 'Verbatim judicial dictation recorder transcribing trial judgments, court orders, and witness depositions.',
    payScale: 'Rs. 28,700 - 91,300/- (Pay Matrix Level 7)',
    defaultMinAge: 18,
    defaultMaxAge: 35,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'High Court Registry & Subordinate Courts',
    sectorName: 'Judiciary & Legal Services',
    organisationName: 'MPHC',
  },
  {
    id: 'post_mp_assistant_programmer',
    departmentId: 'dept_it',
    sectorId: 'sec_it_egov',
    title: 'Assistant Programmer / Systems Analyst (IT)',
    slug: 'mp-assistant-programmer',
    summary: 'State government software programmer and database specialist developing digital portals and citizen services.',
    payScale: 'Rs. 32,800 - 1,03,600/- (Pay Matrix Level 8)',
    defaultMinAge: 21,
    defaultMaxAge: 35,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'Science & Technology (MPSEDC / MAP_IT)',
    sectorName: 'Information Technology & e-Governance',
    organisationName: 'MPSEDC',
  },
  {
    id: 'post_mp_data_entry_operator',
    departmentId: 'dept_gad',
    sectorId: 'sec_it_egov',
    title: 'Data Entry Operator (DEO) / Computer Operator',
    slug: 'mp-data-entry-operator',
    summary: 'Data processing specialist managing state treasury data, civil registrations, and computer records across collectorates.',
    payScale: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    defaultMinAge: 18,
    defaultMaxAge: 40,
    defaultQualification: '12TH',
    isActive: 1,
    departmentName: 'General Administration Department',
    sectorName: 'Information Technology & e-Governance',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_sub_engineer',
    departmentId: 'dept_pwd',
    sectorId: 'sec_technical',
    title: 'Sub-Engineer (Civil / Electrical / Mechanical)',
    slug: 'mp-sub-engineer',
    summary: 'Technical field engineer supervising public building construction, bridge inspection, and water supply civil works.',
    payScale: 'Rs. 32,800 - 1,03,600/- (Pay Matrix Level 8)',
    defaultMinAge: 18,
    defaultMaxAge: 40,
    defaultQualification: 'DIPLOMA',
    isActive: 1,
    departmentName: 'Public Works Department (PWD / WRD)',
    sectorName: 'Engineering & Technical Trades',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_group4_clerk',
    departmentId: 'dept_gad',
    sectorId: 'sec_admin',
    title: 'Assistant Grade-III / Steno-Typist (State Secretariat)',
    slug: 'mp-assistant-grade-3',
    summary: 'Clerical ministerial staff in state secretariats and district offices managing administrative files and typing.',
    payScale: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    defaultMinAge: 18,
    defaultMaxAge: 40,
    defaultQualification: '12TH',
    isActive: 1,
    departmentName: 'General Administration Department',
    sectorName: 'Revenue & Land Administration',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_samvida_varg2',
    departmentId: 'dept_school_edu',
    sectorId: 'sec_teaching',
    title: 'Middle School Teacher (Madhyamik Shikshak / Varg-2)',
    slug: 'mp-middle-teacher-varg-2',
    summary: 'Subject teacher for classes 6 to 8 in government middle schools covering Science, Math, Social Science, and Languages.',
    payScale: 'Rs. 25,300 - 80,500/- (Pay Matrix Level 6)',
    defaultMinAge: 21,
    defaultMaxAge: 40,
    defaultQualification: 'GRADUATION',
    isActive: 1,
    departmentName: 'School Education Department',
    sectorName: 'Teaching & Higher Education',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_samvida_varg3',
    departmentId: 'dept_school_edu',
    sectorId: 'sec_teaching',
    title: 'Primary School Teacher (Prathmik Shikshak / Varg-3)',
    slug: 'mp-primary-teacher-varg-3',
    summary: 'Foundational elementary teacher instructing classes 1 to 5 in MP State government primary schools.',
    payScale: 'Rs. 25,300 - 80,500/- (Pay Matrix Level 6)',
    defaultMinAge: 18,
    defaultMaxAge: 40,
    defaultQualification: '12TH',
    isActive: 1,
    departmentName: 'School Education Department',
    sectorName: 'Teaching & Higher Education',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_staff_nurse',
    departmentId: 'dept_health',
    sectorId: 'sec_health',
    title: 'Staff Nurse (Nursing Officer)',
    slug: 'mp-staff-nurse',
    summary: 'Clinical registered nursing officer providing hospital ward healthcare, neonatal care, and surgical assistance.',
    payScale: 'Rs. 28,700 - 91,300/- (Pay Matrix Level 7)',
    defaultMinAge: 21,
    defaultMaxAge: 40,
    defaultQualification: 'DIPLOMA',
    isActive: 1,
    departmentName: 'Public Health & Family Welfare',
    sectorName: 'Public Health & Medical Services',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_anm',
    departmentId: 'dept_health',
    sectorId: 'sec_health',
    title: 'ANM (Auxiliary Nurse Midwife)',
    slug: 'mp-anm-health',
    summary: 'Rural healthcare worker providing child immunization, maternal care, and family planning at village sub-centres.',
    payScale: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    defaultMinAge: 18,
    defaultMaxAge: 40,
    defaultQualification: '12TH',
    isActive: 1,
    departmentName: 'Public Health & Family Welfare',
    sectorName: 'Public Health & Medical Services',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_pharmacist',
    departmentId: 'dept_health',
    sectorId: 'sec_health',
    title: 'Pharmacist Grade-II',
    slug: 'mp-pharmacist-grade-2',
    summary: 'Government hospital pharmacy dispenser managing medication inventory, formulation, and prescription delivery.',
    payScale: 'Rs. 25,300 - 80,500/- (Pay Matrix Level 6)',
    defaultMinAge: 18,
    defaultMaxAge: 40,
    defaultQualification: 'DIPLOMA',
    isActive: 1,
    departmentName: 'Public Health & Family Welfare',
    sectorName: 'Public Health & Medical Services',
    organisationName: 'MPESB',
  },

  // === GROUP D / CLASS 4 (Support Services & Field Staff) ===
  {
    id: 'post_mp_peon_bhritya',
    departmentId: 'dept_gad',
    sectorId: 'sec_support',
    title: 'Office Peon / Attendant (Bhritya / Process Server)',
    slug: 'mp-peon-bhritya',
    summary: 'Support staff maintaining judicial summon deliveries, departmental dak distribution, and office assistance.',
    payScale: 'Rs. 15,500 - 49,000/- (Pay Matrix Level 1)',
    defaultMinAge: 18,
    defaultMaxAge: 40,
    defaultQualification: '8TH',
    isActive: 1,
    departmentName: 'General Administration Department',
    sectorName: 'Support Staff & Allied Services (Class IV)',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_govt_driver',
    departmentId: 'dept_gad',
    sectorId: 'sec_support',
    title: 'Government Vehicle Driver (Light & Heavy)',
    slug: 'mp-govt-driver',
    summary: 'Professional driver operating judicial motorcade vehicles, police patrol units, ambulances, and official staff cars.',
    payScale: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    defaultMinAge: 18,
    defaultMaxAge: 40,
    defaultQualification: '8TH',
    isActive: 1,
    departmentName: 'General Administration Department',
    sectorName: 'Support Staff & Allied Services (Class IV)',
    organisationName: 'MPESB',
  },
  {
    id: 'post_mp_chowkidar',
    departmentId: 'dept_gad',
    sectorId: 'sec_support',
    title: 'Security Chowkidar / Night Watchman',
    slug: 'mp-chowkidar',
    summary: 'Campus security guard securing government office complexes, district collectorates, and state rest houses.',
    payScale: 'Rs. 15,500 - 49,000/- (Pay Matrix Level 1)',
    defaultMinAge: 18,
    defaultMaxAge: 40,
    defaultQualification: '8TH',
    isActive: 1,
    departmentName: 'General Administration Department',
    sectorName: 'Support Staff & Allied Services (Class IV)',
    organisationName: 'MPESB',
  },
];

export const FALLBACK_RECRUITMENTS: RecruitmentWithDetails[] = [
  {
    id: 'rec_mp_constable_2026',
    postId: 'post_mp_constable',
    advtNumber: 'Advt No. 04/2026',
    title: 'MP Police Constable Recruitment 2026 (7,500 Vacancies)',
    slug: 'mp-police-constable-recruitment-2026',
    shortSummary: 'Official recruitment by MPESB for 7,500 posts of Police Constable in Madhya Pradesh Police Department. 10th pass candidates eligible.',
    cycleYear: 2026,
    totalVacancies: 7500,
    status: 'PUBLISHED',
    lifecycleStatus: 'OPEN',
    isFeatured: 1,
    postTitle: 'Police Constable (General Duty)',
    postSlug: 'mp-police-constable',
    organisationName: 'Madhya Pradesh Employees Selection Board',
    organisationShortName: 'MPESB',
    organisationUrl: 'https://esb.mp.gov.in',
    criteria: {
      minAge: 18,
      maxAgeGeneral: 33,
      ageCutoffDate: '2026-01-01',
      ageRelaxationScSt: 5,
      ageRelaxationObc: 3,
      ageRelaxationFemale: 5,
      ageRelaxationEws: 0,
      minQualificationLevel: '10TH',
      requiresMpDomicile: true,
      requiresMpEmploymentReg: true,
      requiresCpct: false,
      genderAllowed: 'ALL',
      minHeightMaleCm: 168.0,
      minHeightFemaleCm: 158.0,
      minChestMaleCm: 81.0,
      minPercentageRequired: null,
      additionalSkills: null,
    },
  },
  {
    id: 'rec_mp_patwari_2026',
    postId: 'post_mp_patwari',
    advtNumber: 'Advt No. 06/2026',
    title: 'MP ESB Patwari & Combined Group-2 Sub-Group-4 Recruitment 2026',
    slug: 'mp-patwari-recruitment-2026',
    shortSummary: 'Recruitment for 3,550 vacancies of Patwari and Revenue Inspectors across all 55 districts of Madhya Pradesh. Graduate with CPCT required.',
    cycleYear: 2026,
    totalVacancies: 3550,
    status: 'PUBLISHED',
    lifecycleStatus: 'UPCOMING',
    isFeatured: 1,
    postTitle: 'Patwari (Land Records Officer)',
    postSlug: 'mp-patwari',
    organisationName: 'Madhya Pradesh Employees Selection Board',
    organisationShortName: 'MPESB',
    organisationUrl: 'https://esb.mp.gov.in',
    criteria: {
      minAge: 18,
      maxAgeGeneral: 40,
      ageCutoffDate: '2026-01-01',
      ageRelaxationScSt: 5,
      ageRelaxationObc: 5,
      ageRelaxationFemale: 5,
      ageRelaxationEws: 0,
      minQualificationLevel: 'GRADUATION',
      requiresMpDomicile: true,
      requiresMpEmploymentReg: true,
      requiresCpct: true,
      genderAllowed: 'ALL',
      minPercentageRequired: null,
      additionalSkills: ['Hindi Typing'],
    },
  },
  {
    id: 'rec_mp_forest_guard_2026',
    postId: 'post_mp_forest_guard',
    advtNumber: 'Advt No. 07/2026',
    title: 'MP Forest Guard & Jail Prahari Combined Recruitment 2026',
    slug: 'mp-forest-guard-recruitment-2026',
    shortSummary: 'Direct recruitment for 2,112 posts of Van Rakshak (Forest Guard) and Kshetra Rakshak in MP Forest Department. 10th pass candidates eligible.',
    cycleYear: 2026,
    totalVacancies: 2112,
    status: 'PUBLISHED',
    lifecycleStatus: 'OPEN',
    isFeatured: 0,
    postTitle: 'Forest Guard (Van Rakshak)',
    postSlug: 'mp-forest-guard',
    organisationName: 'Madhya Pradesh Employees Selection Board',
    organisationShortName: 'MPESB',
    organisationUrl: 'https://esb.mp.gov.in',
    criteria: {
      minAge: 18,
      maxAgeGeneral: 33,
      ageCutoffDate: '2026-01-01',
      ageRelaxationScSt: 5,
      ageRelaxationObc: 3,
      ageRelaxationFemale: 5,
      ageRelaxationEws: 0,
      minQualificationLevel: '10TH',
      requiresMpDomicile: true,
      requiresMpEmploymentReg: true,
      requiresCpct: false,
      genderAllowed: 'ALL',
      minHeightMaleCm: 163.0,
      minHeightFemaleCm: 150.0,
      minChestMaleCm: 79.0,
      minPercentageRequired: null,
      additionalSkills: null,
    },
  },
];

/**
 * Fetch all master sectors
 */
export async function getAllSectors(providedD1?: D1Database): Promise<MasterSector[]> {
  const d1 = providedD1 || cfEnv?.DB;
  if (!d1) return FALLBACK_SECTORS;

  try {
    const db = getDb(d1);
    const rows = await db.query.sectors.findMany({
      orderBy: [asc(schema.sectors.displayOrder), asc(schema.sectors.name)],
    });
    return rows.length > 0 ? rows : FALLBACK_SECTORS;
  } catch (error) {
    console.warn('Error fetching sectors from D1:', error);
    return FALLBACK_SECTORS;
  }
}

/**
 * Fetch all master departments
 */
export async function getAllDepartments(providedD1?: D1Database): Promise<MasterDepartment[]> {
  const d1 = providedD1 || cfEnv?.DB;
  if (!d1) return FALLBACK_DEPARTMENTS;

  try {
    const db = getDb(d1);
    const rows = await db.query.departments.findMany({
      where: eq(schema.departments.isActive, 1),
      orderBy: [asc(schema.departments.name)],
    });
    return rows.length > 0 ? rows : FALLBACK_DEPARTMENTS;
  } catch (error) {
    console.warn('Error fetching departments from D1:', error);
    return FALLBACK_DEPARTMENTS;
  }
}

/**
 * Fetch all canonical posts joined with department and sector
 */
export async function getAllCanonicalPosts(providedD1?: D1Database): Promise<CanonicalPostWithDetails[]> {
  const d1 = providedD1 || cfEnv?.DB;
  if (!d1) return FALLBACK_POSTS;

  try {
    const db = getDb(d1);
    const rows = await db.query.posts.findMany({
      with: {
        department: {
          with: {
            organisation: true,
          },
        },
        sector: true,
      },
      orderBy: [asc(schema.posts.title)],
    });

    if (!rows || rows.length === 0) return FALLBACK_POSTS;

    return rows.map(p => ({
      id: p.id,
      departmentId: p.departmentId,
      sectorId: p.sectorId,
      title: p.title,
      slug: p.slug,
      summary: p.summary,
      payScale: p.payScale,
      defaultMinAge: p.defaultMinAge,
      defaultMaxAge: p.defaultMaxAge,
      defaultQualification: p.defaultQualification,
      isActive: p.isActive,
      departmentName: p.department?.name,
      sectorName: p.sector?.name,
      organisationName: p.department?.organisation?.shortName || p.department?.organisation?.name,
    }));
  } catch (error) {
    console.warn('Error fetching canonical posts from D1:', error);
    return FALLBACK_POSTS;
  }
}

/**
 * Update an existing canonical post in Master Records.
 * Dynamic updates propagate to all recruitments referencing this post.
 */
export async function updateCanonicalPost(
  data: Partial<CanonicalPostWithDetails> & { id: string },
  providedD1?: D1Database
): Promise<boolean> {
  const d1 = providedD1 || cfEnv?.DB;

  // Always update in-memory fallback so local changes propagate immediately
  const fallbackIndex = FALLBACK_POSTS.findIndex(p => p.id === data.id);
  if (fallbackIndex !== -1) {
    FALLBACK_POSTS[fallbackIndex] = {
      ...FALLBACK_POSTS[fallbackIndex],
      ...data,
    };

    // Propagate updated title to any recruitments referencing this post
    if (data.title) {
      for (const rec of FALLBACK_RECRUITMENTS) {
        if (rec.postId === data.id) {
          rec.postTitle = data.title;
        }
      }
    }
  }

  if (!d1) return true;

  try {
    const db = getDb(d1);
    const updateSet: Record<string, any> = {};
    if (data.title !== undefined) updateSet.title = data.title;
    if (data.payScale !== undefined) updateSet.payScale = data.payScale;
    if (data.defaultMinAge !== undefined) updateSet.defaultMinAge = data.defaultMinAge;
    if (data.defaultMaxAge !== undefined) updateSet.defaultMaxAge = data.defaultMaxAge;
    if (data.defaultQualification !== undefined) updateSet.defaultQualification = data.defaultQualification;
    if (data.summary !== undefined) updateSet.summary = data.summary;
    if (data.isActive !== undefined) updateSet.isActive = data.isActive;

    await db.update(schema.posts).set(updateSet).where(eq(schema.posts.id, data.id));
    return true;
  } catch (error) {
    console.error('Error updating canonical post in D1:', error);
    return false;
  }
}

/**
 * Create a new canonical post in Master Records
 */
export async function createCanonicalPost(
  data: Omit<CanonicalPostWithDetails, 'id'> & { id?: string },
  providedD1?: D1Database
): Promise<string> {
  const d1 = providedD1 || cfEnv?.DB;
  const newId = data.id || `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const newPost: CanonicalPostWithDetails = {
    id: newId,
    departmentId: data.departmentId,
    sectorId: data.sectorId,
    title: data.title,
    slug,
    summary: data.summary || '',
    payScale: data.payScale || null,
    defaultMinAge: data.defaultMinAge ?? 18,
    defaultMaxAge: data.defaultMaxAge ?? 33,
    defaultQualification: data.defaultQualification || '10TH',
    isActive: data.isActive ?? 1,
  };

  // Add to in-memory fallback
  FALLBACK_POSTS.unshift(newPost);

  if (!d1) return newId;

  try {
    const db = getDb(d1);
    await db.insert(schema.posts).values({
      id: newId,
      departmentId: data.departmentId,
      sectorId: data.sectorId,
      title: data.title,
      slug,
      summary: data.summary || '',
      payScale: data.payScale || null,
      defaultMinAge: data.defaultMinAge ?? 18,
      defaultMaxAge: data.defaultMaxAge ?? 33,
      defaultQualification: data.defaultQualification || '10TH',
      isActive: data.isActive ?? 1,
    });
    return newId;
  } catch (error) {
    console.error('Error creating canonical post in D1:', error);
    return newId;
  }
}

/**
 * Fetch all published recruitments with dynamic post details
 */
export async function getAllActiveRecruitments(providedD1?: D1Database): Promise<RecruitmentWithDetails[]> {
  const d1 = providedD1 || cfEnv?.DB;
  if (!d1) {
    // Dynamically synchronize post titles in fallback in case a master post was updated
    return FALLBACK_RECRUITMENTS.map(rec => {
      if (rec.postId) {
        const matchedPost = FALLBACK_POSTS.find(p => p.id === rec.postId);
        if (matchedPost) {
          return {
            ...rec,
            postTitle: matchedPost.title,
            postSlug: matchedPost.slug,
          };
        }
      }
      return rec;
    });
  }

  try {
    const db = getDb(d1);
    const rows = await db.query.recruitments.findMany({
      where: eq(schema.recruitments.status, 'PUBLISHED'),
      with: {
        post: true,
        organisation: true,
        eligibility: true,
      },
      orderBy: [desc(schema.recruitments.isFeatured), desc(schema.recruitments.createdAt)],
    });

    if (!rows || rows.length === 0) {
      return FALLBACK_RECRUITMENTS.map(rec => {
        if (rec.postId) {
          const matchedPost = FALLBACK_POSTS.find(p => p.id === rec.postId);
          if (matchedPost) {
            return {
              ...rec,
              postTitle: matchedPost.title,
              postSlug: matchedPost.slug,
            };
          }
        }
        return rec;
      });
    }

    return rows.map(r => {
      let additionalSkills: string[] | null = null;
      if (r.eligibility?.additionalSkillsJson) {
        try {
          additionalSkills = JSON.parse(r.eligibility.additionalSkillsJson);
        } catch {
          additionalSkills = null;
        }
      }

      return {
        id: r.id,
        postId: r.postId,
        advtNumber: r.advtNumber,
        title: r.title,
        slug: r.slug,
        shortSummary: r.shortSummary,
        cycleYear: r.cycleYear,
        totalVacancies: r.totalVacancies,
        status: r.status,
        lifecycleStatus: r.lifecycleStatus,
        isFeatured: r.isFeatured,
        // Master record values dynamically propagated via relational join:
        postTitle: r.post?.title || 'State Government Post',
        postSlug: r.post?.slug || '',
        organisationName: r.organisation?.name || 'Madhya Pradesh Authority',
        organisationShortName: r.organisation?.shortName || 'MP Govt',
        organisationUrl: r.organisation?.websiteUrl || 'https://esb.mp.gov.in',
        criteria: {
          minAge: r.eligibility?.minAge ?? 18,
          maxAgeGeneral: r.eligibility?.maxAgeGeneral ?? 33,
          ageCutoffDate: r.eligibility?.ageCutoffDate ?? '2026-01-01',
          ageRelaxationScSt: r.eligibility?.ageRelaxationScSt ?? 5,
          ageRelaxationObc: r.eligibility?.ageRelaxationObc ?? 3,
          ageRelaxationFemale: r.eligibility?.ageRelaxationFemale ?? 5,
          ageRelaxationEws: r.eligibility?.ageRelaxationEws ?? 0,
          minQualificationLevel: r.eligibility?.minQualificationLevel ?? '10TH',
          requiresMpDomicile: r.eligibility?.requiresMpDomicile === 1,
          requiresMpEmploymentReg: r.eligibility?.requiresMpEmploymentReg === 1,
          requiresCpct: r.eligibility?.requiresCpct === 1,
          genderAllowed: (r.eligibility?.genderAllowed as any) ?? 'ALL',
          minHeightMaleCm: r.eligibility?.minHeightMaleCm,
          minHeightFemaleCm: r.eligibility?.minHeightFemaleCm,
          minChestMaleCm: r.eligibility?.minChestMaleCm,
          minPercentageRequired: r.eligibility?.minPercentageRequired ?? null,
          additionalSkills,
        },
      };
    });
  } catch (error) {
    console.warn('Error querying D1 database, using fallback dataset:', error);
    return FALLBACK_RECRUITMENTS;
  }
}

