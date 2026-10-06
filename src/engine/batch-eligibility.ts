/**
 * Batch Eligibility Engine
 *
 * Production-grade getEligibleJobs() that fixes all 14 bugs from the
 * user-provided pseudocode. Wraps the single-recruitment evaluateEligibility()
 * and returns three-bucket categorization with structured progressive questions.
 */
import {
  evaluateEligibility,
  type UserEligibilityProfile,
  type RecruitmentCriteria,
  type OverallEligibilityStatus,
  type RuleEvaluationItem,
} from './eligibility';

/** Recruitment record as stored in DB / returned by queries */
export interface RecruitmentRecord {
  id: string;
  title: string;
  slug: string;
  advtNumber: string;
  totalVacancies: number;
  postTitle: string;
  organisationName: string;
  organisationShortName: string;
  isFeatured: number;
  lifecycleStatus: string;
  criteria: RecruitmentCriteria;
}

/** Single evaluated recruitment with full rule breakdown */
export interface EvaluatedRecruitment {
  recruitment: RecruitmentRecord;
  overallStatus: OverallEligibilityStatus;
  items: RuleEvaluationItem[];
  matchedCount: number;
  failedCount: number;
  unknownCount: number;
}

/**
 * A structured question to ask the user when their profile has missing data
 * that affects one or more recruitment evaluations. Unlike the pseudocode's
 * raw field names, these carry Hindi/English labels for direct UI rendering.
 */
export interface StructuredQuestion {
  fieldKey: keyof UserEligibilityProfile;
  labelHindi: string;
  labelEnglish: string;
  description: string;
  inputType: 'boolean' | 'number' | 'text' | 'select';
  /** IDs of recruitments that this missing field affects */
  affectsRecruitmentIds: string[];
}

/** The complete batch evaluation result */
export interface BatchEligibilityResult {
  eligible: EvaluatedRecruitment[];
  pending: EvaluatedRecruitment[];
  ineligible: EvaluatedRecruitment[];
  askNextQuestions: StructuredQuestion[];
  summary: {
    totalEvaluated: number;
    eligibleCount: number;
    pendingCount: number;
    ineligibleCount: number;
  };
}

/**
 * Explicit mapping from rule names to user profile field keys.
 * Bug #1 fix: the pseudocode used string.replace('_mandatory', '') which
 * produced wrong keys (cpct_mandatory → cpct, but profile uses hasCpct).
 * This map ensures correct lookup.
 */
// Keys MUST equal the `ruleName` strings emitted by evaluateEligibility(); a mismatch silently
// drops the question (the old state-specific rule-name keys never matched).
const RULE_TO_PROFILE_FIELD: Record<string, keyof UserEligibilityProfile> = {
  'State Domicile': 'isMpDomicile',
  'Employment Registration': 'hasMpRojgarPanjiyan',
  'Gender': 'gender',
  'Educational Qualification': 'qualificationLevel',
  'Degree Subject / Stream': 'stream',
  'Experience': 'experienceMonths',
  'CPCT Scorecard': 'hasCpct',
  'Physical Standards (Height)': 'heightCm',
  'Physical Standards (Chest)': 'chestCm',
  'Minimum Percentage': 'percentage',
  'Additional Skills / Certifications': 'additionalSkills',
};

