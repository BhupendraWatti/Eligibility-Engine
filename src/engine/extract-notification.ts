/**
 * Notification Text Extractor
 *
 * Rule-based extraction of eligibility constraints from MP government
 * job notification text. Deterministic, auditable, no LLM hallucination.
 *
 * Extracts age limits, qualification, domicile, CPCT, physical standards,
 * and returns a structured JSON with confidence scores per field.
 */

export interface ExtractedField<T> {
  value: T;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sourceSnippet: string; // The text passage this was extracted from
}

export interface ExtractedNotification {
  jobTitle: ExtractedField<string> | null;
  organisation: ExtractedField<string> | null;
  department: ExtractedField<string> | null;
  advtNumber: ExtractedField<string> | null;
  totalVacancies: ExtractedField<number> | null;
  minAge: ExtractedField<number> | null;
  maxAgeGeneral: ExtractedField<number> | null;
  ageCutoffDate: ExtractedField<string> | null;
  ageRelaxationScSt: ExtractedField<number> | null;
  ageRelaxationObc: ExtractedField<number> | null;
  ageRelaxationFemale: ExtractedField<number> | null;
  minQualificationLevel: ExtractedField<string> | null;
  requiresMpDomicile: ExtractedField<boolean> | null;
  requiresMpEmploymentReg: ExtractedField<boolean> | null;
  requiresCpct: ExtractedField<boolean> | null;
  genderAllowed: ExtractedField<'ALL' | 'MALE' | 'FEMALE'> | null;
  minHeightMaleCm: ExtractedField<number> | null;
  minHeightFemaleCm: ExtractedField<number> | null;
  minChestMaleCm: ExtractedField<number> | null;
  minPercentageRequired: ExtractedField<number> | null;
  additionalSkills: ExtractedField<string[]> | null;
  /** Fields that could not be extracted — admin must fill manually */
  unextractedFields: string[];
  /** Overall extraction quality score 0-100 */
  extractionScore: number;
}

// ---------------------------------------------------------------------------
// Pattern bank for MP government notification text
// Supports both Hindi and English patterns
// ---------------------------------------------------------------------------

