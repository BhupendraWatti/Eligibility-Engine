export type RuleStatus = 'MATCH' | 'FAIL' | 'UNKNOWN';
export type OverallEligibilityStatus = 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'NEEDS_VERIFICATION';

export interface UserEligibilityProfile {
  dob?: string; // 'YYYY-MM-DD'
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  category?: 'UR' | 'SC' | 'ST' | 'OBC' | 'EWS';
  isMpDomicile?: boolean;
  hasMpRojgarPanjiyan?: boolean;
  hasCpct?: boolean;
  qualificationLevel?: '8TH' | '10TH' | '12TH' | 'DIPLOMA' | 'GRADUATION' | 'POST_GRADUATION';
  stream?: string;
  heightCm?: number;
  chestCm?: number;
}

export interface RecruitmentCriteria {
  minAge: number;
  maxAgeGeneral: number;
  ageCutoffDate: string; // 'YYYY-MM-DD'
  ageRelaxationScSt: number;
  ageRelaxationObc: number;
  ageRelaxationFemale: number;
  minQualificationLevel: string;
  requiresMpDomicile: boolean;
  requiresMpEmploymentReg: boolean;
  requiresCpct: boolean;
  genderAllowed: 'ALL' | 'MALE' | 'FEMALE';
  minHeightMaleCm?: number | null;
  minHeightFemaleCm?: number | null;
  minChestMaleCm?: number | null;
}

export interface RuleEvaluationItem {
  ruleName: string;
  status: RuleStatus;
  userValue: string;
  requirement: string;
  message: string;
}

export interface RecruitmentEligibilityResult {
  overallStatus: OverallEligibilityStatus;
  items: RuleEvaluationItem[];
  matchedCount: number;
  failedCount: number;
  unknownCount: number;
}

const QUALIFICATION_RANK: Record<string, number> = {
  '8TH': 1,
  '10TH': 2,
  '12TH': 3,
  'DIPLOMA': 4,
  'GRADUATION': 5,
  'POST_GRADUATION': 6,
};

