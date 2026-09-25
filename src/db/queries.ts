import { getDb, schema } from './client';
import { eq, desc, asc, sql, and } from 'drizzle-orm';
import { validateRecruitmentForPublication } from '../services/publication-validator';
import { detectDuplicates } from '../services/duplicate-detector';
import {
  resolveRecruitmentLifecycle,
  getLifecyclePresentation,
  calculateRecruitmentMetrics,
  formatSectorVacancySummary,
  isActiveDrive,
  isUpcomingDrive,
  isCurrentRecruitment,
  type CanonicalLifecycle,
  type StatusPresentation,
  type RecruitmentMetrics,
  type PublicationStatus,
  type ExamStatus,
  type ResultStatus,
} from '../services/lifecycle';

export {
  resolveRecruitmentLifecycle,
  getLifecyclePresentation,
  calculateRecruitmentMetrics,
  formatSectorVacancySummary,
  isActiveDrive,
  isUpcomingDrive,
  isCurrentRecruitment,
  type CanonicalLifecycle,
  type StatusPresentation,
  type RecruitmentMetrics,
  type PublicationStatus,
  type ExamStatus,
  type ResultStatus,
};

let cfEnv: any = undefined;
try {
  // @ts-ignore
  const cf = await import('cloudflare:workers');
  cfEnv = cf.env;
} catch {
  // Fallback for environments outside Cloudflare Workers runtime
}

