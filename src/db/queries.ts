import { getDb, schema } from './client';
import { eq, desc } from 'drizzle-orm';

let cfEnv: any = undefined;
try {
  // @ts-ignore
  const cf = await import('cloudflare:workers');
  cfEnv = cf.env;
} catch {
  // Fallback for environments outside Cloudflare Workers runtime
}

export interface RecruitmentWithDetails {
  id: string;
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

export const FALLBACK_RECRUITMENTS: RecruitmentWithDetails[] = [
  {
    id: 'rec_mp_constable_2026',
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

export async function getAllActiveRecruitments(providedD1?: D1Database): Promise<RecruitmentWithDetails[]> {
  const d1 = providedD1 || cfEnv?.DB;
  if (!d1) return FALLBACK_RECRUITMENTS;

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

    if (!rows || rows.length === 0) return FALLBACK_RECRUITMENTS;

    return rows.map(r => {
      // Parse additional skills from JSON text column
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