export function evaluateEligibility(
  user: UserEligibilityProfile,
  criteria: RecruitmentCriteria
): RecruitmentEligibilityResult {
  const items: RuleEvaluationItem[] = [];

  // 1. Gender Rule
  if (criteria.genderAllowed !== 'ALL') {
    if (!user.gender) {
      items.push({
        ruleName: 'Gender',
        status: 'UNKNOWN',
        userValue: 'Not provided',
        requirement: `${criteria.genderAllowed} only`,
        message: 'Gender was not provided. Please verify.',
      });
    } else if (user.gender !== criteria.genderAllowed) {
      items.push({
        ruleName: 'Gender',
        status: 'FAIL',
        userValue: user.gender,
        requirement: `${criteria.genderAllowed} only`,
        message: `Only ${criteria.genderAllowed} candidates can apply.`,
      });
    } else {
      items.push({
        ruleName: 'Gender',
        status: 'MATCH',
        userValue: user.gender,
        requirement: `${criteria.genderAllowed} only`,
        message: 'Gender requirement satisfied.',
      });
    }
  }

  // 2. MP Domicile Rule
  if (criteria.requiresMpDomicile) {
    if (user.isMpDomicile === undefined) {
      items.push({
        ruleName: 'MP Domicile',
        status: 'UNKNOWN',
        userValue: 'Not provided',
        requirement: 'Must be MP Resident (Mool Niwasi)',
        message: 'MP Domicile status not provided. Verification required.',
      });
    } else if (!user.isMpDomicile) {
      items.push({
        ruleName: 'MP Domicile',
        status: 'FAIL',
        userValue: 'No',
        requirement: 'Must be MP Resident (Mool Niwasi)',
        message: 'This post is reserved exclusively for MP residents.',
      });
    } else {
      items.push({
        ruleName: 'MP Domicile',
        status: 'MATCH',
        userValue: 'Yes',
        requirement: 'Must be MP Resident',
        message: 'MP Domicile criteria satisfied.',
      });
    }
  }

  // 3. Age Rule (Checked strictly as of cutoff date)
  if (!user.dob) {
    items.push({
      ruleName: 'Age Requirement',
      status: 'UNKNOWN',
      userValue: 'Not provided',
      requirement: `${criteria.minAge}-${criteria.maxAgeGeneral} yrs as on ${criteria.ageCutoffDate}`,
      message: 'Date of birth not provided. Age cannot be calculated.',
    });
  } else {
    const ageAtCutoff = calculateAgeAtCutoff(user.dob, criteria.ageCutoffDate);
    let maxAllowed = criteria.maxAgeGeneral;

    // Category relaxation
    if (user.category === 'SC' || user.category === 'ST') {
      maxAllowed += criteria.ageRelaxationScSt;
    } else if (user.category === 'OBC') {
      maxAllowed += criteria.ageRelaxationObc;
    }

    // Female relaxation
    if (user.gender === 'FEMALE' && criteria.ageRelaxationFemale > 0) {
      const femaleMax = criteria.maxAgeGeneral + criteria.ageRelaxationFemale;
      if (femaleMax > maxAllowed) maxAllowed = femaleMax;
    }

    const isMatch = ageAtCutoff >= criteria.minAge && ageAtCutoff <= maxAllowed;
    const formattedAge = ageAtCutoff.toFixed(1);

    items.push({
      ruleName: 'Age Requirement',
      status: isMatch ? 'MATCH' : 'FAIL',
      userValue: `${formattedAge} years (as of ${criteria.ageCutoffDate})`,
      requirement: `${criteria.minAge}-${maxAllowed} years (as of ${criteria.ageCutoffDate})`,
      message: isMatch
        ? `Age (${formattedAge} yrs) is within eligible limits.`
        : `Age (${formattedAge} yrs) falls outside the allowed limit (${criteria.minAge}-${maxAllowed} yrs).`,
    });
  }

  // 4. Qualification Level Rule
  if (!user.qualificationLevel) {
    items.push({
      ruleName: 'Educational Qualification',
      status: 'UNKNOWN',
      userValue: 'Not provided',
      requirement: `Minimum ${criteria.minQualificationLevel}`,
      message: 'Highest qualification not provided. Verification needed.',
    });
  } else {
    const userRank = QUALIFICATION_RANK[user.qualificationLevel] || 0;
    const requiredRank = QUALIFICATION_RANK[criteria.minQualificationLevel] || 0;
    const isMatch = userRank >= requiredRank;

    items.push({
      ruleName: 'Educational Qualification',
      status: isMatch ? 'MATCH' : 'FAIL',
      userValue: user.qualificationLevel,
      requirement: `Minimum ${criteria.minQualificationLevel}`,
      message: isMatch
        ? `Qualification (${user.qualificationLevel}) satisfies minimum (${criteria.minQualificationLevel}).`
        : `Qualification (${user.qualificationLevel}) is below required (${criteria.minQualificationLevel}).`,
    });
  }

  // 5. MP Rojgar Panjiyan Rule
  if (criteria.requiresMpEmploymentReg) {
    if (user.hasMpRojgarPanjiyan === undefined) {
      items.push({
        ruleName: 'MP Rojgar Panjiyan',
        status: 'UNKNOWN',
        userValue: 'Not provided',
        requirement: 'Active registration on mprojgar.gov.in',
        message: 'Must have active registration on MP Employment Exchange portal.',
      });
    } else if (!user.hasMpRojgarPanjiyan) {
      items.push({
        ruleName: 'MP Rojgar Panjiyan',
        status: 'FAIL',
        userValue: 'No',
        requirement: 'Active registration required',
        message: 'Active MP Rojgar Panjiyan registration is legally mandatory.',
      });
    } else {
      items.push({
        ruleName: 'MP Rojgar Panjiyan',
        status: 'MATCH',
        userValue: 'Yes',
        requirement: 'Active registration',
        message: 'Employment portal registration satisfied.',
      });
    }
  }

  // 6. CPCT Certificate Rule
  if (criteria.requiresCpct) {
    if (user.hasCpct === undefined) {
      items.push({
        ruleName: 'CPCT Scorecard',
        status: 'UNKNOWN',
        userValue: 'Not provided',
        requirement: 'Valid CPCT scorecard with Hindi typing',
        message: 'CPCT certificate status not provided.',
      });
    } else if (!user.hasCpct) {
      items.push({
        ruleName: 'CPCT Scorecard',
        status: 'FAIL',
        userValue: 'No',
        requirement: 'Valid CPCT scorecard required',
        message: 'CPCT scorecard is mandatory for this post.',
      });
    } else {
      items.push({
        ruleName: 'CPCT Scorecard',
        status: 'MATCH',
        userValue: 'Yes',
        requirement: 'Valid CPCT scorecard',
        message: 'CPCT certificate verified.',
      });
    }
  }

  // 7. Physical Standards (Height)
  const minHeight = user.gender === 'FEMALE' ? criteria.minHeightFemaleCm : criteria.minHeightMaleCm;
  if (minHeight && minHeight > 0) {
    if (user.heightCm === undefined) {
      items.push({
        ruleName: 'Physical Standards (Height)',
        status: 'UNKNOWN',
        userValue: 'Not provided',
        requirement: `Minimum ${minHeight} cm`,
        message: 'Height measurement not provided.',
      });
    } else if (user.heightCm < minHeight) {
      items.push({
        ruleName: 'Physical Standards (Height)',
        status: 'FAIL',
        userValue: `${user.heightCm} cm`,
        requirement: `Minimum ${minHeight} cm`,
        message: `Height (${user.heightCm} cm) is below minimum required (${minHeight} cm).`,
      });
    } else {
      items.push({
        ruleName: 'Physical Standards (Height)',
        status: 'MATCH',
        userValue: `${user.heightCm} cm`,
        requirement: `Minimum ${minHeight} cm`,
        message: `Height standard satisfied (${user.heightCm} cm >= ${minHeight} cm).`,
      });
    }
  }

  // Composite Calculation
  const failedCount = items.filter((i) => i.status === 'FAIL').length;
  const unknownCount = items.filter((i) => i.status === 'UNKNOWN').length;
  const matchedCount = items.filter((i) => i.status === 'MATCH').length;

  let overallStatus: OverallEligibilityStatus = 'ELIGIBLE';
  if (failedCount > 0) {
    overallStatus = 'NOT_ELIGIBLE';
  } else if (unknownCount > 0) {
    overallStatus = 'NEEDS_VERIFICATION';
  }

  return {
    overallStatus,
    items,
    matchedCount,
    failedCount,
    unknownCount,
  };
}

export function calculateAgeAtCutoff(dobStr: string, cutoffStr: string): number {
  const dob = new Date(dobStr);
  const cutoff = new Date(cutoffStr);

  let years = cutoff.getFullYear() - dob.getFullYear();
  const monthDiff = cutoff.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && cutoff.getDate() < dob.getDate())) {
    years--;
  }

  // Add precise fractional months
  const tempDate = new Date(dob);
  tempDate.setFullYear(dob.getFullYear() + years);
  const diffDays = (cutoff.getTime() - tempDate.getTime()) / (1000 * 60 * 60 * 24);
  const fractionalYear = diffDays / 365.25;

  return Math.max(0, years + fractionalYear);
}