const demoFallbackEnabled = import.meta.env?.DEV === true || (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');

function resolveD1(providedD1: D1Database | undefined, operation: string): D1Database | undefined {
  const d1 = providedD1 || cfEnv?.DB;
  if (!d1 && !demoFallbackEnabled) throw new Error(`D1 binding unavailable while ${operation}.`);
  return d1;
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
  overviewMarkdown?: string | null;
  cycleYear: number;
  totalVacancies: number;
  status: string;
  lifecycleStatus: string;
  examStatus?: string;
  resultStatus?: string;
  resolvedLifecycle: CanonicalLifecycle;
  presentation: StatusPresentation;
  isFeatured: number;
  postTitle: string;
  postSlug: string;
  departmentName?: string;
  departmentSlug?: string;
  sectorName?: string;
  sectorSlug?: string;
  payScale?: string | null;
  payScaleOverride?: string | null;
  salaryDetailsMarkdown?: string | null;
  cadreClassification?: string | null;
  organisationName: string;
  organisationShortName: string;
  organisationUrl: string;
  organisationSlug?: string;
  applicationStart?: string;
  applicationEnd?: string;
  examDate?: string;
  validationStatus?: string;
  validationErrorsJson?: string | null;
  selectionStages?: Array<{ stage?: number; name: string; desc: string; isQualifying?: boolean }>;
  selectionStagesJson?: string | null;
  vacanciesList?: Array<{ category: string; count: number; gender?: string; pct?: string; code?: string; quotaPct?: string; subPostName?: string }>;
  importantDatesList?: Array<{ event: string; desc: string; date: string; status: string; eventType?: string; isTentative?: number; notes?: string | null }>;
  sourcesList?: Array<{ id?: string; sourceType: string; sourceUrl: string; sourceTitle: string; publicationDate: string | null; lastVerifiedAt: Date | string | null; status?: string }>;
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
    domicileStateCode?: string | null;
    requiresMpEmploymentReg: boolean;
    employmentRegistrationLabel?: string | null;
    requiresCpct: boolean;
    genderAllowed: 'ALL' | 'MALE' | 'FEMALE';
    minHeightMaleCm?: number | null;
    minHeightFemaleCm?: number | null;
    minChestMaleCm?: number | null;
    minPercentageRequired?: number | null;
    additionalSkills?: string[] | null;
    qualificationDetailsMarkdown?: string | null;
    relaxationNotesMarkdown?: string | null;
    specialConditionsNotes?: string | null;
    experienceMonths?: number;
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

export function enrichRecruitmentWithLifecycle(rec: any): RecruitmentWithDetails {
  const appStart = rec.applicationStart || rec.importantDatesList?.find((d: any) => d.eventType === 'APPLICATION_START')?.date;
  const appEnd = rec.applicationEnd || rec.importantDatesList?.find((d: any) => d.eventType === 'APPLICATION_END')?.date;
  const examDate = rec.examDate || rec.importantDatesList?.find((d: any) => d.eventType === 'EXAM_DATE')?.date;

  const resolvedLifecycle = resolveRecruitmentLifecycle({
    status: rec.status,
    lifecycleStatus: rec.lifecycleStatus,
    applicationStart: appStart,
    applicationEnd: appEnd,
    examDate,
    examStatus: rec.examStatus,
    resultStatus: rec.resultStatus,
    totalVacancies: rec.totalVacancies,
  });

  const presentation = getLifecyclePresentation(resolvedLifecycle);

  return {
    ...rec,
    applicationStart: appStart,
    applicationEnd: appEnd,
    examDate,
    lifecycleStatus: resolvedLifecycle,
    resolvedLifecycle,
    presentation,
    examStatus: rec.examStatus || (examDate ? 'SCHEDULED' : 'NOT_SCHEDULED'),
    resultStatus: rec.resultStatus || (resolvedLifecycle === 'RESULT_DECLARED' ? 'DECLARED' : 'NOT_DECLARED'),
  };
}

const RAW_FALLBACK_RECRUITMENTS: any[] = [
  {
    id: 'rec_mp_constable_2026',
    postId: 'post_mp_constable',
    advtNumber: 'Advt No. 04/2026',
    title: 'MP Police Constable Recruitment 2026 (7,500 Vacancies)',
    slug: 'mp-police-constable-recruitment-2026',
    shortSummary: 'Official recruitment by MPESB for 7,500 posts of Police Constable in Madhya Pradesh Police Department. 10th pass candidates eligible.',
    overviewMarkdown: 'The Madhya Pradesh Employees Selection Board (MPESB) has officially published the competitive examination notification for 7,500 vacancies of Police Constable (General Duty & Radio) in the Madhya Pradesh Police Department. Selection will be based on a Computer-Based Test (CBT), followed by physical proficiency scoring and document verification.',
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
    payScaleOverride: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    salaryDetailsMarkdown: 'Basic Pay Rs. 19,500/- plus Dearness Allowance (DA), House Rent Allowance (HRA), Medical allowance, and uniform kit maintenance. 3-year statutory probation period with stipend (70%, 80%, 90%).',
    cadreClassification: 'MP Police Non-Gazetted Executive Cadre (Class III)',
    organisationName: 'Madhya Pradesh Employees Selection Board',
    organisationShortName: 'MPESB',
    organisationUrl: 'https://esb.mp.gov.in',
    organisationSlug: 'mpesb',
    applicationStart: '2026-09-22',
    applicationEnd: '2026-10-06',
    examDate: '2026-11-19',
    validationStatus: 'VALID',
    selectionStages: [
      { name: 'Stage 1: Written Examination (CBT)', desc: '100 marks objective test covering General Knowledge, Reasoning, and Simple Arithmetic. No negative marking.' },
      { name: 'Stage 2: Physical Proficiency Test (PPT)', desc: '800m run, Long Jump, and Shot Put. Carries 100 marks contributing to final merit ranking.' },
      { name: 'Stage 3: Document Verification & Medical Exam', desc: 'Original certificates verification, biometric validation, and physical standards measurement at district police lines.' },
    ],
    vacanciesList: [
      { category: 'General / Unreserved (UR)', code: 'UR', count: 2025, pct: '27%', quotaPct: '27%' },
      { category: 'Other Backward Classes (OBC)', code: 'OBC', count: 2025, pct: '27%', quotaPct: '27%' },
      { category: 'Scheduled Tribes (ST)', code: 'ST', count: 1500, pct: '20%', quotaPct: '20%' },
      { category: 'Scheduled Castes (SC)', code: 'SC', count: 1200, pct: '16%', quotaPct: '16%' },
      { category: 'Economically Weaker Section (EWS)', code: 'EWS', count: 750, pct: '10%', quotaPct: '10%' },
    ],
    importantDatesList: [
      { event: 'Notification Released', desc: 'Rulebook Gazetted on ESB Portal', date: '15 Feb 2026', status: 'Completed', eventType: 'NOTIFICATION' },
      { event: 'Applications Open', desc: 'Online Registration Commences', date: '22 Sep 2026', status: 'Upcoming', eventType: 'APPLICATION_START' },
      { event: 'Last Date to Apply', desc: 'Closing Date for Submission & Fee', date: '06 Oct 2026', status: 'Upcoming', eventType: 'APPLICATION_END' },
      { event: 'Correction Window', desc: 'Online Form Error Correction Closes', date: '11 Oct 2026', status: 'Upcoming', eventType: 'CORRECTION_END' },
      { event: 'Written Exam Date', desc: 'Statewide Computer Based Test Commences', date: '19 Nov 2026', status: 'Upcoming', eventType: 'EXAM_DATE' },
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
      qualificationDetailsMarkdown: '10th Class (High School) passed from Madhya Pradesh Board of Secondary Education or equivalent recognized Board. (8th Pass eligible for Scheduled Tribe candidates). For Constable Radio: 12th with PCM plus 2-year ITI or Polytechnic Diploma in Electronics/Computers/IT.',
      relaxationNotesMarkdown: '+5 years upper age relaxation for SC, ST, OBC, Government Servants, and Women candidates as per MP General Administration Department circulars.',
      specialConditionsNotes: 'Valid MP Employment Exchange (Rojgar Panjiyan) registration is mandatory as of application deadline.',
      experienceMonths: 0,
    },
  },
  {
    id: 'rec_mp_forest_guard_2026',
    postId: 'post_mp_forest_guard',
    advtNumber: 'Advt No. 07/2026',
    title: 'MP Forest Guard & Jail Prahari Combined Recruitment 2026',
    slug: 'mp-forest-guard-recruitment-2026',
    shortSummary: 'Direct recruitment for 2,112 posts of Van Rakshak (Forest Guard) and Kshetra Rakshak in MP Forest Department. Exam completed; first phase merit list declared.',
    overviewMarkdown: 'Direct recruitment examination conducted by MPESB for 2,112 posts of Van Rakshak (Forest Guard) and Kshetra Rakshak across MP forest circles. Candidates must qualify written CBT followed by mandatory physical walking endurance test and physical measurement.',
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
    payScaleOverride: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    salaryDetailsMarkdown: 'Pay Matrix Level 4 (Rs. 19,500 - 62,000/-) plus applicable DA, HRA, Uniform Allowance, and Special Hard Duty Forest Allowance.',
    cadreClassification: 'Class III Non-Gazetted Technical Forest Field Service',
    organisationName: 'Madhya Pradesh Employees Selection Board',
    organisationShortName: 'MPESB',
    organisationUrl: 'https://esb.mp.gov.in',
    organisationSlug: 'mpesb',
    applicationStart: '2026-02-28',
    applicationEnd: '2026-04-30',
    examDate: '2026-06-04',
    validationStatus: 'VALID',
    selectionStages: [
      { name: 'Stage 1: Written Examination (CBT)', desc: '100 marks online test comprising General Knowledge, Hindi, English, Mathematics, and General Science.' },
      { name: 'Stage 2: Physical Standard & Walking Test', desc: 'Mandatory 25 km walk in 4 hours for male candidates, 14 km walk in 4 hours for female candidates (Qualifying only).' },
      { name: 'Stage 3: Document & Biometric Verification', desc: 'District forest circle verification of 10th marksheet, domicile certificate, and biometric logs.' },
    ],
    vacanciesList: [
      { category: 'General / Unreserved (UR)', code: 'UR', count: 570, pct: '27%', quotaPct: '27%' },
      { category: 'Other Backward Classes (OBC)', code: 'OBC', count: 570, pct: '27%', quotaPct: '27%' },
      { category: 'Scheduled Tribes (ST)', code: 'ST', count: 422, pct: '20%', quotaPct: '20%' },
      { category: 'Scheduled Castes (SC)', code: 'SC', count: 338, pct: '16%', quotaPct: '16%' },
      { category: 'Economically Weaker Section (EWS)', code: 'EWS', count: 212, pct: '10%', quotaPct: '10%' },
    ],
    importantDatesList: [
      { event: 'Notification Released', desc: 'Rulebook Published on Portal', date: '20 Feb 2026', status: 'Completed', eventType: 'NOTIFICATION' },
      { event: 'Applications Open', desc: 'Application Window Commenced', date: '28 Feb 2026', status: 'Completed', eventType: 'APPLICATION_START' },
      { event: 'Last Date to Apply', desc: 'Revised Online Submission Deadline', date: '30 Apr 2026', status: 'Completed', eventType: 'APPLICATION_END' },
      { event: 'Written Exam Date', desc: 'Direct Recruitment CBT Examination (4-19 Jun)', date: '04 Jun 2026', status: 'Completed', eventType: 'EXAM_DATE' },
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
      qualificationDetailsMarkdown: 'Must have passed High School (10th standard) from Madhya Pradesh Board of Secondary Education or any recognized State/Central board.',
      relaxationNotesMarkdown: '5 years upper age relaxation for SC/ST and female candidates domiciled in MP.',
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
    payScaleOverride: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    salaryDetailsMarkdown: 'Level 4 ministerial scale with standard state government allowances.',
    cadreClassification: 'Class III Ministerial Secretariat Cadre',
    organisationName: 'Madhya Pradesh Employees Selection Board',
    organisationShortName: 'MPESB',
    organisationUrl: 'https://esb.mp.gov.in',
    organisationSlug: 'mpesb',
    applicationStart: '2026-09-10',
    applicationEnd: '2026-10-18',
    examDate: '2026-12-05',
    validationStatus: 'PENDING',
    selectionStages: [
      { name: 'Stage 1: Written Examination', desc: '100 marks objective examination testing General Knowledge, Hindi, English, and Basic Computers.' },
      { name: 'Stage 2: CPCT & Typing Verification', desc: 'Verification of qualifying CPCT scorecard with mandatory Hindi typing speed.' }
    ],
    vacanciesList: [
      { category: 'General / Unreserved (UR)', code: 'UR', count: 384, pct: '27%', quotaPct: '27%' },
      { category: 'Other Backward Classes (OBC)', code: 'OBC', count: 384, pct: '27%', quotaPct: '27%' },
      { category: 'Scheduled Tribes (ST)', code: 'ST', count: 284, pct: '20%', quotaPct: '20%' },
      { category: 'Scheduled Castes (SC)', code: 'SC', count: 227, pct: '16%', quotaPct: '16%' },
      { category: 'Economically Weaker Section (EWS)', code: 'EWS', count: 141, pct: '10%', quotaPct: '10%' },
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
      qualificationDetailsMarkdown: 'Higher Secondary (10+2) certificate from recognized board along with 1-year Diploma in Computer Application (DCA/PGDCA).',
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
    overviewMarkdown: 'The High Court of Madhya Pradesh invites online applications for recruitment to the posts of Junior Judicial Assistant (JJA) and District Court Assistant Grade-III. Testing evaluates speed and accuracy in computer typing.',
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
    payScaleOverride: 'Rs. 19,500 - 62,000/- (Pay Matrix Level 4)',
    salaryDetailsMarkdown: 'Basic Pay Rs. 19,500/- (Level 4) + High Court Special Judicial Allowance + DA + HRA.',
    cadreClassification: 'Subordinate Judiciary Ministerial Cadre (Class III)',
    organisationName: 'High Court of Madhya Pradesh',
    organisationShortName: 'MPHC',
    organisationUrl: 'https://mphc.gov.in',
    organisationSlug: 'mphc',
    applicationStart: '2026-09-20',
    applicationEnd: '2026-11-05',
    examDate: '2026-12-12',
    validationStatus: 'PENDING',
    selectionStages: [
      { name: 'Stage 1: Preliminary Online Screening Test', desc: 'General English, General Knowledge, Computer Knowledge (40 marks).' },
      { name: 'Stage 2: Typing Skill Test', desc: 'Hindi typing (350 words in 10 minutes) and English typing (400 words in 10 minutes) on computer with formatting.' },
      { name: 'Stage 3: Document Verification', desc: 'Scrutiny of Graduation degree, CPCT scorecard, and computer proficiency certificate.' },
    ],
    vacanciesList: [
      { category: 'General / Unreserved (UR)', code: 'UR', count: 490, pct: '50%', quotaPct: '50%' },
      { category: 'Scheduled Tribes (ST)', code: 'ST', count: 196, pct: '20%', quotaPct: '20%' },
      { category: 'Scheduled Castes (SC)', code: 'SC', count: 157, pct: '16%', quotaPct: '16%' },
      { category: 'Other Backward Classes (OBC)', code: 'OBC', count: 137, pct: '14%', quotaPct: '14%' },
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
      qualificationDetailsMarkdown: 'Must hold a Bachelor Degree in any discipline from a recognized University, with valid CPCT scorecard and 1-year Computer Diploma.',
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
    overviewMarkdown: 'The Madhya Pradesh Employees Selection Board conducts the Group-2 Sub-Group-4 Combined Recruitment Test 2026 for 3,550 vacancies covering Patwari (Land Records), Revenue Inspector, and allied executive posts across all 55 districts.',
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
    payScaleOverride: 'Rs. 25,300 - 80,500/- (Pay Matrix Level 6)',
    salaryDetailsMarkdown: 'Basic Pay Rs. 25,300/- (Level 6) + Dearness Allowance (DA) + Travelling Allowance (TA) + Mobile/Stationery allowance. 3-year statutory probation terms apply.',
    cadreClassification: 'Class III Non-Gazetted Revenue Executive Cadre',
    organisationName: 'Madhya Pradesh Employees Selection Board',
    organisationShortName: 'MPESB',
    organisationUrl: 'https://esb.mp.gov.in',
    organisationSlug: 'mpesb',
    applicationStart: '2026-08-04',
    applicationEnd: '2026-08-21',
    examDate: '2026-09-22',
    validationStatus: 'VALID',
    selectionStages: [
      { name: 'Stage 1: Combined Written Examination (CBT)', desc: '200 marks multi-section paper covering General Science, Hindi, English, Maths, General Knowledge, Computer Knowledge, and Management.' },
      { name: 'Stage 2: District Preference & Counselling', desc: 'Merit-based district allocation followed by revenue board certificate scrutiny and CPCT score validation.' },
    ],
    vacanciesList: [
      { category: 'General / Unreserved (UR)', code: 'UR', count: 960, pct: '27%', quotaPct: '27%', subPostName: 'Patwari & Revenue Staff' },
      { category: 'Other Backward Classes (OBC)', code: 'OBC', count: 957, pct: '27%', quotaPct: '27%', subPostName: 'Patwari & Revenue Staff' },
      { category: 'Scheduled Tribes (ST)', code: 'ST', count: 710, pct: '20%', quotaPct: '20%', subPostName: 'Patwari & Revenue Staff' },
      { category: 'Scheduled Castes (SC)', code: 'SC', count: 568, pct: '16%', quotaPct: '16%', subPostName: 'Patwari & Revenue Staff' },
      { category: 'Economically Weaker Section (EWS)', code: 'EWS', count: 355, pct: '10%', quotaPct: '10%', subPostName: 'Patwari & Revenue Staff' },
    ],
    importantDatesList: [
      { event: 'Notification Released', desc: 'Rulebook Gazetted on MPESB Portal', date: '25 Jul 2026', status: 'Completed', eventType: 'NOTIFICATION' },
      { event: 'Applications Open', desc: 'Online Registration Commenced', date: '04 Aug 2026', status: 'Completed', eventType: 'APPLICATION_START' },
      { event: 'Last Date to Apply', desc: 'Closing Date for Submission (Extended)', date: '21 Aug 2026', status: 'Completed', eventType: 'APPLICATION_END' },
      { event: 'Rectification Window', desc: 'Online Error Correction Closed', date: '23 Aug 2026', status: 'Completed', eventType: 'CORRECTION_END' },
      { event: 'Written Exam Date', desc: 'Combined Group-2 Sub-Group-4 CBT Exam Commences', date: '22 Sep 2026', status: 'Upcoming', eventType: 'EXAM_DATE' },
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
      qualificationDetailsMarkdown: 'Graduation in any discipline from a recognized University. CPCT scorecard with Hindi typing is mandatory (or allowable within probation period where specified by GAD circular).',
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
    overviewMarkdown: 'The Madhya Pradesh Public Service Commission (MPPSC) conducts the State Services Examination (SSE) 2026 for prestigious administrative posts including Deputy Collector, Deputy Superintendent of Police (DSP), Commercial Tax Officer, and Chief Municipal Officer.',
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
    payScaleOverride: 'Rs. 56,100 - 1,77,500/- (Pay Matrix Level 12)',
    salaryDetailsMarkdown: 'Pay Matrix Level 12 (Junior Scale Gazetted), Basic Pay Rs. 56,100/- plus 50% DA, HRA, vehicle/conveyance allowance, and executive medical facilities.',
    cadreClassification: 'State Gazetted Executive Service (Class II Gazetted)',
    organisationName: 'Madhya Pradesh Public Service Commission',
    organisationShortName: 'MPPSC',
    organisationUrl: 'https://mppsc.mp.gov.in',
    organisationSlug: 'mppsc',
    applicationStart: '2026-09-15',
    applicationEnd: '2026-10-28',
    examDate: '2026-12-20',
    validationStatus: 'PENDING',
    selectionStages: [
      { name: 'Stage 1: State Service Preliminary Examination', desc: 'Two objective papers (General Studies - 200 marks, CSAT - 200 marks). CSAT is qualifying (40% for UR, 30% for reserved).' },
      { name: 'Stage 2: State Service Main Examination (Written)', desc: 'Six descriptive papers (GS I-IV, General Hindi & Grammar, Hindi Essay & Drafting) totalling 1,500 marks.' },
      { name: 'Stage 3: Personality Test (Interview)', desc: '175 marks viva-voce before the MPPSC interview board. Final merit list is calculated out of 1,675 marks.' },
    ],
    vacanciesList: [
      { category: 'General / Unreserved (UR)', code: 'UR', count: 96, pct: '27%', quotaPct: '27%' },
      { category: 'Other Backward Classes (OBC)', code: 'OBC', count: 96, pct: '27%', quotaPct: '27%' },
      { category: 'Scheduled Tribes (ST)', code: 'ST', count: 71, pct: '20%', quotaPct: '20%' },
      { category: 'Scheduled Castes (SC)', code: 'SC', count: 57, pct: '16%', quotaPct: '16%' },
      { category: 'Economically Weaker Section (EWS)', code: 'EWS', count: 36, pct: '10%', quotaPct: '10%' },
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
      qualificationDetailsMarkdown: 'Graduation degree in any discipline from a University established by Law in India or recognized equivalent.',
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
    sourcesList: [
      { sourceType: 'OFFICIAL_NOTIFICATION_PDF', sourceUrl: 'https://esb.mp.gov.in', sourceTitle: 'Pending Group-5 / Nursing Officer Cycle Gazette Reconciliation', publicationDate: null, lastVerifiedAt: '2026-09-18', status: 'PENDING' },
    ],
    officialLinksList: [
      { linkType: 'PORTAL', title: 'MPESB Official Portal', url: 'https://esb.mp.gov.in', isActive: 1 },
    ],
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
    sourcesList: [
      { sourceType: 'OFFICIAL_NOTIFICATION_PDF', sourceUrl: 'https://esb.mp.gov.in/Rulebooks/RB_2026/Subedar_SI_2026_RuleBook.pdf', sourceTitle: 'MPESB Subedar and Sub-Inspector Recruitment Test 2026 Detailed Rulebook', publicationDate: '2026-09-01', lastVerifiedAt: '2026-09-18', status: 'VALID' },
    ],
    officialLinksList: [
      { linkType: 'APPLY_ONLINE', title: 'Apply Online (MPOnline Portal)', url: 'https://esb.mponline.gov.in', isActive: 1 },
      { linkType: 'NOTIFICATION_PDF', title: 'Download Official SI Rulebook PDF', url: 'https://esb.mp.gov.in/Rulebooks/RB_2026/Subedar_SI_2026_RuleBook.pdf', isActive: 1 },
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
    sourcesList: [
      { sourceType: 'OFFICIAL_NOTIFICATION_PDF', sourceUrl: 'https://esb.mp.gov.in/Rulebooks/RB_2026/TET_Primary_2026_RuleBook.pdf', sourceTitle: 'MP Primary & Middle School Teacher Eligibility Test 2026 Rulebook', publicationDate: '2026-08-10', lastVerifiedAt: '2026-09-18', status: 'VALID' },
    ],
    officialLinksList: [
      { linkType: 'APPLY_ONLINE', title: 'Apply Online (MPOnline Portal)', url: 'https://esb.mponline.gov.in', isActive: 1 },
      { linkType: 'NOTIFICATION_PDF', title: 'Download Teacher TET Rulebook PDF', url: 'https://esb.mp.gov.in/Rulebooks/RB_2026/TET_Primary_2026_RuleBook.pdf', isActive: 1 },
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

export const FALLBACK_RECRUITMENTS: RecruitmentWithDetails[] = RAW_FALLBACK_RECRUITMENTS.map(enrichRecruitmentWithLifecycle);

/**
 * Fetch all master sectors
 */
export async function getAllSectors(providedD1?: D1Database): Promise<MasterSector[]> {
  const d1 = resolveD1(providedD1, 'loading sectors');
  if (!d1) return FALLBACK_SECTORS;

  try {
    const db = getDb(d1);
    const rows = await db.query.sectors.findMany({
      orderBy: [asc(schema.sectors.displayOrder), asc(schema.sectors.name)],
    });
    return rows.length > 0 ? rows : FALLBACK_SECTORS;
  } catch (error) {
    console.warn('Error fetching sectors from D1, using fallback:', error);
    return FALLBACK_SECTORS;
  }
}

/**
 * Fetch all master departments
 */
export async function getAllDepartments(providedD1?: D1Database): Promise<MasterDepartment[]> {
  const d1 = resolveD1(providedD1, 'loading departments');
  if (!d1) return FALLBACK_DEPARTMENTS;

  try {
    const db = getDb(d1);
    const rows = await db.query.departments.findMany({
      where: eq(schema.departments.isActive, 1),
      orderBy: [asc(schema.departments.name)],
    });
    return rows.length > 0 ? rows : FALLBACK_DEPARTMENTS;
  } catch (error) {
    console.warn('Error fetching departments from D1, using fallback:', error);
    return FALLBACK_DEPARTMENTS;
  }
}

/**
 * Fetch all canonical posts joined with department and sector
 */
export async function getAllCanonicalPosts(providedD1?: D1Database): Promise<CanonicalPostWithDetails[]> {
  const d1 = resolveD1(providedD1, 'loading canonical posts');
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

    if (rows.length === 0) return FALLBACK_POSTS;

    return rows.map((p: any) => ({
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
    console.warn('Error fetching canonical posts from D1, using fallback:', error);
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
  const d1 = resolveD1(providedD1, 'updating a canonical post');

  if (!d1) {
    const fallbackIndex = FALLBACK_POSTS.findIndex(p => p.id === data.id);
    if (fallbackIndex === -1) return false;
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
    return true;
  }

  try {
    const db = getDb(d1);
    const updateSet: Record<string, any> = {};
    if (data.sectorId !== undefined) updateSet.sectorId = data.sectorId;
    if (data.departmentId !== undefined) updateSet.departmentId = data.departmentId;
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
    throw error;
  }
}

/**
 * Create a new canonical post in Master Records
 */
export async function createCanonicalPost(
  data: Omit<CanonicalPostWithDetails, 'id'> & { id?: string },
  providedD1?: D1Database
): Promise<string> {
  const d1 = resolveD1(providedD1, 'creating a canonical post');
  const newId = data.id || `post_${crypto.randomUUID()}`;
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

  if (!d1) {
    FALLBACK_POSTS.unshift(newPost);
    return newId;
  }

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
    throw error;
  }
}

/**
 * Fetch all published recruitments with dynamic post details
 */
export async function getAllActiveRecruitments(
  providedD1?: D1Database,
  options: { includeUnpublished?: boolean; stateId?: string; limit?: number } = {}
): Promise<RecruitmentWithDetails[]> {
  const d1 = resolveD1(providedD1, 'loading recruitments');
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
        post: { with: { department: { with: { organisation: true } }, sector: true } },
        organisation: true,
        eligibility: true,
        importantDates: true,
        vacancies: true,
        sources: true,
        officialLinks: true,
      },
      orderBy: [desc(schema.recruitments.isFeatured), desc(schema.recruitments.createdAt)],
      limit: Math.min(Math.max(options.limit ?? 100, 1), 250),
    };

    const filters = [];
    if (!includeUnpublished) filters.push(eq(schema.recruitments.status, 'PUBLISHED'));
    if (options.stateId) filters.push(eq(schema.recruitments.stateId, options.stateId));
    if (filters.length === 1) queryOpts.where = filters[0];
    if (filters.length > 1) queryOpts.where = and(...filters);

    const rows = await db.query.recruitments.findMany(queryOpts) as any[];
    if (rows.length === 0) return FALLBACK_RECRUITMENTS;
    return rows.map(mapDbRecruitmentToDetails);
  } catch (error) {
    console.warn('Error querying D1 recruitments, using fallback:', error);
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
  const d1 = resolveD1(providedD1, 'loading organisations');
  if (!d1) return FALLBACK_ORGANISATIONS;
  try {
    const db = getDb(d1);
    const orgs = await db.query.organisations.findMany({
      where: eq(schema.organisations.isActive, 1),
      orderBy: [asc(schema.organisations.name)],
    });
    if (orgs.length === 0) return FALLBACK_ORGANISATIONS;
    return orgs.map((o: any) => {
      return {
        id: o.id,
        stateId: o.stateId,
        name: o.name,
        shortName: o.shortName,
        slug: o.slug,
        websiteUrl: o.websiteUrl,
        isActive: o.isActive,
        initials: o.shortName.slice(0, 3).toUpperCase(),
        domain: new URL(o.websiteUrl).hostname,
        description: `${o.name} is an official recruitment organisation.`,
      };
    });
  } catch (err) {
    console.warn('Error querying organisations from D1, using fallback:', err);
    return FALLBACK_ORGANISATIONS;
  }
}

export async function createOrganisation(
  data: { stateId: string; name: string; shortName: string; slug: string; websiteUrl: string; isActive?: number; adminEmail: string },
  providedD1?: D1Database
): Promise<string> {
  const d1 = resolveD1(providedD1, 'creating an organisation');
  const id = `org_${crypto.randomUUID()}`;
  if (!d1) {
    FALLBACK_ORGANISATIONS.push({ id, ...data, isActive: data.isActive ?? 1 });
    return id;
  }
  const db = getDb(d1);
  await db.batch([
    db.insert(schema.organisations).values({ id, stateId: data.stateId, name: data.name, shortName: data.shortName, slug: data.slug, websiteUrl: data.websiteUrl, isActive: data.isActive ?? 1 }),
    db.insert(schema.auditLogs).values({ id: `audit_${crypto.randomUUID()}`, adminEmail: data.adminEmail, entity: 'ORGANISATION', entityId: id, action: 'CREATE', newValue: data.name, source: data.websiteUrl }),
  ]);
  return id;
}

export async function updateOrganisation(
  data: { id: string; stateId?: string; name?: string; shortName?: string; slug?: string; websiteUrl?: string; isActive?: number; adminEmail: string },
  providedD1?: D1Database
): Promise<boolean> {
  const d1 = resolveD1(providedD1, 'updating an organisation');
  if (!d1) {
    const idx = FALLBACK_ORGANISATIONS.findIndex(o => o.id === data.id);
    if (idx === -1) return false;
    FALLBACK_ORGANISATIONS[idx] = {
      ...FALLBACK_ORGANISATIONS[idx],
      ...(data.name ? { name: data.name } : {}),
      ...(data.shortName ? { shortName: data.shortName } : {}),
      ...(data.slug ? { slug: data.slug } : {}),
      ...(data.stateId ? { stateId: data.stateId } : {}),
      ...(data.websiteUrl ? { websiteUrl: data.websiteUrl } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    };
    return true;
  }
  const db = getDb(d1);
  const updateSet: Record<string, any> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.shortName !== undefined) updateSet.shortName = data.shortName;
  if (data.slug !== undefined) updateSet.slug = data.slug;
  if (data.stateId !== undefined) updateSet.stateId = data.stateId;
  if (data.websiteUrl !== undefined) updateSet.websiteUrl = data.websiteUrl;
  if (data.isActive !== undefined) updateSet.isActive = data.isActive;
  await db.update(schema.organisations).set(updateSet).where(eq(schema.organisations.id, data.id));
  return true;
}

export async function createDepartment(
  data: { organisationId: string; name: string; slug: string; description?: string; isActive?: number; adminEmail: string },
  providedD1?: D1Database
): Promise<string> {
  const d1 = resolveD1(providedD1, 'creating a department');
  const id = `dept_${crypto.randomUUID()}`;
  if (!d1) {
    FALLBACK_DEPARTMENTS.push({ id, organisationId: data.organisationId, name: data.name, slug: data.slug, description: data.description || null, isActive: data.isActive ?? 1 });
    return id;
  }
  const db = getDb(d1);
  await db.batch([
    db.insert(schema.departments).values({ id, organisationId: data.organisationId, name: data.name, slug: data.slug, description: data.description || null, isActive: data.isActive ?? 1 }),
    db.insert(schema.auditLogs).values({ id: `audit_${crypto.randomUUID()}`, adminEmail: data.adminEmail, entity: 'DEPARTMENT', entityId: id, action: 'CREATE', newValue: data.name }),
  ]);
  return id;
}

export async function updateDepartment(
  data: { id: string; organisationId?: string; name?: string; slug?: string; description?: string; isActive?: number; adminEmail: string },
  providedD1?: D1Database
): Promise<boolean> {
  const d1 = resolveD1(providedD1, 'updating a department');
  if (!d1) {
    const idx = FALLBACK_DEPARTMENTS.findIndex(d => d.id === data.id);
    if (idx === -1) return false;
    FALLBACK_DEPARTMENTS[idx] = {
      ...FALLBACK_DEPARTMENTS[idx],
      ...(data.name ? { name: data.name } : {}),
      ...(data.slug ? { slug: data.slug } : {}),
      ...(data.organisationId ? { organisationId: data.organisationId } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    };
    return true;
  }
  const db = getDb(d1);
  const updateSet: Record<string, any> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.slug !== undefined) updateSet.slug = data.slug;
  if (data.organisationId !== undefined) updateSet.organisationId = data.organisationId;
  if (data.description !== undefined) updateSet.description = data.description;
  if (data.isActive !== undefined) updateSet.isActive = data.isActive;
  await db.update(schema.departments).set(updateSet).where(eq(schema.departments.id, data.id));
  return true;
}

export async function getAllStates(providedD1?: D1Database): Promise<Array<{ id: string; name: string; code: string; slug: string }>> {
  const d1 = resolveD1(providedD1, 'loading states');
  if (!d1) return [{ id: 'st_mp', name: 'Madhya Pradesh', code: 'MP', slug: 'madhya-pradesh' }];
  try {
    const db = getDb(d1);
    const rows = await db.select({ id: schema.states.id, name: schema.states.name, code: schema.states.code, slug: schema.states.slug }).from(schema.states).orderBy(asc(schema.states.name));
    return rows.length > 0 ? rows : [{ id: 'st_mp', name: 'Madhya Pradesh', code: 'MP', slug: 'madhya-pradesh' }];
  } catch (err) {
    console.warn('Error loading states from D1, using fallback:', err);
    return [{ id: 'st_mp', name: 'Madhya Pradesh', code: 'MP', slug: 'madhya-pradesh' }];
  }
}

export async function getAuditLogs(providedD1?: D1Database, limit = 100): Promise<typeof FALLBACK_AUDIT_LOGS> {
  const d1 = resolveD1(providedD1, 'loading audit logs');
  if (!d1) return FALLBACK_AUDIT_LOGS.slice(0, limit);
  const db = getDb(d1);
  return db.query.auditLogs.findMany({ orderBy: [desc(schema.auditLogs.createdAt)], limit: Math.min(Math.max(limit, 1), 500) }) as any;
}

export async function verifySource(sourceId: string, adminEmail: string, note: string, providedD1?: D1Database): Promise<boolean> {
  const d1 = resolveD1(providedD1, 'verifying a source');
  if (!d1) {
    const source = FALLBACK_DOCUMENTS.find(document => document.id === sourceId);
    if (!source) return false;
    source.lastVerifiedAt = new Date();
    source.verification = 'Verified';
    FALLBACK_AUDIT_LOGS.unshift({
      id: `audit_${crypto.randomUUID()}`,
      adminEmail,
      entity: 'SOURCE',
      entityId: sourceId,
      action: 'VERIFY',
      reason: note || 'Official source re-verified by an administrator.',
      createdAt: new Date(),
    } as any);
    return true;
  }
  const db = getDb(d1);
  const source = await db.query.sources.findFirst({ where: eq(schema.sources.id, sourceId) });
  if (!source) return false;
  await db.batch([
    db.update(schema.sources).set({ lastVerifiedAt: sql`(unixepoch())` }).where(eq(schema.sources.id, sourceId)),
    db.insert(schema.auditLogs).values({ id: `audit_${crypto.randomUUID()}`, adminEmail, entity: 'SOURCE', entityId: sourceId, action: 'VERIFY', reason: note || 'Official source re-verified by an administrator.' }),
  ]);
  return true;
}

export interface DocumentItem {
  id: string;
  recruitmentId: string;
  recruitment: string;
  title: string;
  sourceType: string;
  type: string;
  url: string;
  publishedDate: string;
  publicationDateRaw: string;
  verification: 'Verified' | 'Needs review';
  lastVerifiedAt: Date | string | null;
  updated: string;
}

function normalizeSourceType(type: string): string {
  const t = (type || '').toUpperCase().replace(/\s+/g, '_');
  if (t.includes('CORRECTION') || t.includes('CORRIGENDUM') || t.includes('RELAXATION')) return 'CORRECTION_NOTICE';
  if (t.includes('ADMIT')) return 'ADMIT_CARD';
  if (t.includes('KEY') || t.includes('ANSWER')) return 'ANSWER_KEY';
  if (t.includes('SYLLABUS')) return 'SYLLABUS';
  return 'OFFICIAL_NOTIFICATION_PDF';
}

function formatSourceTypeLabel(sourceType: string): string {
  switch (sourceType) {
    case 'CORRECTION_NOTICE': return 'Correction notice';
    case 'ADMIT_CARD': return 'Admit card';
    case 'ANSWER_KEY': return 'Answer key';
    case 'SYLLABUS': return 'Syllabus';
    case 'OFFICIAL_NOTIFICATION_PDF':
    case 'GOVT_GAZETTE':
    default:
      return 'Notification';
  }
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export const FALLBACK_DOCUMENTS: DocumentItem[] = [
  {
    id: 'src_doc_constable_notif',
    recruitmentId: 'rec_mp_constable_2026',
    recruitment: 'MP Police Constable Recruitment 2026',
    title: 'MP Police Constable 2026 Gazette Notification',
    sourceType: 'OFFICIAL_NOTIFICATION_PDF',
    type: 'Notification',
    url: 'https://esb.mp.gov.in/notices/police_rulebook_2026.pdf',
    publishedDate: '15 Sep 2026',
    publicationDateRaw: '2026-09-15',
    verification: 'Verified',
    lastVerifiedAt: new Date('2026-09-18'),
    updated: '18 Sep 2026',
  },
  {
    id: 'src_doc_constable_corr',
    recruitmentId: 'rec_mp_constable_2026',
    recruitment: 'MP Police Constable Recruitment 2026',
    title: 'Police Constable Category Relaxation Corrigendum',
    sourceType: 'CORRECTION_NOTICE',
    type: 'Correction notice',
    url: 'https://esb.mp.gov.in/notices/corrigendum_01_police.pdf',
    publishedDate: '18 Sep 2026',
    publicationDateRaw: '2026-09-18',
    verification: 'Needs review',
    lastVerifiedAt: null,
    updated: '18 Sep 2026',
  },
  {
    id: 'src_doc_forest_notif',
    recruitmentId: 'rec_mp_forest_guard_2026',
    recruitment: 'Forest Guard Recruitment 2026',
    title: 'MP Forest Guard 2026 Official Rulebook',
    sourceType: 'OFFICIAL_NOTIFICATION_PDF',
    type: 'Notification',
    url: 'https://esb.mp.gov.in/notices/forest_guard_2026.pdf',
    publishedDate: '10 Sep 2026',
    publicationDateRaw: '2026-09-10',
    verification: 'Verified',
    lastVerifiedAt: new Date('2026-09-17'),
    updated: '17 Sep 2026',
  },
  {
    id: 'src_doc_ag3_syllabus',
    recruitmentId: 'rec_mp_jja_court_2026',
    recruitment: 'Assistant Grade III Recruitment 2026',
    title: 'Assistant Grade III High Court Examination Syllabus',
    sourceType: 'SYLLABUS',
    type: 'Syllabus',
    url: 'https://mphc.gov.in/recruitment/ag3_syllabus_2026.pdf',
    publishedDate: '12 Sep 2026',
    publicationDateRaw: '2026-09-12',
    verification: 'Verified',
    lastVerifiedAt: new Date('2026-09-16'),
    updated: '16 Sep 2026',
  },
  {
    id: 'src_doc_sse_answerkey',
    recruitmentId: 'rec_mp_mppsc_sse_2026',
    recruitment: 'MPPSC State Service Examination 2026',
    title: 'MPPSC State Service Prelims Provisional Answer Key',
    sourceType: 'ANSWER_KEY',
    type: 'Answer key',
    url: 'https://mppsc.mp.gov.in/keys/sse_prelims_key_2026.pdf',
    publishedDate: '12 Sep 2026',
    publicationDateRaw: '2026-09-12',
    verification: 'Verified',
    lastVerifiedAt: new Date('2026-09-15'),
    updated: '15 Sep 2026',
  },
];

export async function getAllDocuments(providedD1?: D1Database): Promise<DocumentItem[]> {
  const d1 = resolveD1(providedD1, 'loading documents');
  if (d1) {
    try {
      const db = getDb(d1);
      const rows = await db.query.sources.findMany({
        with: { recruitment: true },
        orderBy: [desc(schema.sources.lastVerifiedAt), desc(schema.sources.publicationDate)],
      }) as any[];
      if (rows && rows.length > 0) {
        return rows.map(r => ({
          id: r.id,
          recruitmentId: r.recruitmentId,
          recruitment: r.recruitment?.title || 'Linked Recruitment',
          title: r.sourceTitle,
          sourceType: r.sourceType,
          type: formatSourceTypeLabel(r.sourceType),
          url: r.sourceUrl,
          publishedDate: formatDateDisplay(r.publicationDate),
          publicationDateRaw: r.publicationDate || '',
          verification: r.lastVerifiedAt ? 'Verified' : 'Needs review',
          lastVerifiedAt: r.lastVerifiedAt,
          updated: formatDateDisplay(r.lastVerifiedAt || r.publicationDate),
        }));
      }
    } catch (err) {
      console.warn('Error querying sources from D1, using fallback documents:', err);
    }
  }
  return FALLBACK_DOCUMENTS;
}

export async function createDocument(
  data: {
    recruitmentId: string;
    title: string;
    sourceType: string;
    sourceUrl: string;
    publicationDate?: string;
    adminEmail: string;
  },
  providedD1?: D1Database
): Promise<string> {
  const d1 = resolveD1(providedD1, 'creating document');
  const id = `src_${crypto.randomUUID()}`;
  const normType = normalizeSourceType(data.sourceType);
  const typeLabel = formatSourceTypeLabel(normType);
  const pubDateRaw = data.publicationDate || new Date().toISOString().split('T')[0];
  const pubDateDisplay = formatDateDisplay(pubDateRaw);
  const recs = await getAllActiveRecruitments(providedD1, { includeUnpublished: true });
  const rec = recs.find(r => r.id === data.recruitmentId);
  const recTitle = rec?.title || 'Official Recruitment';

  const newDoc: DocumentItem = {
    id,
    recruitmentId: data.recruitmentId,
    recruitment: recTitle,
    title: data.title,
    sourceType: normType,
    type: typeLabel,
    url: data.sourceUrl,
    publishedDate: pubDateDisplay,
    publicationDateRaw: pubDateRaw,
    verification: 'Verified',
    lastVerifiedAt: new Date(),
    updated: formatDateDisplay(new Date().toISOString()),
  };

  if (!d1) {
    FALLBACK_DOCUMENTS.unshift(newDoc);
    FALLBACK_AUDIT_LOGS.unshift({
      id: `audit_${crypto.randomUUID()}`,
      adminEmail: data.adminEmail,
      entity: 'SOURCE',
      entityId: id,
      action: 'CREATE',
      field: 'title',
      oldValue: null,
      newValue: data.title,
      reason: 'New document link attached to recruitment',
      source: data.sourceUrl,
      createdAt: new Date(),
    } as any);
    return id;
  }

  const db = getDb(d1);
  await db.batch([
    db.insert(schema.sources).values({
      id,
      recruitmentId: data.recruitmentId,
      sourceType: normType,
      sourceUrl: data.sourceUrl,
      sourceTitle: data.title,
      publicationDate: pubDateRaw,
      lastVerifiedAt: sql`(unixepoch())`,
    }),
    db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      adminEmail: data.adminEmail,
      entity: 'SOURCE',
      entityId: id,
      action: 'CREATE',
      field: 'title',
      newValue: data.title,
      reason: 'New official document attached',
      source: data.sourceUrl,
    }),
  ]);

  return id;
}

export async function updateDocument(
  data: {
    id: string;
    recruitmentId?: string;
    title?: string;
    sourceType?: string;
    sourceUrl?: string;
    publicationDate?: string;
    adminEmail: string;
  },
  providedD1?: D1Database
): Promise<boolean> {
  const d1 = resolveD1(providedD1, 'updating document');
  const normType = data.sourceType ? normalizeSourceType(data.sourceType) : undefined;
  const typeLabel = normType ? formatSourceTypeLabel(normType) : undefined;
  const pubDateDisplay = data.publicationDate ? formatDateDisplay(data.publicationDate) : undefined;

  let recTitle: string | undefined = undefined;
  if (data.recruitmentId) {
    const recs = await getAllActiveRecruitments(providedD1, { includeUnpublished: true });
    recTitle = recs.find(r => r.id === data.recruitmentId)?.title;
  }

  if (!d1) {
    const idx = FALLBACK_DOCUMENTS.findIndex(d => d.id === data.id);
    if (idx === -1) return false;
    FALLBACK_DOCUMENTS[idx] = {
      ...FALLBACK_DOCUMENTS[idx],
      ...(data.recruitmentId ? { recruitmentId: data.recruitmentId } : {}),
      ...(recTitle ? { recruitment: recTitle } : {}),
      ...(data.title ? { title: data.title } : {}),
      ...(normType ? { sourceType: normType, type: typeLabel! } : {}),
      ...(data.sourceUrl ? { url: data.sourceUrl } : {}),
      ...(data.publicationDate ? { publicationDateRaw: data.publicationDate, publishedDate: pubDateDisplay! } : {}),
      updated: formatDateDisplay(new Date().toISOString()),
    };
    FALLBACK_AUDIT_LOGS.unshift({
      id: `audit_${crypto.randomUUID()}`,
      adminEmail: data.adminEmail,
      entity: 'SOURCE',
      entityId: data.id,
      action: 'UPDATE',
      field: 'title',
      newValue: data.title || FALLBACK_DOCUMENTS[idx].title,
      reason: 'Document details updated',
      createdAt: new Date(),
    } as any);
    return true;
  }

  const db = getDb(d1);
  const existing = await db.query.sources.findFirst({ where: eq(schema.sources.id, data.id) });
  if (!existing) return false;
  const updateSet: Record<string, any> = {};
  if (data.recruitmentId) updateSet.recruitmentId = data.recruitmentId;
  if (data.title) updateSet.sourceTitle = data.title;
  if (normType) updateSet.sourceType = normType;
  if (data.sourceUrl) updateSet.sourceUrl = data.sourceUrl;
  if (data.publicationDate) updateSet.publicationDate = data.publicationDate;
  updateSet.lastVerifiedAt = sql`(unixepoch())`;

  await db.batch([
    db.update(schema.sources).set(updateSet).where(eq(schema.sources.id, data.id)),
    db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      adminEmail: data.adminEmail,
      entity: 'SOURCE',
      entityId: data.id,
      action: 'UPDATE',
      reason: 'Document updated by administrator',
      newValue: data.title || '',
    }),
  ]);

  return true;
}

export async function deleteDocument(
  data: { id: string; adminEmail: string },
  providedD1?: D1Database
): Promise<boolean> {
  const d1 = resolveD1(providedD1, 'deleting document');

  if (!d1) {
    const idx = FALLBACK_DOCUMENTS.findIndex(d => d.id === data.id);
    if (idx === -1) return false;
    const removed = FALLBACK_DOCUMENTS.splice(idx, 1)[0];
    FALLBACK_AUDIT_LOGS.unshift({
      id: `audit_${crypto.randomUUID()}`,
      adminEmail: data.adminEmail,
      entity: 'SOURCE',
      entityId: data.id,
      action: 'DELETE',
      field: 'title',
      oldValue: removed.title,
      reason: 'Document deleted by administrator',
      createdAt: new Date(),
    } as any);
    return true;
  }

  const db = getDb(d1);
  const existing = await db.query.sources.findFirst({ where: eq(schema.sources.id, data.id) });
  if (!existing) return false;
  await db.batch([
    db.delete(schema.sources).where(eq(schema.sources.id, data.id)),
    db.insert(schema.auditLogs).values({
      id: `audit_${crypto.randomUUID()}`,
      adminEmail: data.adminEmail,
      entity: 'SOURCE',
      entityId: data.id,
      action: 'DELETE',
      reason: 'Document link removed from system',
    }),
  ]);

  return true;
}

/**
 * Fetch a single organisation by its URL slug with linked recruitments & departments
 */
export async function getOrganisationBySlug(
  slug: string,
  providedD1?: D1Database
): Promise<(MasterOrganisation & { recruitments: RecruitmentWithDetails[]; departments: MasterDepartment[] }) | undefined> {
  const d1 = resolveD1(providedD1, 'loading an organisation');
  if (d1) {
    const db = getDb(d1);
    const org = await db.query.organisations.findFirst({ where: eq(schema.organisations.slug, slug) }) as any;
    if (!org || org.isActive !== 1) return undefined;
    const [departments, recruitmentRows] = await Promise.all([
      db.query.departments.findMany({ where: and(eq(schema.departments.organisationId, org.id), eq(schema.departments.isActive, 1)), orderBy: [asc(schema.departments.name)] }),
      db.query.recruitments.findMany({
        where: and(eq(schema.recruitments.organisationId, org.id), eq(schema.recruitments.status, 'PUBLISHED')),
        with: { post: { with: { department: { with: { organisation: true } }, sector: true } }, organisation: true, eligibility: true, vacancies: true, importantDates: true, sources: true, officialLinks: true },
        orderBy: [desc(schema.recruitments.isFeatured), desc(schema.recruitments.createdAt)],
        limit: 100,
      }) as any,
    ]);
    return {
      id: org.id, stateId: org.stateId, name: org.name, shortName: org.shortName, slug: org.slug,
      websiteUrl: org.websiteUrl, isActive: org.isActive, initials: org.shortName.slice(0, 3).toUpperCase(),
      domain: new URL(org.websiteUrl).hostname, description: `${org.name} is an official recruitment organisation.`,
      departments: departments as MasterDepartment[], recruitments: (recruitmentRows as any[]).map(mapDbRecruitmentToDetails),
    };
  }
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
  const d1 = resolveD1(providedD1, 'loading a canonical post');
  if (d1) {
    const db = getDb(d1);
    const post = await db.query.posts.findFirst({
      where: eq(schema.posts.slug, slug),
      with: { department: { with: { organisation: true } }, sector: true },
    }) as any;
    if (!post || post.isActive !== 1) return undefined;
    const rows = await db.query.recruitments.findMany({
      where: and(eq(schema.recruitments.postId, post.id), eq(schema.recruitments.status, 'PUBLISHED')),
      with: { post: { with: { department: { with: { organisation: true } }, sector: true } }, organisation: true, eligibility: true, vacancies: true, importantDates: true, sources: true, officialLinks: true },
      orderBy: [desc(schema.recruitments.createdAt)],
      limit: 100,
    }) as any[];
    return {
      id: post.id, departmentId: post.departmentId, sectorId: post.sectorId, title: post.title, slug: post.slug,
      summary: post.summary, payScale: post.payScale, defaultMinAge: post.defaultMinAge, defaultMaxAge: post.defaultMaxAge,
      defaultQualification: post.defaultQualification, isActive: post.isActive, departmentName: post.department?.name,
      sectorName: post.sector?.name, organisationName: post.department?.organisation?.name,
      activeRecruitments: rows.map(mapDbRecruitmentToDetails).map(r => ({ id: r.id, title: r.title, slug: r.slug, totalVacancies: r.totalVacancies, lifecycleStatus: r.lifecycleStatus })),
    };
  }
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
  providedD1?: D1Database,
  options: { includeUnpublished?: boolean } = {}
): Promise<RecruitmentWithDetails | undefined> {
  const d1 = resolveD1(providedD1, 'loading recruitment detail');
  if (!d1) {
    return FALLBACK_RECRUITMENTS.find(r => r.slug === slug && (options.includeUnpublished || r.status === 'PUBLISHED'));
  }

  try {
    const db = getDb(d1);
    const r = await db.query.recruitments.findFirst({
      where: options.includeUnpublished
        ? eq(schema.recruitments.slug, slug)
        : and(eq(schema.recruitments.slug, slug), eq(schema.recruitments.status, 'PUBLISHED')),
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

    return r ? mapDbRecruitmentToDetails(r) : undefined;
  } catch (err) {
    console.error('Error fetching recruitment with relations from D1:', err);
    throw err;
  }
}

/**
 * Fetch a single recruitment by its unique ID (or slug) with all relations
 */
export async function getRecruitmentById(
  id: string,
  providedD1?: D1Database
): Promise<RecruitmentWithDetails | undefined> {
  const d1 = resolveD1(providedD1, 'loading recruitment for administration');
  if (!d1) {
    return FALLBACK_RECRUITMENTS.find(r => r.id === id || r.slug === id);
  }

  try {
    const db = getDb(d1);
    const r = await db.query.recruitments.findFirst({
      where: eq(schema.recruitments.id, id),
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

    return r ? mapDbRecruitmentToDetails(r) : undefined;
  } catch (err) {
    console.error('Error fetching recruitment by id from D1:', err);
    throw err;
  }
}

/**
 * Helper to map a D1 query recruitment result with relations into RecruitmentWithDetails
 */
function mapDbRecruitmentToDetails(r: any): RecruitmentWithDetails {
  if (!r.eligibility) throw new Error(`Recruitment ${r.id} has no eligibility record.`);
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

  let selectionStages: Array<{ stage?: number; name: string; desc: string; isQualifying?: boolean }> | undefined = undefined;
  if (r.selectionStagesJson) {
    try {
      selectionStages = JSON.parse(r.selectionStagesJson);
    } catch {}
  }

  const vacanciesList = (r.vacancies || []).map((v: any) => ({
    category: v.category,
    count: v.count,
    gender: v.gender,
    pct: v.quotaPct || (r.totalVacancies > 0 ? `${Math.round((v.count / r.totalVacancies) * 100)}%` : undefined),
    code: v.category,
    quotaPct: v.quotaPct || undefined,
    subPostName: v.subPostName || undefined,
  }));

  const importantDatesList = (r.importantDates || []).map((d: any) => ({
    event: d.eventType.replace(/_/g, ' '),
    desc: d.notes || d.eventType,
    date: d.eventDate,
    status: 'Active',
    eventType: d.eventType,
    isTentative: d.isTentative,
    notes: d.notes,
  }));

  const appStartEvent = (r.importantDates || []).find((d: any) => d.eventType === 'APPLICATION_START');
  const appEndEvent = (r.importantDates || []).find((d: any) => d.eventType === 'APPLICATION_END');
  const examDateEvent = (r.importantDates || []).find((d: any) => d.eventType === 'EXAM_DATE');

  const sourcesList = (r.sources || []).map((s: any) => ({
    id: s.id,
    sourceType: s.sourceType,
    sourceUrl: s.sourceUrl,
    sourceTitle: s.sourceTitle,
    publicationDate: s.publicationDate,
    lastVerifiedAt: s.lastVerifiedAt,
  }));

  const officialLinksList = (r.officialLinks || []).map((l: any) => ({
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

  const resolvedLifecycle = resolveRecruitmentLifecycle({
    status: r.status,
    lifecycleStatus: r.lifecycleStatus,
    applicationStart: appStartEvent?.eventDate,
    applicationEnd: appEndEvent?.eventDate,
    examDate: examDateEvent?.eventDate,
    examStatus: (r as any).examStatus,
    resultStatus: (r as any).resultStatus,
    totalVacancies: r.totalVacancies,
  });
  const presentation = getLifecyclePresentation(resolvedLifecycle);

  return {
    id: r.id,
    postId: r.postId,
    advtNumber: r.advtNumber,
    title: r.title,
    slug: r.slug,
    shortSummary: r.shortSummary,
    overviewMarkdown: r.overviewMarkdown,
    cycleYear: r.cycleYear,
    totalVacancies: r.totalVacancies,
    status: r.status,
    lifecycleStatus: resolvedLifecycle,
    examStatus: (r as any).examStatus || (examDateEvent?.eventDate ? 'SCHEDULED' : 'NOT_SCHEDULED'),
    resultStatus: (r as any).resultStatus || (resolvedLifecycle === 'RESULT_DECLARED' ? 'DECLARED' : 'NOT_DECLARED'),
    resolvedLifecycle,
    presentation,
    isFeatured: r.isFeatured,
    postTitle: r.post?.title || 'State Government Post',
    postSlug: r.post?.slug || '',
    departmentName: r.post?.department?.name || 'Madhya Pradesh Department',
    departmentSlug: r.post?.department?.slug,
    sectorName: r.post?.sector?.name || 'State Cadre',
    sectorSlug: r.post?.sector?.slug,
    payScale: r.payScaleOverride || r.post?.payScale,
    payScaleOverride: r.payScaleOverride,
    salaryDetailsMarkdown: r.salaryDetailsMarkdown,
    cadreClassification: r.cadreClassification,
    organisationName: r.organisation?.name || 'Madhya Pradesh Authority',
    organisationShortName: r.organisation?.shortName || 'MP Govt',
    organisationUrl: r.organisation?.websiteUrl || 'https://esb.mp.gov.in',
    organisationSlug: r.organisation?.slug,
    applicationStart: appStartEvent?.eventDate,
    applicationEnd: appEndEvent?.eventDate,
    examDate: examDateEvent?.eventDate,
    validationStatus: r.validationStatus,
    validationErrorsJson: r.validationErrorsJson,
    selectionStages: selectionStages && selectionStages.length > 0 ? selectionStages : undefined,
    selectionStagesJson: r.selectionStagesJson,
    vacanciesList: vacanciesList.length > 0 ? vacanciesList : undefined,
    importantDatesList: importantDatesList.length > 0 ? importantDatesList : undefined,
    sourcesList: sourcesList.length > 0 ? sourcesList : undefined,
    officialLinksList: officialLinksList.length > 0 ? officialLinksList : undefined,
    canonicalPost,
    criteria: {
      minAge: r.eligibility.minAge,
      maxAgeGeneral: r.eligibility.maxAgeGeneral,
      ageCutoffDate: r.eligibility.ageCutoffDate,
      ageRelaxationScSt: r.eligibility.ageRelaxationScSt,
      ageRelaxationObc: r.eligibility.ageRelaxationObc,
      ageRelaxationFemale: r.eligibility.ageRelaxationFemale,
      ageRelaxationEws: r.eligibility.ageRelaxationEws,
      minQualificationLevel: r.eligibility.minQualificationLevel,
      allowedStreams,
      requiresMpDomicile: r.eligibility?.requiresMpDomicile === 1,
      requiresMpEmploymentReg: r.eligibility?.requiresMpEmploymentReg === 1,
      requiresCpct: r.eligibility?.requiresCpct === 1,
      genderAllowed: r.eligibility.genderAllowed as any,
      minHeightMaleCm: r.eligibility?.minHeightMaleCm,
      minHeightFemaleCm: r.eligibility?.minHeightFemaleCm,
      minChestMaleCm: r.eligibility?.minChestMaleCm,
      minPercentageRequired: r.eligibility?.minPercentageRequired ?? null,
      additionalSkills,
      qualificationDetailsMarkdown: r.eligibility?.qualificationDetailsMarkdown,
      relaxationNotesMarkdown: r.eligibility?.relaxationNotesMarkdown,
      specialConditionsNotes: r.eligibility?.specialConditionsNotes,
      experienceMonths: r.eligibility?.experienceMonths,
    },
  };
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
  stateId?: string;
  organisationId?: string;
  organisationShortName?: string;
  advtNumber: string;
  totalVacancies: number;
  shortSummary?: string;
  overviewMarkdown?: string;
  lifecycleStatus?: string;
  status?: string; // 'DRAFT' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'PUBLISHED'
  cycleYear?: number;
  payScaleOverride?: string;
  salaryDetailsMarkdown?: string;
  cadreClassification?: string;
  minAge?: number;
  maxAgeGeneral?: number;
  ageCutoffDate?: string;
  ageRelaxationScSt?: number;
  ageRelaxationObc?: number;
  ageRelaxationFemale?: number;
  ageRelaxationEws?: number;
  minQualificationLevel?: string;
  qualificationDetailsMarkdown?: string;
  relaxationNotesMarkdown?: string;
  specialConditionsNotes?: string;
  experienceMonths?: number;
  allowedStreams?: string[];
  requiresMpDomicile?: boolean;
  domicileStateCode?: string | null;
  requiresMpEmploymentReg?: boolean;
  employmentRegistrationLabel?: string | null;
  requiresCpct?: boolean;
  genderAllowed?: 'ALL' | 'MALE' | 'FEMALE';
  minHeightMaleCm?: number | null;
  minHeightFemaleCm?: number | null;
  minChestMaleCm?: number | null;
  minPercentageRequired?: number | null;
  additionalSkills?: string[];
  applicationStart?: string;
  applicationEnd?: string;
  examDate?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  officialApplyUrl?: string;
  selectionStages?: Array<{ stage?: number; name: string; desc: string; isQualifying?: boolean }>;
  vacanciesBreakdown?: Array<{ category: string; count: number; gender?: string; pct?: string; quotaPct?: string; subPostName?: string }>;
  importantDates?: Array<{ eventType: string; eventDate: string; isTentative?: number; notes?: string }>;
  sources?: Array<{ sourceType: string; sourceTitle: string; sourceUrl: string; publicationDate?: string }>;
  officialLinks?: Array<{ linkType: string; title: string; url: string }>;
  adminEmail?: string;
  examStatus?: string;
  resultStatus?: string;
  isFeatured?: number;
}

async function resolveRecruitmentMasters(data: CreateRecruitmentInput, d1?: D1Database): Promise<{ post: any; organisation: any; stateId: string }> {
  if (!d1) {
    const post = FALLBACK_POSTS.find(p => p.id === data.postId);
    const organisation = FALLBACK_ORGANISATIONS.find(o =>
      data.organisationId ? o.id === data.organisationId : o.shortName === data.organisationShortName
    );
    if (!post) throw new Error(`Unknown canonical post: ${data.postId}`);
    if (!organisation) throw new Error('A valid recruiting organisation is required.');
    return { post, organisation, stateId: data.stateId || organisation.stateId };
  }

  const db = getDb(d1);
  const post = await db.query.posts.findFirst({
    where: eq(schema.posts.id, data.postId),
    with: { department: true, sector: true },
  }) as any;
  const organisation = await db.query.organisations.findFirst({
    where: data.organisationId
      ? eq(schema.organisations.id, data.organisationId)
      : eq(schema.organisations.shortName, data.organisationShortName || ''),
  }) as any;
  if (!post) throw new Error(`Unknown canonical post: ${data.postId}`);
  if (!organisation) throw new Error('A valid recruiting organisation is required.');
  return { post, organisation, stateId: data.stateId || organisation.stateId };
}

/**
 * Ingest and create a new recruitment drive atomically with all relational child records
 * (recruitment, eligibility, vacancies, dates, sources, official links, and audit log)
 */
export async function createRecruitmentAtomic(
  data: CreateRecruitmentInput,
  providedD1?: D1Database
): Promise<{ success: boolean; id: string; validation: any; errors?: string[]; message?: string }> {
  const d1 = resolveD1(providedD1, 'creating a recruitment');
  const newId = `rec_${crypto.randomUUID()}`;
  const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const { post: matchedPost, organisation: org, stateId } = await resolveRecruitmentMasters(data, d1);

  // 1. Validation & Duplicate Detection
  const existingRecruitments = await getAllActiveRecruitments(providedD1, { includeUnpublished: true, limit: 250 });
  const duplicateCheck = detectDuplicates(
    {
      id: newId,
      title: data.title,
      advtNumber: data.advtNumber,
      organisationShortName: org.shortName,
      sourceUrl: data.sourceUrl || data.sources?.[0]?.sourceUrl,
      postId: data.postId,
      cycleYear: data.cycleYear || new Date().getFullYear(),
    },
    existingRecruitments.map(r => ({
      id: r.id,
      title: r.title,
      advtNumber: r.advtNumber,
      organisationShortName: r.organisationShortName,
      sourceUrl: r.sourcesList?.[0]?.sourceUrl,
      postId: r.postId,
      cycleYear: r.cycleYear,
    }))
  );

  if (duplicateCheck.status === 'CONFIRMED_DUPLICATE') {
    return { success: false, id: newId, validation: null, errors: [duplicateCheck.summary], message: duplicateCheck.summary };
  }

  const validationInput = {
    id: newId,
    title: data.title,
    slug,
    advtNumber: data.advtNumber,
    cycleYear: data.cycleYear || new Date().getFullYear(),
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
    sources: data.sources?.length ? data.sources.map(source => ({ ...source, status: 'VALID' as const })) : data.sourceUrl ? [{
      sourceType: 'OFFICIAL_NOTIFICATION_PDF',
      sourceUrl: data.sourceUrl,
      sourceTitle: data.sourceTitle || `${org.shortName} Official Notification`,
      status: 'VALID' as const,
    }] : [],
    criteria: {
      minAge: data.minAge ?? matchedPost?.defaultMinAge ?? 18,
      maxAgeGeneral: data.maxAgeGeneral ?? matchedPost?.defaultMaxAge ?? 33,
      ageCutoffDate: data.ageCutoffDate || `${new Date().getFullYear()}-01-01`,
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
    return {
      success: false,
      id: newId,
      validation: validationResult,
      errors: validationResult.blockingErrors,
      message: 'Publication validation failed. Save as draft or correct the blocking errors.',
    };
  }

  const selectionStagesJson = data.selectionStages && data.selectionStages.length > 0
    ? JSON.stringify(data.selectionStages)
    : null;

  // 2. Prepare in-memory representation
  const newRecruitment = {
    id: newId,
    postId: data.postId,
    advtNumber: data.advtNumber,
    title: data.title,
    slug,
    shortSummary: data.shortSummary || `Direct recruitment for ${data.totalVacancies.toLocaleString()} vacancies of ${matchedPost?.title || 'posts'} in Madhya Pradesh.`,
    overviewMarkdown: data.overviewMarkdown || null,
    cycleYear: data.cycleYear || new Date().getFullYear(),
    totalVacancies: data.totalVacancies,
    status: targetStatus,
    lifecycleStatus: data.lifecycleStatus || 'OPEN',
    isFeatured: data.isFeatured ?? 0,
    postTitle: matchedPost?.title || 'State Government Post',
    postSlug: matchedPost?.slug || '',
    departmentName: matchedPost?.departmentName,
    sectorName: matchedPost?.sectorName,
    payScale: data.payScaleOverride || matchedPost?.payScale,
    payScaleOverride: data.payScaleOverride || null,
    salaryDetailsMarkdown: data.salaryDetailsMarkdown || null,
    cadreClassification: data.cadreClassification || null,
    organisationName: org.name,
    organisationShortName: org.shortName,
    organisationUrl: org.websiteUrl,
    organisationSlug: org.slug,
    applicationStart: data.applicationStart,
    applicationEnd: data.applicationEnd,
    examDate: data.examDate,
    validationStatus: targetValidationStatus,
    validationErrorsJson: JSON.stringify(validationResult.blockingErrors),
    canonicalPost: matchedPost,
    selectionStages: data.selectionStages || undefined,
    selectionStagesJson,
    vacanciesList: data.vacanciesBreakdown || [],
    importantDatesList: data.importantDates && data.importantDates.length > 0
      ? data.importantDates.map(d => ({
          event: d.eventType.replace(/_/g, ' '),
          desc: d.notes || d.eventType,
          date: d.eventDate,
          status: 'Active',
          eventType: d.eventType,
          isTentative: d.isTentative || 0,
          notes: d.notes,
        }))
      : [
          ...(data.applicationStart ? [{ event: 'Applications Open', desc: 'Online registration begins', date: data.applicationStart, status: 'Active', eventType: 'APPLICATION_START', isTentative: 0, notes: undefined }] : []),
          ...(data.applicationEnd ? [{ event: 'Last Date to Apply', desc: 'Application deadline', date: data.applicationEnd, status: 'Active', eventType: 'APPLICATION_END', isTentative: 0, notes: undefined }] : []),
          ...(data.examDate ? [{ event: 'Examination Date', desc: 'Scheduled examination', date: data.examDate, status: 'Active', eventType: 'EXAM_DATE', isTentative: 0, notes: undefined }] : []),
        ],
    sourcesList: data.sources && data.sources.length > 0
      ? data.sources.map(s => ({
          sourceType: s.sourceType,
          sourceUrl: s.sourceUrl,
          sourceTitle: s.sourceTitle,
          publicationDate: s.publicationDate || data.applicationStart || null,
          lastVerifiedAt: new Date(),
        }))
      : data.sourceUrl ? [{
          sourceType: 'OFFICIAL_NOTIFICATION_PDF',
          sourceUrl: data.sourceUrl,
          sourceTitle: data.sourceTitle || `${org.shortName} official notification`,
          publicationDate: data.applicationStart || null,
          lastVerifiedAt: new Date(),
        }] : [],
    officialLinksList: data.officialLinks && data.officialLinks.length > 0
      ? data.officialLinks.map(l => ({
          linkType: l.linkType,
          title: l.title,
          url: l.url,
          isActive: 1,
        }))
      : data.officialApplyUrl ? [{
          linkType: 'APPLY_ONLINE',
          title: `Apply on ${org.shortName} portal`,
          url: data.officialApplyUrl,
          isActive: 1,
        }] : [],
    criteria: {
      minAge: data.minAge ?? matchedPost?.defaultMinAge ?? 18,
      maxAgeGeneral: data.maxAgeGeneral ?? matchedPost?.defaultMaxAge ?? 33,
      ageCutoffDate: data.ageCutoffDate || `${new Date().getFullYear()}-01-01`,
      ageRelaxationScSt: data.ageRelaxationScSt ?? 5,
      ageRelaxationObc: data.ageRelaxationObc ?? 3,
      ageRelaxationFemale: data.ageRelaxationFemale ?? 5,
      ageRelaxationEws: data.ageRelaxationEws ?? 0,
      minQualificationLevel: data.minQualificationLevel ?? matchedPost?.defaultQualification ?? '10TH',
      allowedStreams: data.allowedStreams,
      requiresMpDomicile: data.requiresMpDomicile ?? true,
      requiresMpEmploymentReg: data.requiresMpEmploymentReg ?? true,
      requiresCpct: data.requiresCpct ?? false,
      genderAllowed: data.genderAllowed || 'ALL',
      minHeightMaleCm: data.minHeightMaleCm ?? null,
      minHeightFemaleCm: data.minHeightFemaleCm ?? null,
      minChestMaleCm: data.minChestMaleCm ?? null,
      minPercentageRequired: data.minPercentageRequired ?? null,
      additionalSkills: data.additionalSkills || null,
      qualificationDetailsMarkdown: data.qualificationDetailsMarkdown || null,
      relaxationNotesMarkdown: data.relaxationNotesMarkdown || null,
      specialConditionsNotes: data.specialConditionsNotes || null,
      experienceMonths: data.experienceMonths || 0,
    },
  };

  const enrichedRecruitment = enrichRecruitmentWithLifecycle({
    ...newRecruitment,
    examStatus: data.examStatus,
    resultStatus: data.resultStatus,
  });

  const adminEmail = data.adminEmail || (demoFallbackEnabled ? 'local-admin@localhost' : '');
  if (!adminEmail) throw new Error('Authenticated admin identity is required.');

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
          stateId,
          advtNumber: data.advtNumber,
          title: data.title,
          slug,
          shortSummary: newRecruitment.shortSummary,
          overviewMarkdown: data.overviewMarkdown || null,
          cycleYear: newRecruitment.cycleYear,
          totalVacancies: data.totalVacancies,
          status: targetStatus,
          lifecycleStatus: enrichedRecruitment.resolvedLifecycle,
          examStatus: enrichedRecruitment.examStatus || 'NOT_SCHEDULED',
          resultStatus: enrichedRecruitment.resultStatus || 'NOT_DECLARED',
          isFeatured: data.isFeatured ?? 0,
          validationStatus: targetValidationStatus,
          validationErrorsJson: JSON.stringify(validationResult.blockingErrors),
          selectionStagesJson,
          payScaleOverride: data.payScaleOverride || null,
          salaryDetailsMarkdown: data.salaryDetailsMarkdown || null,
          cadreClassification: data.cadreClassification || null,
        })
      );

      statements.push(
        db.insert(schema.recruitmentEligibility).values({
          id: `elig_${newId}`,
          recruitmentId: newId,
          minAge: data.minAge ?? matchedPost?.defaultMinAge ?? 18,
          maxAgeGeneral: data.maxAgeGeneral ?? matchedPost?.defaultMaxAge ?? 33,
          ageCutoffDate: data.ageCutoffDate || `${new Date().getFullYear()}-01-01`,
          ageRelaxationScSt: data.ageRelaxationScSt ?? 5,
          ageRelaxationObc: data.ageRelaxationObc ?? 3,
          ageRelaxationFemale: data.ageRelaxationFemale ?? 5,
          ageRelaxationEws: data.ageRelaxationEws ?? 0,
          minQualificationLevel: data.minQualificationLevel ?? matchedPost?.defaultQualification ?? '10TH',
          allowedStreamsJson: data.allowedStreams ? JSON.stringify(data.allowedStreams) : null,
          minPercentageRequired: data.minPercentageRequired ?? null,
          additionalSkillsJson: data.additionalSkills?.length ? JSON.stringify(data.additionalSkills) : null,
          requiresMpDomicile: (data.requiresMpDomicile ?? true) ? 1 : 0,
          requiresMpEmploymentReg: (data.requiresMpEmploymentReg ?? true) ? 1 : 0,
          requiresCpct: (data.requiresCpct ?? false) ? 1 : 0,
          genderAllowed: data.genderAllowed || 'ALL',
          minHeightMaleCm: data.minHeightMaleCm ?? null,
          minHeightFemaleCm: data.minHeightFemaleCm ?? null,
          minChestMaleCm: data.minChestMaleCm ?? null,
          experienceMonths: data.experienceMonths || 0,
          specialConditionsNotes: data.specialConditionsNotes || null,
          qualificationDetailsMarkdown: data.qualificationDetailsMarkdown || null,
          relaxationNotesMarkdown: data.relaxationNotesMarkdown || null,
        })
      );

      // Vacancies
      for (const v of newRecruitment.vacanciesList || []) {
        statements.push(
          db.insert(schema.vacancies).values({
          id: `vac_${crypto.randomUUID()}`,
            recruitmentId: newId,
            category: v.category,
            gender: v.gender || 'ALL',
            count: v.count,
            quotaPct: v.quotaPct || null,
            subPostName: v.subPostName || null,
          })
        );
      }

      // Dates
      for (const d of newRecruitment.importantDatesList || []) {
        statements.push(
          db.insert(schema.importantDates).values({
            id: `date_${crypto.randomUUID()}`,
            recruitmentId: newId,
            eventType: d.eventType || 'NOTIFICATION',
            eventDate: d.date,
            isTentative: d.isTentative || 0,
            notes: d.desc,
          })
        );
      }

      // Source
      for (const s of newRecruitment.sourcesList || []) {
        statements.push(
          db.insert(schema.sources).values({
            id: `src_${crypto.randomUUID()}`,
            recruitmentId: newId,
            sourceType: s.sourceType || 'OFFICIAL_NOTIFICATION_PDF',
            sourceUrl: s.sourceUrl,
            sourceTitle: s.sourceTitle,
            publicationDate: typeof s.publicationDate === 'string' ? s.publicationDate : null,
          })
        );
      }

      // Official Link
      for (const l of newRecruitment.officialLinksList || []) {
        statements.push(
          db.insert(schema.officialLinks).values({
            id: `link_${crypto.randomUUID()}`,
            recruitmentId: newId,
            linkType: l.linkType || 'APPLY_ONLINE',
            title: l.title,
            url: l.url,
            isActive: 1,
          })
        );
      }

      // Audit Log
      statements.push(
        db.insert(schema.auditLogs).values({
          id: `audit_${crypto.randomUUID()}`,
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
      return {
        success: false,
        id: newId,
        validation: validationResult,
        errors: ['The database transaction failed. No recruitment was created.'],
        message: 'The database transaction failed. No recruitment was created.',
      };
    }
  } else {
    FALLBACK_RECRUITMENTS.unshift(enrichedRecruitment);
    FALLBACK_AUDIT_LOGS.unshift({
      id: `audit_${crypto.randomUUID()}`,
      adminEmail,
      entity: 'RECRUITMENT',
      entityId: newId,
      action: targetStatus === 'PUBLISHED' ? 'PUBLISH' : 'CREATE',
      field: 'status',
      oldValue: null,
      newValue: targetStatus,
      reason: `Recruitment created with validation status: ${targetValidationStatus}`,
      source: data.sourceUrl || null,
      createdAt: new Date(),
    });
  }

  return {
    success: true,
    id: newId,
    validation: validationResult,
    errors: validationResult.blockingErrors,
  };
}

/**
 * Update an existing recruitment drive atomically across all relational sections
 */
export async function updateRecruitmentAtomic(
  id: string,
  data: CreateRecruitmentInput,
  providedD1?: D1Database
): Promise<{ success: boolean; id: string; validation: any; errors?: string[]; message?: string }> {
  const d1 = resolveD1(providedD1, 'updating a recruitment');
  const { post: matchedPost, organisation: org, stateId } = await resolveRecruitmentMasters(data, d1);
  const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const existingRecruitments = await getAllActiveRecruitments(providedD1, { includeUnpublished: true, limit: 250 });
  const duplicateCheck = detectDuplicates({
    id,
    title: data.title,
    advtNumber: data.advtNumber,
    organisationShortName: org.shortName,
    organisationId: org.id,
    sourceUrl: data.sourceUrl || data.sources?.[0]?.sourceUrl,
    postId: data.postId,
    cycleYear: data.cycleYear,
  }, existingRecruitments.map(r => ({
    id: r.id,
    title: r.title,
    advtNumber: r.advtNumber,
    organisationShortName: r.organisationShortName,
    sourceUrl: r.sourcesList?.[0]?.sourceUrl,
    postId: r.postId,
    cycleYear: r.cycleYear,
  })));
  if (duplicateCheck.status === 'CONFIRMED_DUPLICATE') {
    return { success: false, id, validation: null, errors: [duplicateCheck.summary], message: duplicateCheck.summary };
  }

  const validationInput = {
    id,
    title: data.title,
    slug,
    advtNumber: data.advtNumber,
    cycleYear: data.cycleYear || new Date().getFullYear(),
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
    sources: data.sources?.length ? data.sources.map(source => ({ ...source, status: 'VALID' as const })) : data.sourceUrl ? [{
      sourceType: 'OFFICIAL_NOTIFICATION_PDF',
      sourceUrl: data.sourceUrl,
      sourceTitle: data.sourceTitle || `${org.shortName} Official Notification`,
      status: 'VALID' as const,
    }] : [],
    criteria: {
      minAge: data.minAge ?? matchedPost?.defaultMinAge ?? 18,
      maxAgeGeneral: data.maxAgeGeneral ?? matchedPost?.defaultMaxAge ?? 33,
      ageCutoffDate: data.ageCutoffDate || `${new Date().getFullYear()}-01-01`,
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
    return {
      success: false,
      id,
      validation: validationResult,
      errors: validationResult.blockingErrors,
      message: 'Publication validation failed. Save as draft or correct the blocking errors.',
    };
  }

  const selectionStagesJson = data.selectionStages && data.selectionStages.length > 0
    ? JSON.stringify(data.selectionStages)
    : null;

  // 1. Update in-memory fallback representation
  const idx = FALLBACK_RECRUITMENTS.findIndex(r => r.id === id || r.slug === id);
  if (!d1 && idx !== -1) {
    const existing = FALLBACK_RECRUITMENTS[idx];
    const rawUpdated = {
      ...existing,
      title: data.title,
      slug,
      advtNumber: data.advtNumber,
      totalVacancies: data.totalVacancies,
      shortSummary: data.shortSummary || existing.shortSummary,
      overviewMarkdown: data.overviewMarkdown !== undefined ? data.overviewMarkdown : existing.overviewMarkdown,
      status: targetStatus,
      lifecycleStatus: data.lifecycleStatus || existing.lifecycleStatus,
      examStatus: data.examStatus !== undefined ? data.examStatus : existing.examStatus,
      resultStatus: data.resultStatus !== undefined ? data.resultStatus : existing.resultStatus,
      payScale: data.payScaleOverride || matchedPost?.payScale || existing.payScale,
      payScaleOverride: data.payScaleOverride || null,
      salaryDetailsMarkdown: data.salaryDetailsMarkdown || null,
      cadreClassification: data.cadreClassification || null,
      applicationStart: data.applicationStart || existing.applicationStart,
      applicationEnd: data.applicationEnd || existing.applicationEnd,
      examDate: data.examDate || existing.examDate,
      validationStatus: targetValidationStatus,
      validationErrorsJson: JSON.stringify(validationResult.blockingErrors),
      selectionStages: data.selectionStages || existing.selectionStages,
      selectionStagesJson,
      vacanciesList: data.vacanciesBreakdown !== undefined ? data.vacanciesBreakdown : existing.vacanciesList,
      importantDatesList: data.importantDates !== undefined
        ? data.importantDates.map(d => ({
            event: d.eventType.replace(/_/g, ' '),
            desc: d.notes || d.eventType,
            date: d.eventDate,
            status: 'Active',
            eventType: d.eventType,
            isTentative: d.isTentative || 0,
            notes: d.notes,
          }))
        : existing.importantDatesList,
      sourcesList: data.sources !== undefined
        ? data.sources.map(s => ({
            sourceType: s.sourceType,
            sourceUrl: s.sourceUrl,
            sourceTitle: s.sourceTitle,
            publicationDate: s.publicationDate || data.applicationStart || null,
            lastVerifiedAt: new Date(),
          }))
        : existing.sourcesList,
      officialLinksList: data.officialLinks !== undefined
        ? data.officialLinks.map(l => ({
            linkType: l.linkType,
            title: l.title,
            url: l.url,
            isActive: 1,
          }))
        : existing.officialLinksList,
      criteria: {
        ...existing.criteria,
        minAge: data.minAge ?? existing.criteria.minAge,
        maxAgeGeneral: data.maxAgeGeneral ?? existing.criteria.maxAgeGeneral,
        ageCutoffDate: data.ageCutoffDate || existing.criteria.ageCutoffDate,
        minQualificationLevel: data.minQualificationLevel ?? existing.criteria.minQualificationLevel,
        ageRelaxationScSt: data.ageRelaxationScSt ?? existing.criteria.ageRelaxationScSt,
        ageRelaxationObc: data.ageRelaxationObc ?? existing.criteria.ageRelaxationObc,
        ageRelaxationFemale: data.ageRelaxationFemale ?? existing.criteria.ageRelaxationFemale,
        ageRelaxationEws: data.ageRelaxationEws ?? existing.criteria.ageRelaxationEws,
        requiresMpDomicile: data.requiresMpDomicile !== undefined ? data.requiresMpDomicile : existing.criteria.requiresMpDomicile,
        requiresMpEmploymentReg: data.requiresMpEmploymentReg !== undefined ? data.requiresMpEmploymentReg : existing.criteria.requiresMpEmploymentReg,
        requiresCpct: data.requiresCpct !== undefined ? data.requiresCpct : existing.criteria.requiresCpct,
        qualificationDetailsMarkdown: data.qualificationDetailsMarkdown || null,
        relaxationNotesMarkdown: data.relaxationNotesMarkdown || null,
        specialConditionsNotes: data.specialConditionsNotes || null,
        experienceMonths: data.experienceMonths || 0,
        minPercentageRequired: data.minPercentageRequired ?? null,
        additionalSkills: data.additionalSkills || null,
      },
    };
    FALLBACK_RECRUITMENTS[idx] = enrichRecruitmentWithLifecycle(rawUpdated);
  }

  // 2. Audit Log
  const adminEmail = data.adminEmail || (demoFallbackEnabled ? 'local-admin@localhost' : '');
  if (!adminEmail) throw new Error('Authenticated admin identity is required.');
  if (!d1) FALLBACK_AUDIT_LOGS.unshift({
    id: `audit_${crypto.randomUUID()}`,
    adminEmail,
    entity: 'RECRUITMENT',
    entityId: id,
    action: 'UPDATE',
    field: 'all',
    oldValue: null,
    newValue: targetStatus,
    reason: `Recruitment updated via Admin Editor with validation: ${targetValidationStatus}`,
    source: data.sourceUrl || null,
    createdAt: new Date(),
  });

  // 3. Atomic D1 Batch Persistence
  if (d1) {
    try {
      const db = getDb(d1);
      const statements: any[] = [];

      const resolvedLStatus = resolveRecruitmentLifecycle({
        status: targetStatus,
        lifecycleStatus: data.lifecycleStatus || 'OPEN',
        applicationStart: data.applicationStart,
        applicationEnd: data.applicationEnd,
        examDate: data.examDate,
        examStatus: data.examStatus,
        resultStatus: data.resultStatus,
        totalVacancies: data.totalVacancies,
      });

      // Update recruitments table
      statements.push(
        db.update(schema.recruitments)
          .set({
            postId: data.postId,
            organisationId: org.id,
            stateId,
            title: data.title,
            slug,
            advtNumber: data.advtNumber,
            shortSummary: data.shortSummary || '',
            overviewMarkdown: data.overviewMarkdown || null,
            totalVacancies: data.totalVacancies,
            cycleYear: data.cycleYear || new Date().getFullYear(),
            status: targetStatus,
            lifecycleStatus: resolvedLStatus,
            examStatus: data.examStatus || (data.examDate ? 'SCHEDULED' : 'NOT_SCHEDULED'),
            resultStatus: data.resultStatus || (resolvedLStatus === 'RESULT_DECLARED' ? 'DECLARED' : 'NOT_DECLARED'),
            isFeatured: data.isFeatured ?? 0,
            validationStatus: targetValidationStatus,
            validationErrorsJson: JSON.stringify(validationResult.blockingErrors),
            selectionStagesJson,
            payScaleOverride: data.payScaleOverride || null,
            salaryDetailsMarkdown: data.salaryDetailsMarkdown || null,
            cadreClassification: data.cadreClassification || null,
            updatedAt: sql`(unixepoch())`,
          })
          .where(eq(schema.recruitments.id, id))
      );

      // Upsert recruitmentEligibility so legacy/incomplete rows can be repaired atomically.
      statements.push(
        db.insert(schema.recruitmentEligibility)
          .values({
            id: `elig_${id}`,
            recruitmentId: id,
            minAge: data.minAge ?? matchedPost?.defaultMinAge ?? 18,
            maxAgeGeneral: data.maxAgeGeneral ?? matchedPost?.defaultMaxAge ?? 33,
            ageCutoffDate: data.ageCutoffDate || `${new Date().getFullYear()}-01-01`,
            ageRelaxationScSt: data.ageRelaxationScSt ?? 5,
            ageRelaxationObc: data.ageRelaxationObc ?? 3,
            ageRelaxationFemale: data.ageRelaxationFemale ?? 5,
            ageRelaxationEws: data.ageRelaxationEws ?? 0,
            minQualificationLevel: data.minQualificationLevel ?? matchedPost?.defaultQualification ?? '10TH',
            allowedStreamsJson: data.allowedStreams ? JSON.stringify(data.allowedStreams) : null,
            requiresMpDomicile: (data.requiresMpDomicile ?? true) ? 1 : 0,
            requiresMpEmploymentReg: (data.requiresMpEmploymentReg ?? true) ? 1 : 0,
            requiresCpct: (data.requiresCpct ?? false) ? 1 : 0,
            genderAllowed: data.genderAllowed || 'ALL',
            minHeightMaleCm: data.minHeightMaleCm ?? null,
            minHeightFemaleCm: data.minHeightFemaleCm ?? null,
            minChestMaleCm: data.minChestMaleCm ?? null,
            minPercentageRequired: data.minPercentageRequired ?? null,
            additionalSkillsJson: data.additionalSkills?.length ? JSON.stringify(data.additionalSkills) : null,
            experienceMonths: data.experienceMonths || 0,
            specialConditionsNotes: data.specialConditionsNotes || null,
            qualificationDetailsMarkdown: data.qualificationDetailsMarkdown || null,
            relaxationNotesMarkdown: data.relaxationNotesMarkdown || null,
          })
          .onConflictDoUpdate({
            target: schema.recruitmentEligibility.recruitmentId,
            set: {
              minAge: data.minAge ?? matchedPost?.defaultMinAge ?? 18,
              maxAgeGeneral: data.maxAgeGeneral ?? matchedPost?.defaultMaxAge ?? 33,
              ageCutoffDate: data.ageCutoffDate || `${new Date().getFullYear()}-01-01`,
              ageRelaxationScSt: data.ageRelaxationScSt ?? 5,
              ageRelaxationObc: data.ageRelaxationObc ?? 3,
              ageRelaxationFemale: data.ageRelaxationFemale ?? 5,
              ageRelaxationEws: data.ageRelaxationEws ?? 0,
              minQualificationLevel: data.minQualificationLevel ?? matchedPost?.defaultQualification ?? '10TH',
              allowedStreamsJson: data.allowedStreams ? JSON.stringify(data.allowedStreams) : null,
              requiresMpDomicile: (data.requiresMpDomicile ?? true) ? 1 : 0,
              requiresMpEmploymentReg: (data.requiresMpEmploymentReg ?? true) ? 1 : 0,
              requiresCpct: (data.requiresCpct ?? false) ? 1 : 0,
              genderAllowed: data.genderAllowed || 'ALL',
              minHeightMaleCm: data.minHeightMaleCm ?? null,
              minHeightFemaleCm: data.minHeightFemaleCm ?? null,
              minChestMaleCm: data.minChestMaleCm ?? null,
              minPercentageRequired: data.minPercentageRequired ?? null,
              additionalSkillsJson: data.additionalSkills?.length ? JSON.stringify(data.additionalSkills) : null,
              experienceMonths: data.experienceMonths || 0,
              specialConditionsNotes: data.specialConditionsNotes || null,
              qualificationDetailsMarkdown: data.qualificationDetailsMarkdown || null,
              relaxationNotesMarkdown: data.relaxationNotesMarkdown || null,
            },
          })
      );

      // Recreate child vacancies if specified
      if (data.vacanciesBreakdown !== undefined) {
        statements.push(db.delete(schema.vacancies).where(eq(schema.vacancies.recruitmentId, id)));
        for (const v of data.vacanciesBreakdown) {
          statements.push(
            db.insert(schema.vacancies).values({
              id: `vac_${crypto.randomUUID()}`,
              recruitmentId: id,
              category: v.category,
              gender: v.gender || 'ALL',
              count: v.count,
              quotaPct: v.quotaPct || null,
              subPostName: v.subPostName || null,
            })
          );
        }
      }

      // Recreate important dates if specified
      if (data.importantDates !== undefined) {
        statements.push(db.delete(schema.importantDates).where(eq(schema.importantDates.recruitmentId, id)));
        for (const d of data.importantDates) {
          statements.push(
            db.insert(schema.importantDates).values({
              id: `date_${crypto.randomUUID()}`,
              recruitmentId: id,
              eventType: d.eventType,
              eventDate: d.eventDate,
              isTentative: d.isTentative || 0,
              notes: d.notes || null,
            })
          );
        }
      }

      // Recreate sources if specified
      if (data.sources !== undefined) {
        statements.push(db.delete(schema.sources).where(eq(schema.sources.recruitmentId, id)));
        for (const s of data.sources) {
          statements.push(
            db.insert(schema.sources).values({
              id: `src_${crypto.randomUUID()}`,
              recruitmentId: id,
              sourceType: s.sourceType,
              sourceUrl: s.sourceUrl,
              sourceTitle: s.sourceTitle,
              publicationDate: s.publicationDate || null,
            })
          );
        }
      }

      // Recreate official links if specified
      if (data.officialLinks !== undefined) {
        statements.push(db.delete(schema.officialLinks).where(eq(schema.officialLinks.recruitmentId, id)));
        for (const l of data.officialLinks) {
          statements.push(
            db.insert(schema.officialLinks).values({
              id: `link_${crypto.randomUUID()}`,
              recruitmentId: id,
              linkType: l.linkType,
              title: l.title,
              url: l.url,
              isActive: 1,
            })
          );
        }
      }

      // Audit Log
      statements.push(
        db.insert(schema.auditLogs).values({
          id: `audit_${crypto.randomUUID()}`,
          adminEmail,
          entity: 'RECRUITMENT',
          entityId: id,
          action: 'UPDATE',
          field: 'all',
          oldValue: null,
          newValue: targetStatus,
          reason: `Recruitment updated via Admin Editor with validation: ${targetValidationStatus}`,
          source: data.sourceUrl || null,
        })
      );

      // Execute batch atomically
      // @ts-ignore
      await db.batch(statements);
    } catch (error) {
      console.error('Error in atomic recruitment update in D1:', error);
      return {
        success: false,
        id,
        validation: validationResult,
        errors: ['The database transaction failed. No changes were saved.'],
        message: 'The database transaction failed. No changes were saved.',
      };
    }
  }

  return {
    success: true,
    id,
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
  if (!res.success) throw new Error(res.message || 'Recruitment creation failed.');
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
  activeDriveCount: number;
  activeVacancies: number;
  upcomingDriveCount: number;
  upcomingVacancies: number;
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

  const publishedRecruitments = recruitments.filter(r => r.status === 'PUBLISHED');
  const metrics = calculateRecruitmentMetrics(publishedRecruitments, now);
  const recentAuditLogs = await getAuditLogs(providedD1, 10);

  return {
    published,
    drafts,
    pendingVerification,
    expiringIn7Days,
    needsReview,
    sourceExpired,
    dataConflicts,
    totalVacancies,
    activeDriveCount: metrics.activeDriveCount,
    activeVacancies: metrics.activeVacancyCount,
    upcomingDriveCount: metrics.upcomingDriveCount,
    upcomingVacancies: metrics.upcomingVacancyCount,
    recentAuditLogs,
    conflictsList,
  };
}
