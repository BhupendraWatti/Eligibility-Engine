export type RuleStatus = 'MATCH' | 'FAIL' | 'UNKNOWN';
export type OverallEligibilityStatus = 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'NEEDS_VERIFICATION';
import { jurisdictionName } from '../data/india-jurisdictions';

export interface UserEligibilityProfile {
  dob?: string; // 'YYYY-MM-DD'
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  category?: 'UR' | 'SC' | 'ST' | 'OBC' | 'EWS';
  isMpDomicile?: boolean;
  domicileStateCode?: string;
  hasMpRojgarPanjiyan?: boolean;
  registrations?: string[];
  hasCpct?: boolean;
  qualificationLevel?: '8TH' | '10TH' | '12TH' | 'ITI' | 'DIPLOMA' | 'GRADUATION' | 'POST_GRADUATION';
  stream?: string;
  percentage?: number;
  heightCm?: number;
  chestCm?: number;
  additionalSkills?: string[];
  experienceMonths?: number;
}

export interface RecruitmentCriteria {
  minAge: number;
  maxAgeGeneral: number;
  ageCutoffDate: string; // 'YYYY-MM-DD'
  ageRelaxationScSt: number;
  ageRelaxationObc: number;
  ageRelaxationFemale: number;
  ageRelaxationEws: number;
  minQualificationLevel: string;
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
  allowedStreams?: string[] | null;
  experienceMonths?: number;
}

export interface RuleEvaluationItem {
  ruleName: string;
  status: RuleStatus;
  userValue: string;
  requirement: string;
  message: string;
}

export interface AgeRelaxationBreakdown {
  baseMinAge: number;
  baseMaxAge: number;
  category: string;
  categoryRelaxation: number;
  femaleRelaxation: number;
  effectiveMaxAge: number;
  candidateAge: number;
  cutoffDate: string;
  isMatch: boolean;
}

export interface RecruitmentEligibilityResult {
  overallStatus: OverallEligibilityStatus;
  items: RuleEvaluationItem[];
  matchedCount: number;
  failedCount: number;
  unknownCount: number;
  ageRelaxationBreakdown?: AgeRelaxationBreakdown;
}

export const QUALIFICATION_RANK: Record<string, number> = {
  '8TH': 1,
  '10TH': 2,
  '12TH': 3,
  'ITI': 3,
  'DIPLOMA': 4,
  'GRADUATION': 5,
  'POST_GRADUATION': 6,
};

