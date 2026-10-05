/** Validation of an extracted record, plus a confidence score the reviewer can sort by. */
import { isAllowedUrl } from './http';
import type { Extracted } from './extract';

export interface Validation { ok: boolean; errors: string[]; warnings: string[]; confidence: number; quotesVerified: number; quotesTotal: number }

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s: string) => ISO.test(s) && !Number.isNaN(Date.parse(s));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '');

/** Fields that carry a fact a reader acts on; each needs evidence when present. */
const KEY_FIELDS: Array<keyof Extracted> = ['title', 'organisationName', 'advertisementNumber', 'totalVacancies', 'applicationStart', 'applicationEnd', 'examDate', 'ageCutoffDate', 'minAge', 'maxAgeGeneral', 'minQualificationLevel', 'vacanciesBreakdown', 'importantDates'];

export function validateExtraction(ex: Extracted, docUrl: string, docText: string | null, now = new Date()): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isAllowedUrl(docUrl)) errors.push('Document is not on an allow-listed official domain.');
  if (!ex.title) errors.push('Title is missing.');
  if (!ex.organisationName) errors.push('Organisation is missing.');

  const dates: Array<[string, string]> = [];
  for (const k of ['applicationStart', 'applicationEnd', 'examDate', 'ageCutoffDate', 'publicationDate'] as const) if (ex[k]) dates.push([k, ex[k]!]);
  for (const d of ex.importantDates ?? []) dates.push([`importantDates.${d.eventType}`, d.eventDate]);
  if (!dates.length) errors.push('No date is stated in the document.');

  const year = now.getUTCFullYear();
  for (const [field, value] of dates) {
    if (!isDate(value)) { errors.push(`${field} "${value}" is not a valid ISO date.`); continue; }
    const y = Number(value.slice(0, 4));
    if (y < year - 1 || y > year + 2) errors.push(`${field} ${value} is outside the plausible range (${year - 1} to ${year + 2}).`);
  }
  if (ex.applicationStart && ex.applicationEnd && isDate(ex.applicationStart) && isDate(ex.applicationEnd) && ex.applicationStart > ex.applicationEnd) {
    errors.push(`Application start ${ex.applicationStart} is after the last date ${ex.applicationEnd}.`);
  }
  if (ex.examDate && ex.applicationStart && isDate(ex.examDate) && isDate(ex.applicationStart) && ex.examDate < ex.applicationStart) {
    errors.push(`Exam date ${ex.examDate} is before the application start ${ex.applicationStart}.`);
  }
  if (ex.examDate && ex.applicationEnd && isDate(ex.examDate) && isDate(ex.applicationEnd) && ex.examDate < ex.applicationEnd) {
    warnings.push('Exam date is before the application closing date.');
  }
  if (ex.minAge !== null && ex.maxAgeGeneral !== null && ex.minAge > ex.maxAgeGeneral) errors.push('Minimum age is above the maximum age.');

  if (ex.vacanciesBreakdown?.length && ex.totalVacancies !== null) {
    const sum = ex.vacanciesBreakdown.reduce((a, v) => a + v.count, 0);
    if (sum !== ex.totalVacancies) errors.push(`Category vacancies add up to ${sum} but the document's total is ${ex.totalVacancies}.`);
  }

  for (const l of ex.officialLinks ?? []) {
    if (!/^https?:\/\//i.test(l.url)) errors.push(`Link "${l.url}" is not an http(s) URL.`);
  }

  // Evidence: every key value needs a quote; for HTML we can prove the quote really is in the page.
  const evidenceFields = new Set(ex.evidence.map(e => e.field));
  const present = KEY_FIELDS.filter(f => ex[f] !== null && ex[f] !== undefined);
  const covered = present.filter(f => evidenceFields.has(f as string));
  for (const f of present) if (!evidenceFields.has(f as string)) warnings.push(`No quoted evidence for ${String(f)}.`);
  let verified = 0;
  if (docText !== null) {
    const haystack = norm(docText);
    for (const e of ex.evidence) {
      if (haystack.includes(norm(e.quote))) verified++;
      else warnings.push(`Quote for ${e.field} was not found in the page text.`);
    }
  }
  const quotesTotal = ex.evidence.length;

  const base = ex.overallConfidence ?? 0.5;
  const coverage = present.length ? covered.length / present.length : 0;
  // HTML: quotes are checked against the page. PDF: quotes cannot be checked here, so confidence is capped at 0.95.
  const proof = docText !== null ? (quotesTotal ? verified / quotesTotal : 0) : 0.95;
  const confidence = Math.round(Math.min(1, base) * (0.5 + 0.5 * coverage) * proof * 100) / 100;

  return { ok: errors.length === 0, errors, warnings, confidence, quotesVerified: verified, quotesTotal };
}