const PATTERNS = {
  // Age patterns
  age_range: /(?:आयु|age|उम्र)\s*[:—-]?\s*(\d{1,2})\s*(?:से|to|-|–)\s*(\d{1,2})\s*(?:वर्ष|years?|yrs?)/gi,
  min_age: /(?:न्यूनतम|minimum|min)\s*(?:आयु|age)\s*[:—-]?\s*(\d{1,2})\s*(?:वर्ष|years?)/gi,
  max_age: /(?:अधिकतम|maximum|max)\s*(?:आयु|age)\s*[:—-]?\s*(\d{1,2})\s*(?:वर्ष|years?)/gi,
  age_cutoff: /(?:आयु\s*(?:की\s*)?(?:गणना|परिगणना)|age\s*(?:as\s*on|calculated?\s*(?:as\s*)?on|reckoned))\s*[:—-]?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/gi,

  // Relaxation patterns
  sc_st_relaxation: /(?:अ\.जा\.|अ\.ज\.जा\.|SC\/ST|SC\s*&\s*ST)\s*[:—-]?\s*(?:के\s*लिए\s*)?(\d{1,2})\s*(?:वर्ष|years?)\s*(?:की\s*छूट|relaxation)/gi,
  obc_relaxation: /(?:अ\.पि\.व\.|OBC)\s*[:—-]?\s*(?:के\s*लिए\s*)?(\d{1,2})\s*(?:वर्ष|years?)\s*(?:की\s*छूट|relaxation)/gi,
  female_relaxation: /(?:महिला|female|women)\s*[:—-]?\s*(?:के\s*लिए\s*)?(\d{1,2})\s*(?:वर्ष|years?)\s*(?:की\s*छूट|relaxation)/gi,

  // Qualification patterns — word boundaries prevent matching inside 'registration'
  qualification: /(?:शैक्षणिक\s*योग्यता|educational?\s*qualification|minimum\s*qualification)\s*[:—-]?\s*(.*?)(?:\.|$)/gim,
  tenth_pass: /(?:10(?:th|वीं)|दसवीं|हाई\s*स्कूल|matric(?:ulation)?|high\s*school)\s*(?:उत्तीर्ण|pass(?:ed)?)/gi,
  twelfth_pass: /(?:12(?:th|वीं)|बारहवीं|हायर\s*सेकेंडरी|inter(?:mediate)?|higher\s*secondary)\s*(?:उत्तीर्ण|pass(?:ed)?)/gi,
  graduation: /(?:स्नातक|\bgraduat(?:e|ion)\b|bachelor['’]?s?\s*degree|\bBA\b|\bBSc\b|\bBCom\b|\bB\.?Tech\b|\bB\.?E\.?\b)/gi,
  post_graduation: /(?:स्नातकोत्तर|\bpost[\s-]*graduat(?:e|ion)\b|master['’]?s?\s*degree|\bMA\b|\bMSc\b|\bM\.?Tech\b|\bM\.?E\.?\b)/gi,
  diploma: /(?:डिप्लोमा|\bdiploma\b|\bpolytechnic\b)/gi,
  eighth_pass: /(?:8(?:th|वीं)|आठवीं)\s*(?:उत्तीर्ण|pass(?:ed)?)/gi,

  // Organisation patterns
  mpesb: /(?:MPESB|मध्य\s*प्रदेश\s*कर्मचारी\s*चयन\s*मंडल|MP\s*Employees?\s*Selection\s*Board|ESB)/gi,
  mppsc: /(?:MPPSC|मध्य\s*प्रदेश\s*लोक\s*सेवा\s*आयोग|MP\s*Public\s*Service\s*Commission)/gi,
  mphc: /(?:MPHC|मध्य\s*प्रदेश\s*उच्च\s*न्यायालय|High\s*Court\s*(?:of\s*)?(?:MP|Madhya\s*Pradesh))/gi,

  // Domicile
  mp_domicile: /(?:मध्य\s*प्रदेश\s*(?:का\s*)?(?:मूल\s*निवासी|स्थायी\s*निवासी)|MP\s*(?:domicile|resident)|permanent\s*resident\s*of\s*(?:MP|Madhya\s*Pradesh))/gi,

  // Employment registration
  rojgar_panjiyan: /(?:रोज़गार\s*पंजीयन|employment\s*(?:exchange|registration)|mprojgar|rojgar\s*panjiyan)/gi,

  // CPCT
  cpct: /(?:CPCT|कंप्यूटर\s*दक्षता\s*प्रमाणपत्र\s*परीक्षा|Computer\s*Proficiency\s*Certification\s*Test)/gi,

  // Physical standards — flexible to match various formats
  height_male: /(?:पुरुष|male|men)\s*(?:.*?)(?:ऊंचाई|height)\s*[:—-]?\s*(\d{2,3})\s*(?:से\.?मी\.?|cm|centimeter)/gi,
  height_female: /(?:महिला|female|women)\s*(?:.*?)(?:ऊंचाई|height)\s*[:—-]?\s*(\d{2,3})\s*(?:से\.?मी\.?|cm|centimeter)/gi,
  height_generic: /(?:ऊंचाई|height)\s*[:—-]?\s*(\d{2,3})\s*(?:से\.?मी\.?|cm)/gi,
  chest: /(?:छाती|chest)\s*[:—-]?\s*(\d{2,3})\s*(?:से\.?मी\.?|cm)/gi,

  // Vacancy count — matches both "7,500 Vacancies" and "पद: 3,550"
  vacancies: /(\d{1,6}(?:,\d{3})*)\s*(?:पद|रिक्तियां|vacancies?|posts?)|(?:कुल\s*)?(?:पद|रिक्तियां|vacancies?|posts?)\s*[:—-]?\s*(\d{1,6}(?:,\d{3})*)/gi,

  // Advertisement number
  advt_number: /(?:विज्ञापन\s*(?:क्र|संख्या)|advt\.?\s*(?:no|number)\.?)\s*[:—-]?\s*([\w\-\/]+)/gi,

  // Percentage
  percentage: /(?:न्यूनतम|minimum)?\s*(\d{1,3})\s*(?:प्रतिशत|%|percent)/gi,

  // Gender restriction
  male_only: /(?:केवल\s*पुरुष|only\s*(?:for\s*)?male|male\s*candidates?\s*only)/gi,
  female_only: /(?:केवल\s*महिला|only\s*(?:for\s*)?female|female\s*candidates?\s*only)/gi,

  // Skills
  hindi_typing: /(?:हिंदी\s*टाइपिंग|hindi\s*typing)/gi,
  steno: /(?:आशुलिपि|steno(?:graphy|grapher)?)/gi,
  computer_diploma: /(?:DCA|PGDCA|कंप्यूटर\s*डिप्लोमा|computer\s*diploma)/gi,
};

/**
 * Extract eligibility constraints from raw notification text.
 * Returns structured JSON with confidence scores.
 */
export function extractNotification(rawText: string): ExtractedNotification {
  const result: ExtractedNotification = {
    jobTitle: null,
    organisation: null,
    department: null,
    advtNumber: null,
    totalVacancies: null,
    minAge: null,
    maxAgeGeneral: null,
    ageCutoffDate: null,
    ageRelaxationScSt: null,
    ageRelaxationObc: null,
    ageRelaxationFemale: null,
    minQualificationLevel: null,
    requiresMpDomicile: null,
    requiresMpEmploymentReg: null,
    requiresCpct: null,
    genderAllowed: null,
    minHeightMaleCm: null,
    minHeightFemaleCm: null,
    minChestMaleCm: null,
    minPercentageRequired: null,
    additionalSkills: null,
    unextractedFields: [],
    extractionScore: 0,
  };

  const text = rawText.replace(/\r\n/g, '\n');

  // --- Organisation ---
  if (PATTERNS.mpesb.test(text)) {
    const match = text.match(PATTERNS.mpesb);
    result.organisation = { value: 'MPESB', confidence: 'HIGH', sourceSnippet: match?.[0] || '' };
  } else if (PATTERNS.mppsc.test(text)) {
    const match = text.match(PATTERNS.mppsc);
    result.organisation = { value: 'MPPSC', confidence: 'HIGH', sourceSnippet: match?.[0] || '' };
  } else if (PATTERNS.mphc.test(text)) {
    const match = text.match(PATTERNS.mphc);
    result.organisation = { value: 'MPHC', confidence: 'HIGH', sourceSnippet: match?.[0] || '' };
  } else {
    result.unextractedFields.push('organisation');
  }

  // --- Advertisement Number ---
  const advtMatch = new RegExp(PATTERNS.advt_number.source, PATTERNS.advt_number.flags).exec(text);
  if (advtMatch) {
    result.advtNumber = { value: advtMatch[1], confidence: 'HIGH', sourceSnippet: advtMatch[0] };
  } else {
    result.unextractedFields.push('advtNumber');
  }

  // --- Total Vacancies ---
  const vacMatch = new RegExp(PATTERNS.vacancies.source, PATTERNS.vacancies.flags).exec(text);
  if (vacMatch) {
    const rawCount = vacMatch[1] || vacMatch[2]; // Two alternation groups
    if (rawCount) {
      const count = parseInt(rawCount.replace(/,/g, ''), 10);
      result.totalVacancies = { value: count, confidence: 'HIGH', sourceSnippet: vacMatch[0] };
    }
  }
  if (!result.totalVacancies) {
    result.unextractedFields.push('totalVacancies');
  }

  // --- Age Range ---
  const ageMatch = new RegExp(PATTERNS.age_range.source, PATTERNS.age_range.flags).exec(text);
  if (ageMatch) {
    result.minAge = { value: parseInt(ageMatch[1], 10), confidence: 'HIGH', sourceSnippet: ageMatch[0] };
    result.maxAgeGeneral = { value: parseInt(ageMatch[2], 10), confidence: 'HIGH', sourceSnippet: ageMatch[0] };
  } else {
    // Try individual min/max
    const minMatch = new RegExp(PATTERNS.min_age.source, PATTERNS.min_age.flags).exec(text);
    const maxMatch = new RegExp(PATTERNS.max_age.source, PATTERNS.max_age.flags).exec(text);
    if (minMatch) result.minAge = { value: parseInt(minMatch[1], 10), confidence: 'MEDIUM', sourceSnippet: minMatch[0] };
    else result.unextractedFields.push('minAge');
    if (maxMatch) result.maxAgeGeneral = { value: parseInt(maxMatch[1], 10), confidence: 'MEDIUM', sourceSnippet: maxMatch[0] };
    else result.unextractedFields.push('maxAgeGeneral');
  }

  // --- Age Cutoff Date ---
  const cutoffMatch = new RegExp(PATTERNS.age_cutoff.source, PATTERNS.age_cutoff.flags).exec(text);
  if (cutoffMatch) {
    const day = cutoffMatch[1].padStart(2, '0');
    const month = cutoffMatch[2].padStart(2, '0');
    let year = cutoffMatch[3];
    if (year.length === 2) year = `20${year}`;
    result.ageCutoffDate = { value: `${year}-${month}-${day}`, confidence: 'HIGH', sourceSnippet: cutoffMatch[0] };
  } else {
    result.unextractedFields.push('ageCutoffDate');
  }

  // --- Relaxations ---
  const scStMatch = new RegExp(PATTERNS.sc_st_relaxation.source, PATTERNS.sc_st_relaxation.flags).exec(text);
  if (scStMatch) {
    result.ageRelaxationScSt = { value: parseInt(scStMatch[1], 10), confidence: 'HIGH', sourceSnippet: scStMatch[0] };
  }

  const obcMatch = new RegExp(PATTERNS.obc_relaxation.source, PATTERNS.obc_relaxation.flags).exec(text);
  if (obcMatch) {
    result.ageRelaxationObc = { value: parseInt(obcMatch[1], 10), confidence: 'HIGH', sourceSnippet: obcMatch[0] };
  }

  const femaleMatch = new RegExp(PATTERNS.female_relaxation.source, PATTERNS.female_relaxation.flags).exec(text);
  if (femaleMatch) {
    result.ageRelaxationFemale = { value: parseInt(femaleMatch[1], 10), confidence: 'HIGH', sourceSnippet: femaleMatch[0] };
  }

  // --- Qualification Level ---
  // Strategy: check SPECIFIC patterns first (10th pass, 12th pass) since they're
  // more precise, then fall back to generic graduation/post-graduation patterns.
  // Use the qualification context line if available for scoped matching.
  const qualLine = new RegExp(PATTERNS.qualification.source, PATTERNS.qualification.flags).exec(text);
  const qualContext = qualLine ? qualLine[0] : text;

  if (new RegExp(PATTERNS.tenth_pass.source, PATTERNS.tenth_pass.flags).test(qualContext)) {
    result.minQualificationLevel = { value: '10TH', confidence: 'HIGH', sourceSnippet: qualContext.match(new RegExp(PATTERNS.tenth_pass.source, PATTERNS.tenth_pass.flags))?.[0] || '' };
  } else if (new RegExp(PATTERNS.eighth_pass.source, PATTERNS.eighth_pass.flags).test(qualContext)) {
    result.minQualificationLevel = { value: '8TH', confidence: 'HIGH', sourceSnippet: qualContext.match(new RegExp(PATTERNS.eighth_pass.source, PATTERNS.eighth_pass.flags))?.[0] || '' };
  } else if (new RegExp(PATTERNS.twelfth_pass.source, PATTERNS.twelfth_pass.flags).test(qualContext)) {
    result.minQualificationLevel = { value: '12TH', confidence: 'HIGH', sourceSnippet: qualContext.match(new RegExp(PATTERNS.twelfth_pass.source, PATTERNS.twelfth_pass.flags))?.[0] || '' };
  } else if (new RegExp(PATTERNS.post_graduation.source, PATTERNS.post_graduation.flags).test(qualContext)) {
    result.minQualificationLevel = { value: 'POST_GRADUATION', confidence: 'MEDIUM', sourceSnippet: qualContext.match(new RegExp(PATTERNS.post_graduation.source, PATTERNS.post_graduation.flags))?.[0] || '' };
  } else if (new RegExp(PATTERNS.graduation.source, PATTERNS.graduation.flags).test(qualContext)) {
    result.minQualificationLevel = { value: 'GRADUATION', confidence: 'MEDIUM', sourceSnippet: qualContext.match(new RegExp(PATTERNS.graduation.source, PATTERNS.graduation.flags))?.[0] || '' };
  } else if (new RegExp(PATTERNS.diploma.source, PATTERNS.diploma.flags).test(qualContext)) {
    result.minQualificationLevel = { value: 'DIPLOMA', confidence: 'MEDIUM', sourceSnippet: qualContext.match(new RegExp(PATTERNS.diploma.source, PATTERNS.diploma.flags))?.[0] || '' };
  } else {
    result.unextractedFields.push('minQualificationLevel');
  }

  // --- MP Domicile ---
  if (new RegExp(PATTERNS.mp_domicile.source, PATTERNS.mp_domicile.flags).test(text)) {
    result.requiresMpDomicile = { value: true, confidence: 'HIGH', sourceSnippet: text.match(PATTERNS.mp_domicile)?.[0] || '' };
  }

  // --- Employment Registration ---
  if (new RegExp(PATTERNS.rojgar_panjiyan.source, PATTERNS.rojgar_panjiyan.flags).test(text)) {
    result.requiresMpEmploymentReg = { value: true, confidence: 'HIGH', sourceSnippet: text.match(PATTERNS.rojgar_panjiyan)?.[0] || '' };
  }

  // --- CPCT ---
  if (new RegExp(PATTERNS.cpct.source, PATTERNS.cpct.flags).test(text)) {
    result.requiresCpct = { value: true, confidence: 'HIGH', sourceSnippet: text.match(PATTERNS.cpct)?.[0] || '' };
  }

  // --- Gender ---
  if (new RegExp(PATTERNS.male_only.source, PATTERNS.male_only.flags).test(text)) {
    result.genderAllowed = { value: 'MALE', confidence: 'HIGH', sourceSnippet: text.match(PATTERNS.male_only)?.[0] || '' };
  } else if (new RegExp(PATTERNS.female_only.source, PATTERNS.female_only.flags).test(text)) {
    result.genderAllowed = { value: 'FEMALE', confidence: 'HIGH', sourceSnippet: text.match(PATTERNS.female_only)?.[0] || '' };
  }
  // Default is ALL — no explicit mention usually means both genders

  // --- Physical Standards ---
  const heightMaleMatch = new RegExp(PATTERNS.height_male.source, PATTERNS.height_male.flags).exec(text);
  if (heightMaleMatch) {
    result.minHeightMaleCm = { value: parseInt(heightMaleMatch[1], 10), confidence: 'MEDIUM', sourceSnippet: heightMaleMatch[0] };
  }

  const heightFemaleMatch = new RegExp(PATTERNS.height_female.source, PATTERNS.height_female.flags).exec(text);
  if (heightFemaleMatch) {
    result.minHeightFemaleCm = { value: parseInt(heightFemaleMatch[1], 10), confidence: 'MEDIUM', sourceSnippet: heightFemaleMatch[0] };
  }

  const chestMatch = new RegExp(PATTERNS.chest.source, PATTERNS.chest.flags).exec(text);
  if (chestMatch) {
    result.minChestMaleCm = { value: parseInt(chestMatch[1], 10), confidence: 'MEDIUM', sourceSnippet: chestMatch[0] };
  }

  // --- Percentage ---
  const pctMatch = new RegExp(PATTERNS.percentage.source, PATTERNS.percentage.flags).exec(text);
  if (pctMatch) {
    const pct = parseInt(pctMatch[1], 10);
    if (pct >= 30 && pct <= 100) {
      result.minPercentageRequired = { value: pct, confidence: 'MEDIUM', sourceSnippet: pctMatch[0] };
    }
  }

  // --- Additional Skills ---
  const skills: string[] = [];
  if (new RegExp(PATTERNS.hindi_typing.source, PATTERNS.hindi_typing.flags).test(text)) {
    skills.push('Hindi Typing');
  }
  if (new RegExp(PATTERNS.steno.source, PATTERNS.steno.flags).test(text)) {
    skills.push('Stenographer Certification');
  }
  if (new RegExp(PATTERNS.computer_diploma.source, PATTERNS.computer_diploma.flags).test(text)) {
    skills.push('Computer Diploma (DCA/PGDCA)');
  }
  if (skills.length > 0) {
    result.additionalSkills = { value: skills, confidence: 'MEDIUM', sourceSnippet: skills.join(', ') };
  }

  // --- Extraction Score ---
  const criticalFields = [
    'minAge', 'maxAgeGeneral', 'minQualificationLevel', 'organisation'
  ] as const;
  const allFields = [
    'jobTitle', 'organisation', 'advtNumber', 'totalVacancies',
    'minAge', 'maxAgeGeneral', 'ageCutoffDate',
    'minQualificationLevel',
  ] as const;

  let score = 0;
  const fieldValues: Record<string, any> = result;
  for (const f of allFields) {
    if (fieldValues[f] !== null) score += 12.5;
  }

  result.extractionScore = Math.round(score);

  return result;
}

/**
 * Convert extracted notification fields to the DB-compatible RecruitmentCriteria format.
 * Applies sensible MP defaults for missing fields.
 */
export function extractedToCriteria(extracted: ExtractedNotification): {
  criteria: Record<string, any>;
  warnings: string[];
} {
  const warnings: string[] = [];

  const criteria: Record<string, any> = {
    minAge: extracted.minAge?.value ?? 18,
    maxAgeGeneral: extracted.maxAgeGeneral?.value ?? 33,
    ageCutoffDate: extracted.ageCutoffDate?.value ?? null,
    ageRelaxationScSt: extracted.ageRelaxationScSt?.value ?? 5,
    ageRelaxationObc: extracted.ageRelaxationObc?.value ?? 3,
    ageRelaxationFemale: extracted.ageRelaxationFemale?.value ?? 5,
    ageRelaxationEws: 0,
    minQualificationLevel: extracted.minQualificationLevel?.value ?? null,
    requiresMpDomicile: extracted.requiresMpDomicile?.value ?? false,
    requiresMpEmploymentReg: extracted.requiresMpEmploymentReg?.value ?? true,
    requiresCpct: extracted.requiresCpct?.value ?? false,
    genderAllowed: extracted.genderAllowed?.value ?? 'ALL',
    minHeightMaleCm: extracted.minHeightMaleCm?.value ?? null,
    minHeightFemaleCm: extracted.minHeightFemaleCm?.value ?? null,
    minChestMaleCm: extracted.minChestMaleCm?.value ?? null,
    minPercentageRequired: extracted.minPercentageRequired?.value ?? null,
    additionalSkillsJson: extracted.additionalSkills?.value
      ? JSON.stringify(extracted.additionalSkills.value)
      : null,
  };

  if (!criteria.ageCutoffDate) warnings.push('Age cutoff date could not be extracted. Admin must set manually.');
  if (!criteria.minQualificationLevel) warnings.push('Minimum qualification could not be determined. Admin must set manually.');
  if (extracted.unextractedFields.length > 0) {
    warnings.push(`Fields requiring manual entry: ${extracted.unextractedFields.join(', ')}`);
  }

  return { criteria, warnings };
}