export function evaluateEligibility(
  user: UserEligibilityProfile,
  criteria: RecruitmentCriteria
): RecruitmentEligibilityResult {
  const items: RuleEvaluationItem[] = [];
  let ageBreakdown: AgeRelaxationBreakdown | undefined;

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

  // 2. Recruitment-jurisdiction domicile rule (legacy MP flags remain API-compatible).
  if (criteria.requiresMpDomicile || criteria.domicileStateCode) {
    const requiredState = (criteria.domicileStateCode || 'MP').toUpperCase();
    const candidateState = user.domicileStateCode?.toUpperCase() || (user.isMpDomicile === true ? 'MP' : user.isMpDomicile === false ? 'OTHER' : undefined);
    if (!candidateState) {
      items.push({
        ruleName: 'State Domicile',
        status: 'UNKNOWN',
        userValue: 'Not provided',
        requirement: `Must hold ${requiredState} domicile`,
        message: 'Domicile state was not provided. Verification required.',
      });
    } else if (candidateState !== requiredState) {
      items.push({
        ruleName: 'State Domicile',
        status: 'FAIL',
        userValue: jurisdictionName(candidateState),
        requirement: `Must hold ${jurisdictionName(requiredState)} domicile`,
        message: `This recruitment requires domicile of ${jurisdictionName(requiredState)}.`,
      });
    } else {
      items.push({
        ruleName: 'State Domicile',
        status: 'MATCH',
        userValue: jurisdictionName(candidateState),
        requirement: `Must hold ${jurisdictionName(requiredState)} domicile`,
        message: 'Domicile requirement satisfied.',
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
    if (!Number.isFinite(ageAtCutoff)) {
      items.push({
        ruleName: 'Age Requirement',
        status: 'UNKNOWN',
        userValue: user.dob,
        requirement: `Valid date of birth and cutoff date ${criteria.ageCutoffDate}`,
        message: 'Date of birth or age cutoff date is invalid.',
      });
    } else {
    // Indian notices compare COMPLETED years on the cutoff date against the limits
    // (33y 11m counts as 33). Fractional age is for display only.
    const completedYears = completedYearsAtCutoff(user.dob, criteria.ageCutoffDate);
    const categoryRelax = (category?: string) =>
      category === 'SC' || category === 'ST' ? (criteria.ageRelaxationScSt ?? 0)
      : category === 'OBC' ? (criteria.ageRelaxationObc ?? 0)
      : category === 'EWS' ? (criteria.ageRelaxationEws ?? 0)
      : 0;
    // Female relaxation is stored per recruitment; it does not stack with category (max of the two).
    const maxAgeFor = (category?: string, gender?: string) => {
      let max = criteria.maxAgeGeneral + categoryRelax(category);
      if (gender === 'FEMALE' && (criteria.ageRelaxationFemale ?? 0) > 0) {
        max = Math.max(max, criteria.maxAgeGeneral + criteria.ageRelaxationFemale);
      }
      return max;
    };

    const maxAllowed = maxAgeFor(user.category, user.gender);
    const isMatch = completedYears >= criteria.minAge && completedYears <= maxAllowed;
    const formattedAge = ageAtCutoff.toFixed(1);

    // A missing category or gender must not cause a premature rejection: if the candidate
    // would pass under some possible answer, the result is NEEDS_VERIFICATION, not FAIL.
    const possibleMax = Math.max(
      ...(user.category ? [user.category] : ['UR', 'SC', 'OBC', 'EWS']).flatMap(c =>
        (user.gender ? [user.gender] : ['MALE', 'FEMALE']).map(g => maxAgeFor(c, g))
      )
    );
    const depends = !isMatch && completedYears >= criteria.minAge && completedYears <= possibleMax;

    const categoryRelaxation = categoryRelax(user.category);
    const femaleRelaxation = user.gender === 'FEMALE' ? (criteria.ageRelaxationFemale ?? 0) : 0;

    ageBreakdown = {
      baseMinAge: criteria.minAge,
      baseMaxAge: criteria.maxAgeGeneral,
      category: user.category || 'UR',
      categoryRelaxation,
      femaleRelaxation,
      effectiveMaxAge: maxAllowed,
      candidateAge: ageAtCutoff,
      cutoffDate: criteria.ageCutoffDate,
      isMatch,
    };

    items.push({
      ruleName: 'Age Requirement',
      status: isMatch ? 'MATCH' : depends ? 'UNKNOWN' : 'FAIL',
      userValue: `${formattedAge} years (as of ${criteria.ageCutoffDate})`,
      requirement: `${criteria.minAge}-${maxAllowed} years (as of ${criteria.ageCutoffDate})`,
      message: isMatch
        ? `Age (${formattedAge} yrs) is within eligible limits.`
        : depends
        ? `Age (${formattedAge} yrs) exceeds the general limit but may qualify with a category or gender relaxation (up to ${possibleMax} yrs). Provide category and gender to confirm.`
        : `Age (${formattedAge} yrs) falls outside the allowed limit (${criteria.minAge}-${maxAllowed} yrs).`,
    });
    }
  }

  // 4. Qualification Level & Stream / Subject Rule
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
    // A non-empty requirement we cannot rank must never pass silently (rank 0 would accept everyone).
    const unrecognisedRequirement = !!criteria.minQualificationLevel && QUALIFICATION_RANK[criteria.minQualificationLevel] === undefined;
    const isMatch = criteria.minQualificationLevel === 'ITI'
      ? user.qualificationLevel === 'ITI'
      : userRank >= requiredRank;

    items.push({
      ruleName: 'Educational Qualification',
      status: unrecognisedRequirement ? 'UNKNOWN' : isMatch ? 'MATCH' : 'FAIL',
      userValue: user.qualificationLevel,
      requirement: `Minimum ${criteria.minQualificationLevel}`,
      message: unrecognisedRequirement
        ? `Required qualification "${criteria.minQualificationLevel}" is not a recognised level. Verify against the notice.`
        : isMatch
        ? `Qualification (${user.qualificationLevel}) satisfies minimum (${criteria.minQualificationLevel}).`
        : `Qualification (${user.qualificationLevel}) is below required (${criteria.minQualificationLevel}).`,
    });

    // Specific degree/stream evaluation if post requires non-generic streams
    if (
      criteria.allowedStreams &&
      criteria.allowedStreams.length > 0 &&
      !criteria.allowedStreams.some(s => s.toUpperCase() === 'ANY')
    ) {
      if (!user.stream) {
        items.push({
          ruleName: 'Degree Subject / Stream',
          status: 'UNKNOWN',
          userValue: 'Not provided',
          requirement: `Required Stream: ${criteria.allowedStreams.join(' or ')}`,
          message: `Notice specifies degree specialization (${criteria.allowedStreams.join(', ')}). Candidate did not provide stream.`,
        });
      } else {
        const streamLower = user.stream.toLowerCase().trim();
        const streamTokens = streamLower.split(/[^a-z0-9]+/).filter(Boolean);
        // Substring matching only for 3+ chars so a one/two-letter entry cannot match every stream.
        const hasMatchingStream = criteria.allowedStreams.some(allowed => {
          const aLower = allowed.toLowerCase().trim();
          return aLower === streamLower
            || streamTokens.includes(aLower)
            || (aLower.length >= 3 && streamLower.includes(aLower))
            || (streamLower.length >= 3 && aLower.includes(streamLower));
        });

        items.push({
          ruleName: 'Degree Subject / Stream',
          status: hasMatchingStream ? 'MATCH' : 'FAIL',
          userValue: user.stream,
          requirement: `Required Stream: ${criteria.allowedStreams.join(' or ')}`,
          message: hasMatchingStream
            ? `Specialization (${user.stream}) satisfies requirement (${criteria.allowedStreams.join(', ')}).`
            : `Specialization (${user.stream}) does not match allowed streams (${criteria.allowedStreams.join(', ')}).`,
        });
      }
    }
  }

  // 5. Minimum Percentage Rule (only if the job specifies a threshold)
  if (criteria.minPercentageRequired && criteria.minPercentageRequired > 0) {
    if (user.percentage === undefined || user.percentage === null) {
      items.push({
        ruleName: 'Minimum Percentage',
        status: 'UNKNOWN',
        userValue: 'Not provided',
        requirement: `Minimum ${criteria.minPercentageRequired}%`,
        message: 'Percentage not provided. Cannot verify minimum marks requirement.',
      });
    } else {
      const isMatch = user.percentage >= criteria.minPercentageRequired;
      items.push({
        ruleName: 'Minimum Percentage',
        status: isMatch ? 'MATCH' : 'FAIL',
        userValue: `${user.percentage}%`,
        requirement: `Minimum ${criteria.minPercentageRequired}%`,
        message: isMatch
          ? `Percentage (${user.percentage}%) meets the minimum requirement (${criteria.minPercentageRequired}%).`
          : `Percentage (${user.percentage}%) is below the required minimum (${criteria.minPercentageRequired}%).`,
      });
    }
  }

  // 6. Recruitment-specific employment exchange/portal registration.
  if (criteria.requiresMpEmploymentReg) {
    const registration = criteria.employmentRegistrationLabel || 'MP_ROJGAR';
    const listMatch = user.registrations?.some(value => value.toUpperCase() === registration.toUpperCase());
    const hasRegistration = listMatch
      ? true
      : user.registrations
      ? registration.toUpperCase() === 'MP_ROJGAR' && user.hasMpRojgarPanjiyan === true
      : user.hasMpRojgarPanjiyan;
    if (hasRegistration === undefined) {
      items.push({
        ruleName: 'Employment Registration',
        status: 'UNKNOWN',
        userValue: 'Not provided',
        requirement: `Active ${registration} registration`,
        message: 'Required employment registration was not provided.',
      });
    } else if (!hasRegistration) {
      items.push({
        ruleName: 'Employment Registration',
        status: 'FAIL',
        userValue: 'No',
        requirement: `Active ${registration} registration`,
        message: `Active ${registration} registration is required by this recruitment.`,
      });
    } else {
      items.push({
        ruleName: 'Employment Registration',
        status: 'MATCH',
        userValue: 'Yes',
        requirement: 'Active registration',
        message: 'Employment portal registration satisfied.',
      });
    }
  }

  // 7. CPCT Certificate Rule
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

  // 8. Physical Standards — Height
  const genderUnknown = !user.gender;
  const heightsDiffer = (criteria.minHeightMaleCm ?? 0) !== (criteria.minHeightFemaleCm ?? 0);
  const minHeight = user.gender === 'FEMALE' ? criteria.minHeightFemaleCm : criteria.minHeightMaleCm;
  if (genderUnknown && heightsDiffer && ((criteria.minHeightMaleCm ?? 0) > 0 || (criteria.minHeightFemaleCm ?? 0) > 0)) {
    items.push({
      ruleName: 'Physical Standards (Height)',
      status: 'UNKNOWN',
      userValue: 'Gender not provided',
      requirement: `Male ${criteria.minHeightMaleCm ?? '-'} cm / Female ${criteria.minHeightFemaleCm ?? '-'} cm`,
      message: 'Height standard differs by gender and gender was not provided.',
    });
  } else if (minHeight && minHeight > 0) {
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

  // 9. Physical Standards — Chest (Male only for uniformed posts)
  if (criteria.minChestMaleCm && criteria.minChestMaleCm > 0 && genderUnknown) {
    items.push({
      ruleName: 'Physical Standards (Chest)',
      status: 'UNKNOWN',
      userValue: 'Gender not provided',
      requirement: `Minimum ${criteria.minChestMaleCm} cm (male candidates)`,
      message: 'Chest standard applies to male candidates and gender was not provided.',
    });
  } else if (criteria.minChestMaleCm && criteria.minChestMaleCm > 0 && user.gender !== 'FEMALE') {
    if (user.chestCm === undefined) {
      items.push({
        ruleName: 'Physical Standards (Chest)',
        status: 'UNKNOWN',
        userValue: 'Not provided',
        requirement: `Minimum ${criteria.minChestMaleCm} cm (unexpanded)`,
        message: 'Chest measurement not provided.',
      });
    } else if (user.chestCm < criteria.minChestMaleCm) {
      items.push({
        ruleName: 'Physical Standards (Chest)',
        status: 'FAIL',
        userValue: `${user.chestCm} cm`,
        requirement: `Minimum ${criteria.minChestMaleCm} cm`,
        message: `Chest measurement (${user.chestCm} cm) is below minimum required (${criteria.minChestMaleCm} cm).`,
      });
    } else {
      items.push({
        ruleName: 'Physical Standards (Chest)',
        status: 'MATCH',
        userValue: `${user.chestCm} cm`,
        requirement: `Minimum ${criteria.minChestMaleCm} cm`,
        message: `Chest standard satisfied (${user.chestCm} cm >= ${criteria.minChestMaleCm} cm).`,
      });
    }
  }

  // 10. Additional Skills / Exams (e.g., Hindi Typing, Stenographer Certification)
  if (criteria.additionalSkills && criteria.additionalSkills.length > 0) {
    if (!user.additionalSkills || user.additionalSkills.length === 0) {
      items.push({
        ruleName: 'Additional Skills / Certifications',
        status: 'UNKNOWN',
        userValue: 'Not provided',
        requirement: criteria.additionalSkills.join(', '),
        message: `Required certifications: ${criteria.additionalSkills.join(', ')}. Status not provided.`,
      });
    } else {
      const userSkillsNormalized = user.additionalSkills.map(s => s.toUpperCase().trim());
      const missingSkills = criteria.additionalSkills.filter(
        s => !userSkillsNormalized.includes(s.toUpperCase().trim())
      );

      if (missingSkills.length > 0) {
        items.push({
          ruleName: 'Additional Skills / Certifications',
          status: 'FAIL',
          userValue: user.additionalSkills.join(', '),
          requirement: criteria.additionalSkills.join(', '),
          message: `Missing required certifications: ${missingSkills.join(', ')}.`,
        });
      } else {
        items.push({
          ruleName: 'Additional Skills / Certifications',
          status: 'MATCH',
          userValue: user.additionalSkills.join(', '),
          requirement: criteria.additionalSkills.join(', '),
          message: 'All required certifications satisfied.',
        });
      }
    }
  }

  if ((criteria.experienceMonths ?? 0) > 0) {
    if (user.experienceMonths === undefined) {
      items.push({
        ruleName: 'Experience',
        status: 'UNKNOWN',
        userValue: 'Not provided',
        requirement: `${criteria.experienceMonths} months`,
        message: 'Required experience cannot be verified without the candidate’s experience duration.',
      });
    } else {
      const meetsExperience = user.experienceMonths >= (criteria.experienceMonths ?? 0);
      items.push({
        ruleName: 'Experience',
        status: meetsExperience ? 'MATCH' : 'FAIL',
        userValue: `${user.experienceMonths} months`,
        requirement: `${criteria.experienceMonths} months`,
        message: meetsExperience ? 'Experience requirement satisfied.' : 'Candidate experience is below the required duration.',
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
    ageRelaxationBreakdown: ageBreakdown,
  };
}

function parseIsoDate(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  // Reject rolled-over dates such as 2000-02-31.
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return { y, m, d };
}

/** Whole years completed on the cutoff date (timezone-independent). NaN for invalid input or DOB after cutoff. */
export function completedYearsAtCutoff(dobStr: string, cutoffStr: string): number {
  const dob = parseIsoDate(dobStr);
  const cutoff = parseIsoDate(cutoffStr);
  if (!dob || !cutoff) return Number.NaN;
  if (Date.UTC(dob.y, dob.m - 1, dob.d) > Date.UTC(cutoff.y, cutoff.m - 1, cutoff.d)) return Number.NaN;
  let years = cutoff.y - dob.y;
  if (cutoff.m < dob.m || (cutoff.m === dob.m && cutoff.d < dob.d)) years--;
  return years;
}

/** Fractional age on the cutoff date, for display. Eligibility compares completedYearsAtCutoff. */
export function calculateAgeAtCutoff(dobStr: string, cutoffStr: string): number {
  const years = completedYearsAtCutoff(dobStr, cutoffStr);
  if (!Number.isFinite(years)) return Number.NaN;
  const dob = parseIsoDate(dobStr)!;
  const cutoff = parseIsoDate(cutoffStr)!;
  const anniversary = Date.UTC(dob.y + years, dob.m - 1, dob.d);
  const diffDays = (Date.UTC(cutoff.y, cutoff.m - 1, cutoff.d) - anniversary) / 86_400_000;
  return Math.max(0, years + diffDays / 365.25);
}