/** Label registry for building structured questions */
const FIELD_QUESTION_META: Record<string, Omit<StructuredQuestion, 'fieldKey' | 'affectsRecruitmentIds'>> = {
  isMpDomicile: {
    labelHindi: 'क्या आप भर्ती करने वाले राज्य के मूल निवासी हैं?',
    labelEnglish: 'Are you a domiciled (permanent) resident of the state conducting this recruitment?',
    description: 'A state domicile / Mool Niwasi certificate is required for many state government posts. Answer for the state that issued the notification.',
    inputType: 'boolean',
  },
  hasMpRojgarPanjiyan: {
    labelHindi: 'क्या आपका राज्य रोज़गार कार्यालय पंजीयन सक्रिय है?',
    labelEnglish: 'Do you have an active state employment exchange registration?',
    description: 'Some states make employment exchange registration mandatory for their state posts.',
    inputType: 'boolean',
  },
  hasCpct: {
    labelHindi: 'क्या आपके पास वैध CPCT स्कोरकार्ड है?',
    labelEnglish: 'Do you have a valid CPCT scorecard with Hindi typing?',
    description: 'CPCT (Computer Proficiency Certification Test) is required for clerical and Patwari posts.',
    inputType: 'boolean',
  },
  heightCm: {
    labelHindi: 'आपकी ऊंचाई (सेंटीमीटर में)?',
    labelEnglish: 'Your height in centimeters?',
    description: 'Physical height measurement is required for uniformed posts (Police, Forest Guard).',
    inputType: 'number',
  },
  chestCm: {
    labelHindi: 'आपकी छाती की माप (सेंटीमीटर)?',
    labelEnglish: 'Your chest measurement in centimeters (unexpanded)?',
    description: 'Chest measurement is required for male candidates in uniformed posts.',
    inputType: 'number',
  },
  percentage: {
    labelHindi: 'आपके अंकों का प्रतिशत?',
    labelEnglish: 'Your percentage of marks in qualifying examination?',
    description: 'Some posts require a minimum percentage in the qualifying degree.',
    inputType: 'number',
  },
  dob: {
    labelHindi: 'आपकी जन्म तिथि?',
    labelEnglish: 'Your date of birth?',
    description: 'Age is calculated on each recruitment’s own cutoff date.',
    inputType: 'text',
  },
  category: {
    labelHindi: 'आपकी श्रेणी (UR / OBC / SC / ST / EWS)?',
    labelEnglish: 'Your category (UR / OBC / SC / ST / EWS)?',
    description: 'Age relaxation depends on category.',
    inputType: 'select',
  },
  gender: {
    labelHindi: 'आपका लिंग?',
    labelEnglish: 'Your gender?',
    description: 'Some posts are gender-specific, and age relaxation and physical standards differ by gender.',
    inputType: 'select',
  },
  qualificationLevel: {
    labelHindi: 'आपकी सर्वोच्च शैक्षणिक योग्यता?',
    labelEnglish: 'Your highest educational qualification?',
    description: 'Every post sets a minimum qualification.',
    inputType: 'select',
  },
  stream: {
    labelHindi: 'आपकी डिग्री का विषय / स्ट्रीम?',
    labelEnglish: 'Your degree subject or stream?',
    description: 'Some posts accept only specific degree streams.',
    inputType: 'text',
  },
  experienceMonths: {
    labelHindi: 'आपका कार्य अनुभव (महीनों में)?',
    labelEnglish: 'Your relevant work experience in months?',
    description: 'Some posts require prior experience.',
    inputType: 'number',
  },
  additionalSkills: {
    labelHindi: 'अतिरिक्त कौशल या प्रमाणपत्र?',
    labelEnglish: 'Additional skills or certifications you hold?',
    description: 'Some posts require specific certifications like Hindi Typing, Stenographer, etc.',
    inputType: 'text',
  },
};

/**
 * Production-grade batch eligibility evaluation.
 *
 * Fixes vs the user's pseudocode:
 *  #1  - Explicit field mapping, not string.replace
 *  #2  - Age calculated from DOB + cutoff date, not flat integer
 *  #3  - Per-category relaxation (SC/ST +5, OBC +3, EWS 0), not binary UR/reserved
 *  #4  - 6-level qualification rank including 8th and Diploma
 *  #5  - Gender filter checks (MALE/FEMALE/ALL)
 *  #6  - Physical standards checks (height + chest)
 *  #7  - Additional skills validation
 *  #8  - Percentage check is UNKNOWN when missing, not FAIL
 *  #9  - Clean control flow with single-pass evaluation
 *  #10 - EWS handled explicitly (0 relaxation)
 *  #11 - Progressive questioning with re-evaluation support
 *  #12 - Structured question objects with Hindi/English labels
 *  #13 - Organisation vs Department distinction maintained
 *  #14 - Results sorted by featured → vacancies → lifecycle
 */
