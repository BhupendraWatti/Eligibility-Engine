/**
 * NIRNAY Central Publication Validation Guard
 * 
 * Enforces a strict 6-stage verification pipeline before any recruitment
 * can transition to PUBLISHED state or be rendered on public portals.
 */

export interface ValidationCheckState {
  recruitment: 'PASS' | 'FAIL' | 'WARNING';
  canonicalMapping: 'PASS' | 'FAIL' | 'WARNING';
  source: 'PASS' | 'FAIL' | 'WARNING';
  eligibility: 'PASS' | 'FAIL' | 'WARNING';
  organisation: 'PASS' | 'FAIL' | 'WARNING';
  content: 'PASS' | 'FAIL' | 'WARNING';
}

export interface PublicationValidationResult {
  publishable: boolean;
  checks: ValidationCheckState;
  blockingErrors: string[];
  warnings: string[];
}

export interface RecruitmentValidationInput {
  id?: string;
  title: string;
  slug: string;
  /** null is valid: the official notice may state no advertisement number. */
  advtNumber?: string | null;
  cycleYear: number;
  totalVacancies: number;
  status?: string;
  lifecycleStatus?: string;
  shortSummary?: string;
  postId?: string;
  postTitle?: string;
  postSlug?: string;
  departmentId?: string;
  departmentName?: string;
  organisationId?: string;
  organisationShortName?: string;
  organisationName?: string;
  applicationStart?: string;
  applicationEnd?: string;
  examDate?: string;
  criteria?: {
    minAge?: number;
    maxAgeGeneral?: number;
    ageCutoffDate?: string;
    ageRelaxationScSt?: number;
    ageRelaxationObc?: number;
    ageRelaxationFemale?: number;
    ageRelaxationEws?: number;
    minQualificationLevel?: string;
    requiresMpDomicile?: boolean;
    requiresMpEmploymentReg?: boolean;
    requiresCpct?: boolean;
    genderAllowed?: 'ALL' | 'MALE' | 'FEMALE';
    minHeightMaleCm?: number | null;
    minHeightFemaleCm?: number | null;
    minChestMaleCm?: number | null;
  };
  sources?: Array<{
    sourceType: string;
    sourceUrl: string;
    sourceTitle: string;
    publicationDate?: string;
    status?: 'VALID' | 'EXPIRED' | 'INVALID' | 'MISSING' | 'NEEDS_REVIEW';
  }>;
  vacancies?: Array<{
    category: string;
    count: number;
  }>;
}

const VALID_QUALIFICATIONS = new Set([
  '7TH',
  '8TH',
  '10TH',
  '12TH',
  'ITI',
  'DIPLOMA',
  'GRADUATION',
  'POST_GRADUATION',
]);

/**
 * Validate a recruitment record across all 6 integrity dimensions.
 */
