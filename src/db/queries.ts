import { getDb, schema } from './client';
import { eq, desc, asc, sql } from 'drizzle-orm';
import { validateRecruitmentForPublication } from '../services/publication-validator';
import { detectDuplicates } from '../services/duplicate-detector';

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
  departmentSlug?: string;
  sectorName?: string;
  sectorSlug?: string;
  organisationName?: string;
  organisationShortName?: string;
  organisationSlug?: string;
  selectionStages?: Array<{ name: string; desc: string }>;
  syllabus?: Array<{ subject: string; marks: string }>;
  activeRecruitments?: Array<{ id: string; title: string; slug: string; totalVacancies: number; lifecycleStatus: string }>;
}

export interface MasterOrganisation {
  id: string;
  stateId: string;
  name: string;
  shortName: string;
  slug: string;
  websiteUrl: string;
  isActive: number;
  initials?: string;
  domain?: string;
  description?: string;
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
  departmentName?: string;
  departmentSlug?: string;
  sectorName?: string;
  sectorSlug?: string;
  payScale?: string | null;
  organisationName: string;
  organisationShortName: string;
  organisationUrl: string;
  organisationSlug?: string;
  applicationStart?: string;
  applicationEnd?: string;
  examDate?: string;
  validationStatus?: string;
  validationErrorsJson?: string | null;
  vacanciesList?: Array<{ category: string; count: number; gender?: string; pct?: string; code?: string }>;
  importantDatesList?: Array<{ event: string; desc: string; date: string; status: string; eventType?: string; isTentative?: number; notes?: string | null }>;
  sourcesList?: Array<{ sourceType: string; sourceUrl: string; sourceTitle: string; publicationDate: string | null; lastVerifiedAt: Date | string | null; status?: string }>;
  officialLinksList?: Array<{ linkType: string; title: string; url: string; isActive: number }>;
  canonicalPost?: CanonicalPostWithDetails;
  criteria: {
    minAge: number;
    maxAgeGeneral: number;
    ageCutoffDate: string;
    ageRelaxationScSt: number;
    ageRelaxationObc: number;
    ageRelaxationFemale: number;
    ageRelaxationEws: number;
    minQualificationLevel: string;
    allowedStreams?: string[] | null;
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

export const FALLBACK_ORGANISATIONS: MasterOrganisation[] = [
  {
    id: 'org_mpesb',
    stateId: 'st_mp',
    name: 'Madhya Pradesh Employees Selection Board',
    shortName: 'MPESB',
    slug: 'mpesb',
    websiteUrl: 'https://esb.mp.gov.in',
    isActive: 1,
    initials: 'ESB',
    domain: 'esb.mp.gov.in',
    description: 'The Madhya Pradesh Employees Selection Board (formerly known as PEB / Vyapam) is the premier statutory recruitment agency of the Government of Madhya Pradesh responsible for direct recruitment to Group 2, Group 3, and Group 4 executive, clerical, and technical cadre posts.',
  },
  {
    id: 'org_mppsc',
    stateId: 'st_mp',
    name: 'Madhya Pradesh Public Service Commission',
    shortName: 'MPPSC',
    slug: 'mppsc',
    websiteUrl: 'https://mppsc.mp.gov.in',
    isActive: 1,
    initials: 'PSC',
    domain: 'mppsc.mp.gov.in',
    description: 'The Madhya Pradesh Public Service Commission is the constitutional body mandated under Article 315 of the Constitution of India to conduct competitive examinations for appointment to state civil services, police leadership (DSP), and gazetted administrative posts.',
  },
  {
    id: 'org_mphc',
    stateId: 'st_mp',
    name: 'High Court of Madhya Pradesh',
    shortName: 'MPHC',
    slug: 'mphc',
    websiteUrl: 'https://mphc.gov.in',
    isActive: 1,
    initials: 'HC',
    domain: 'mphc.gov.in',
    description: 'The High Court of Madhya Pradesh (Principal Seat at Jabalpur, with Benches at Indore and Gwalior) conducts independent direct judicial recruitments for District Judges, Civil Judges, Junior Judicial Assistants, and District Court Steno-Typists.',
  },
  {
    id: 'org_mpsedc',
    stateId: 'st_mp',
    name: 'MP State Electronics Development Corporation',
    shortName: 'MPSEDC',
    slug: 'mpsedc',
    websiteUrl: 'https://mpsedc.mp.gov.in',
    isActive: 1,
    initials: 'EDC',
    domain: 'mpsedc.mp.gov.in',
    description: 'MPSEDC is the nodal IT agency under the Department of Science & Technology responsible for technical appointments, District e-Governance Managers (DeGM), CPCT assessment, and statewide digital governance systems.',
  },
  {
    id: 'org_nhm_mp',
    stateId: 'st_mp',
    name: 'National Health Mission Madhya Pradesh',
    shortName: 'NHM MP',
    slug: 'nhm-mp',
    websiteUrl: 'https://nhmmp.gov.in',
    isActive: 1,
    initials: 'NHM',
    domain: 'nhmmp.gov.in',
    description: 'National Health Mission MP coordinates state public health delivery, clinical workforce deployments, nursing appointments, and community health officers (CHO) recruitments across Madhya Pradesh.',
  },
];

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
    lifecycleStatus: 'UPCOMING',
    isFeatured: 1,
    postTitle: 'Police Constable (General Duty)',
    postSlug: 'mp-police-constable',
    departmentName: 'Home Department (Police & Jail)',
    departmentSlug: 'home-department',
    sectorName: 'Police, Defence & Prisons',
    sectorSlug: 'police-defence-prisons',
    payScale: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    organisationName: 'Madhya Pradesh Employees Selection Board',
    organisationShortName: 'MPESB',
    organisationUrl: 'https://esb.mp.gov.in',
    organisationSlug: 'mpesb',
    applicationStart: '2026-09-22',
    applicationEnd: '2026-10-06',
    examDate: '2026-11-19',
    validationStatus: 'VALID',
    vacanciesList: [
      { category: 'General / Unreserved (UR)', code: 'UR', count: 2025, pct: '27%' },
      { category: 'Other Backward Classes (OBC)', code: 'OBC', count: 2025, pct: '27%' },
      { category: 'Scheduled Tribes (ST)', code: 'ST', count: 1500, pct: '20%' },
      { category: 'Scheduled Castes (SC)', code: 'SC', count: 1200, pct: '16%' },
      { category: 'Economically Weaker Section (EWS)', code: 'EWS', count: 750, pct: '10%' },
    ],
    importantDatesList: [
      { event: 'Notification Released', desc: 'Rulebook Gazetted on ESB Portal', date: '15 Feb 2026', status: 'Completed' },
      { event: 'Applications Open', desc: 'Online Registration Commences', date: '22 Sep 2026', status: 'Upcoming' },
      { event: 'Last Date to Apply', desc: 'Closing Date for Submission & Fee', date: '06 Oct 2026', status: 'Upcoming' },
      { event: 'Correction Window', desc: 'Online Form Error Correction Closes', date: '11 Oct 2026', status: 'Upcoming' },
      { event: 'Written Exam Date', desc: 'Statewide Computer Based Test Commences', date: '19 Nov 2026', status: 'Upcoming' },
    ],
    sourcesList: [
      { sourceType: 'OFFICIAL_NOTIFICATION_PDF', sourceUrl: 'https://esb.mp.gov.in/Rulebooks/RB_2026/Police_Constable_2026_RuleBook.pdf', sourceTitle: 'MP Police Constable Recruitment Test 2026 Detailed Rulebook', publicationDate: '2026-02-15', lastVerifiedAt: '2026-09-17', status: 'VALID' },
    ],
    officialLinksList: [
      { linkType: 'APPLY_ONLINE', title: 'Apply Online (MPOnline Portal)', url: 'https://esb.mponline.gov.in', isActive: 1 },
      { linkType: 'NOTIFICATION_PDF', title: 'Download Official Notification PDF', url: 'https://esb.mp.gov.in/Rulebooks/RB_2026/Police_Constable_2026_RuleBook.pdf', isActive: 1 },
      { linkType: 'RESULT', title: 'MPESB Official Examination Portal', url: 'https://esb.mp.gov.in', isActive: 1 },
    ],
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
    id: 'rec_mp_forest_guard_2026',
    postId: 'post_mp_forest_guard',
    advtNumber: 'Advt No. 07/2026',
    title: 'MP Forest Guard & Jail Prahari Combined Recruitment 2026',
    slug: 'mp-forest-guard-recruitment-2026',
    shortSummary: 'Direct recruitment for 2,112 posts of Van Rakshak (Forest Guard) and Kshetra Rakshak in MP Forest Department. Exam completed; first phase merit list declared.',
    cycleYear: 2026,
    totalVacancies: 2112,
    status: 'PUBLISHED',
    lifecycleStatus: 'RESULT_DECLARED',
    isFeatured: 0,
    postTitle: 'Forest Guard (Van Rakshak)',
    postSlug: 'mp-forest-guard',
    departmentName: 'Forest & Wildlife Department',
    departmentSlug: 'forest-department',
    sectorName: 'Forest, Wildlife & Environment',
    sectorSlug: 'forest-environment',
    payScale: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    organisationName: 'Madhya Pradesh Employees Selection Board',
    organisationShortName: 'MPESB',
    organisationUrl: 'https://esb.mp.gov.in',
    organisationSlug: 'mpesb',
    applicationStart: '2026-02-28',
    applicationEnd: '2026-04-30',
    examDate: '2026-06-04',
    validationStatus: 'VALID',
    vacanciesList: [
      { category: 'General / Unreserved (UR)', code: 'UR', count: 570, pct: '27%' },
      { category: 'Other Backward Classes (OBC)', code: 'OBC', count: 570, pct: '27%' },
      { category: 'Scheduled Tribes (ST)', code: 'ST', count: 422, pct: '20%' },
      { category: 'Scheduled Castes (SC)', code: 'SC', count: 338, pct: '16%' },
      { category: 'Economically Weaker Section (EWS)', code: 'EWS', count: 212, pct: '10%' },
    ],
    importantDatesList: [
      { event: 'Notification Released', desc: 'Rulebook Published on Portal', date: '20 Feb 2026', status: 'Completed' },
      { event: 'Applications Open', desc: 'Application Window Commenced', date: '28 Feb 2026', status: 'Completed' },
      { event: 'Last Date to Apply', desc: 'Revised Online Submission Deadline', date: '30 Apr 2026', status: 'Completed' },
      { event: 'Written Exam Date', desc: 'Direct Recruitment CBT Examination (4-19 Jun)', date: '04 Jun 2026', status: 'Completed' },
      { event: 'Result Declared', desc: 'First Phase Written Exam Merit List Declared', date: '14 Aug 2026', status: 'Completed' },
      { event: 'Physical Proficiency Test (PET)', desc: 'Second Phase PST/PET Verification', date: '15 Sep 2026', status: 'Active' },
    ],
    sourcesList: [
      { sourceType: 'OFFICIAL_NOTIFICATION_PDF', sourceUrl: 'https://esb.mp.gov.in/Rulebooks/RB_2026/Van_Rakshak_2026_RuleBook.pdf', sourceTitle: 'MP Forest Guard and Jail Prahari Combined Recruitment Test 2026 Rulebook', publicationDate: '2026-02-20', lastVerifiedAt: '2026-09-17', status: 'VALID' },
    ],
    officialLinksList: [
      { linkType: 'APPLY_ONLINE', title: 'Apply Online (MPOnline Portal)', url: 'https://esb.mponline.gov.in', isActive: 1 },
      { linkType: 'NOTIFICATION_PDF', title: 'Download Official Forest Guard Rulebook PDF', url: 'https://esb.mp.gov.in/Rulebooks/RB_2026/Van_Rakshak_2026_RuleBook.pdf', isActive: 1 },
      { linkType: 'RESULT', title: 'Check Written Examination Result', url: 'https://esb.mp.gov.in/results/results_n.htm', isActive: 1 },
    ],
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
  {
    id: 'rec_mp_group4_clerk_2026',
    postId: 'post_mp_group4_clerk',
    advtNumber: 'Advt No. 08/2026',
    title: 'Assistant Grade-III & Steno-Typist Combined Recruitment 2026',
    slug: 'mp-assistant-grade-3-recruitment-2026',
    shortSummary: 'Held in verification queue pending official MPESB 2026 gazette release. Previous unverified police-template rules removed.',
    cycleYear: 2026,
    totalVacancies: 1420,
    status: 'PENDING_VERIFICATION',
    lifecycleStatus: 'HOLD',
    isFeatured: 0,
    postTitle: 'Assistant Grade-III / Steno-Typist (State Secretariat)',
    postSlug: 'mp-assistant-grade-3',
    departmentName: 'General Administration Department',
    departmentSlug: 'general-administration',
    sectorName: 'Support Staff & Allied Services (Class IV)',
    sectorSlug: 'support-staff-class-iv',
    payScale: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    organisationName: 'Madhya Pradesh Employees Selection Board',
    organisationShortName: 'MPESB',
    organisationUrl: 'https://esb.mp.gov.in',
    organisationSlug: 'mpesb',
    applicationStart: '2026-09-10',
    applicationEnd: '2026-10-18',
    examDate: '2026-12-05',
    validationStatus: 'PENDING',
    vacanciesList: [
      { category: 'General / Unreserved (UR)', code: 'UR', count: 384, pct: '27%' },
      { category: 'Other Backward Classes (OBC)', code: 'OBC', count: 384, pct: '27%' },
      { category: 'Scheduled Tribes (ST)', code: 'ST', count: 284, pct: '20%' },
      { category: 'Scheduled Castes (SC)', code: 'SC', count: 227, pct: '16%' },
      { category: 'Economically Weaker Section (EWS)', code: 'EWS', count: 141, pct: '10%' },
    ],
    importantDatesList: [
      { event: 'Verification Queue', desc: 'Awaiting 2026 Gazette Rulebook', date: '18 Sep 2026', status: 'Active' },
    ],
    sourcesList: [
      { sourceType: 'OFFICIAL_NOTIFICATION_PDF', sourceUrl: 'https://esb.mp.gov.in', sourceTitle: 'Pending Official Gazette Publication', publicationDate: null, lastVerifiedAt: '2026-09-18', status: 'PENDING' },
    ],
    officialLinksList: [
      { linkType: 'PORTAL', title: 'MPESB Official Portal', url: 'https://esb.mp.gov.in', isActive: 1 },
    ],
    criteria: {
      minAge: 18,
      maxAgeGeneral: 40,
      ageCutoffDate: '2026-01-01',
      ageRelaxationScSt: 5,
      ageRelaxationObc: 3,
      ageRelaxationFemale: 5,
      ageRelaxationEws: 0,
      minQualificationLevel: '12TH',
      requiresMpDomicile: true,
      requiresMpEmploymentReg: true,
      requiresCpct: true,
      genderAllowed: 'ALL',
      minPercentageRequired: null,
      additionalSkills: ['Hindi Typing', 'CPCT Scorecard'],
    },
  },
  {
    id: 'rec_mp_jja_court_2026',
    postId: 'post_mp_jja_court',
    advtNumber: 'Advt No. HC/JJA/2026',
    title: 'Junior Judicial Assistant (JJA) & Court AG-III Examination 2026',
    slug: 'mp-jja-court-recruitment-2026',
    shortSummary: 'Held in verification queue pending confirmation of official 2026 High Court notification.',
    cycleYear: 2026,
    totalVacancies: 980,
    status: 'PENDING_VERIFICATION',
    lifecycleStatus: 'HOLD',
    isFeatured: 0,
    postTitle: 'Junior Judicial Assistant (JJA) / Assistant Grade-III (Courts)',
    postSlug: 'mp-jja-court',
    departmentName: 'High Court Registry & Subordinate Courts',
    departmentSlug: 'high-court-judiciary',
    sectorName: 'Judiciary & Legal Services',
    sectorSlug: 'judiciary-legal-services',
    payScale: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    organisationName: 'High Court of Madhya Pradesh',
    organisationShortName: 'MPHC',
    organisationUrl: 'https://mphc.gov.in',
    organisationSlug: 'mphc',
    applicationStart: '2026-09-20',
    applicationEnd: '2026-11-05',
    examDate: '2026-12-12',
    validationStatus: 'PENDING',
    vacanciesList: [
      { category: 'General / Unreserved (UR)', code: 'UR', count: 490, pct: '50%' },
      { category: 'Scheduled Tribes (ST)', code: 'ST', count: 196, pct: '20%' },
      { category: 'Scheduled Castes (SC)', code: 'SC', count: 157, pct: '16%' },
      { category: 'Other Backward Classes (OBC)', code: 'OBC', count: 137, pct: '14%' },
    ],
    importantDatesList: [
      { event: 'Verification Queue', desc: 'Awaiting 2026 MPHC Gazette Verification', date: '18 Sep 2026', status: 'Active' },
    ],
    sourcesList: [
      { sourceType: 'OFFICIAL_NOTIFICATION_PDF', sourceUrl: 'https://mphc.gov.in', sourceTitle: 'Pending Official High Court Registry Gazette', publicationDate: null, lastVerifiedAt: '2026-09-18', status: 'PENDING' },
    ],
    officialLinksList: [
      { linkType: 'PORTAL', title: 'High Court of MP Official Portal', url: 'https://mphc.gov.in', isActive: 1 },
    ],
    criteria: {
      minAge: 18,
      maxAgeGeneral: 35,
      ageCutoffDate: '2026-01-01',
      ageRelaxationScSt: 5,
      ageRelaxationObc: 3,
      ageRelaxationFemale: 5,
      ageRelaxationEws: 0,
      minQualificationLevel: 'GRADUATION',
      requiresMpDomicile: false,
      requiresMpEmploymentReg: true,
      requiresCpct: true,
      genderAllowed: 'ALL',
      minPercentageRequired: 50.0,
      additionalSkills: ['English & Hindi Typing'],
    },
  },
  {
    id: 'rec_mp_patwari_2026',
    postId: 'post_mp_patwari',
    advtNumber: 'Advt No. 06/2026',
    title: 'MPESB Group-2 Sub-Group-4 Combined Recruitment Test 2026',
    slug: 'mp-patwari-recruitment-2026',
    shortSummary: 'Combined Group-2 Sub-Group-4 recruitment including Patwari and Revenue Inspector cadres across Madhya Pradesh.',
    cycleYear: 2026,
    totalVacancies: 3550,
    status: 'PUBLISHED',
    lifecycleStatus: 'EXAM_SCHEDULED',
    isFeatured: 1,
    postTitle: 'Group-2 Sub-Group-4 Combined Cadre (including Patwari)',
    postSlug: 'mp-patwari',
    departmentName: 'Revenue Department',
    departmentSlug: 'revenue-department',
    sectorName: 'Revenue & Land Administration',
    sectorSlug: 'revenue-land-administration',
    payScale: 'Rs. 25,300 - 80,500/- (Pay Matrix Level 6)',
    organisationName: 'Madhya Pradesh Employees Selection Board',
    organisationShortName: 'MPESB',
    organisationUrl: 'https://esb.mp.gov.in',
    organisationSlug: 'mpesb',
    applicationStart: '2026-08-04',
    applicationEnd: '2026-08-21',
    examDate: '2026-09-22',
    validationStatus: 'VALID',
    vacanciesList: [
      { category: 'General / Unreserved (UR)', code: 'UR', count: 960, pct: '27%' },
      { category: 'Other Backward Classes (OBC)', code: 'OBC', count: 957, pct: '27%' },
      { category: 'Scheduled Tribes (ST)', code: 'ST', count: 710, pct: '20%' },
      { category: 'Scheduled Castes (SC)', code: 'SC', count: 568, pct: '16%' },
      { category: 'Economically Weaker Section (EWS)', code: 'EWS', count: 355, pct: '10%' },
    ],
    importantDatesList: [
      { event: 'Notification Released', desc: 'Rulebook Gazetted on MPESB Portal', date: '25 Jul 2026', status: 'Completed' },
      { event: 'Applications Open', desc: 'Online Registration Commenced', date: '04 Aug 2026', status: 'Completed' },
      { event: 'Last Date to Apply', desc: 'Closing Date for Submission (Extended)', date: '21 Aug 2026', status: 'Completed' },
      { event: 'Rectification Window', desc: 'Online Error Correction Closed', date: '23 Aug 2026', status: 'Completed' },
      { event: 'Written Exam Date', desc: 'Combined Group-2 Sub-Group-4 CBT Exam Commences', date: '22 Sep 2026', status: 'Upcoming' },
    ],
    sourcesList: [
      { sourceType: 'OFFICIAL_NOTIFICATION_PDF', sourceUrl: 'https://esb.mp.gov.in/Rulebooks/RB_2026/Patwari_Group2_2026_RuleBook.pdf', sourceTitle: 'MP ESB Combined Group-2 Sub-Group-4 & Patwari Examination 2026 Rulebook', publicationDate: '2026-07-25', lastVerifiedAt: '2026-09-17', status: 'VALID' },
    ],
    officialLinksList: [
      { linkType: 'APPLY_ONLINE', title: 'Apply Online via MPOnline Portal', url: 'https://esb.mponline.gov.in', isActive: 1 },
      { linkType: 'NOTIFICATION_PDF', title: 'Download Official Patwari Rulebook PDF', url: 'https://esb.mp.gov.in/Rulebooks/RB_2026/Patwari_Group2_2026_RuleBook.pdf', isActive: 1 },
    ],
    criteria: {
      minAge: 18,
      maxAgeGeneral: 40,
      ageCutoffDate: '2026-01-01',
      ageRelaxationScSt: 5,
      ageRelaxationObc: 3,
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
    id: 'rec_mp_mppsc_sse_2026',
    postId: 'post_mp_deputy_collector',
    advtNumber: 'Advt No. 01/Exam/2026',
    title: 'MPPSC State Services Examination (SSE) 2026',
    slug: 'mppsc-state-service-2026',
    shortSummary: 'Held in verification queue pending confirmation of exact 2026 SSE gazette advertisement and post schedule.',
    cycleYear: 2026,
    totalVacancies: 356,
    status: 'PENDING_VERIFICATION',
    lifecycleStatus: 'HOLD',
    isFeatured: 0,
    postTitle: 'Deputy Collector (State Administrative Service)',
    postSlug: 'mp-deputy-collector',
    departmentName: 'General Administration Department',
    departmentSlug: 'general-administration',
    sectorName: 'Civil & Administrative Services',
    sectorSlug: 'civil-administrative-services',
    payScale: 'Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)',
    organisationName: 'Madhya Pradesh Public Service Commission',
    organisationShortName: 'MPPSC',
    organisationUrl: 'https://mppsc.mp.gov.in',
    organisationSlug: 'mppsc',
    applicationStart: '2026-09-15',
    applicationEnd: '2026-10-28',
    examDate: '2026-12-20',
    validationStatus: 'PENDING',
    vacanciesList: [
      { category: 'General / Unreserved (UR)', code: 'UR', count: 96, pct: '27%' },
      { category: 'Other Backward Classes (OBC)', code: 'OBC', count: 96, pct: '27%' },
      { category: 'Scheduled Tribes (ST)', code: 'ST', count: 71, pct: '20%' },
      { category: 'Scheduled Castes (SC)', code: 'SC', count: 57, pct: '16%' },
      { category: 'Economically Weaker Section (EWS)', code: 'EWS', count: 36, pct: '10%' },
    ],
    importantDatesList: [
      { event: 'Verification Queue', desc: 'Awaiting 2026 MPPSC SSE Gazette Verification', date: '18 Sep 2026', status: 'Active' },
    ],
    sourcesList: [
      { sourceType: 'OFFICIAL_NOTIFICATION_PDF', sourceUrl: 'https://mppsc.mp.gov.in', sourceTitle: 'Pending MPPSC Official Gazette Notice', publicationDate: null, lastVerifiedAt: '2026-09-18', status: 'PENDING' },
    ],
    officialLinksList: [
      { linkType: 'PORTAL', title: 'MPPSC Official Website', url: 'https://mppsc.mp.gov.in', isActive: 1 },
    ],
    criteria: {
      minAge: 21,
      maxAgeGeneral: 40,
      ageCutoffDate: '2026-01-01',
      ageRelaxationScSt: 5,
      ageRelaxationObc: 3,
      ageRelaxationFemale: 5,
      ageRelaxationEws: 0,
      minQualificationLevel: 'GRADUATION',
      requiresMpDomicile: false,
      requiresMpEmploymentReg: true,
      requiresCpct: false,
      genderAllowed: 'ALL',
      minPercentageRequired: null,
      additionalSkills: null,
    },
  },
  {
    id: 'rec_mp_staff_nurse_2026',
    postId: 'post_mp_staff_nurse',
    advtNumber: 'Advt No. 09/2026',
    title: 'Staff Nurse & Paramedical Cadre Recruitment 2026',
    slug: 'mp-staff-nurse-recruitment-2026',
    shortSummary: 'Held in verification queue to reconcile separate Nursing Officer and Group-5 Paramedical cycles.',
    cycleYear: 2026,
    totalVacancies: 1240,
    status: 'PENDING_VERIFICATION',
    lifecycleStatus: 'HOLD',
    isFeatured: 0,
    postTitle: 'Staff Nurse (Nursing Officer)',
    postSlug: 'mp-staff-nurse',
    departmentName: 'Public Health and Medical Education Department',
    departmentSlug: 'health-medical-education',
    sectorName: 'Healthcare & Medical Services',
    sectorSlug: 'healthcare-medical-services',
    organisationName: 'Madhya Pradesh Employees Selection Board',
    organisationShortName: 'MPESB',
    organisationUrl: 'https://esb.mp.gov.in',
    applicationStart: '2026-10-05',
    applicationEnd: '2026-11-02',
    examDate: '2026-12-22',
    validationStatus: 'PENDING',
    criteria: {
      minAge: 21,
      maxAgeGeneral: 40,
      ageCutoffDate: '2026-01-01',
      ageRelaxationScSt: 5,
      ageRelaxationObc: 3,
      ageRelaxationFemale: 5,
      ageRelaxationEws: 0,
      minQualificationLevel: 'DIPLOMA',
      requiresMpDomicile: true,
      requiresMpEmploymentReg: true,
      requiresCpct: false,
      genderAllowed: 'ALL',
      minPercentageRequired: null,
      additionalSkills: ['MP Nursing Council Registration'],
    },
  },
  {
    id: 'rec_mp_si_2026',
    postId: 'post_mp_si',
    advtNumber: 'Advt No. 10/2026',
    title: 'MPESB Subedar & Sub-Inspector Recruitment Test 2026',
    slug: 'mp-police-sub-inspector-recruitment-2026',
    shortSummary: 'Executive policing recruitment by MPESB for Subedar and Sub-Inspector cadres across Madhya Pradesh Police Department.',
    cycleYear: 2026,
    totalVacancies: 850,
    status: 'PUBLISHED',
    lifecycleStatus: 'OPEN',
    isFeatured: 1,
    postTitle: 'Subedar & Sub Inspector (MP Police)',
    postSlug: 'mp-police-sub-inspector',
    departmentName: 'Home Department (Police & Jail)',
    departmentSlug: 'home-department',
    sectorName: 'Police, Defence & Prisons',
    sectorSlug: 'police-defence-prisons',
    organisationName: 'Madhya Pradesh Employees Selection Board',
    organisationShortName: 'MPESB',
    organisationUrl: 'https://esb.mp.gov.in',
    applicationStart: '2026-09-09',
    applicationEnd: '2026-09-23',
    examDate: '2026-10-28',
    validationStatus: 'VALID',
    importantDatesList: [
      { event: 'Notification Released', desc: 'Rulebook Gazetted on MPESB Portal', date: '01 Sep 2026', status: 'Completed' },
      { event: 'Applications Open', desc: 'Online Application Portal Active', date: '09 Sep 2026', status: 'Active' },
      { event: 'Last Date to Apply', desc: 'Closing Date for Submission', date: '23 Sep 2026', status: 'Closing Soon' },
      { event: 'Rectification Window', desc: 'Application Error Correction Closed', date: '28 Sep 2026', status: 'Upcoming' },
      { event: 'Written Exam Date', desc: 'Written Examination Commences', date: '28 Oct 2026', status: 'Upcoming' },
    ],
    criteria: {
      minAge: 21,
      maxAgeGeneral: 33,
      ageCutoffDate: '2026-01-01',
      ageRelaxationScSt: 5,
      ageRelaxationObc: 3,
      ageRelaxationFemale: 5,
      ageRelaxationEws: 0,
      minQualificationLevel: 'GRADUATION',
      requiresMpDomicile: true,
      requiresMpEmploymentReg: true,
      requiresCpct: false,
      genderAllowed: 'ALL',
      minHeightMaleCm: 168.0,
      minHeightFemaleCm: 153.0,
      minChestMaleCm: 81.0,
      minPercentageRequired: null,
      additionalSkills: null,
    },
  },
  {
    id: 'rec_mp_samvida_varg3_2026',
    postId: 'post_mp_samvida_varg3',
    advtNumber: 'Advt No. 02/2026',
    title: 'Primary & Middle School Teacher Eligibility Test 2026 (TET)',
    slug: 'mp-primary-teacher-varg-3-2026',
    shortSummary: 'Statewide teacher qualification eligibility examination by MPESB. Qualifying test for future teacher appointment drives.',
    cycleYear: 2026,
    totalVacancies: 0,
    status: 'PUBLISHED',
    lifecycleStatus: 'EXAM_SCHEDULED',
    isFeatured: 0,
    postTitle: 'Teacher Eligibility Test (Primary & Middle School Classes)',
    postSlug: 'mp-primary-teacher-varg-3',
    departmentName: 'School Education & Tribal Affairs',
    departmentSlug: 'school-education',
    sectorName: 'Education, Teaching & Universities',
    sectorSlug: 'education-teaching-universities',
    organisationName: 'Madhya Pradesh Employees Selection Board',
    organisationShortName: 'MPESB',
    organisationUrl: 'https://esb.mp.gov.in',
    applicationStart: '2026-08-21',
    applicationEnd: '2026-09-18',
    examDate: '2026-10-12',
    validationStatus: 'VALID',
    importantDatesList: [
      { event: 'Notification Released', desc: 'Eligibility Test Rulebook Gazetted', date: '10 Aug 2026', status: 'Completed' },
      { event: 'Applications Open', desc: 'Online Registration Commenced', date: '21 Aug 2026', status: 'Completed' },
      { event: 'Last Date to Apply', desc: 'Closing Date for Application Submission', date: '18 Sep 2026', status: 'Active' },
      { event: 'Rectification Window', desc: 'Form Correction Window Closes', date: '20 Sep 2026', status: 'Upcoming' },
      { event: 'Written Exam Date', desc: 'Statewide Eligibility Test Commences', date: '12 Oct 2026', status: 'Upcoming' },
    ],
    criteria: {
      minAge: 18,
      maxAgeGeneral: 40,
      ageCutoffDate: '2026-01-01',
      ageRelaxationScSt: 5,
      ageRelaxationObc: 3,
      ageRelaxationFemale: 5,
      ageRelaxationEws: 0,
      minQualificationLevel: '12TH',
      requiresMpDomicile: true,
      requiresMpEmploymentReg: true,
      requiresCpct: false,
      genderAllowed: 'ALL',
      minPercentageRequired: 50.0,
      additionalSkills: ['D.El.Ed / B.Ed'],
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
export async function getAllActiveRecruitments(
  providedD1?: D1Database,
  options: { includeUnpublished?: boolean } = {}
): Promise<RecruitmentWithDetails[]> {
  const d1 = providedD1 || cfEnv?.DB;
  const includeUnpublished = options.includeUnpublished ?? false;

  if (!d1) {
    // Dynamically synchronize post titles in fallback in case a master post was updated
    const records = includeUnpublished
      ? FALLBACK_RECRUITMENTS
      : FALLBACK_RECRUITMENTS.filter(r => r.status === 'PUBLISHED');

    return records.map(rec => {
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
    const queryOpts: any = {
      with: {
        post: true,
        organisation: true,
        eligibility: true,
      },
      orderBy: [desc(schema.recruitments.isFeatured), desc(schema.recruitments.createdAt)],
    };

    if (!includeUnpublished) {
      queryOpts.where = eq(schema.recruitments.status, 'PUBLISHED');
    }

    const rows = await db.query.recruitments.findMany(queryOpts);

    if (!rows || rows.length === 0) {
      const records = includeUnpublished
        ? FALLBACK_RECRUITMENTS
        : FALLBACK_RECRUITMENTS.filter(r => r.status === 'PUBLISHED');

      return records.map(rec => {
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

// In-Memory Audit Logs fallback
export const FALLBACK_AUDIT_LOGS: Array<{
  id: string;
  adminEmail: string;
  entity: string;
  entityId: string;
  action: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  source?: string | null;
  createdAt: Date;
}> = [
  {
    id: 'audit_01',
    adminEmail: 'aarav@nirnay.in',
    entity: 'RECRUITMENT',
    entityId: 'rec_mp_mppsc_sse_2026',
    action: 'VERIFY',
    field: 'status',
    oldValue: 'PENDING_VERIFICATION',
    newValue: 'PUBLISHED',
    reason: 'Official MPPSC SSE 2026 Gazette Rulebook verified against mppsc.mp.gov.in',
    source: 'https://mppsc.mp.gov.in/Uploads/Adv/Adv_State_Services_Exam_2026.pdf',
    createdAt: new Date('2026-09-17T10:00:00Z'),
  },
  {
    id: 'audit_02',
    adminEmail: 'aarav@nirnay.in',
    entity: 'RECRUITMENT',
    entityId: 'rec_mp_constable_2026',
    action: 'PUBLISH',
    field: 'lifecycleStatus',
    oldValue: 'UPCOMING',
    newValue: 'OPEN',
    reason: 'Application portal officially open on MPESB',
    source: 'https://esb.mp.gov.in/rulebooks/Police_Constable_2026_Rulebook.pdf',
    createdAt: new Date('2026-09-17T09:30:00Z'),
  },
];

/**
 * Fetch all active statutory organisations
 */
export async function getAllOrganisations(providedD1?: D1Database): Promise<MasterOrganisation[]> {
  const d1 = providedD1 || cfEnv?.DB;
  if (!d1) return FALLBACK_ORGANISATIONS;
  try {
    const db = getDb(d1);
    const orgs = await db.query.organisations.findMany({
      where: eq(schema.organisations.isActive, 1),
      orderBy: [asc(schema.organisations.name)],
    });
    if (!orgs || orgs.length === 0) return FALLBACK_ORGANISATIONS;
    return orgs.map(o => {
      const fallback = FALLBACK_ORGANISATIONS.find(f => f.id === o.id || f.slug === o.slug);
      return {
        id: o.id,
        stateId: o.stateId,
        name: o.name,
        shortName: o.shortName,
        slug: o.slug,
        websiteUrl: o.websiteUrl,
        isActive: o.isActive,
        initials: fallback?.initials || o.shortName.slice(0, 3).toUpperCase(),
        domain: fallback?.domain || new URL(o.websiteUrl).hostname,
        description: fallback?.description || `${o.name} is an authorized statutory recruitment agency of the Government of Madhya Pradesh.`,
      };
    });
  } catch (err) {
    console.warn('Error querying organisations from D1:', err);
    return FALLBACK_ORGANISATIONS;
  }
}

/**
 * Fetch a single organisation by its URL slug with linked recruitments & departments
 */
export async function getOrganisationBySlug(
  slug: string,
  providedD1?: D1Database
): Promise<(MasterOrganisation & { recruitments: RecruitmentWithDetails[]; departments: MasterDepartment[] }) | undefined> {
  const organisations = await getAllOrganisations(providedD1);
  const org = organisations.find(o => o.slug.toLowerCase() === slug.toLowerCase() || o.shortName.toLowerCase() === slug.toLowerCase());
  if (!org) return undefined; // STRICT: Never fallback to MPESB!

  const allRecruitments = await getAllActiveRecruitments(providedD1);
  const allDepartments = await getAllDepartments(providedD1);

  const orgRecruitments = allRecruitments.filter(r => {
    const recOrgShort = r.organisationShortName?.toLowerCase() || '';
    const recOrgName = r.organisationName?.toLowerCase() || '';
    const currentShort = org.shortName.toLowerCase();
    const currentName = org.name.toLowerCase();
    return recOrgShort === currentShort || recOrgName === currentName || r.organisationSlug === org.slug;
  });

  const orgDepartments = allDepartments.filter(d => d.organisationId === org.id);

  return {
    ...org,
    recruitments: orgRecruitments,
    departments: orgDepartments,
  };
}

/**
 * Fetch a single canonical post by slug with associated active recruitments
 */
export async function getCanonicalPostBySlug(
  slug: string,
  providedD1?: D1Database
): Promise<CanonicalPostWithDetails | undefined> {
  const posts = await getAllCanonicalPosts(providedD1);
  const post = posts.find(p => p.slug.toLowerCase() === slug.toLowerCase());
  if (!post) return undefined; // STRICT: NEVER fall back to Police Constable!

  const allRecruitments = await getAllActiveRecruitments(providedD1);
  const activeRecruitments = allRecruitments
    .filter(r => r.postId === post.id || r.postSlug === post.slug)
    .map(r => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      totalVacancies: r.totalVacancies,
      lifecycleStatus: r.lifecycleStatus,
    }));

  return {
    ...post,
    activeRecruitments,
  };
}

/**
 * Fetch a single recruitment by its slug with all relational child tables
 * (post, organisation, eligibility, vacancies, important dates, sources, official links)
 */
export async function getRecruitmentWithRelations(
  slug: string,
  providedD1?: D1Database
): Promise<RecruitmentWithDetails | undefined> {
  const d1 = providedD1 || cfEnv?.DB;
  if (!d1) {
    return FALLBACK_RECRUITMENTS.find(r => r.slug === slug);
  }

  try {
    const db = getDb(d1);
    const r = await db.query.recruitments.findFirst({
      where: eq(schema.recruitments.slug, slug),
      with: {
        post: {
          with: {
            department: {
              with: {
                organisation: true,
              },
            },
            sector: true,
          },
        },
        organisation: true,
        eligibility: true,
        vacancies: true,
        importantDates: true,
        sources: true,
        officialLinks: true,
      },
    });

    if (!r) {
      return FALLBACK_RECRUITMENTS.find(rec => rec.slug === slug);
    }

    let additionalSkills: string[] | null = null;
    let allowedStreams: string[] | null = null;
    if (r.eligibility?.additionalSkillsJson) {
      try {
        additionalSkills = JSON.parse(r.eligibility.additionalSkillsJson);
      } catch {}
    }
    if (r.eligibility?.allowedStreamsJson) {
      try {
        allowedStreams = JSON.parse(r.eligibility.allowedStreamsJson);
      } catch {}
    }

    const vacanciesList = (r.vacancies || []).map(v => ({
      category: v.category,
      count: v.count,
      gender: v.gender,
      pct: r.totalVacancies > 0 ? `${Math.round((v.count / r.totalVacancies) * 100)}%` : undefined,
      code: v.category,
    }));

    const importantDatesList = (r.importantDates || []).map(d => ({
      event: d.eventType.replace(/_/g, ' '),
      desc: d.notes || d.eventType,
      date: d.eventDate,
      status: 'Active',
      eventType: d.eventType,
      isTentative: d.isTentative,
      notes: d.notes,
    }));

    const sourcesList = (r.sources || []).map(s => ({
      sourceType: s.sourceType,
      sourceUrl: s.sourceUrl,
      sourceTitle: s.sourceTitle,
      publicationDate: s.publicationDate,
      lastVerifiedAt: s.lastVerifiedAt,
    }));

    const officialLinksList = (r.officialLinks || []).map(l => ({
      linkType: l.linkType,
      title: l.title,
      url: l.url,
      isActive: l.isActive,
    }));

    const canonicalPost: CanonicalPostWithDetails | undefined = r.post ? {
      id: r.post.id,
      departmentId: r.post.departmentId,
      sectorId: r.post.sectorId,
      title: r.post.title,
      slug: r.post.slug,
      summary: r.post.summary,
      payScale: r.post.payScale,
      defaultMinAge: r.post.defaultMinAge,
      defaultMaxAge: r.post.defaultMaxAge,
      defaultQualification: r.post.defaultQualification,
      isActive: r.post.isActive,
      departmentName: r.post.department?.name,
      sectorName: r.post.sector?.name,
      organisationName: r.post.department?.organisation?.shortName || r.post.department?.organisation?.name,
    } : undefined;

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
      postTitle: r.post?.title || 'State Government Post',
      postSlug: r.post?.slug || '',
      departmentName: r.post?.department?.name || 'Madhya Pradesh Department',
      departmentSlug: r.post?.department?.slug,
      sectorName: r.post?.sector?.name || 'State Cadre',
      sectorSlug: r.post?.sector?.slug,
      payScale: r.post?.payScale,
      organisationName: r.organisation?.name || 'Madhya Pradesh Authority',
      organisationShortName: r.organisation?.shortName || 'MP Govt',
      organisationUrl: r.organisation?.websiteUrl || 'https://esb.mp.gov.in',
      organisationSlug: r.organisation?.slug,
      validationStatus: r.validationStatus,
      validationErrorsJson: r.validationErrorsJson,
      vacanciesList: vacanciesList.length > 0 ? vacanciesList : undefined,
      importantDatesList: importantDatesList.length > 0 ? importantDatesList : undefined,
      sourcesList: sourcesList.length > 0 ? sourcesList : undefined,
      officialLinksList: officialLinksList.length > 0 ? officialLinksList : undefined,
      canonicalPost,
      criteria: {
        minAge: r.eligibility?.minAge ?? 18,
        maxAgeGeneral: r.eligibility?.maxAgeGeneral ?? 33,
        ageCutoffDate: r.eligibility?.ageCutoffDate ?? '2026-01-01',
        ageRelaxationScSt: r.eligibility?.ageRelaxationScSt ?? 5,
        ageRelaxationObc: r.eligibility?.ageRelaxationObc ?? 3,
        ageRelaxationFemale: r.eligibility?.ageRelaxationFemale ?? 5,
        ageRelaxationEws: r.eligibility?.ageRelaxationEws ?? 0,
        minQualificationLevel: r.eligibility?.minQualificationLevel ?? '10TH',
        allowedStreams,
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
  } catch (err) {
    console.warn('Error fetching recruitment with relations from D1:', err);
    return FALLBACK_RECRUITMENTS.find(r => r.slug === slug);
  }
}

/**
 * Fetch a single recruitment by its URL slug
 */
export async function getRecruitmentBySlug(slug: string, providedD1?: D1Database): Promise<RecruitmentWithDetails | undefined> {
  return getRecruitmentWithRelations(slug, providedD1);
}

/**
 * Fetch a single sector by its URL slug
 */
export async function getSectorBySlug(slug: string, providedD1?: D1Database): Promise<MasterSector | undefined> {
  const sectors = await getAllSectors(providedD1);
  return sectors.find(s => s.slug === slug);
}

/**
 * Fetch all canonical posts for a given sector ID
 */
export async function getPostsBySectorId(sectorId: string, providedD1?: D1Database): Promise<CanonicalPostWithDetails[]> {
  const posts = await getAllCanonicalPosts(providedD1);
  return posts.filter(p => p.sectorId === sectorId);
}

export interface CreateRecruitmentInput {
  title: string;
  postId: string;
  organisationShortName?: string;
  advtNumber: string;
  totalVacancies: number;
  shortSummary?: string;
  lifecycleStatus?: string;
  status?: string; // 'DRAFT' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'PUBLISHED'
  minAge?: number;
  maxAgeGeneral?: number;
  minQualificationLevel?: string;
  allowedStreams?: string[];
  requiresMpDomicile?: boolean;
  requiresMpEmploymentReg?: boolean;
  requiresCpct?: boolean;
  genderAllowed?: 'ALL' | 'MALE' | 'FEMALE';
  minHeightMaleCm?: number | null;
  minHeightFemaleCm?: number | null;
  minChestMaleCm?: number | null;
  applicationStart?: string;
  applicationEnd?: string;
  examDate?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  officialApplyUrl?: string;
  vacanciesBreakdown?: Array<{ category: string; count: number; gender?: string }>;
  adminEmail?: string;
}

/**
 * Ingest and create a new recruitment drive atomically with all relational child records
 * (recruitment, eligibility, vacancies, dates, sources, official links, and audit log)
 */
export async function createRecruitmentAtomic(
  data: CreateRecruitmentInput,
  providedD1?: D1Database
): Promise<{ success: boolean; id: string; validation: any; errors?: string[] }> {
  const d1 = providedD1 || cfEnv?.DB;
  const newId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const matchedPost = FALLBACK_POSTS.find(p => p.id === data.postId);
  const orgShort = data.organisationShortName || (data.postId.includes('mppsc') ? 'MPPSC' : data.postId.includes('judge') ? 'MPHC' : 'MPESB');
  const org = FALLBACK_ORGANISATIONS.find(o => o.shortName === orgShort) || FALLBACK_ORGANISATIONS[0];

  // 1. Validation & Duplicate Detection
  const existingRecruitments = await getAllActiveRecruitments(providedD1);
  const duplicateCheck = detectDuplicates(
    {
      id: newId,
      title: data.title,
      advtNumber: data.advtNumber,
      organisationShortName: org.shortName,
      sourceUrl: data.sourceUrl,
      postId: data.postId,
    },
    existingRecruitments.map(r => ({
      id: r.id,
      title: r.title,
      advtNumber: r.advtNumber,
      organisationShortName: r.organisationShortName,
      sourceUrl: r.sourcesList?.[0]?.sourceUrl || r.organisationUrl,
      postId: r.postId,
    }))
  );

  const validationInput = {
    id: newId,
    title: data.title,
    slug,
    advtNumber: data.advtNumber,
    cycleYear: new Date().getFullYear(),
    totalVacancies: data.totalVacancies,
    postId: data.postId,
    postTitle: matchedPost?.title || 'State Government Post',
    departmentName: matchedPost?.departmentName || 'General Administration Department',
    organisationShortName: org.shortName,
    organisationName: org.name,
    lifecycleStatus: data.lifecycleStatus || 'OPEN',
    applicationStart: data.applicationStart,
    applicationEnd: data.applicationEnd,
    examDate: data.examDate,
    sources: data.sourceUrl ? [{
      sourceType: 'OFFICIAL_NOTIFICATION_PDF',
      sourceUrl: data.sourceUrl,
      sourceTitle: data.sourceTitle || `${org.shortName} Official Notification`,
      status: 'VALID' as const,
    }] : [],
    criteria: {
      minAge: data.minAge ?? matchedPost?.defaultMinAge ?? 18,
      maxAgeGeneral: data.maxAgeGeneral ?? matchedPost?.defaultMaxAge ?? 33,
      ageCutoffDate: `${new Date().getFullYear()}-01-01`,
      minQualificationLevel: data.minQualificationLevel ?? matchedPost?.defaultQualification ?? '10TH',
      requiresMpDomicile: data.requiresMpDomicile ?? true,
      requiresMpEmploymentReg: data.requiresMpEmploymentReg ?? true,
      requiresCpct: data.requiresCpct ?? false,
      genderAllowed: data.genderAllowed || 'ALL' as 'ALL',
    },
  };

  const validationResult = validateRecruitmentForPublication(validationInput);

  let targetStatus = data.status || 'PUBLISHED';
  let targetValidationStatus = validationResult.publishable ? 'VALID' : 'NEEDS_REVIEW';

  if (!validationResult.publishable && targetStatus === 'PUBLISHED') {
    targetStatus = 'PENDING_VERIFICATION';
  }

  // 2. Prepare in-memory representation
  const newRecruitment: RecruitmentWithDetails = {
    id: newId,
    postId: data.postId,
    advtNumber: data.advtNumber,
    title: data.title,
    slug,
    shortSummary: data.shortSummary || `Direct recruitment for ${data.totalVacancies.toLocaleString()} vacancies of ${matchedPost?.title || 'posts'} in Madhya Pradesh.`,
    cycleYear: new Date().getFullYear(),
    totalVacancies: data.totalVacancies,
    status: targetStatus,
    lifecycleStatus: data.lifecycleStatus || 'OPEN',
    isFeatured: 0,
    postTitle: matchedPost?.title || 'State Government Post',
    postSlug: matchedPost?.slug || '',
    departmentName: matchedPost?.departmentName,
    sectorName: matchedPost?.sectorName,
    payScale: matchedPost?.payScale,
    organisationName: org.name,
    organisationShortName: org.shortName,
    organisationUrl: org.websiteUrl,
    organisationSlug: org.slug,
    validationStatus: targetValidationStatus,
    validationErrorsJson: JSON.stringify(validationResult.blockingErrors),
    canonicalPost: matchedPost,
    vacanciesList: data.vacanciesBreakdown || [
      { category: 'UR', count: Math.round(data.totalVacancies * 0.27), pct: '27%', code: 'UR' },
      { category: 'OBC', count: Math.round(data.totalVacancies * 0.27), pct: '27%', code: 'OBC' },
      { category: 'ST', count: Math.round(data.totalVacancies * 0.20), pct: '20%', code: 'ST' },
      { category: 'SC', count: Math.round(data.totalVacancies * 0.16), pct: '16%', code: 'SC' },
      { category: 'EWS', count: Math.round(data.totalVacancies * 0.10), pct: '10%', code: 'EWS' },
    ],
    importantDatesList: [
      { event: 'Notification Released', desc: 'Rulebook Gazetted', date: 'Official Gazetted', status: 'Completed', eventType: 'NOTIFICATION' },
      ...(data.applicationStart ? [{ event: 'Applications Open', desc: 'Online Registration Commenced', date: data.applicationStart, status: 'Active', eventType: 'APPLICATION_START' }] : []),
      ...(data.applicationEnd ? [{ event: 'Last Date to Apply', desc: 'Online Form Submission Deadline', date: data.applicationEnd, status: 'Closing Soon', eventType: 'APPLICATION_END' }] : []),
      ...(data.examDate ? [{ event: 'Examination Date', desc: 'Statewide Competitive Examination', date: data.examDate, status: 'Upcoming', eventType: 'EXAM_DATE' }] : []),
    ],
    sourcesList: [
      {
        sourceType: 'OFFICIAL_NOTIFICATION_PDF',
        sourceUrl: data.sourceUrl || org.websiteUrl,
        sourceTitle: data.sourceTitle || `${org.shortName} Official Rulebook Notification`,
        publicationDate: data.applicationStart || '2026-01-01',
        lastVerifiedAt: new Date(),
      },
    ],
    officialLinksList: [
      {
        linkType: 'APPLY_ONLINE',
        title: `Apply on ${org.shortName} Portal`,
        url: data.officialApplyUrl || org.websiteUrl,
        isActive: 1,
      },
    ],
    criteria: {
      minAge: data.minAge ?? matchedPost?.defaultMinAge ?? 18,
      maxAgeGeneral: data.maxAgeGeneral ?? matchedPost?.defaultMaxAge ?? 33,
      ageCutoffDate: `${new Date().getFullYear()}-01-01`,
      ageRelaxationScSt: 5,
      ageRelaxationObc: 3,
      ageRelaxationFemale: 5,
      ageRelaxationEws: 0,
      minQualificationLevel: data.minQualificationLevel ?? matchedPost?.defaultQualification ?? '10TH',
      allowedStreams: data.allowedStreams,
      requiresMpDomicile: data.requiresMpDomicile ?? true,
      requiresMpEmploymentReg: data.requiresMpEmploymentReg ?? true,
      requiresCpct: data.requiresCpct ?? false,
      genderAllowed: data.genderAllowed || 'ALL',
      minHeightMaleCm: data.minHeightMaleCm ?? null,
      minHeightFemaleCm: data.minHeightFemaleCm ?? null,
      minChestMaleCm: data.minChestMaleCm ?? null,
      minPercentageRequired: null,
      additionalSkills: null,
    },
  };

  FALLBACK_RECRUITMENTS.unshift(newRecruitment);

  // 3. Write Audit Log
  const adminEmail = data.adminEmail || 'aarav@nirnay.in';
  FALLBACK_AUDIT_LOGS.unshift({
    id: `audit_${Date.now()}`,
    adminEmail,
    entity: 'RECRUITMENT',
    entityId: newId,
    action: targetStatus === 'PUBLISHED' ? 'PUBLISH' : 'CREATE',
    field: 'status',
    oldValue: null,
    newValue: targetStatus,
    reason: `Recruitment created via Admin Ingest with validation status: ${targetValidationStatus}`,
    source: data.sourceUrl || org.websiteUrl,
    createdAt: new Date(),
  });

  // 4. Atomic D1 Batch Persistence
  if (d1) {
    try {
      const db = getDb(d1);
      const statements: any[] = [];

      statements.push(
        db.insert(schema.recruitments).values({
          id: newId,
          postId: data.postId,
          organisationId: org.id,
          stateId: 'st_mp',
          advtNumber: data.advtNumber,
          title: data.title,
          slug,
          shortSummary: newRecruitment.shortSummary,
          cycleYear: newRecruitment.cycleYear,
          totalVacancies: data.totalVacancies,
          status: targetStatus,
          lifecycleStatus: data.lifecycleStatus || 'OPEN',
          isFeatured: 0,
          validationStatus: targetValidationStatus,
          validationErrorsJson: JSON.stringify(validationResult.blockingErrors),
        })
      );

      statements.push(
        db.insert(schema.recruitmentEligibility).values({
          id: `elig_${newId}`,
          recruitmentId: newId,
          minAge: data.minAge ?? matchedPost?.defaultMinAge ?? 18,
          maxAgeGeneral: data.maxAgeGeneral ?? matchedPost?.defaultMaxAge ?? 33,
          ageCutoffDate: `${new Date().getFullYear()}-01-01`,
          ageRelaxationScSt: 5,
          ageRelaxationObc: 3,
          ageRelaxationFemale: 5,
          minQualificationLevel: data.minQualificationLevel ?? matchedPost?.defaultQualification ?? '10TH',
          allowedStreamsJson: data.allowedStreams ? JSON.stringify(data.allowedStreams) : null,
          requiresMpDomicile: data.requiresMpDomicile ? 1 : 1,
          requiresMpEmploymentReg: data.requiresMpEmploymentReg ? 1 : 1,
          requiresCpct: data.requiresCpct ? 1 : 0,
          genderAllowed: data.genderAllowed || 'ALL',
          minHeightMaleCm: data.minHeightMaleCm ?? null,
          minHeightFemaleCm: data.minHeightFemaleCm ?? null,
          minChestMaleCm: data.minChestMaleCm ?? null,
        })
      );

      // Vacancies
      for (const v of newRecruitment.vacanciesList || []) {
        statements.push(
          db.insert(schema.vacancies).values({
            id: `vac_${newId}_${v.category.toLowerCase()}`,
            recruitmentId: newId,
            category: v.category,
            gender: v.gender || 'ALL',
            count: v.count,
          })
        );
      }

      // Dates
      for (const d of newRecruitment.importantDatesList || []) {
        statements.push(
          db.insert(schema.importantDates).values({
            id: `date_${newId}_${d.eventType?.toLowerCase() || Math.random().toString(36).substring(2, 6)}`,
            recruitmentId: newId,
            eventType: d.eventType || 'NOTIFICATION',
            eventDate: d.date,
            isTentative: 0,
            notes: d.desc,
          })
        );
      }

      // Source
      statements.push(
        db.insert(schema.sources).values({
          id: `src_${newId}`,
          recruitmentId: newId,
          sourceType: 'OFFICIAL_NOTIFICATION_PDF',
          sourceUrl: data.sourceUrl || org.websiteUrl,
          sourceTitle: data.sourceTitle || `${org.shortName} Official Rulebook Notification`,
          publicationDate: data.applicationStart || '2026-01-01',
        })
      );

      // Official Link
      statements.push(
        db.insert(schema.officialLinks).values({
          id: `link_${newId}`,
          recruitmentId: newId,
          linkType: 'APPLY_ONLINE',
          title: `Apply on ${org.shortName} Portal`,
          url: data.officialApplyUrl || org.websiteUrl,
          isActive: 1,
        })
      );

      // Audit Log
      statements.push(
        db.insert(schema.auditLogs).values({
          id: `audit_${Date.now()}`,
          adminEmail,
          entity: 'RECRUITMENT',
          entityId: newId,
          action: targetStatus === 'PUBLISHED' ? 'PUBLISH' : 'CREATE',
          field: 'status',
          oldValue: null,
          newValue: targetStatus,
          reason: `Recruitment created via Admin Ingest with validation status: ${targetValidationStatus}`,
          source: data.sourceUrl || org.websiteUrl,
        })
      );

      // Execute batch atomically in D1
      // @ts-ignore
      await db.batch(statements);
    } catch (error) {
      console.error('Error in atomic recruitment creation in D1:', error);
    }
  }

  return {
    success: true,
    id: newId,
    validation: validationResult,
    errors: validationResult.blockingErrors,
  };
}

/**
 * Backward compatible createRecruitment wrapper
 */
export async function createRecruitment(
  data: CreateRecruitmentInput,
  providedD1?: D1Database
): Promise<string> {
  const res = await createRecruitmentAtomic(data, providedD1);
  return res.id;
}

export interface AdminKPIData {
  published: number;
  drafts: number;
  pendingVerification: number;
  expiringIn7Days: number;
  needsReview: number;
  sourceExpired: number;
  dataConflicts: number;
  totalVacancies: number;
  recentAuditLogs: Array<{
    id: string;
    adminEmail: string;
    entity: string;
    entityId: string;
    action: string;
    field?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    reason?: string | null;
    source?: string | null;
    createdAt: Date;
  }>;
  conflictsList: Array<{
    id: string;
    title: string;
    advtNumber: string;
    slug: string;
    type: string;
    issue: string;
  }>;
}

/**
 * Operational KPI calculation computed dynamically from live database state
 */
export async function getAdminKPIs(providedD1?: D1Database): Promise<AdminKPIData> {
  const recruitments = await getAllActiveRecruitments(providedD1, { includeUnpublished: true });
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let published = 0;
  let drafts = 0;
  let pendingVerification = 0;
  let expiringIn7Days = 0;
  let needsReview = 0;
  let sourceExpired = 0;
  let dataConflicts = 0;
  let totalVacancies = 0;
  const conflictsList: AdminKPIData['conflictsList'] = [];

  for (const r of recruitments) {
    totalVacancies += r.totalVacancies || 0;

    if (r.status === 'PUBLISHED') published++;
    else if (r.status === 'DRAFT') drafts++;
    else if (r.status === 'PENDING_VERIFICATION') pendingVerification++;

    if (r.validationStatus === 'NEEDS_REVIEW' || r.status === 'NEEDS_REVIEW') {
      needsReview++;
    }

    // Expiring in 7 days check
    if (r.applicationEnd) {
      const endDate = new Date(r.applicationEnd);
      if (endDate >= now && endDate <= sevenDaysFromNow) {
        expiringIn7Days++;
      }
    }

    // Source Expired / Missing check
    const hasSource = r.sourcesList && r.sourcesList.length > 0;
    if (!hasSource) {
      sourceExpired++;
      conflictsList.push({
        id: r.id,
        title: r.title,
        advtNumber: r.advtNumber,
        slug: r.slug,
        type: 'MISSING_SOURCE',
        issue: 'Published recruitment is missing a verified official source document or link.',
      });
    }

    // Inconsistency / Data Conflicts check
    let hasConflict = false;

    // Check: Closing date before opening date
    if (r.applicationStart && r.applicationEnd) {
      if (new Date(r.applicationEnd) < new Date(r.applicationStart)) {
        hasConflict = true;
        conflictsList.push({
          id: r.id,
          title: r.title,
          advtNumber: r.advtNumber,
          slug: r.slug,
          type: 'INVALID_DATES',
          issue: `Application closing date (${r.applicationEnd}) is earlier than start date (${r.applicationStart}).`,
        });
      }
    }

    // Check: MPPSC linked to Police Constable corruption
    if (r.organisationShortName === 'MPPSC' && (r.postTitle?.toLowerCase().includes('police constable') || r.postSlug?.includes('police-constable'))) {
      hasConflict = true;
      conflictsList.push({
        id: r.id,
        title: r.title,
        advtNumber: r.advtNumber,
        slug: r.slug,
        type: 'CORRUPTED_MAPPING',
        issue: 'MPPSC recruitment is erroneously mapped to Police Constable canonical post.',
      });
    }

    // Check: Vacancy category sum mismatch
    if (r.vacanciesList && r.vacanciesList.length > 0 && r.totalVacancies > 0) {
      const sum = r.vacanciesList.reduce((acc, v) => acc + (v.count || 0), 0);
      if (sum !== r.totalVacancies) {
        hasConflict = true;
        conflictsList.push({
          id: r.id,
          title: r.title,
          advtNumber: r.advtNumber,
          slug: r.slug,
          type: 'VACANCY_MISMATCH',
          issue: `Category vacancy sum (${sum}) does not equal total declared vacancies (${r.totalVacancies}).`,
        });
      }
    }

    if (hasConflict || r.validationStatus === 'INVALID') {
      dataConflicts++;
    }
  }

  return {
    published,
    drafts,
    pendingVerification,
    expiringIn7Days,
    needsReview,
    sourceExpired,
    dataConflicts,
    totalVacancies,
    recentAuditLogs: FALLBACK_AUDIT_LOGS.slice(0, 10),
    conflictsList,
  };
}