export function getEligibleJobs(
  userProfile: UserEligibilityProfile,
  allJobs: RecruitmentRecord[]
): BatchEligibilityResult {
  const eligible: EvaluatedRecruitment[] = [];
  const pending: EvaluatedRecruitment[] = [];
  const ineligible: EvaluatedRecruitment[] = [];

  // Track which missing fields affect which jobs (for progressive questioning)
  const missingFieldToJobs = new Map<string, Set<string>>();

  for (const job of allJobs) {
    const evalResult = evaluateEligibility(userProfile, job.criteria);

    const evaluated: EvaluatedRecruitment = {
      recruitment: job,
      overallStatus: evalResult.overallStatus,
      items: evalResult.items,
      matchedCount: evalResult.matchedCount,
      failedCount: evalResult.failedCount,
      unknownCount: evalResult.unknownCount,
    };

    if (evalResult.overallStatus === 'NOT_ELIGIBLE') {
      ineligible.push(evaluated);
    } else if (evalResult.overallStatus === 'NEEDS_VERIFICATION') {
      pending.push(evaluated);

      // Track which fields are unknown for progressive questioning
      for (const item of evalResult.items) {
        if (item.status === 'UNKNOWN') {
          // Age can be unknown for three different reasons; ask for the one that is actually missing.
          const fieldKey = item.ruleName === 'Age Requirement'
            ? (!userProfile.dob ? 'dob' : !userProfile.category ? 'category' : 'gender')
            : RULE_TO_PROFILE_FIELD[item.ruleName];
          if (fieldKey) {
            if (!missingFieldToJobs.has(fieldKey)) {
              missingFieldToJobs.set(fieldKey, new Set());
            }
            missingFieldToJobs.get(fieldKey)!.add(job.id);
          }
        }
      }
    } else {
      eligible.push(evaluated);
    }
  }

  // Sort each bucket: featured first, then by vacancy count descending, then by lifecycle
  const lifecyclePriority: Record<string, number> = {
    'APPLICATION_OPEN': 1,
    'OPEN': 1,
    'APPLICATION_CLOSING': 2,
    'CLOSING_SOON': 2,
    'NOT_STARTED': 3,
    'UPCOMING': 3,
    'APPLICATION_CLOSED': 4,
    'CLOSED': 4,
    'EXAM_SCHEDULED': 5,
    'EXAM_COMPLETED': 6,
    'EXAM_HELD': 6,
    'RESULT_DECLARED': 7,
    'RESULT_OUT': 7,
  };

  const sortFn = (a: EvaluatedRecruitment, b: EvaluatedRecruitment) => {
    // Featured first
    if (a.recruitment.isFeatured !== b.recruitment.isFeatured) {
      return b.recruitment.isFeatured - a.recruitment.isFeatured;
    }
    // Then by lifecycle priority (OPEN jobs first)
    const aLifecycle = lifecyclePriority[a.recruitment.lifecycleStatus] ?? 99;
    const bLifecycle = lifecyclePriority[b.recruitment.lifecycleStatus] ?? 99;
    if (aLifecycle !== bLifecycle) return aLifecycle - bLifecycle;
    // Then by vacancy count descending
    return b.recruitment.totalVacancies - a.recruitment.totalVacancies;
  };

  eligible.sort(sortFn);
  pending.sort(sortFn);
  ineligible.sort(sortFn);

  // Build structured questions from missing fields
  const askNextQuestions: StructuredQuestion[] = [];
  for (const [fieldKey, jobIds] of missingFieldToJobs.entries()) {
    const meta = FIELD_QUESTION_META[fieldKey];
    if (meta) {
      askNextQuestions.push({
        fieldKey: fieldKey as keyof UserEligibilityProfile,
        ...meta,
        affectsRecruitmentIds: Array.from(jobIds),
      });
    }
  }

  // Sort questions by how many jobs they affect (most impactful first)
  askNextQuestions.sort((a, b) => b.affectsRecruitmentIds.length - a.affectsRecruitmentIds.length);

  return {
    eligible,
    pending,
    ineligible,
    askNextQuestions,
    summary: {
      totalEvaluated: allJobs.length,
      eligibleCount: eligible.length,
      pendingCount: pending.length,
      ineligibleCount: ineligible.length,
    },
  };
}
