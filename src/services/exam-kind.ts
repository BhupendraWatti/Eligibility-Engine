/**
 * What a listing is: a job recruitment with vacancies, or a qualifying exam open to everyone who meets its conditions.
 * Eligibility tests (UGC NET, CSIR NET, CTET, state TET/SET) and entrance exams (JEE Main, NEET UG, CUET) have no vacancies:
 * every candidate who clears the cutoff (qualifying marks, percentile or All India Rank) qualifies.
 * See docs/designs/qualifying-exams.md.
 */
export const EXAM_KINDS = ['RECRUITMENT', 'ELIGIBILITY_TEST', 'ENTRANCE_EXAM'] as const;
export type ExamKind = (typeof EXAM_KINDS)[number];

export const isExamKind = (v: unknown): v is ExamKind => typeof v === 'string' && (EXAM_KINDS as readonly string[]).includes(v);

/** True for an eligibility test or entrance exam: no vacancies, candidates qualify by clearing the cutoff. */
export const isQualifyingExam = (kind: string | null | undefined): boolean => kind === 'ELIGIBILITY_TEST' || kind === 'ENTRANCE_EXAM';

export const EXAM_KIND_LABELS: Record<ExamKind, string> = {
  RECRUITMENT: 'Job recruitment',
  ELIGIBILITY_TEST: 'Eligibility test',
  ENTRANCE_EXAM: 'Entrance exam',
};

/** The national sector seeded by migration 0019 for qualifying exams. */
export const NATIONAL_TESTS_SECTOR_ID = 'sec_national_tests';

type VacancyInput = { examKind?: string | null; totalVacancies?: number | null };

/**
 * What to show where a job shows its vacancy count. A qualifying exam has none, so it never shows "0 posts".
 * `fallback` is used for a job whose count is not announced.
 */
export function vacancyLabel(r: VacancyInput, fallback = 'Not announced'): string {
  if (isQualifyingExam(r.examKind)) return r.examKind === 'ENTRANCE_EXAM' ? 'Rank based, no vacancies' : 'Qualifying exam, no vacancies';
  return r.totalVacancies && r.totalVacancies > 0 ? r.totalVacancies.toLocaleString('en-IN') : fallback;
}

/** "1,234 posts" for a job, the exam type for a qualifying exam, null when a job has no count yet. */
export function vacancyPhrase(r: VacancyInput, unit: 'post' | 'vacancy' = 'post'): string | null {
  if (isQualifyingExam(r.examKind)) return EXAM_KIND_LABELS[r.examKind as ExamKind];
  if (!r.totalVacancies || r.totalVacancies <= 0) return null;
  const plural = unit === 'post' ? (r.totalVacancies === 1 ? 'post' : 'posts') : (r.totalVacancies === 1 ? 'vacancy' : 'vacancies');
  return `${r.totalVacancies.toLocaleString('en-IN')} ${plural}`;
}

type AgeInput = { minAge?: number | null; maxAgeGeneral?: number | null; noUpperAgeLimit?: boolean | null };

/** "18-33 yrs", or "17+ yrs (no upper limit)" when the notice states no upper age limit. */
export function ageRangeLabel(c: AgeInput, unit = 'yrs'): string {
  if (c.noUpperAgeLimit) return `${c.minAge ?? 0}+ ${unit} (no upper limit)`;
  return `${c.minAge ?? '?'}-${c.maxAgeGeneral ?? '?'} ${unit}`;
}