export function validateRecruitmentForPublication(
  record: RecruitmentValidationInput
): PublicationValidationResult {
  const blockingErrors: string[] = [];
  const warnings: string[] = [];

  const checks: ValidationCheckState = {
    recruitment: 'PASS',
    canonicalMapping: 'PASS',
    source: 'PASS',
    eligibility: 'PASS',
    organisation: 'PASS',
    content: 'PASS',
  };

  // ============================================================================
  // 1. Recruitment Validation
  // ============================================================================
  if (!record.title || record.title.trim().length < 5) {
    blockingErrors.push('Recruitment title is required (minimum 5 characters).');
    checks.recruitment = 'FAIL';
  }

  if (!record.slug || record.slug.trim().length < 3) {
    blockingErrors.push('Recruitment URL slug is required.');
    checks.recruitment = 'FAIL';
  }

  if (!record.cycleYear || record.cycleYear < 2020 || record.cycleYear > 2035) {
    blockingErrors.push(`Cycle year (${record.cycleYear}) must be a realistic recruitment calendar year.`);
    checks.recruitment = 'FAIL';
  }

  if (typeof record.totalVacancies !== 'number' || record.totalVacancies < 0) {
    blockingErrors.push('Total vacancies count cannot be negative.');
    checks.recruitment = 'FAIL';
  }

  // Dates validation
  if (record.applicationStart && record.applicationEnd) {
    if (new Date(record.applicationStart) > new Date(record.applicationEnd)) {
      blockingErrors.push('Application closing date cannot be before application opening date.');
      checks.recruitment = 'FAIL';
    }
  }

  if (record.applicationEnd && record.examDate) {
    if (new Date(record.applicationEnd) > new Date(record.examDate)) {
      warnings.push('Scheduled examination date is before or on application closing date.');
      if (checks.recruitment !== 'FAIL') checks.recruitment = 'WARNING';
    }
  }

  // Vacancy category sum check
  if (record.vacancies && record.vacancies.length > 0) {
    const sumCount = record.vacancies.reduce((sum, v) => sum + (v.count || 0), 0);
    if (sumCount !== record.totalVacancies) {
      warnings.push(`Sum of category vacancies (${sumCount}) does not match declared total vacancies (${record.totalVacancies}).`);
      if (checks.recruitment !== 'FAIL') checks.recruitment = 'WARNING';
    }
  }

  // ============================================================================
  // 2. Canonical Mapping Validation
  // ============================================================================
  if (!record.postId || record.postId.trim().length === 0) {
    blockingErrors.push('Canonical post mapping is required. Every recruitment must map to a verified canonical post.');
    checks.canonicalMapping = 'FAIL';
  }

  // Prevent dangerous Police Constable accidental fallback for non-police posts
  const titleLower = record.title.toLowerCase();
  const orgLower = (record.organisationShortName || '').toLowerCase();
  const postTitleLower = (record.postTitle || '').toLowerCase();

  const isMppsc = orgLower.includes('mppsc') || titleLower.includes('mppsc');
  const isConstable = postTitleLower.includes('police constable') || (record.postId && record.postId.includes('constable'));

  if (isMppsc && isConstable) {
    blockingErrors.push('Critical Mapping Corruption: MPPSC recruitment cannot map to Police Constable post.');
    checks.canonicalMapping = 'FAIL';
  }

  // ============================================================================
  // 3. Source Validation
  // ============================================================================
  if (!record.sources || record.sources.length === 0) {
    blockingErrors.push('At least one official government source URL or rulebook PDF is mandatory for publication.');
    checks.source = 'FAIL';
  } else {
    const hasValidSource = record.sources.some(s => {
      if (!s.sourceUrl || !s.sourceUrl.startsWith('http')) return false;
      if (s.status === 'EXPIRED' || s.status === 'INVALID') return false;
      return true;
    });

    if (!hasValidSource) {
      blockingErrors.push('No active, verified official government source URL found.');
      checks.source = 'FAIL';
    }

    const hasExpiredSource = record.sources.some(s => s.status === 'EXPIRED');
    if (hasExpiredSource && checks.source !== 'FAIL') {
      warnings.push('One or more associated source URLs are flagged as expired.');
      checks.source = 'WARNING';
    }
  }

  // ============================================================================
  // 4. Eligibility Validation
  // ============================================================================
  if (!record.criteria) {
    blockingErrors.push('Recruitment criteria definition is required for deterministic engine evaluation.');
    checks.eligibility = 'FAIL';
  } else {
    const c = record.criteria;
    if (c.minAge === undefined || c.minAge < 14 || c.minAge > 45) {
      blockingErrors.push(`Invalid minimum age limit (${c.minAge}). Must be between 14 and 45.`);
      checks.eligibility = 'FAIL';
    }

    if (c.maxAgeGeneral === undefined || c.maxAgeGeneral < 18 || c.maxAgeGeneral > 65) {
      blockingErrors.push(`Invalid maximum age limit (${c.maxAgeGeneral}). Must be between 18 and 65.`);
      checks.eligibility = 'FAIL';
    }

    if (c.minAge !== undefined && c.maxAgeGeneral !== undefined && c.minAge > c.maxAgeGeneral) {
      blockingErrors.push(`Minimum age (${c.minAge}) cannot exceed maximum age (${c.maxAgeGeneral}).`);
      checks.eligibility = 'FAIL';
    }

    if (!c.ageCutoffDate || !/^\d{4}-\d{2}-\d{2}$/.test(c.ageCutoffDate)) {
      blockingErrors.push('Age cutoff date must be in YYYY-MM-DD format.');
      checks.eligibility = 'FAIL';
    }

    if (!c.minQualificationLevel || !VALID_QUALIFICATIONS.has(c.minQualificationLevel)) {
      blockingErrors.push(`Invalid qualification level '${c.minQualificationLevel}'. Must be one of: 8TH, 10TH, 12TH, DIPLOMA, GRADUATION, POST_GRADUATION.`);
      checks.eligibility = 'FAIL';
    }

    if ((c.ageRelaxationScSt ?? 0) < 0 || (c.ageRelaxationObc ?? 0) < 0 || (c.ageRelaxationFemale ?? 0) < 0) {
      blockingErrors.push('Age relaxations must be non-negative values.');
      checks.eligibility = 'FAIL';
    }

    // Physical standards bounds check if provided
    if (c.minHeightMaleCm !== null && c.minHeightMaleCm !== undefined) {
      if (c.minHeightMaleCm < 140 || c.minHeightMaleCm > 220) {
        blockingErrors.push(`Male height requirement (${c.minHeightMaleCm} cm) is outside plausible range (140-220 cm).`);
        checks.eligibility = 'FAIL';
      }
    }
  }

  // ============================================================================
  // 5. Organisation Validation
  // ============================================================================
  if (!record.organisationShortName && !record.organisationName && !record.organisationId) {
    blockingErrors.push('Recruiting authority organisation must be explicitly specified.');
    checks.organisation = 'FAIL';
  }

  // Ensure organisation matches authority domain
  if (record.organisationShortName === 'MPPSC' && record.sources) {
    const hasWrongDomain = record.sources.some(s => s.sourceUrl && s.sourceUrl.includes('esb.mp.gov.in'));
    if (hasWrongDomain) {
      blockingErrors.push('Organisation mismatch: MPPSC recruitment source points to MPESB domain.');
      checks.organisation = 'FAIL';
    }
  }

  // ============================================================================
  // 6. Content Validation
  // ============================================================================
  if (record.shortSummary) {
    const summaryLower = record.shortSummary.toLowerCase();
    if (isMppsc && summaryLower.includes('police constable')) {
      blockingErrors.push('Content Contradiction: MPPSC recruitment summary contains Police Constable description.');
      checks.content = 'FAIL';
    }
  }

  const publishable = blockingErrors.length === 0;

  return {
    publishable,
    checks,
    blockingErrors,
    warnings,
  };
}
